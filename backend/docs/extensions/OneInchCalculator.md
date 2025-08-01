# OneInchCalculator Extension

## Overview

The `OneInchCalculator` extension is a custom implementation for the 1inch Limit Order Protocol that uses the 1inch Aggregation Router for real-time price discovery instead of Chainlink oracles. This extension provides dynamic pricing based on current market conditions across multiple DEXs.

## Key Features

- **Real-time Price Discovery**: Uses 1inch Aggregation Router to get current market prices
- **Multi-DEX Support**: Automatically finds the best prices across all supported DEXs
- **Spread Management**: Supports configurable spreads for maker/taker pricing
- **Inverse Calculations**: Supports both normal and inverse price calculations
- **Gas Optimized**: Efficient implementation with reasonable gas costs

## Contract Details

- **Contract**: `OneInchCalculator.sol`
- **Interface**: `IAmountGetter`
- **Dependencies**: 1inch Aggregation Router v6

## Blob Format

The extension uses a custom blob format to encode configuration data:

```
[flags(1)][makerToken(20)][takerToken(20)][spread(32)]
```

### Blob Structure

| Field        | Size     | Description                                       |
| ------------ | -------- | ------------------------------------------------- |
| `flags`      | 1 byte   | Calculation flags (0x00 = normal, 0x80 = inverse) |
| `makerToken` | 20 bytes | Address of the maker token                        |
| `takerToken` | 20 bytes | Address of the taker token                        |
| `spread`     | 32 bytes | Spread value in basis points (1e9 = 1 billion)    |

### Flags

- `0x00`: Normal calculation (amount → price)
- `0x80`: Inverse calculation (price → amount)

### Spread

The spread is used to adjust the market price. For example:

- `1e9` (1,000,000,000): No spread (1:1 ratio)
- `1.05e9` (1,050,000,000): 5% premium
- `0.95e9` (950,000,000): 5% discount

## Functions

### getMakingAmount

Calculates the making amount based on the taking amount and current market price.

```solidity
function getMakingAmount(
    IOrderMixin.Order calldata order,
    bytes calldata extension,
    bytes32 orderHash,
    address taker,
    uint256 takingAmount,
    uint256 remainingMakingAmount,
    bytes calldata extraData
) external view returns (uint256)
```

**Parameters:**

- `order`: Order data (unused)
- `extension`: Extension data (unused)
- `orderHash`: Order hash (unused)
- `taker`: Taker address (unused)
- `takingAmount`: Amount being taken
- `remainingMakingAmount`: Remaining making amount (unused)
- `extraData`: Blob containing configuration

**Returns:**

- Calculated making amount based on current market price and spread

### getTakingAmount

Calculates the taking amount based on the making amount and current market price.

```solidity
function getTakingAmount(
    IOrderMixin.Order calldata order,
    bytes calldata extension,
    bytes32 orderHash,
    address taker,
    uint256 makingAmount,
    uint256 remainingMakingAmount,
    bytes calldata extraData
) external view returns (uint256)
```

**Parameters:**

- `order`: Order data (unused)
- `extension`: Extension data (unused)
- `orderHash`: Order hash (unused)
- `taker`: Taker address (unused)
- `makingAmount`: Amount being made
- `remainingMakingAmount`: Remaining making amount (unused)
- `extraData`: Blob containing configuration

**Returns:**

- Calculated taking amount based on current market price and spread

## Usage Examples

### Basic Usage

```javascript
const { ethers } = require('ethers');

// Create blob for USDC -> WETH with 1% spread
const makerToken = '0xA0b86a33E6441b8C4C8C8C8C8C8C8C8C8C8C8C8'; // USDC
const takerToken = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'; // WETH
const spread = ethers.parseUnits('1.01', 9); // 1% premium
const flags = 0x00; // Normal calculation

const blob = ethers.concat([
  ethers.zeroPadValue(ethers.toBeHex(flags), 1),
  ethers.zeroPadValue(makerToken, 20),
  ethers.zeroPadValue(takerToken, 20),
  ethers.zeroPadValue(ethers.toBeHex(spread), 32),
]);

// Calculate making amount for 1000 USDC
const takingAmount = ethers.parseUnits('1000', 6); // 1000 USDC
const makingAmount = await oneInchCalculator.getMakingAmount(
  order,
  '0x',
  orderHash,
  taker,
  takingAmount,
  takingAmount,
  blob
);
```

### Inverse Calculation

```javascript
// Create blob for inverse calculation (WETH -> USDC)
const makerToken = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'; // WETH
const takerToken = '0xA0b86a33E6441b8C4C8C8C8C8C8C8C8C8C8C8C8'; // USDC
const spread = ethers.parseUnits('0.99', 9); // 1% discount
const flags = 0x80; // Inverse calculation

const blob = ethers.concat([
  ethers.zeroPadValue(ethers.toBeHex(flags), 1),
  ethers.zeroPadValue(makerToken, 20),
  ethers.zeroPadValue(takerToken, 20),
  ethers.zeroPadValue(ethers.toBeHex(spread), 32),
]);

// Calculate taking amount for 1 WETH
const makingAmount = ethers.parseEther('1'); // 1 WETH
const takingAmount = await oneInchCalculator.getTakingAmount(
  order,
  '0x',
  orderHash,
  taker,
  makingAmount,
  makingAmount,
  blob
);
```

## Error Handling

The extension includes comprehensive error handling:

- `InvalidBlobLength`: Blob length is not 73 bytes
- `ZeroAmount`: Input amount is zero
- `PriceDiscoveryFailed`: 1inch Aggregation Router call failed
- `InsufficientLiquidity`: No liquidity available for the token pair

## Gas Optimization

The extension is optimized for gas efficiency:

- **getMakingAmount**: < 100k gas
- **getTakingAmount**: < 100k gas

## Deployment

### Constructor Parameters

```solidity
constructor(address _aggregationRouter)
```

- `_aggregationRouter`: Address of the 1inch Aggregation Router

### Network-Specific Addresses

The extension supports all networks where 1inch Aggregation Router v6 is deployed:

- **Mainnet**: `0x1111111254EEB25477B68fb85Ed929f73A960582`
- **Polygon**: `0x1111111254EEB25477B68fb85Ed929f73A960582`
- **Arbitrum**: `0x1111111254EEB25477B68fb85Ed929f73A960582`
- **Optimism**: `0x1111111254EEB25477B68fb85Ed929f73A960582`
- **BSC**: `0x1111111254EEB25477B68fb85Ed929f73A960582`
- And many more...

## Comparison with ChainlinkCalculator

| Feature             | ChainlinkCalculator | OneInchCalculator            |
| ------------------- | ------------------- | ---------------------------- |
| Price Source        | Chainlink Oracles   | 1inch Aggregation Router     |
| Real-time           | No (oracle delay)   | Yes (live market)            |
| Multi-DEX           | No                  | Yes                          |
| Spread Support      | Yes                 | Yes                          |
| Inverse Calculation | Yes                 | Yes                          |
| Gas Cost            | Lower               | Higher (due to router calls) |
| Accuracy            | Oracle-based        | Market-based                 |

## Security Considerations

1. **Price Manipulation**: Market prices can be manipulated, unlike oracle prices
2. **Slippage**: Real-time prices may change between calculation and execution
3. **Router Dependencies**: Relies on 1inch Aggregation Router availability
4. **Liquidity**: Requires sufficient liquidity in the target token pairs

## Testing

Run the test suite:

```bash
npx hardhat test test/extensions/OneInchCalculator.test.js
```

The test suite covers:

- Deployment validation
- Blob encoding/decoding
- Price calculations with spreads
- Inverse calculations
- Error conditions
- Gas optimization
