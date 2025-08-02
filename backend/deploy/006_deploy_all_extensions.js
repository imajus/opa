module.exports = async ({ getNamedAccounts, deployments }) => {
  const { log } = deployments;
  const { deployer } = await getNamedAccounts();

  log('===========================================');
  log('All Extensions Deployment Summary');
  log('===========================================');

  // All contracts should be deployed by now due to dependencies
  const dutchAuctionCalculator = await deployments.get(
    'DutchAuctionCalculator'
  );
  const rangeAmountCalculator = await deployments.get('RangeAmountCalculator');
  const flashLoanAdapter = await deployments.get('FlashLoanAdapter');
  const gasStation = await deployments.get('GasStation');

  log(`DutchAuctionCalculator deployed at: ${dutchAuctionCalculator.address}`);
  log(`RangeAmountCalculator deployed at: ${rangeAmountCalculator.address}`);
  log(`FlashLoanAdapter deployed at: ${flashLoanAdapter.address}`);
  log(`GasStation deployed at: ${gasStation.address}`);
  log('===========================================');
};

module.exports.tags = ['AllExtensions'];
module.exports.dependencies = [
  'DutchAuctionCalculator',
  'RangeAmountCalculator',
  'GasStation',
];
