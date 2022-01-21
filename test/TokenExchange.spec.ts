import { Wallet, BigNumber } from 'ethers'
import { ethers, network, waffle } from 'hardhat'
import { TestToken } from '../typechain/TestToken'
import { Survival } from '../typechain/Survival'
import { TokenExchange } from '../typechain/TokenExchange'
import { expect } from './shared/expect'
import { tokenExchangeFixture, bigNumber18 } from './shared/fixtures'

const createFixtureLoader = waffle.createFixtureLoader

describe('TokenExchange', async () => {
    let wallet: Wallet, other: Wallet;

    let lockToken: TestToken
    let releaseToken: Survival
    let tokenExchange: TokenExchange

    let loadFixTure: ReturnType<typeof createFixtureLoader>;

    before('create fixture loader', async () => {
        [wallet, other] = await (ethers as any).getSigners()
        loadFixTure = createFixtureLoader([wallet])
    })

    beforeEach('deploy TokenExchange', async () => {
        ; ({ lockToken, releaseToken, tokenExchange } = await loadFixTure(tokenExchangeFixture));
        await lockToken.mint(other.address, bigNumber18.mul(10000))
        await releaseToken.increaseFunds([wallet.address, tokenExchange.address], [bigNumber18.mul(100000000), bigNumber18.mul(100000000)])
        await releaseToken.mint(other.address, bigNumber18.mul(10000))
        await lockToken.connect(other).approve(tokenExchange.address, ethers.constants.MaxUint256)
    })

    describe('#lock', async () => {
        it('success for first lock', async () => {
            await tokenExchange.connect(other).lock(other.address, bigNumber18.mul(100))
            let lockInfo = await tokenExchange.getLockInfo(other.address)
            expect(lockInfo.lockedAmount).to.eq(bigNumber18.mul(100))
            expect(lockInfo.debt).to.eq(0)
            expect(lockInfo.accReleasedPerBlock).to.eq(bigNumber18.mul(20))
        })

        it('success for lock again over time', async () => {
            // first lock 
            await tokenExchange.connect(other).lock(other.address, bigNumber18.mul(100))
            await network.provider.send('evm_mine')
            await network.provider.send('evm_mine')
            await network.provider.send('evm_mine')
            await network.provider.send('evm_mine')
            await network.provider.send('evm_mine')
            
            // second lock
            await tokenExchange.connect(other).lock(other.address, bigNumber18.mul(100))
            let lockInfo = await tokenExchange.getLockInfo(other.address)
            expect(lockInfo.lockedAmount).to.eq(bigNumber18.mul(100))
            expect(lockInfo.debt).to.eq(0)
            expect(lockInfo.accReleasedPerBlock).to.eq(bigNumber18.mul(20))
        })

        it('success for lock again in time', async () => {
            // first lock 
            await tokenExchange.connect(other).lock(other.address, bigNumber18.mul(100))
            await network.provider.send('evm_mine')
            await network.provider.send('evm_mine')
            // second lock
            await tokenExchange.connect(other).lock(other.address, bigNumber18.mul(100))
            let lockInfo = await tokenExchange.getLockInfo(other.address)
            expect(lockInfo.lockedAmount).to.eq(bigNumber18.mul(140))
            expect(lockInfo.debt).to.eq(0)
            expect(lockInfo.accReleasedPerBlock).to.eq(bigNumber18.mul(28))
        })

        it('gas used', async () => {
            // first lock 
            let tx = await tokenExchange.connect(other).lock(other.address, bigNumber18.mul(100))
            let receipt = await tx.wait()
            expect(receipt.gasUsed).to.eq(16_2553)
        })
    })

    describe('#getPendingAmount', async () => {
        beforeEach('create lock', async () => {
            await tokenExchange.connect(other).lock(other.address, bigNumber18.mul(100))
        })

        it('success for only lock', async () => {
            await network.provider.send('evm_mine')
            await network.provider.send('evm_mine')
            expect(await tokenExchange.getPendingAmount(other.address)).to.eq(bigNumber18.mul(20))
        })

        it('success for lock and claim', async () => {
            await network.provider.send('evm_mine')
            await network.provider.send('evm_mine')
            await tokenExchange.connect(other).claim()
            await network.provider.send('evm_mine')
            expect(await tokenExchange.getPendingAmount(other.address)).to.eq(bigNumber18.mul(10))
            let lockInfo = await tokenExchange.getLockInfo(other.address)
            expect(lockInfo.debt).to.eq(bigNumber18.mul(60))
        })
    })

    describe('#claim', async () => {
        beforeEach('create lock', async () => {
            await tokenExchange.connect(other).lock(other.address, bigNumber18.mul(100))
            await network.provider.send('evm_mine')
            await network.provider.send('evm_mine')
        })

        it('success for claim', async () => {
            await network.provider.send('evm_mine')
            await network.provider.send('evm_mine')
            expect(await tokenExchange.connect(other).claim()).to.emit(tokenExchange, 'Claim').withArgs(other.address, releaseToken.address, bigNumber18.mul(50))
        })

        it('success for repetitive claim', async () => {
            await network.provider.send('evm_mine')
            await network.provider.send('evm_mine')
            await tokenExchange.connect(other).claim()
            expect(await tokenExchange.connect(other).claim()).to.emit(tokenExchange, 'Claim').withArgs(other.address, releaseToken.address, BigNumber.from(0))
        })

        it('gas used', async () => {
            let tx = await tokenExchange.connect(other).claim()
            let receipt = await tx.wait()
            expect(receipt.gasUsed).to.eq(7_9676)
        })
    })
})