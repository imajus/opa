# OrderBuilder API Documentation

A lightweight JavaScript helper for creating, configuring, and signing 1inch Limit Order Protocol (LOP) v4 orders with optional extensions.

## Table of Contents

- [Quick Start](#quick-start)
- [Installation](#installation)
- [Basic Usage](#basic-usage)
- [Advanced Usage with Extensions](#advanced-usage-with-extensions)
- [API Reference](#api-reference)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)
- [Examples](#examples)

## Quick Start

```javascript
import { OrderBuilder } from './src/order-builder.js';
import { Wallet } from 'ethers';

// Create a simple USDC -> WETH order
const builder = new OrderBuilder(
  '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
  '1000000', // 1 USDC (6 decimals)
  '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
  '500000000000000000' // 0.5 WETH (18 decimals)
);

// Configure order expiration
builder
  .getMakerTraits()
  .withExpiration(Math.floor(Date.now() / 1000) + 3600) // 1 hour
  .allowPartialFills();

// Sign the order
const wallet = new Wallet(privateKey, provider);
const result = await builder.build(wallet); // Ethereum mainnet (chainId from config)

console.log('Order hash:', result.orderHash);
console.log('Signature:', result.signature);
console.log('Extension:', result.extension);
```

## Installation

```bash
npm install @1inch/limit-order-sdk ethers zod
```

## Basic Usage

### Creating a Simple Order

```javascript
import { OrderBuilder } from './src/order-builder.js';

// Basic order without extensions
const builder = new OrderBuilder(
  makerAsset, // Token you're offering
  makerAmount, // Amount you're offering (in smallest unit)
  takerAsset, // Token you want to receive
  takerAmount, // Amount you want to receive (in smallest unit)
  receiver // Optional: custom receiver address
);
```

### Configuring Order Traits

```javascript
// Configure order behavior
const traits = builder.getMakerTraits();

// Set expiration (Unix timestamp)
traits.withExpiration(Math.floor(Date.now() / 1000) + 3600);

// Set custom nonce
traits.withNonce(42);

// Allow partial fills
traits.allowPartialFills();

// Allow multiple fills
traits.allowMultipleFills();

// Disable partial fills for exact amounts
traits.withoutPartialFills();
```

### Building and Signing

```javascript
import { Wallet } from 'ethers';

const wallet = new Wallet(privateKey, provider);

try {
  const result = await builder.build(wallet); // chainId from config

  // Use the signed order
  console.log('Order struct:', result.order);
  console.log('Order hash:', result.orderHash);
  console.log('Signature:', result.signature);
  console.log('Extension:', result.extension);

  // Submit to 1inch backend or contract
  await submitOrder(result);
} catch (error) {
  console.error('Order building failed:', error.message);
}
```

## Advanced Usage with Extensions

Extensions provide advanced functionality like dynamic pricing, gas optimization, and custom interactions.

### Available Extensions

- **Chainlink Calculator**: Dynamic pricing using oracle feeds
- **Dutch Auction Calculator**: Time-based price decay
- **Range Amount Calculator**: Linear price changes during fills
- **Gas Station**: Gasless trading for stablecoin-to-ETH swaps

### Adding Single Extension

```javascript
import { chainlinkCalculator } from './src/extensions/chainlink-calculator.js';

const builder = new OrderBuilder(
  makerAsset,
  makerAmount,
  takerAsset,
  takerAmount
);

// Add Chainlink price calculator
builder.addExtension(chainlinkCalculator);

const result = await builder.build(signer); // chainId from config
```

### Adding Multiple Extensions (Non-Conflicting)

```javascript
try {
  // These extensions use different hooks, so they're compatible
  builder.addExtension(extA); // uses preInteraction
  builder.addExtension(extB); // uses makerAmount + takerAmount
  builder.addExtension(extC); // uses postInteraction

  const signedOrder = await builder.build(signer); // chainId from config
} catch (error) {
  if (error instanceof HookCollisionError) {
    console.error('Extension conflict:', error.message);
  }
}
```

### Extension Configuration Examples

#### Chainlink Oracle Pricing

```javascript
import { chainlinkCalculator } from './src/extensions/chainlink-calculator.js';

const builder = new OrderBuilder(
  '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
  '1000000000', // 1000 USDC
  '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
  '0' // Dynamic amount based on oracle
);

// Configure for ETH/USD oracle with 1% spread
const params = {
  makerAmount: {
    type: 'single',
    config: {
      oracle: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419', // ETH/USD
      spread: '10000000', // 1% in 1e9 units
      inverse: false,
    },
  },
};

builder.addExtension(chainlinkCalculator);
const result = await builder.build(signer, params); // Pass params to extensions
```

#### Dutch Auction

```javascript
import { dutchAuctionCalculator } from './src/extensions/dutch-auction-calculator.js';

const startTime = Math.floor(Date.now() / 1000);
const endTime = startTime + 3600; // 1 hour auction

const params = {
  makerAmount: {
    startTime,
    endTime,
    startAmount: '2000000000000000000', // 2 ETH start price
    endAmount: '1000000000000000000', // 1 ETH end price
  },
};

builder.addExtension(dutchAuctionCalculator);
const result = await builder.build(signer, params); // Pass params to extensions

// Access the extension data used in the order
console.log('Extension data:', {
  makingAmountData: result.extension.makingAmountData,
  takingAmountData: result.extension.takingAmountData,
  preInteraction: result.extension.preInteraction,
  postInteraction: result.extension.postInteraction,
});
```

## API Reference

### OrderBuilder Class

#### Constructor

```javascript
new OrderBuilder(makerAsset, makerAmount, takerAsset, takerAmount, receiver?)
```

**Parameters:**

- `makerAsset` (string): ERC-20 contract address of asset being offered
- `makerAmount` (string|bigint): Amount being offered (smallest unit)
- `takerAsset` (string): ERC-20 contract address of asset being requested
- `takerAmount` (string|bigint): Amount being requested (smallest unit)
- `receiver` (string, optional): Custom receiver address (defaults to maker)

#### Methods

##### `getMakerTraits(): MakerTraits`

Returns the internal MakerTraits instance for configuration.

```javascript
const traits = builder.getMakerTraits();
traits.withExpiration(timestamp).allowPartialFills();
```

##### `addExtension(wrapper: ExtensionWrapper): void`

Adds an extension wrapper with automatic collision detection.

**Throws:**

- `HookCollisionError`: If extension conflicts with existing extensions
- `TypeError`: If wrapper is invalid

```javascript
builder.addExtension(chainlinkCalculator);
```

##### `build(signer: Signer, params?: object): Promise<OrderResult>`

Builds, hashes, and signs the complete order. The chainId is automatically taken from the config file. The optional `params` object is passed to all extension `build()` calls for extension configuration.

**Parameters:**

- `signer`: Ethers.js signer (EOA only)
- `params` (object, optional): Parameters to pass to extension build functions

**Returns:** Promise resolving to:

```javascript
{
  order: Object,      // Built LimitOrder struct
  orderHash: string,  // EIP-712 hash
  signature: string,  // EIP-712 signature
  extension: Object   // Combined extension instance used in the order
}
```

The `extension` field contains the combined Extension instance that was used to build the order. This includes all the hook data from any extensions that were added to the builder. If no extensions were added, this will be an empty Extension instance.

###### Extension Params

The `params` object is used to configure extensions. Each extension's `build()` function receives the full `params` object. The structure of `params` depends on the extensions you use. For example:

```javascript
const params = {
  makerAmount: {
    type: 'single',
    config: {
      /* ... */
    },
  },
  takerAmount: {
    /* ... */
  },
  preInteraction: {
    /* ... */
  },
  postInteraction: {
    /* ... */
  },
};
const result = await builder.build(signer, params);
```

### Error Classes

#### `HookCollisionError`

Thrown when extensions have conflicting hook types.

```javascript
try {
  builder.addExtension(extensionA);
  builder.addExtension(extensionB); // may throw
} catch (error) {
  if (error instanceof HookCollisionError) {
    console.log('Conflicting hook:', error.message);
  }
}
```

## Error Handling

### Common Errors

```javascript
try {
  const result = await builder.build(signer); // chainId from config
} catch (error) {
  if (error instanceof HookCollisionError) {
    // Extension hook collision
    console.error('Extension conflict:', error.message);
  } else if (error.code === 'INVALID_ARGUMENT') {
    // Invalid parameters
    console.error('Invalid parameter:', error.argument);
  } else if (error.code === 'UNSUPPORTED_OPERATION') {
    // Smart contract wallet not supported
    console.error('EOA wallet required');
  } else {
    // Other errors
    console.error('Unexpected error:', error.message);
  }
}
```

### Validation Best Practices

```javascript
// Validate addresses
function isValidAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// Validate amounts
function isValidAmount(amount) {
  try {
    const bigintAmount = BigInt(amount);
    return bigintAmount > 0n;
  } catch {
    return false;
  }
}

// Validate chain ID
function isValidChainId(chainId) {
  return Number.isInteger(chainId) && chainId > 0;
}
```

## Best Practices

### 1. Amount Handling

```javascript
// ✅ Always use smallest units
const usdcAmount = '1000000'; // 1 USDC (6 decimals)
const wethAmount = '500000000000000000'; // 0.5 WETH (18 decimals)

// ✅ Use BigInt for large numbers
const largeAmount = BigInt('1000000000000000000000'); // 1000 tokens

// ❌ Don't use floating point
const badAmount = 1.5 * 1e18; // Precision loss!
```

### 2. Extension Safety

```javascript
// ✅ Handle extension conflicts gracefully
function addExtensionSafely(builder, extension) {
  try {
    builder.addExtension(extension);
    return true;
  } catch (error) {
    if (error instanceof HookCollisionError) {
      console.warn(`Skipping ${extension.meta.name}: ${error.message}`);
      return false;
    }
    throw error; // Re-throw unexpected errors
  }
}
```

### 3. Order Expiration

```javascript
// ✅ Set reasonable expiration times
const oneHour = Math.floor(Date.now() / 1000) + 3600;
const oneDay = Math.floor(Date.now() / 1000) + 86400;

builder.getMakerTraits().withExpiration(oneHour);

// ✅ Check expiration before submission
function isOrderExpired(order) {
  const now = Math.floor(Date.now() / 1000);
  return order.makerTraits.expiration() <= now;
}
```

## Examples

### Example 1: Basic Token Swap

```javascript
import { OrderBuilder } from './src/order-builder.js';
import { Wallet } from 'ethers';

async function createBasicSwap() {
  const builder = new OrderBuilder(
    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
    '1000000', // 1 USDC
    '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
    '500000000000000000' // 0.5 WETH
  );

  // Configure for 1 hour expiration
  builder
    .getMakerTraits()
    .withExpiration(Math.floor(Date.now() / 1000) + 3600)
    .allowPartialFills();

  const wallet = new Wallet(process.env.PRIVATE_KEY, provider);
  return await builder.build(wallet); // chainId from config
}
```

### Example 2: Dutch Auction Order

```javascript
import { OrderBuilder } from './src/order-builder.js';
import { dutchAuctionCalculator } from './src/extensions/dutch-auction-calculator.js';

async function createDutchAuction() {
  const startTime = Math.floor(Date.now() / 1000);
  const endTime = startTime + 3600; // 1 hour

  const builder = new OrderBuilder(
    '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
    '1000000000000000000', // 1 WETH
    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
    '0' // Dynamic amount from auction
  );

  // Configure Dutch auction: start at 2000 USDC, end at 1500 USDC
  const params = {
    makerAmount: {
      startTime,
      endTime,
      startAmount: '2000000000', // 2000 USDC
      endAmount: '1500000000', // 1500 USDC
    },
  };

  builder.addExtension(dutchAuctionCalculator);
  return await builder.build(signer, params); // Pass params to extensions
}
```

### Example 3: Oracle-Based Pricing

```javascript
import { OrderBuilder } from './src/order-builder.js';
import { chainlinkCalculator } from './src/extensions/chainlink-calculator.js';

async function createOracleOrder() {
  const builder = new OrderBuilder(
    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
    '0', // Dynamic amount
    '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
    '1000000000000000000' // 1 WETH
  );

  // Use ETH/USD Chainlink oracle with 0.5% spread
  const params = {
    makerAmount: {
      type: 'single',
      config: {
        oracle: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
        spread: '5000000', // 0.5% in 1e9 units
        inverse: true, // Get USD amount for ETH
      },
    },
  };

  builder.addExtension(chainlinkCalculator);

  builder
    .getMakerTraits()
    .withExpiration(Math.floor(Date.now() / 1000) + 1800) // 30 min
    .allowPartialFills();

  return await builder.build(signer, params); // Pass params to extensions
}
```

### Example 4: Multi-Extension Order

```javascript
import { OrderBuilder } from './src/order-builder.js';
import { gasStation } from './src/extensions/gas-station.js';
import { rangeAmountCalculator } from './src/extensions/range-amount-calculator.js';

async function createAdvancedOrder() {
  const builder = new OrderBuilder(
    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
    '1000000000', // 1000 USDC
    '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
    '0' // Dynamic amount from range calculator
  );

  try {
    // Add gas station for gasless trading
    builder.addExtension(gasStation);

    // Add range pricing (won't conflict with gas station)
    builder.addExtension(rangeAmountCalculator);

    // Configure for partial fills and 2 hour expiration
    builder
      .getMakerTraits()
      .withExpiration(Math.floor(Date.now() / 1000) + 7200)
      .allowPartialFills()
      .allowMultipleFills();

    return await builder.build(signer); // chainId from config
  } catch (error) {
    if (error instanceof HookCollisionError) {
      console.error('Extension conflict:', error.message);
      // Fallback to single extension
      return createFallbackOrder();
    }
    throw error;
  }
}
```

---

For more information, see:

- [1inch Limit Order Protocol Documentation](https://docs.1inch.io/docs/limit-order-protocol/introduction)
- [EIP-712 Typed Data Standard](https://eips.ethereum.org/EIPS/eip-712)
- [Extension Development Guide](./Extensions.md)
