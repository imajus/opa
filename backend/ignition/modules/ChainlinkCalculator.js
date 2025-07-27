const { buildModule } = require('@nomicfoundation/hardhat-ignition/modules');

module.exports = buildModule('ChainlinkCalculatorModule', (m) => {
  // Deploy the official ChainlinkCalculator from @1inch/limit-order-protocol-contract
  const chainlinkCalculator = m.contract('ChainlinkCalculator');

  return { chainlinkCalculator };
});
