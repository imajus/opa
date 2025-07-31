/**
 * Global configuration for 1inch Limit Order Protocol extensions
 */
export default {
  // network: {
  //   name: 'localhost',
  //   chainId: 31337,
  //   rpcUrl: 'http://localhost:8545',
  // },
  extensions: {
    gasStation: {
      address: '0xFEE2d383Ee292283eC43bdf0fa360296BE1e1149',
    },
    chainlinkCalculator: {
      address: '0x65933e6885FeBC647659766A7837dd410cCDcb65',
    },
    dutchAuctionCalculator: {
      address: '0xC9481A6935698050E569AcD70078DAD8303871CF',
    },
    rangeAmountCalculator: {
      address: '0xb7aCdc1Ae11554dfe98aA8791DCEE0F009155D5e',
    },
  },
};
