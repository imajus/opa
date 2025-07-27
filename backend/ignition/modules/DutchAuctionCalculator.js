const { buildModule } = require('@nomicfoundation/hardhat-ignition/modules');

module.exports = buildModule('DutchAuctionCalculatorModule', (m) => {
  // Deploy the official DutchAuctionCalculator from @1inch/limit-order-protocol-contract
  const dutchAuctionCalculator = m.contract('DutchAuctionCalculator');

  return { dutchAuctionCalculator };
});
