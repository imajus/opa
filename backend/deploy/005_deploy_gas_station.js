module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
  const { deploy, get } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = await getChainId();

  // Configuration parameters for Gas Station
  const takerFeeBps = 100; // 1% taker fee (100 basis points)
  const gasStipend = 150000; // 150k gas stipend

  let uniswapFactory;
  let swapRouter;
  let weth;
  let aavePool;

  // External contract addresses
  if (chainId === '1') {
    uniswapFactory = '0x1F98431c8aD98523631AE4a59f267346ea31F984'; // Uniswap V3 Factory
    swapRouter = '0xE592427A0AEce92De3Edee1F18E0157C05861564'; // Uniswap V3 Swap Router
    weth = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'; // WETH
    aavePool = '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2'; // Aave v3 Pool
  } else if (chainId === '8453') {
    uniswapFactory = '0x33128a8fC17869897dcE68Ed026d694621f6FDfD'; // Uniswap V3 Factory
    swapRouter = '0x2626664c2603336E57B271c5C0b26F421741e481'; // Uniswap V3 Swap Router
    weth = '0x4200000000000000000000000000000000000006'; // WETH
    aavePool = '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5'; // Aave v3 Pool
  } else {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }

  await deploy('GasStation', {
    from: deployer,
    args: [takerFeeBps, gasStipend, uniswapFactory, swapRouter, weth, aavePool],
    log: true,
  });
};

module.exports.tags = ['GasStation', 'extensions'];
