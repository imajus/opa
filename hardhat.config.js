require('dotenv').config();
require('@nomicfoundation/hardhat-toolbox');

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: '0.8.28',
  defaultNetwork: 'localhost',
  networks: {
    local: {
      url: 'http://127.0.0.1:8545/',
    },
    hardhat: {
      forking: {
        url: `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
      },
    },
  },
};
