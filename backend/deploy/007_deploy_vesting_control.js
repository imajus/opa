const { network } = require('hardhat');

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy('VestingControl', {
    from: deployer,
    args: [], // No constructor arguments needed
    log: true,
    deterministicDeployment: false,
  });
};

module.exports.tags = ['VestingControl', 'extensions'];
module.exports.dependencies = [];
