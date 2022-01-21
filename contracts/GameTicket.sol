// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import './libraries/SafeMath.sol';
import './interfaces/IERC20.sol';
import './libraries/TransferHelper.sol';
import './modules/ReentrancyGuard.sol';
import './modules/Pausable.sol';
import './modules/Configable.sol';
import './modules/Initializable.sol';
import './interfaces/IRewardSource.sol';

contract GameTicket is IRewardSource, Configable, Pausable, ReentrancyGuard, Initializable {
    using SafeMath for uint;
    address public override buyToken;
    address public rewardPool;
    uint public feeRate;
    uint public unit;
    uint public total;
    mapping(address => uint) public override tickets;
    mapping(address => bool) public status;
    address public gameToken;
    uint public gameTokenUnit;
    uint public joinAmount;
    
    event Joined(address indexed _user);
    event FeeRateChanged(uint indexed _old, uint indexed _new);
    event RewardPoolChanged(address indexed _old, address indexed _new);
    event Bought(address indexed _from, address indexed _to, uint _amount);

    receive() external payable {
    }

    function initialize(address _buyToken, address _gameToken, uint _buyTokenUnit, uint _gameTokenUnit, uint _joinAmount) external initializer {
        require(_buyToken != address(0), 'GameTicket: ZERO_ADDRESS');
        owner = msg.sender;
        buyToken = _buyToken;
        gameToken = _gameToken;
        unit = _buyTokenUnit;
        gameTokenUnit = _gameTokenUnit;
        joinAmount = _joinAmount;
    }

    function setUnit(uint _buyTokenUnit, uint _gameTokenUnit) external onlyAdmin {
        require(_buyTokenUnit != unit || _gameTokenUnit != gameTokenUnit, 'GameTicket: NO_CHANGE');
        unit = _buyTokenUnit;
        gameTokenUnit = _gameTokenUnit;
    }

    function setJoinAmount(uint _joinAmount) external onlyAdmin {
        require(_joinAmount != joinAmount, 'GameTicket: NO_CHANGE');
        joinAmount = _joinAmount;
    }

    function setFeeRate(uint _rate) external onlyAdmin {
        require(_rate != feeRate, 'GameTicket: NO_CHANGE');
        require(_rate <= 10000, 'GameTicket: INVALID_VALUE');
        emit FeeRateChanged(feeRate, _rate);
        feeRate = _rate;
    }

    function setRewardPool(address _pool) external onlyDev {
        require(_pool != rewardPool, 'GameTicket: NO_CHANGE');
        emit RewardPoolChanged(rewardPool, _pool);
        rewardPool = _pool;
    }

    function join() external returns (bool) {
        require(!status[msg.sender], 'GameTicket: JOINED');
        TransferHelper.safeTransferFrom(gameToken, msg.sender, address(0), joinAmount);
        status[msg.sender] = true;
        emit Joined(msg.sender);
        return true;
    }

    function _buy(address _to, uint _amount) internal returns (bool) {
        require(_amount > 0, 'GameTicket: ZERO');
        tickets[_to] = tickets[_to].add(_amount);
        total = total.add(_amount);
        emit Bought(msg.sender, _to, _amount);
        return true;
    }

    function buy(address _to, uint _amount) external payable nonReentrant whenNotPaused returns (bool) {
        if (unit > 0) {
            if (buyToken == address(0)) {
                require(unit.mul(_amount) == msg.value, 'GameTicket: INVALID_VALUE');
            } else {
                require(IERC20(buyToken).balanceOf(msg.sender) >= unit.mul(_amount), 'GameTicket: INSUFFICIENT_BALANCE');
                TransferHelper.safeTransferFrom(buyToken, msg.sender, address(this), unit.mul(_amount));
            }
        }

        if (gameTokenUnit > 0) {
            require(IERC20(gameToken).balanceOf(msg.sender) >= gameTokenUnit.mul(_amount), 'GameTicket: GAME_TOKEN_INSUFFICIENT_BALANCE');
            TransferHelper.safeTransferFrom(gameToken, msg.sender, address(0), gameTokenUnit.mul(_amount));
        }

        return _buy(_to, _amount);
    }

    function buyBatch(address[] calldata _tos, uint[] calldata _amounts) external payable nonReentrant whenNotPaused returns (bool) {
        require(_tos.length == _amounts.length, 'GameTicket: INVALID_PARAM');

        uint _buyTokenTotal;
        uint _gameTokenTotal;

        for(uint i; i < _amounts.length; i++) {
            if (unit > 0) _buyTokenTotal = _buyTokenTotal.add(_amounts[i].mul(unit));
            if (gameTokenUnit > 0) _gameTokenTotal = _gameTokenTotal.add(_amounts[i].mul(gameTokenUnit));
            _buy(_tos[i], _amounts[i]);
        }

        if (buyToken == address(0)) {
            require(_buyTokenTotal == msg.value, 'GameTicket: INVALID_TOTALVALUE');
        } else {
            require(IERC20(buyToken).balanceOf(msg.sender) >= _buyTokenTotal, 'GameTicket: INSUFFICIENT_BALANCE');
            TransferHelper.safeTransferFrom(buyToken, msg.sender, address(this), _buyTokenTotal);
        }

        if(_gameTokenTotal > 0) {
            require(IERC20(gameToken).balanceOf(msg.sender) >= _gameTokenTotal, 'GameTicket: GAME_TOKEN_INSUFFICIENT_BALANCE');
            TransferHelper.safeTransferFrom(gameToken, msg.sender, address(0), _gameTokenTotal);
        }

        return true;
    }

    function withdraw(uint _value) external virtual override nonReentrant whenNotPaused returns (uint reward, uint fee) {
        require(msg.sender == rewardPool, 'GameTicket: FORBIDDEN');
        require(_value > 0, 'GameTicket: ZERO');
        require(getBalance() >= _value, 'GameTicket: INSUFFICIENT_BALANCE');

        reward = _value;
        if(feeRate > 0) {
            fee = _value.mul(feeRate).div(10000);
            reward = _value.sub(fee);
        }
        if (buyToken == address(0)) {
            if(fee > 0) TransferHelper.safeTransferETH(team(), fee);
            if(reward > 0) TransferHelper.safeTransferETH(rewardPool, reward);
        } else {
            if(fee > 0) TransferHelper.safeTransfer(buyToken, team(), fee);
            if(reward > 0) TransferHelper.safeTransfer(buyToken, rewardPool, reward);
        }
        emit Withdrawed(rewardPool, reward, team(), fee);
    }

    function getBalance() public view virtual override returns (uint) {
        uint balance = address(this).balance;
        if(buyToken != address(0)) {
            balance = IERC20(buyToken).balanceOf(address(this));
        }
        return balance;
    }
}
