const { buildModule } = require('@nomicfoundation/hardhat-ignition/modules');

module.exports = buildModule('AllExtensionsModule', (m) => {
  // Deploy all three official 1inch extension calculators
  const chainlinkCalculator = m.contract('ChainlinkCalculator');
  const dutchAuctionCalculator = m.contract('DutchAuctionCalculator');
  const rangeAmountCalculator = m.contract('RangeAmountCalculator');

  return {
    chainlinkCalculator,
    dutchAuctionCalculator,
    rangeAmountCalculator,
  };
});
