import { BigNumber, Wallet } from 'ethers'
import { ethers, network } from 'hardhat'
import { TestToken } from '../../typechain/TestToken'
import { GameTicket } from '../../typechain/GameTicket'
import { GameConfig } from '../../typechain/GameConfig'
import { Survival } from '../../typechain/Survival'
import { TokenExchange } from '../../typechain/TokenExchange'
import { GamePoolActivity } from '../../typechain/GamePoolActivity'
import { Fixture } from 'ethereum-waffle'
export const bigNumber18 = BigNumber.from("1000000000000000000")  // 1e18
export const bigNumber17 = BigNumber.from("100000000000000000")  //1e17
export const dateNow = BigNumber.from("1636429275") // 2021-11-09 11:41:15
export const deadline = BigNumber.from('1893427200') // 2030

export async function getBlockNumber() {
    const blockNumber = await ethers.provider.getBlockNumber()
    console.debug("Current block number: " + blockNumber);
    return blockNumber;
}

interface TestTokensFixture {
    buyToken: TestToken
}

async function testTokensFixture(): Promise<TestTokensFixture> {
    let testTokenFactory = await ethers.getContractFactory('TestToken')
    let buyToken = (await testTokenFactory.deploy()) as TestToken
    await buyToken.initialize();
    return { buyToken }
}

interface SurvivalFixture {
    survival: Survival
}

async function survivalFixture(): Promise<SurvivalFixture> {
    let survivalFactory = await ethers.getContractFactory('Survival')
    let survival = (await survivalFactory.deploy()) as Survival
    await survival.initialize("survival", "surv", BigNumber.from(18), BigNumber.from('10000000000000000000000000000'));
    return { survival }
}

interface TokenExchangeFixture {
    lockToken: TestToken
    releaseToken: Survival
    tokenExchange: TokenExchange
}

export const tokenExchangeFixture: Fixture<TokenExchangeFixture> = async function ([wallet]: Wallet[]): Promise<TokenExchangeFixture> {
    let { buyToken: lockToken } = await testTokensFixture();
    let { survival: releaseToken } = await survivalFixture();

    let tokenExchangeFactory = await ethers.getContractFactory('TokenExchange')
    let tokenExchange = (await tokenExchangeFactory.deploy()) as TokenExchange
    await tokenExchange.initialize(lockToken.address, releaseToken.address, ethers.constants.AddressZero, BigNumber.from(5), bigNumber17.mul(5))

    await lockToken.mint(wallet.address, bigNumber18.mul(10000));
    return { lockToken, releaseToken, tokenExchange }
}

interface GameTicketFixture {
    buyToken: TestToken
    gameToken: Survival
    gameTicket: GameTicket
}

export const gameTicketFixture: Fixture<GameTicketFixture> = async function (): Promise<GameTicketFixture> {
    return await _gameTicketFixture();
}

async function _gameTicketFixture(): Promise<GameTicketFixture> {
    const { buyToken: buyToken } = await testTokensFixture();
    const { survival: gameToken } = await survivalFixture();

    const gameConfigFactory = await ethers.getContractFactory('GameConfig');
    const gameTicketFactory = await ethers.getContractFactory('GameTicket');

    const gameConfig = (await gameConfigFactory.deploy()) as GameConfig;
    await gameConfig.initialize();

    const gameTicket = (await gameTicketFactory.deploy()) as GameTicket;
    await gameTicket.initialize(buyToken.address, gameToken.address, bigNumber18, bigNumber18.mul(10), bigNumber18.mul(100));
    await gameTicket.setupConfig(gameConfig.address);

    return { buyToken, gameToken, gameTicket };
}

interface GamePoolActivityFixture extends GameTicketFixture {
    gamePoolActivity: GamePoolActivity
}

export const gamePoolActivityFxiture: Fixture<GamePoolActivityFixture> = async function(): Promise<GamePoolActivityFixture> {
    let { buyToken, gameToken, gameTicket } = await _gameTicketFixture();

    let gamePoolActivityFactory = await ethers.getContractFactory('GamePoolActivity')
    let gamePoolActivity = (await gamePoolActivityFactory.deploy()) as GamePoolActivity;
    await gamePoolActivity.initialize();
    await gamePoolActivity.configure(gameTicket.address, gameTicket.address, ethers.constants.AddressZero, BigNumber.from(5), BigNumber.from(5), true, true);

    return { buyToken, gameToken, gameTicket, gamePoolActivity };
}