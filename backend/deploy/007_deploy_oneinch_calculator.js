module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  // 1inch Aggregation Router address
  const aggregationRouter = '0x1111111254EEB25477B68fb85Ed929f73A960582';

  // Deploy OneInchCalculator
  await deploy('OneInchCalculator', {
    from: deployer,
    args: [aggregationRouter],
    log: true,
  });
};

module.exports.tags = ['OneInchCalculator', 'extensions'];
