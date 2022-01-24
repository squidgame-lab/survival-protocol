import { Wallet, BigNumber } from 'ethers'
import { ethers, waffle } from 'hardhat'
import { TestToken } from '../typechain/TestToken'
import { Survival } from '../typechain/Survival'
import { GameTicket } from '../typechain/GameTicket'
import { expect } from './shared/expect'
import { gameTicketFixture, bigNumber18 } from './shared/fixtures'

const createFixtureLoader = waffle.createFixtureLoader

describe('GameTicket', async () => {
    let wallet: Wallet, other: Wallet;

    let buyToken: TestToken
    let gameToken: Survival
    let gameTicket: GameTicket

    let loadFixTure: ReturnType<typeof createFixtureLoader>;

    before('create fixture loader', async () => {
        [wallet, other] = await (ethers as any).getSigners()
        loadFixTure = createFixtureLoader([wallet, other])
    })

    beforeEach('deploy GameTicket', async () => {
        ; ({ buyToken, gameToken, gameTicket } = await loadFixTure(gameTicketFixture));
        await buyToken.mint(wallet.address, bigNumber18.mul(10000));

        await gameToken.increaseFund(wallet.address, bigNumber18.mul(100000000));
        await gameToken.mint(wallet.address, bigNumber18.mul(10000));;
    })

    describe('#join', async () => {
        beforeEach('approve gameToken to gameTicket', async () => {
            await gameToken.approve(gameTicket.address, ethers.constants.MaxUint256);
        })

        it('success for join', async () => {
            expect(await gameTicket.status(wallet.address)).to.equal(false);
            await gameTicket.join();
            expect(await gameTicket.status(wallet.address)).to.equal(true);
        })
    })

    describe('#buy', async () => {
        beforeEach('approve buyToken and gameToken to gameTicket', async () => {
            await buyToken.approve(gameTicket.address, ethers.constants.MaxUint256);
            await gameToken.approve(gameTicket.address, ethers.constants.MaxUint256);
        })

        it('fails for INSUFFICIENT_BALANCE', async () => {
            await expect(gameTicket.connect(other).buy(other.address, BigNumber.from(10))).to.revertedWith('GameTicket: INSUFFICIENT_BALANCE');
        })

        it('success for buy with buyToken and gameToken', async () => {
            let ticketAmount = BigNumber.from(2)
            await gameTicket.buy(wallet.address, ticketAmount);
            expect(await gameTicket.tickets(wallet.address)).to.eq(ticketAmount);
            expect(await gameTicket.total()).to.eq(ticketAmount);
        })

        it('success for buy with gameToken', async () => {
            await gameTicket.setUnit(BigNumber.from(0), bigNumber18.mul(10))
            let ticketAmount = BigNumber.from(2)
            let gameTokenBalanceBefore = await gameToken.balanceOf(wallet.address)
            await gameTicket.buy(wallet.address, ticketAmount);
            let gameTokenBalanceAfter = await gameToken.balanceOf(wallet.address)
            expect(gameTokenBalanceBefore.sub(gameTokenBalanceAfter)).to.eq(bigNumber18.mul(20))
            expect(await gameTicket.tickets(wallet.address)).to.eq(ticketAmount);
            expect(await gameTicket.total()).to.eq(ticketAmount);
        })

        it('success for buy event', async () => {
            let ticketAmount = BigNumber.from(2)
            expect(await gameTicket.buy(wallet.address, ticketAmount)).to.emit(gameTicket, 'Bought').withArgs(wallet.address, wallet.address, ticketAmount);
        })
    })

    describe('#withdraw', async () => {
        describe('fails cases', async () => {
            it('fails for caller not rewardPool', async () => {
                await expect(gameTicket.withdraw(0)).to.revertedWith('GameTicket: FORBIDDEN');
            })

            it('false for balance not enough', async () => {
                await gameTicket.setRewardPool(wallet.address);
                await expect(gameTicket.withdraw(bigNumber18)).to.revertedWith('GameTicket: INSUFFICIENT_BALANCE');
            })
        })

        describe('success cases', async () => {
            beforeEach('approve buyToken and gameToken to gameTicket', async () => {
                await buyToken.approve(gameTicket.address, ethers.constants.MaxUint256);
                await gameToken.approve(gameTicket.address, ethers.constants.MaxUint256);
            })

            beforeEach('buy', async () => {
                await gameTicket.setRewardPool(wallet.address);
                await gameTicket.buy(wallet.address, BigNumber.from(2));
            })

            it('success for zero fee', async () => {
                await gameTicket.withdraw(bigNumber18.mul(2));
                expect(await buyToken.balanceOf(wallet.address)).to.eq(bigNumber18.mul(10000));
            })

            it('success for 1% feeRate', async () => {
                await gameTicket.setFeeRate(100);
                let pool = await gameTicket.rewardPool();
                expect(await gameTicket.withdraw(bigNumber18.mul(2))).to.emit(gameTicket, 'Withdrawed').withArgs(pool, '1980000000000000000', wallet.address, '20000000000000000');
            })
        })
    })
})