const { ethers } = require('hardhat');
const { ether, units } = require('./utils');

async function wrapToken(token) {
  const decimals = await token.decimals();
  return {
    contract: token,
    getAddress: () => token.getAddress(),
    mint: (account, value) => token.mint(account, units(value, decimals)),
    approve: (owner, spender, value) =>
      token.connect(owner).approve(spender, units(value, decimals)),
    parseAmount: (value) => units(value, decimals),
  };
}

async function wrapWrapperToken(token) {
  return {
    contract: token,
    getAddress: () => token.getAddress(),
    mint: (account, value) =>
      token.connect(account).deposit({ value: ether(value) }),
    approve: (owner, spender, value) =>
      token.connect(owner).approve(spender, ether(value)),
    parseAmount: (value) => ether(value),
  };
}

async function deploySwapTokens() {
  const LimitOrderProtocol = await ethers.getContractFactory(
    'LimitOrderProtocol'
  );
  const TokenMock = await ethers.getContractFactory('TokenMock');
  const TokenCustomDecimalsMock = await ethers.getContractFactory(
    'TokenCustomDecimalsMock'
  );
  const WrappedTokenMock = await ethers.getContractFactory('WrappedTokenMock');
  // Deploy tokens
  const dai = await TokenMock.deploy('DAI', 'DAI');
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

module.exports = {
  deploySwapTokens,
  deploySeriesEpochManager,
  deployArbitraryPredicate,
};
