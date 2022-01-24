import { Wallet, BigNumber } from 'ethers'
import { ethers, waffle } from 'hardhat'
import { TestToken } from '../typechain/TestToken'
import { Survival } from '../typechain/Survival'
import { GameTicket } from '../typechain/GameTicket'
import { GamePoolActivity } from '../typechain/GamePoolActivity'
import { expect } from './shared/expect'
import { gameTicketFixture, bigNumber18 } from './shared/fixtures'

const createFixtureLoader = waffle.createFixtureLoader

describe('GameTicket', async () => {
    let wallet: Wallet, other: Wallet;

    let buyToken: TestToken
    let gameToken: Survival
    let gameTicket: GameTicket
    let gamePoolActivity: GamePoolActivity

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

})