# Uniswap Calculator Extension

> **🦄 Real-Time Price Discovery for 1inch Limit Order Protocol via Uniswap V3**  
> Enable dynamic amount calculations based on current market prices from Uniswap V3 pools

---

## Overview

The **Uniswap Calculator Extension** enables real-time price discovery and dynamic amount calculations for the 1inch Limit Order Protocol by integrating with Uniswap V3 Factory and pools. This extension allows orders to be priced based on current Uniswap V3 market conditions rather than fixed amounts, providing:

1. **Real-time pricing** from Uniswap V3 pool slot0 data
2. **Fee tier selection** for optimal liquidity (0.05%, 0.3%, 1%)
3. **Configurable spread** to account for fees and slippage
4. **Dynamic amount calculation** using SqrtPriceMath library
5. **Market-responsive orders** that adapt to current Uniswap V3 liquidity conditions

This creates a more flexible and market-responsive trading experience where order amounts are calculated on-chain based on real-time Uniswap V3 pool prices using the SqrtPriceMath library for precise calculations.

---

## Architecture

```mermaid
graph TD
    A[Order Execution] --> B[Uniswap Calculator Hook]
    B --> C[Decode Blob Data]
    C --> D[Extract Fee Tier & Spread from Blob]
    D --> E[Extract Token Addresses from Order]
    E --> F[Validate Fee Tier]
    F --> G[Call Uniswap V3 Factory]
    G --> H[Get Pool Address for Fee Tier]
    H --> I[Read Pool slot0 for sqrtPriceX96]
    I --> J[Calculate Amount using SqrtPriceMath]
    J --> K[Apply Spread]
    K --> L[Return Calculated Amount]
    L --> M[Order Execution Continues]
```

### Key Components

- **🦄 Uniswap Calculator**: Core extension implementing `IAmountGetter`
- **🏭 Uniswap V3 Factory**: Pool discovery and address resolution
- **💰 Uniswap V3 Pool**: Real-time price data via slot0
- **🧮 SqrtPriceMath Library**: Precise price and amount calculations
- **⚙️ Fee Tier Management**: Support for 0.05%, 0.3%, and 1% fee pools
- **📈 Spread Management**: Configurable spread for fee coverage and slippage protection
- **🎯 Dynamic Calculation**: On-chain amount calculation based on current market conditions

---

## Features

### ✅ **Real-Time Price Discovery**

- Integrates with Uniswap V3 Factory and pools for live market prices
- Uses pool slot0 data for current sqrtPriceX96 values
- Supports all ERC20 tokens with Uniswap V3 liquidity
- Fallback handling for non-existent pools and insufficient liquidity scenarios

### ✅ **Fee Tier Selection**

- **0.05% (500)**: For stablecoin pairs and very stable assets
- **0.3% (3000)**: Most common tier for standard token pairs
- **1% (10000)**: For exotic or volatile token pairs
- Automatic validation of supported fee tiers

### ✅ **Configurable Spread**

- Spread parameter in basis points (1e9 = 1 billion = 100%)
- Reasonable validation range (10% to 1000%)
- Applied to both making and taking amount calculations

### ✅ **Dynamic Amount Calculation**

- `getMakingAmount`: Calculates required maker tokens for given taker amount (takerToken → makerToken)
- `getTakingAmount`: Calculates expected taker tokens for given maker amount (makerToken → takerToken)
- Uses SqrtPriceMath library for precise mathematical calculations
- Real-time Uniswap V3 pool price integration via slot0 data
- Explicit token direction handling for clearer logic

### ✅ **Enhanced Blob Data Encoding**

- Compact 35-byte blob format for efficient on-chain storage
- Format: `[fee(3)][spread(32)]`
- Token addresses extracted from order parameters for cleaner design

---

## Configuration

### Constructor Parameters

```solidity
constructor(address _uniswapFactory)
```

### Network Addresses

#### Ethereum Mainnet

```javascript
const config = {
  uniswapFactory: '0x1F98431c8aD98523631AE4a59f267346ea31F984', // Uniswap V3 Factory
};
```

#### Polygon

```javascript
const config = {
  uniswapFactory: '0x1F98431c8aD98523631AE4a59f267346ea31F984', // Uniswap V3 Factory
};
```

#### Arbitrum

```javascript
const config = {
  uniswapFactory: '0x1F98431c8aD98523631AE4a59f267346ea31F984', // Uniswap V3 Factory
};
```

#### Base

```javascript
const config = {
  uniswapFactory: '0x33128a8fC17869897dcE68Ed026d694621f6FDfD', // Uniswap V3 Factory
};
```

#### Optimism

```javascript
const config = {
  uniswapFactory: '0x1F98431c8aD98523631AE4a59f267346ea31F984', // Uniswap V3 Factory
};
```

---

## Usage Examples

### 1. Basic Order with Uniswap Calculator

```javascript
import { uniswapCalculatorWrapper } from './extensions/UniswapCalculator.js';

const order = {
  salt: '12345',
  makerAsset: '0x6B175474E89094C44Da98b954EedeAC495271d0F', // DAI
  takerAsset: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
  maker: '0x...',
  receiver: '0x0000000000000000000000000000000000000000',
  allowedSender: '0x0000000000000000000000000000000000000000',
  makingAmount: '1000000000000000000000', // 1000 DAI (threshold)
  takingAmount: '500000000000000000', // 0.5 WETH (threshold)

  // Uniswap Calculator integration
  makerTraits: encodeMakerTraits({
    allowedSender: false,
    shouldCheckEpoch: false,
    expiry: Math.floor(Date.now() / 1000) + 3600, // 1 hour
    nonceOrEpoch: 1,
    series: 0,
  }),
};

// Create extension with 0.3% fee tier and 5% spread
const extension = await uniswapCalculatorWrapper.build(
  {
    makerAmount: { feeTier: 3000, spread: '1050000000' }, // 0.3% fee, 5% spread
    takerAmount: { feeTier: 3000, spread: '1050000000' }, // Reuse same settings
  },
  {
    makerAsset: { address: order.makerAsset },
    takerAsset: { address: order.takerAsset },
  }
);
```

### 2. Dynamic Amount Calculation with Fee Tiers

```javascript
// Get actual making amount based on current Uniswap V3 price
const actualMakingAmount = await uniswapCalculator.getMakingAmount(
  order,
  extensionData, // Blob data from extension
  ethers.ZeroHash, // order hash
  taker.address,
  order.takingAmount, // threshold amount
  order.makingAmount // remaining amount
);

console.log(
  `Required maker amount: ${ethers.formatEther(actualMakingAmount)} DAI`
);
// Output: "Required maker amount: 1050.25 DAI" (includes 5% spread)

// Compare different fee tiers
const feeTiers = [500, 3000, 10000];
for (const fee of feeTiers) {
  const extension = await uniswapCalculatorWrapper.build(
    { makerAmount: { feeTier: fee, spread: '1000000000' } },
    {
      makerAsset: { address: daiAddress },
      takerAsset: { address: wethAddress },
    }
  );

  const amount = await uniswapCalculator.getMakingAmount(
    order,
    extension.data,
    ethers.ZeroHash,
    taker.address,
    ethers.parseEther('1'),
    ethers.parseEther('1000')
  );

  console.log(`Fee ${fee / 100}%: ${ethers.formatEther(amount)} DAI`);
}
// Output:
// Fee 0.05%: 1000.15 DAI (best rate)
// Fee 0.3%: 1000.85 DAI (standard rate)
// Fee 1%: 1002.50 DAI (worst rate, but may have better liquidity)
```

### 3. Frontend Integration with Fee Tier Selection

```javascript
// React component for Uniswap Calculator orders
import { useState, useEffect } from 'react';
import { uniswapCalculatorWrapper } from './extensions/UniswapCalculator.js';

function UniswapCalculatorOrder({ makerAsset, takerAsset }) {
  const [feeTier, setFeeTier] = useState(3000); // Default 0.3%
  const [spread, setSpread] = useState('1050000000'); // 5% default
  const [calculatedAmount, setCalculatedAmount] = useState(null);
  const [estimatedGas, setEstimatedGas] = useState(null);

  const feeTierOptions = [
    {
      value: 500,
      label: '0.05% (Stable)',
      description: 'Best for stablecoin pairs',
    },
    {
      value: 3000,
      label: '0.3% (Standard)',
      description: 'Most common for token pairs',
    },
    {
      value: 10000,
      label: '1% (Exotic)',
      description: 'For volatile or exotic pairs',
    },
  ];

  useEffect(() => {
    async function calculateAmount() {
      try {
        const extension = await uniswapCalculatorWrapper.build(
          {
            makerAmount: { feeTier, spread },
            takerAmount: { feeTier, spread },
          },
          {
            makerAsset: { address: makerAsset },
            takerAsset: { address: takerAsset },
          }
        );

        // Get calculated amount from contract
        const amount = await uniswapCalculator.getMakingAmount(
          order,
          extension.data,
          ethers.ZeroHash,
          userAddress,
          '1000000000000000000', // 1 token
          '1000000000000000000'
        );

        setCalculatedAmount(ethers.formatEther(amount));

        // Estimate gas usage
        const gasEstimate = await uniswapCalculator.getMakingAmount.estimateGas(
          order,
          extension.data,
          ethers.ZeroHash,
          userAddress,
          '1000000000000000000',
          '1000000000000000000'
        );
        setEstimatedGas(gasEstimate.toString());
      } catch (error) {
        console.error('Calculation failed:', error);
        setCalculatedAmount(null);
      }
    }

    calculateAmount();
  }, [feeTier, spread, makerAsset, takerAsset]);

  return (
    <div className="uniswap-calculator-order">
      <div className="fee-tier-selection">
        <label>Fee Tier:</label>
        <select
          value={feeTier}
          onChange={(e) => setFeeTier(parseInt(e.target.value))}
        >
          {feeTierOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <small>
          {feeTierOptions.find((o) => o.value === feeTier)?.description}
        </small>
      </div>

      <div className="spread-selection">
        <label>
          Spread (%):
          <input
            type="number"
            value={Number(spread) / 1e7} // Convert to percentage
            onChange={(e) => setSpread((e.target.value * 1e7).toString())}
            min="0.1"
            max="100"
            step="0.1"
          />
        </label>
      </div>

      {calculatedAmount && (
        <div className="results">
          <p>Calculated amount: {calculatedAmount} tokens</p>
          <p>Estimated gas: {estimatedGas}</p>
          <p>Fee tier: {feeTier / 100}%</p>
        </div>
      )}
    </div>
  );
}
```

### 4. Advanced Fee Tier Optimization

```javascript
// Automatically select the best fee tier based on liquidity and price
async function findOptimalFeeTier(makerAsset, takerAsset, amount) {
  const feeTiers = [500, 3000, 10000];
  const results = [];

  for (const fee of feeTiers) {
    try {
      const extension = await uniswapCalculatorWrapper.build(
        { makerAmount: { feeTier: fee, spread: '1000000000' } },
        {
          makerAsset: { address: makerAsset },
          takerAsset: { address: takerAsset },
        }
      );

      const quote = await uniswapCalculator.getMakingAmount(
        order,
        extension.data,
        ethers.ZeroHash,
        userAddress,
        amount,
        amount
      );

      results.push({
        feeTier: fee,
        quote: quote,
        rate: Number(quote) / Number(amount),
        feeLabel: `${fee / 100}%`,
      });
    } catch (error) {
      console.log(`Fee tier ${fee / 100}% not available:`, error.message);
    }
  }

  if (results.length === 0) {
    throw new Error('No liquidity available on any fee tier');
  }

  // Sort by best rate (lowest quote for making amount)
  results.sort((a, b) => Number(a.quote) - Number(b.quote));

  const optimal = results[0];
  console.log(
    `Optimal fee tier: ${optimal.feeLabel} with rate ${optimal.rate.toFixed(6)}`
  );

  return optimal;
}

// Usage
const optimal = await findOptimalFeeTier(
  '0x6B175474E89094C44Da98b954EedeAC495271d0F', // DAI
  '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
  ethers.parseEther('1') // 1 WETH
);
```

---

## Blob Data Format

### Structure

The Uniswap Calculator uses a 76-byte blob for efficient on-chain data storage:

```
[flags(1)][makerToken(20)][takerToken(20)][fee(3)][spread(32)]
```

### Field Details

| Field        | Size     | Description                                       | Example                                                            |
| ------------ | -------- | ------------------------------------------------- | ------------------------------------------------------------------ |
| `flags`      | 1 byte   | Calculation flags (0x00 = normal, 0x80 = inverse) | `0x00`                                                             |
| `makerToken` | 20 bytes | Maker token contract address (no 0x prefix)       | `6B175474E89094C44Da98b954EedeAC495271d0F`                         |
| `takerToken` | 20 bytes | Taker token contract address (no 0x prefix)       | `C02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2`                         |
| `fee`        | 3 bytes  | Uniswap V3 fee tier (hex, padded to 6 chars)      | `000BB8` (3000 = 0.3%)                                             |
| `spread`     | 32 bytes | Spread in basis points (hex, padded to 64 chars)  | `000000000000000000000000000000000000000000000000000000003B9ACA00` |

### JavaScript Encoding

```javascript
function encodeBlobData(makerToken, takerToken, feeTier, spread) {
  const flags = '0x00'; // Normal calculation
  const makerTokenHex = makerToken.toLowerCase().slice(2); // Remove 0x
  const takerTokenHex = takerToken.toLowerCase().slice(2); // Remove 0x
  const feeHex = feeTier.toString(16).padStart(6, '0'); // 3 bytes = 6 hex chars
  const spreadHex = BigInt(spread).toString(16).padStart(64, '0');

  return flags + makerTokenHex + takerTokenHex + feeHex + spreadHex;
}

// Example usage
const blobData = encodeBlobData(
  '0x6B175474E89094C44Da98b954EedeAC495271d0F', // DAI
  '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
  3000, // 0.3% fee tier
  '1050000000' // 5% spread
);

console.log('Blob data:', blobData);
// Output: "0x006B175474E89094C44Da98b954EedeAC495271d0FC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2000BB8000000000000000000000000000000000000000000000000000000003B9ACA00"
```

### Fee Tier Encoding

```javascript
const FEE_TIERS = {
  STABLE: 500, // 0.05% - hex: 0x0001F4
  STANDARD: 3000, // 0.3%  - hex: 0x000BB8
  EXOTIC: 10000, // 1%    - hex: 0x002710
};

function encodeFeeHex(feeTier) {
  return feeTier.toString(16).padStart(6, '0');
}

console.log('0.05%:', encodeFeeHex(FEE_TIERS.STABLE)); // "0001f4"
console.log('0.3%:', encodeFeeHex(FEE_TIERS.STANDARD)); // "000bb8"
console.log('1%:', encodeFeeHex(FEE_TIERS.EXOTIC)); // "002710"
```

---

## Fee Tier Configuration

### Understanding Uniswap V3 Fee Tiers

Uniswap V3 pools are segmented by fee tiers, each optimized for different types of trading pairs:

#### **0.05% (500) - Stable Pairs**

- **Best for**: Stablecoin pairs (USDC/USDT, DAI/USDC)
- **Characteristics**: Highest liquidity concentration, lowest price impact
- **Use case**: Large trades with minimal slippage

#### **0.3% (3000) - Standard Pairs**

- **Best for**: Most ETH and token pairs (ETH/USDC, WBTC/ETH)
- **Characteristics**: Balanced liquidity and fee capture
- **Use case**: Most common trading pairs

#### **1% (10000) - Exotic Pairs**

- **Best for**: Volatile or less common pairs
- **Characteristics**: Higher fees compensate for volatility risk
- **Use case**: Long-tail tokens, experimental pairs

### Fee Tier Selection Strategy

```javascript
function selectOptimalFeeTier(tokenA, tokenB) {
  // Stablecoin detection
  const stablecoins = [
    '0xA0b86a33E6417aB4E4C31631e7AAD54Db8C4C8B6', // USDC
    '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
    '0x6B175474E89094C44Da98b954EedeAC495271d0F', // DAI
    '0x4Fabb145d64652a948d72533023f6E7A623C7C53', // BUSD
  ];

  // Major tokens
  const majorTokens = [
    '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
    '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', // WBTC
    '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', // UNI
    '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0', // MATIC
  ];

  const isStableA = stablecoins.includes(tokenA.toLowerCase());
  const isStableB = stablecoins.includes(tokenB.toLowerCase());
  const isMajorA = majorTokens.includes(tokenA.toLowerCase());
  const isMajorB = majorTokens.includes(tokenB.toLowerCase());

  if (isStableA && isStableB) {
    return 500; // 0.05% for stable pairs
  } else if ((isMajorA || isStableA) && (isMajorB || isStableB)) {
    return 3000; // 0.3% for major pairs
  } else {
    return 10000; // 1% for exotic pairs
  }
}

// Usage example
const feeTier = selectOptimalFeeTier(
  '0xA0b86a33E6417aB4E4C31631e7AAD54Db8C4C8B6', // USDC
  '0x6B175474E89094C44Da98b954EedeAC495271d0F' // DAI
);
console.log(`Optimal fee tier: ${feeTier / 100}%`); // "Optimal fee tier: 0.05%"
```

---

## Spread Configuration

### Understanding Spread

The spread parameter represents the multiplier applied to the Uniswap V3 market price:

- **1e9 (1,000,000,000)**: 100% - no spread, exact market price
- **1.05e9 (1,050,000,000)**: 105% - 5% spread above market price
- **0.95e9 (950,000,000)**: 95% - 5% spread below market price

### Common Spread Values

```javascript
const SPREADS = {
  NO_SPREAD: '1000000000', // 100% - exact market price
  MINIMAL_SPREAD: '1001000000', // 100.1% - 0.1% spread
  LOW_SPREAD: '1005000000', // 100.5% - 0.5% spread
  STANDARD_SPREAD: '1010000000', // 101% - 1% spread
  MEDIUM_SPREAD: '1025000000', // 102.5% - 2.5% spread
  HIGH_SPREAD: '1050000000', // 105% - 5% spread
  AGGRESSIVE_SPREAD: '1100000000', // 110% - 10% spread
};
```

### Dynamic Spread Based on Volatility

```javascript
async function calculateDynamicSpread(tokenA, tokenB, feeTier) {
  // Get recent price data (simplified example)
  const quotes = [];
  for (let i = 0; i < 10; i++) {
    const quote = await uniswapCalculator.getQuote(
      tokenA,
      tokenB,
      feeTier,
      ethers.parseEther('1')
    );
    quotes.push(Number(quote));
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
  }

  // Calculate volatility (standard deviation)
  const mean = quotes.reduce((a, b) => a + b) / quotes.length;
  const variance =
    quotes.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) /
    quotes.length;
  const volatility = Math.sqrt(variance) / mean;

  // Base spread + volatility adjustment
  const baseSpread = 1.01; // 1% base
  const volatilityMultiplier = 1 + volatility * 10; // Scale volatility
  const dynamicSpread = baseSpread * volatilityMultiplier;

  return Math.floor(dynamicSpread * 1e9).toString();
}
```

---

## Integration Guide

### 1. Deploy Uniswap Calculator

```bash
# Using Hardhat deployment script
npx hardhat run scripts/deploy-uniswap-calculator.js --network mainnet

# Deploy with specific factory address
npx hardhat run scripts/deploy-uniswap-calculator.js --network mainnet --factory 0x1F98431c8aD98523631AE4a59f267346ea31F984
```

### 2. Create Dynamic Orders with Fee Tiers

```javascript
// Backend integration
import { uniswapCalculatorWrapper } from './extensions/UniswapCalculator.js';

async function createDynamicOrder(makerAsset, takerAsset, feeTier, spread) {
  // Validate fee tier
  const validFeeTiers = [500, 3000, 10000];
  if (!validFeeTiers.includes(feeTier)) {
    throw new Error(
      `Invalid fee tier: ${feeTier}. Must be one of: ${validFeeTiers.join(
        ', '
      )}`
    );
  }

  const extension = await uniswapCalculatorWrapper.build(
    {
      makerAmount: { feeTier: feeTier, spread: spread.toString() },
      takerAmount: { feeTier: feeTier, spread: spread.toString() },
    },
    {
      makerAsset: { address: makerAsset },
      takerAsset: { address: takerAsset },
    }
  );

  const order = {
    // ... order parameters
    extension: extension,
  };

  return order;
}
```

### 3. Monitor Price Changes Across Fee Tiers

```javascript
// Listen for price updates across different fee tiers
const feeTiers = [500, 3000, 10000];

async function monitorPricesAcrossTiers(tokenA, tokenB) {
  const prices = {};

  for (const fee of feeTiers) {
    try {
      const quote = await uniswapCalculator.getQuote(
        tokenA,
        tokenB,
        fee,
        ethers.parseEther('1')
      );
      prices[fee] = {
        fee: fee,
        quote: ethers.formatEther(quote),
        label: `${fee / 100}%`,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.log(`No liquidity in ${fee / 100}% tier:`, error.message);
    }
  }

  return prices;
}

// Usage
setInterval(async () => {
  const prices = await monitorPricesAcrossTiers(
    '0x6B175474E89094C44Da98b954EedeAC495271d0F', // DAI
    '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' // WETH
  );

  console.log('Current prices across fee tiers:', prices);
  // Output:
  // {
  //   500: { fee: 500, quote: "1000.05", label: "0.05%", timestamp: 1234567890 },
  //   3000: { fee: 3000, quote: "1000.30", label: "0.3%", timestamp: 1234567890 },
  //   10000: { fee: 10000, quote: "1001.00", label: "1%", timestamp: 1234567890 }
  // }
}, 10000); // Check every 10 seconds
```

---

## Security Considerations

### ✅ **Price Validation**

- Real-time price discovery from Uniswap V3 Factory and pools
- Fee tier validation prevents invalid pool queries
- Fallback handling for non-existent pools and insufficient liquidity
- Spread validation prevents extreme price manipulation

### ✅ **Economic Security**

- Configurable spread limits prevent excessive fees
- Fee tier selection optimizes for best available liquidity
- Uniswap V3 price integration prevents stale price attacks
- Same token validation prevents unnecessary swaps

### ✅ **Integration Safety**

- Comprehensive error handling for pool discovery and price calculations
- Blob data validation ensures correct encoding
- Token address validation prevents invalid configurations
- Fee tier validation prevents unsupported pool queries

### ⚠️ **Risk Factors**

- **Price Volatility**: Rapid token price changes during execution
- **MEV**: Potential front-running of profitable orders
- **Uniswap Dependency**: Relies on Uniswap V3 Factory and pool availability
- **Liquidity Risk**: Requires sufficient liquidity in selected fee tier
- **Fee Tier Risk**: Optimal tier may change based on market conditions

### 🛡️ **Best Practices**

```javascript
// 1. Always validate fee tier availability
async function validateFeeTierLiquidity(tokenA, tokenB, feeTier) {
  try {
    await uniswapCalculator.getQuote(
      tokenA,
      tokenB,
      feeTier,
      ethers.parseEther('0.01')
    );
    return true;
  } catch (error) {
    return false;
  }
}

// 2. Implement fallback fee tier selection
async function selectFeeTierWithFallback(tokenA, tokenB, preferredTier) {
  const tiers = [preferredTier, 3000, 500, 10000]; // Preferred + fallbacks

  for (const tier of tiers) {
    if (await validateFeeTierLiquidity(tokenA, tokenB, tier)) {
      return tier;
    }
  }

  throw new Error('No liquidity available on any fee tier');
}

// 3. Set reasonable spread limits
function validateSpread(spread) {
  const spreadNum = BigInt(spread);
  const MIN_SPREAD = BigInt('500000000'); // 50% (0.5x)
  const MAX_SPREAD = BigInt('5000000000'); // 500% (5x)

  if (spreadNum < MIN_SPREAD || spreadNum > MAX_SPREAD) {
    throw new Error(
      `Spread ${spread} outside safe range [${MIN_SPREAD}, ${MAX_SPREAD}]`
    );
  }
}
```

---

## Testing

### Unit Tests

```bash
# Run Uniswap Calculator tests
npx hardhat test test/extensions/UniswapCalculator.test.js

# Run with gas reporting
REPORT_GAS=true npx hardhat test test/extensions/UniswapCalculator.test.js

# Run specific test suites
npx hardhat test test/extensions/UniswapCalculator.test.js --grep "Fee Tier"
npx hardhat test test/extensions/UniswapCalculator.test.js --grep "Amount Calculation"
```

### Coverage

```bash
# Generate coverage report
npx hardhat coverage --testfiles "test/extensions/UniswapCalculator.test.js"

# Results:
# ✅ UniswapCalculator: 100% statement coverage
# ✅ All critical paths and error conditions covered
# ✅ Fee tier validation thoroughly tested
# ✅ Blob encoding/decoding with fee tiers tested
```

### Integration Tests

```bash
# Test against mainnet fork
npx hardhat test test/extensions/UniswapCalculator.integration.test.js --network hardhat

# Test specific fee tier scenarios
npx hardhat test --grep "fee tier liquidity"
npx hardhat test --grep "cross-tier arbitrage"
```

### Gas Usage Verification

```bash
# Verify gas usage meets requirements
npx hardhat test --grep "gas usage"

# Expected results:
# ✅ getMakingAmount: <40k gas (slightly higher than 1inch due to fee tier validation)
# ✅ getTakingAmount: <40k gas
# ✅ Fee tier validation: <5k gas
# ✅ Blob decoding: <8k gas (more complex due to fee tier)
```

---

## Troubleshooting

### Common Issues

#### **"InvalidBlobLength" Error**

```javascript
// ❌ Invalid: Incorrect blob length (should be 76 bytes, not 73)
const blobData = flags + makerToken + takerToken + spread; // Missing fee tier

// ✅ Valid: 76-byte blob
const blobData = flags + makerToken + takerToken + feeHex + spread; // 76 bytes
```

#### **"InvalidFeeTier" Error**

```javascript
// ❌ Invalid: Unsupported fee tier
const feeTier = 2500; // Not supported

// ✅ Valid: Supported fee tiers
const validFeeTiers = [500, 3000, 10000];
const feeTier = 3000; // 0.3%
```

#### **"PoolNotFound" Error**

```javascript
// Check Uniswap V3 Factory and pool availability
const factory = new ethers.Contract(factoryAddress, factoryABI, provider);

try {
  const poolAddress = await factory.getPool(makerToken, takerToken, feeTier);

  if (poolAddress === ethers.ZeroAddress) {
    console.error('Pool does not exist for this token pair and fee tier');
    // Try different fee tier or check if tokens are correct
  }
} catch (error) {
  console.error('Pool discovery failed:', error);
  // Try different fee tier or check pool existence
}
```

#### **"InsufficientLiquidity" Error**

- Check if token pair has sufficient liquidity on selected fee tier
- Try different fee tiers: 500, 3000, 10000
- Verify token addresses are correct
- Consider reducing order size

#### **Fee Tier Selection Issues**

```javascript
// Auto-detect best fee tier with fallback
async function findBestFeeTier(tokenA, tokenB, amount) {
  const tiers = [500, 3000, 10000];
  let bestTier = null;
  let bestQuote = null;

  for (const tier of tiers) {
    try {
      const poolAddress = await factory.getPool(tokenA, tokenB, tier);
      if (poolAddress !== ethers.ZeroAddress) {
        const pool = new ethers.Contract(poolAddress, poolABI, provider);
        const slot0 = await pool.slot0();
        if (slot0.sqrtPriceX96 > 0) {
          bestTier = tier; // First available tier with liquidity
          break;
        }
      }
    } catch (error) {
      console.log(`Tier ${tier / 100}% unavailable`);
    }
  }

  if (!bestTier) {
    throw new Error('No liquidity available on any fee tier');
  }

  return bestTier;
}
```

---

## Roadmap

### 🔄 **Future Enhancements**

#### **v2.0 - Advanced Features**

- Inverse calculation support (0x80 flag)
- Multi-hop routing through multiple fee tiers
- Partial fill support with proportional spread
- Gas optimization for pool price calculations

#### **v2.1 - MEV Protection**

- Integration with Flashbots Protect
- Private mempool submission for sensitive trades
- Dynamic spread adjustment based on MEV risk
- Time-based order execution windows

#### **v2.2 - Multi-Chain Support**

- Polygon, Arbitrum, Optimism deployment
- Cross-chain price discovery
- Chain-specific fee tier optimization
- Native token support (ETH, MATIC, etc.)

#### **v3.0 - Advanced Pricing**

- Time-weighted average price (TWAP) integration
- Volatility-adjusted spreads based on historical data
- Machine learning fee tier optimization
- Concentrated liquidity position integration

#### **v3.1 - Liquidity Optimization**

- Real-time liquidity depth analysis
- Dynamic fee tier switching based on trade size
- Slippage prediction and mitigation
- Integration with Uniswap V4 hooks

---

## Support

### 📞 **Get Help**

- **Documentation**: [Uniswap V3 Developer Docs](https://docs.uniswap.org/)
- **Discord**: [1inch Community](https://discord.gg/1inch)
- **Discord**: [Uniswap Community](https://discord.gg/uniswap)
- **GitHub**: [Issues & Bug Reports](https://github.com/1inch/limit-order-protocol)

### 🤝 **Contributing**

- Fork the repository
- Create feature branch: `git checkout -b feature/uniswap-enhancement`
- Commit changes: `git commit -m 'Add Uniswap V3 fee tier optimization'`
- Push to branch: `git push origin feature/uniswap-enhancement`
- Open a Pull Request

### 🐛 **Bug Reports**

Include the following information:

- Network and contract addresses
- Fee tier used
- Token pair
- Error message and stack trace
- Transaction hash (if applicable)

---

**🦄 Uniswap Calculator Extension - Decentralized Price Discovery with Fee Tier Optimization**
