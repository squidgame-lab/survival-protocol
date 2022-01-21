// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;

import './libraries/SafeMath.sol';
import './libraries/TransferHelper.sol';
import './modules/ReentrancyGuard.sol';
import './modules/Configable.sol';
import './modules/Initializable.sol';
import './interfaces/IShareToken.sol';
import './interfaces/IERC20.sol';

import 'hardhat/console.sol';

contract TokenExchange is Configable, ReentrancyGuard, Initializable {
    using SafeMath for uint256;

    uint256 public duration; // block number
    uint256 public exchangeRate; // 1e18
    uint256 public totalSupply;
    address public lockToken;
    address public releaseToken;
    address public lockReceiver;
    
    struct Lock {
        uint256 lockedAmount;
        uint256 startBlockNum;
        uint256 accReleasedPerBlock;
        uint256 debt;
    }

    mapping(address => Lock) public userLocked;

    event Configure(address indexed user, address lockToken, address releaseToken, address lockReceiver, uint256 duration, uint256 exchangeRate);
    event CreateLock(address indexed user, address lockToken, uint256 amount);
    event Claim(address indexed user, address releaseToken, uint256 amount);

    function initialize(address _lockToken, address _releaseToken, address _lockReceiver, uint256 _duration, uint256 _exchangeRate) external initializer {
        owner = msg.sender;
        _configure(_lockToken, _releaseToken, _lockReceiver, _duration, _exchangeRate);
    }

    function configure(address _lockToken, address _releaseToken, address _lockReceiver, uint256 _duration, uint256 _exchangeRate) external onlyAdmin {
        _configure(_lockToken, _releaseToken, _lockReceiver, _duration, _exchangeRate);
        emit Configure(msg.sender, _lockToken, _releaseToken, _lockReceiver, _duration, _exchangeRate);
    }

    function lock(address _account, uint256 _amount) external payable nonReentrant {
        require(_account != address(0), 'TokenExchange: INVALID_ACCOUNT');
        require(_amount > 0, 'TokenExchange: INVALID_AMOUNT'); 

        if (lockToken == address(0)) {
            require(_amount == msg.value, 'TokenExchange: INVALID_AMOUNT');
            TransferHelper.safeTransferETH(lockReceiver, _amount);
        } else {
            require(IERC20(lockToken).balanceOf(msg.sender) >= _amount, 'TokenExchange: INSUFFICIENT_BALANCE');
            TransferHelper.safeTransferFrom(lockToken, msg.sender, address(this), _amount);
        }        

        Lock memory lockInfo = userLocked[_account];
        if (lockInfo.lockedAmount == 0) {
            userLocked[_account] = Lock({
                lockedAmount: _amount,
                startBlockNum: block.number,
                accReleasedPerBlock: _amount.div(duration),
                debt: 0
            });
        } else {
            _claim(_account);
            uint256 balance = userLocked[_account].lockedAmount.sub(userLocked[_account].debt);
            userLocked[_account].lockedAmount = balance.add(_amount);
            userLocked[_account].startBlockNum = block.number;
            userLocked[_account].accReleasedPerBlock = userLocked[_account].lockedAmount.div(duration);
            userLocked[_account].debt = 0;
        }

        totalSupply = totalSupply.add(_amount);

        emit CreateLock(_account, lockToken, _amount);
    }

    function claim() external {
        uint256 pendingAmount = _claim(msg.sender);
        emit Claim(msg.sender, releaseToken, pendingAmount);
    }

    function getPendingAmount(address _account) public view returns (uint256 _amount) {
        _amount = _getLockPendingAmount(_account).mul(exchangeRate).div(1e18);
    }

    function getLockInfo(address _account) external view returns (uint256 lockedAmount, uint256 accReleasedPerBlock, uint256 debt, uint256 pendingAmount) {
        return (
            userLocked[_account].lockedAmount,
            userLocked[_account].accReleasedPerBlock,
            userLocked[_account].debt,
            getPendingAmount(_account)
        );
    } 

    function _configure(address _lockToken, address _releaseToken, address _lockReceiver, uint256 _duration, uint256 _exchangeRate) internal {
        lockToken = _lockToken;
        releaseToken = _releaseToken;
        lockReceiver = _lockReceiver;
        duration = _duration;
        exchangeRate = _exchangeRate;
    }

    function _claim(address _account) internal returns (uint256 pendingAmount) {
        uint256 lockPendingAmount = _getLockPendingAmount(_account);
        pendingAmount = lockPendingAmount.mul(exchangeRate).div(1e18);
        if (pendingAmount == 0) return pendingAmount;
        IShareToken(releaseToken).mint(_account, pendingAmount);
        userLocked[_account].debt = userLocked[_account].debt.add(lockPendingAmount);
    }

    function _getLockPendingAmount(address _account) internal view returns (uint256 _amount) {
        Lock memory lockInfo = userLocked[_account];
        if (block.number > lockInfo.startBlockNum.add(duration)) {
            return lockInfo.lockedAmount.sub(lockInfo.debt);
        }
        _amount = block.number.sub(lockInfo.startBlockNum).mul(lockInfo.accReleasedPerBlock).sub(lockInfo.debt);
        return _amount;
    }
}