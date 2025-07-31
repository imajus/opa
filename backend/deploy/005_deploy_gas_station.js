module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
  const { deploy, get } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = await getChainId();

  // Get FlashLoanAdapter deployment
  const flashLoanAdapter = await get('FlashLoanAdapter');

  // Configuration parameters for Gas Station
  const takerFeeBps = 100; // 1% taker fee (100 basis points)
  const gasStipend = 150000; // 150k gas stipend

  // External contract addresses
  const aggregationRouter = '0x111111125421cA6dc452d289314280a0f8842A65'; // 1inch Router v6
  const weth = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'; // WETH
  const aavePool = '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2'; // Aave v3 Pool

  await deploy('GasStation', {
    from: deployer,
    args: [
      takerFeeBps,
      gasStipend,
      aggregationRouter,
      weth,
      aavePool,
      flashLoanAdapter.address,
    ],
    log: true,
  });
};

module.exports.tags = ['GasStation', 'extensions'];
module.exports.dependencies = ['FlashLoanAdapter'];
