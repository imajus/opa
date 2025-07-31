module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy('ChainlinkCalculator', {
    from: deployer,
    log: true,
  });
};

module.exports.tags = ['ChainlinkCalculator', 'calculators'];
