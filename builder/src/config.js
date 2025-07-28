/**
 * Global configuration for 1inch Limit Order Protocol extensions
 */
export const config = {
  network: {
    name: 'localhost',
    chainId: 31337,
    rpcUrl: 'http://localhost:8545',
  },
  extensions: {
    gasStation: {
      address: '0x0000000000000000000000000000000000000000',
    },
    chainlinkCalculator: {
      address: '0x0000000000000000000000000000000000000000',
    },
    dutchAuctionCalculator: {
      address: '0xB167Cb0b51983858EEc1E1716dF18a59A1fe35B4',
    },
    rangeAmountCalculator: {
      address: '0x0000000000000000000000000000000000000000',
    },
  },
};
