# 1inch Limit Order Protocol Extension Wrappers

This package provides JavaScript wrappers for 1inch Limit Order Protocol extensions, enabling easy creation and configuration of sophisticated trading strategies.

## Quick Start

### Installation

```
npm install @1inch/limit-order-sdk
```

### Importing Extension Wrappers

```js
import {
  gasStation,
  dutchAuctionCalculator,
  rangeAmountCalculator,
  extensions,
  extensionMeta,
  extensionSchemas,
} from '../src/index.js'; // Adjust path as needed
```

### Example: Creating a Gas Station Extension

```js
import { gasStation } from '../src/index.js';

// Build the extension (no params needed for Gas Station)
const extension = gasStation.build();
// Use `extension` with the 1inch Limit Order SDK
```



### Example: Dutch Auction Calculator

```js
import { dutchAuctionCalculator } from '../src/index.js';

const params = {
  MAKER_AMOUNT: {
    startTime: 1700000000,
    endTime: 1700003600,
    startAmount: '1000000000000000000', // 1 ETH
    endAmount: '900000000000000000', // 0.9 ETH
  },
};
const extension = dutchAuctionCalculator.build(params);
```

### Example: Range Amount Calculator

```js
import { rangeAmountCalculator } from '../src/index.js';

const params = {
  MAKER_AMOUNT: {
    priceStart: '1000000000000000000', // 1
    priceEnd: '2000000000000000000', // 2
  },
};
const extension = rangeAmountCalculator.build(params);
```

## API Reference

- Each wrapper exposes a `.build(params)` method that returns a 1inch SDK `Extension` instance.
- Use the exported schemas for parameter validation.
- See source code and JSDoc for advanced usage and configuration.
