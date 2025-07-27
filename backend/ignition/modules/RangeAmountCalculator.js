const { buildModule } = require('@nomicfoundation/hardhat-ignition/modules');

module.exports = buildModule('RangeAmountCalculatorModule', (m) => {
  // Deploy the official RangeAmountCalculator from @1inch/limit-order-protocol-contract
  const rangeAmountCalculator = m.contract('RangeAmountCalculator');

  return { rangeAmountCalculator };
});
