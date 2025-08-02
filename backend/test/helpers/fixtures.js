const { ethers } = require('hardhat');
const { ether, units } = require('./utils');

async function wrapToken(token) {
  const address = await token.getAddress();
  const decimals = await token.decimals();
  return {
    address,
    decimals,
    contract: token,
    // getAddress: () => token.getAddress(),
    balance: (account) => token.balanceOf(account),
    mint: (account, value) => token.mint(account, units(value, decimals)),
    approve: (owner, spender, value) =>
      token.connect(owner).approve(spender, units(value, decimals)),
    parseAmount: (value) => units(value, decimals),
    formatAmount: (value) => ethers.formatUnits(value, decimals),
  };
}

async function wrapWrapperToken(token) {
  const address = await token.getAddress();
  const decimals = await token.decimals();
  return {
    address,
    decimals,
    contract: token,
    // getAddress: () => token.getAddress(),
    balance: (account) => token.balanceOf(account),
    mint: (account, value) =>
      token.connect(account).deposit({ value: ether(value) }),
    approve: (owner, spender, value) =>
      token.connect(owner).approve(spender, ether(value)),
    parseAmount: (value) => ether(value),
    formatAmount: (value) => ethers.formatEther(value),
  };
}

async function deploySwapTokens() {
  const [deployer] = await ethers.getSigners();
  const LimitOrderProtocol = await ethers.getContractFactory(
    'LimitOrderProtocol'
  );
  const TokenMock = await ethers.getContractFactory('TokenMock');
  const TokenCustomDecimalsMock = await ethers.getContractFactory(
    'TokenCustomDecimalsMock'
  );
  const PermitMock = await ethers.getContractFactory('ERC20PermitMock');
  const WrappedTokenMock = await ethers.getContractFactory('WrappedTokenMock');
  // Deploy tokens
  // const dai = await TokenMock.deploy('DAI', 'DAI');
  const dai = await PermitMock.deploy(
    'DAI',
    'DAI',
    deployer.address,
    ether('1000')
  );
  const inch = await TokenMock.deploy('1INCH', '1INCH');
  const usdc = await TokenCustomDecimalsMock.deploy('USDC', 'USDC', '0', 6);
  const usdt = await TokenCustomDecimalsMock.deploy('USDT', 'USDT', '0', 6);
  const weth = await WrappedTokenMock.deploy('WETH', 'WETH');
  // Wait for token deployments
  await Promise.all([
    dai.waitForDeployment(),
    usdc.waitForDeployment(),
    usdt.waitForDeployment(),
    inch.waitForDeployment(),
    weth.waitForDeployment(),
  ]);
  // LimitOrderProtocol
  const swap = await LimitOrderProtocol.deploy(weth);
  await swap.waitForDeployment();
  return {
    swap,
    dai: await wrapToken(dai),
    weth: await wrapWrapperToken(weth),
    inch: await wrapToken(inch),
    usdc: await wrapToken(usdc),
    usdt: await wrapToken(usdt),
  };
}

// async function deploySwap() {
//   const LimitOrderProtocol = await ethers.getContractFactory(
//     'LimitOrderProtocol'
//   );
//   const swap = await LimitOrderProtocol.deploy(constants.ZERO_ADDRESS);
//   await swap.waitForDeployment();
//   return { swap };
// }

async function deployArbitraryPredicate() {
  const ArbitraryPredicateMock = await ethers.getContractFactory(
    'ArbitraryPredicateMock'
  );
  const arbitraryPredicate = await ArbitraryPredicateMock.deploy();
  await arbitraryPredicate.waitForDeployment();
  return { arbitraryPredicate };
}

async function deploySeriesEpochManager() {
  const SeriesEpochManager = await ethers.getContractFactory(
    'SeriesEpochManager'
  );
  const seriesEpochManager = await SeriesEpochManager.deploy();
  await seriesEpochManager.waitForDeployment();
  return { seriesEpochManager };
}

async function deployGasStationWithMocks() {
  const [deployer] = await ethers.getSigners();

  // Deploy mock contracts for testing
  const MockAavePool = await ethers.getContractFactory('MockAavePool');
  const mockAavePool = await MockAavePool.deploy();
  await mockAavePool.waitForDeployment();

  // Deploy basic tokens for testing
  const TokenMock = await ethers.getContractFactory('TokenMock');
  const WrappedTokenMock = await ethers.getContractFactory('WrappedTokenMock');
  const PermitMock = await ethers.getContractFactory('ERC20PermitMock');

  const usdc = await TokenMock.deploy('USDC', 'USDC');
  const dai = await PermitMock.deploy(
    'DAI',
    'DAI',
    deployer.address,
    ether('1000')
  );
  const weth = await WrappedTokenMock.deploy('WETH', 'WETH');

  await Promise.all([
    usdc.waitForDeployment(),
    dai.waitForDeployment(),
    weth.waitForDeployment(),
  ]);

  // Gas Station configuration
  const takerFeeBps = 100; // 1%
  const gasStipend = 150000; // 150k gas

  // Deploy mock Uniswap V3 Factory
  const MockUniswapFactory = await ethers.getContractFactory(
    'MockUniswapFactory'
  );
  const mockUniswapFactory = await MockUniswapFactory.deploy();
  await mockUniswapFactory.waitForDeployment();

  // Deploy mock Uniswap V3 Swap Router
  const MockSwapRouter = await ethers.getContractFactory('MockSwapRouter');
  const mockSwapRouter = await MockSwapRouter.deploy();
  await mockSwapRouter.waitForDeployment();

  // Deploy Gas Station
  const GasStation = await ethers.getContractFactory('GasStation');
  const gasStation = await GasStation.deploy(
    takerFeeBps,
    gasStipend,
    await mockUniswapFactory.getAddress(),
    await mockSwapRouter.getAddress(),
    await weth.getAddress(),
    await mockAavePool.getAddress()
  );
  await gasStation.waitForDeployment();

  return {
    gasStation,
    mockAavePool,
    mockUniswapFactory,
    mockSwapRouter,
    tokens: {
      usdc: await wrapToken(usdc),
      dai: await wrapToken(dai),
      weth: await wrapWrapperToken(weth),
    },
    config: {
      takerFeeBps,
      gasStipend,
      mockUniswapFactory: await mockUniswapFactory.getAddress(),
      mockSwapRouter: await mockSwapRouter.getAddress(),
    },
  };
}

async function deployGasStationIntegration() {
  // Deploy full integration setup with LimitOrderProtocol
  const swapTokensFixture = await deploySwapTokens();
  const gasStationFixture = await deployGasStationWithMocks();

  return {
    ...swapTokensFixture,
    ...gasStationFixture,
  };
}

module.exports = {
  deploySwapTokens,
  deploySeriesEpochManager,
  deployArbitraryPredicate,
  deployGasStationWithMocks,
  deployGasStationIntegration,
};
