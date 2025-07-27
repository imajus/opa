const { buildModule } = require('@nomicfoundation/hardhat-ignition/modules');

module.exports = buildModule('AllExtensionsModule', (m) => {
  // Deploy all three official 1inch extension calculators
  const chainlinkCalculator = m.contract('ChainlinkCalculator');
  const dutchAuctionCalculator = m.contract('DutchAuctionCalculator');
  const rangeAmountCalculator = m.contract('RangeAmountCalculator');

  // Configuration parameters for Gas Station
  const takerFeeBps = m.getParameter('takerFeeBps', 100); // 1% taker fee (100 basis points)
  const gasStipend = m.getParameter('gasStipend', 150000); // 150k gas stipend

  // External contract addresses (these would be network-specific)
  const aggregationRouter = m.getParameter(
    'aggregationRouter',
    '0x111111125421cA6dc452d289314280a0f8842A65'
  ); // 1inch Router v6 on mainnet
  const weth = m.getParameter(
    'weth',
    '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
  ); // WETH on mainnet
  const aavePool = m.getParameter(
    'aavePool',
    '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2'
  ); // Aave v3 Pool on mainnet

  // Deploy FlashLoanAdapter
  const flashLoanAdapter = m.contract('FlashLoanAdapter');

  // Deploy Gas Station extension
  const gasStation = m.contract('GasStation', [
    takerFeeBps,
    gasStipend,
    aggregationRouter,
    weth,
    aavePool,
    flashLoanAdapter,
  ]);

  return {
    chainlinkCalculator,
    dutchAuctionCalculator,
    rangeAmountCalculator,
    gasStation,
    flashLoanAdapter,
  };
});
