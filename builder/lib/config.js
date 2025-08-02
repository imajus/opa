/**
 * Global configuration for 1inch Limit Order Protocol extensions
 */
export default {
  extensions: {
    gasStation: {
      address: null, //TODO
    },
    oneInchCalculator: {
      address: '0xBf2d92E18f6C84ed809fdF2023F812502b581208',
    },
    uniswapCalculator: {
      address: '0xCBE374BF9650B783b8e945DdC626273E74A4CB65',
    },
    chainlinkCalculator: {
      address: '0x644ea330f200a1cfde1558e0ebb2e12a642f1900',
    },
    dutchAuctionCalculator: {
      address: '0xb4a98c55aA4A179516e98e12b3042CF95e739cD0',
    },
    rangeAmountCalculator: {
      address: '0x98e58a8fCb283F69Ad5eA97E618A589A284c0210',
    },
  },
};
