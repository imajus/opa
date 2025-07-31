module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy('FlashLoanAdapter', {
    from: deployer,
    log: true,
  });
};

module.exports.tags = ['FlashLoanAdapter', 'gas-station-deps'];
