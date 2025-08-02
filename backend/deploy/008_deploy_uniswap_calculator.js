module.exports = async ({ getNamedAccounts, deployments, network }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  // Uniswap V3 Factory addresses for different networks
  const factoryAddresses = {
    mainnet: '0x1F98431c8aD98523631AE4a59f267346ea31F984', // Uniswap V3 Factory
    base: '0x33128a8fC17869897dcE68Ed026d694621f6FDfD', // Uniswap V3 Factory
    polygon: '0x1F98431c8aD98523631AE4a59f267346ea31F984', // Uniswap V3 Factory
    arbitrum: '0x1F98431c8aD98523631AE4a59f267346ea31F984', // Uniswap V3 Factory
    optimism: '0x1F98431c8aD98523631AE4a59f267346ea31F984', // Uniswap V3 Factory
    sepolia: '0x0227628f3F023bb0B980b67D528571c95c6DaC1c', // Uniswap V3 Factory (testnet)
    baseSepolia: '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24', // Uniswap V3 Factory (testnet)
    hardhat: '0x1F98431c8aD98523631AE4a59f267346ea31F984', // Default to mainnet address for fork
  };

  const networkName = network.name;
  const uniswapFactory = factoryAddresses[networkName];

  if (!uniswapFactory) {
    throw new Error(
      `No Uniswap V3 Factory address configured for network: ${networkName}`
    );
  }

  console.log(
    `Deploying UniswapCalculator on ${networkName} with Factory: ${uniswapFactory}`
  );

  // Deploy UniswapCalculator
  const deployment = await deploy('UniswapCalculator', {
    from: deployer,
    args: [uniswapFactory],
    log: true,
    gasLimit: 2000000, // Set explicit gas limit due to contract complexity
  });

  console.log(`UniswapCalculator deployed at: ${deployment.address}`);
  console.log(`Using Uniswap V3 Factory: ${uniswapFactory}`);
  console.log(`Supported fee tiers: 0.05% (500), 0.3% (3000), 1% (10000)`);
};

module.exports.tags = ['UniswapCalculator', 'extensions'];
module.exports.dependencies = []; // No dependencies on other contracts
