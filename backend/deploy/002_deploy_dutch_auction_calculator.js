module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy('DutchAuctionCalculator', {
    from: deployer,
    log: true,
  });
};

module.exports.tags = ['DutchAuctionCalculator', 'calculators'];
