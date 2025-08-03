# VestingControl Extension

The VestingControl extension enables sophisticated token vesting functionality within the 1inch Limit Order Protocol. It allows for time-based token distribution with configurable cliff periods and periodic unlocks, ensuring that token recipients can only claim their allocation according to a predetermined vesting schedule.

## Overview

This extension implements a stateless vesting mechanism where:

- **Cliff Period**: Initial waiting period before any tokens can be claimed
- **Vesting Periods**: Regular intervals when new tokens become available
- **Per-Period Limits**: Maximum tokens that can be claimed in each period
- **Automatic Validation**: Built-in checks prevent early or excessive claims

## Key Features

- ✅ **Stateless Design**: No on-chain storage required - all parameters encoded in order
- ✅ **Flexible Scheduling**: Support for any vesting period (hours to years)
- ✅ **Cliff Support**: Configurable initial waiting period
- ✅ **Per-Period Validation**: Ensures orderly token distribution
- ✅ **Event Tracking**: Comprehensive logging for transparency
- ✅ **Gas Efficient**: Minimal computational overhead

## Use Cases

### 1. Startup Employee Vesting

```js
// Standard 4-year vesting with 1-year cliff
const employeeVesting = {
  vestingPeriod: 30 * 24 * 60 * 60, // 30 days
  totalPeriods: 36, // 3 years after cliff
  startTime: now + 365 * 24 * 60 * 60, // 1 year cliff
};
```

### 2. Investor Token Distribution

```js
// Quarterly unlocks with 3-month cliff
const investorVesting = {
  vestingPeriod: 90 * 24 * 60 * 60, // 90 days
  totalPeriods: 8, // 2 years quarterly
  startTime: now + 90 * 24 * 60 * 60, // 3 month cliff
};
```

### 3. Community Rewards

```js
// Weekly distribution over 1 year, no cliff
const communityVesting = {
  vestingPeriod: 7 * 24 * 60 * 60, // 7 days
  totalPeriods: 52, // 1 year weekly
  startTime: Math.floor(Date.now() / 1000), // Start immediately
};
```

## Parameters

### Required Fields

| Parameter       | Type     | Description                        | Example             |
| --------------- | -------- | ---------------------------------- | ------------------- |
| `vestingPeriod` | `number` | Duration between unlocks (seconds) | `2592000` (30 days) |
| `totalPeriods`  | `number` | Total number of unlock periods     | `12` (12 unlocks)   |
| `startTime`     | `number` | Unix timestamp when vesting begins | `1700000000`        |

### Validation Rules

- **vestingPeriod**: Must be ≥ 1 hour and ≤ 10 years
- **totalPeriods**: Must be ≥ 1 and ≤ 1000
- **startTime**: Cannot be in the past (5-minute buffer allowed)
- **Total Duration**: Combined duration cannot exceed 20 years

## Usage Examples

### Basic Implementation

```js
import { vestingControl } from '@1inch/limit-order-sdk';

// Define vesting schedule
const vestingParams = {
  preInteraction: {
    vestingPeriod: 2592000, // 30 days
    totalPeriods: 12, // 12 months
    startTime: Math.floor(Date.now() / 1000) + 7776000, // 90 day cliff
  },
};

// Validate parameters
const errors = vestingControl.validate(vestingParams);
if (errors) {
  console.error('Validation failed:', errors);
  return;
}

// Build extension
const extension = await vestingControl.build(vestingParams);

// Use with order builder
const order = orderBuilder
  .setMakerAsset(projectTokenAddress)
  .setTakerAsset(paymentTokenAddress)
  .setMakingAmount(totalVestingAmount)
  .setTakingAmount(paymentAmount)
  .setExtension(extension)
  .build();
```

### Complete Vesting Workflow

```js
// 1. Create vesting order
const order = {
  makerAsset: projectToken.address,
  takerAsset: paymentToken.address,
  makingAmount: ethers.parseEther('1000'), // 1000 tokens
  takingAmount: ethers.parseEther('100'), // 100 payment tokens
  // ... other order fields
  extension: vestingExtensionData,
};

// 2. Sign order
const signature = await signer.signTypedData(domain, types, order);

// 3. Investor fills order (respecting vesting schedule)
const amountToFill = ethers.parseEther('111'); // ~1/9 of total (one period)
await limitOrderProtocol.fillOrder(order, signature, amountToFill);

// 4. Vesting enforcement is handled automatically by preInteraction
// The LOP will only allow fills that respect the vesting schedule
```

## Integration Patterns

### Frontend Integration

```js
// Calculate available amounts for UI
function calculateVestingStatus(vestingParams, totalAmount, claimed) {
  const { vestingPeriod, totalPeriods, startTime } = vestingParams;
  const now = Math.floor(Date.now() / 1000);

  if (now < startTime) {
    return {
      phase: 'cliff',
      nextUnlock: startTime,
      availableAmount: 0,
    };
  }

  const periodsElapsed = Math.floor((now - startTime) / vestingPeriod) + 1;
  const periodsCompleted = Math.min(periodsElapsed, totalPeriods);
  const amountPerPeriod = totalAmount / totalPeriods;
  const totalVested = amountPerPeriod * periodsCompleted;
  const availableAmount = Math.max(0, totalVested - claimed);

  return {
    phase: periodsCompleted >= totalPeriods ? 'completed' : 'active',
    periodsCompleted,
    totalPeriods,
    availableAmount,
    nextUnlock:
      periodsCompleted < totalPeriods
        ? startTime + periodsCompleted * vestingPeriod
        : null,
  };
}
```

### Event Monitoring

```js
// Listen for vesting events
vestingControl.on('VestingUnlock', (taker, amount, period, timestamp) => {
  console.log(`🎉 Vesting unlock: ${ethers.formatEther(amount)} tokens`);
  console.log(`📅 Period: ${period}/${totalPeriods}`);
  console.log(`⏰ Time: ${new Date(timestamp * 1000)}`);

  // Update UI, send notifications, etc.
  updateVestingDashboard(taker, amount, period);
});
```

## Error Handling

### Common Errors

| Error                      | Cause                                | Solution                         |
| -------------------------- | ------------------------------------ | -------------------------------- |
| `VestingNotStarted`        | Attempting to claim before startTime | Wait until vesting period begins |
| `InvalidUnlockAmount`      | Claiming too much for current period | Reduce claim amount              |
| `VestingAlreadyCompleted`  | All tokens have been claimed         | No more tokens available         |
| `InvalidVestingParameters` | Invalid configuration                | Check parameter validation       |

### Error Handling Example

```js
try {
  await limitOrderProtocol.fillOrder(order, signature, amount);
} catch (error) {
  if (error.message.includes('VestingNotStarted')) {
    showMessage(
      'Vesting has not started yet. Please wait for the cliff period to end.'
    );
  } else if (error.message.includes('InvalidUnlockAmount')) {
    showMessage('Cannot claim more than allowed for current vesting period.');
  }
}
```

## Security Considerations

### Best Practices

1. **Validate Parameters**: Always validate vesting parameters before creating orders
2. **Monitor Events**: Track VestingUnlock events for transparency
3. **Check Status**: Query vesting status before attempting fills
4. **Handle Rounding**: Account for rounding in final periods
5. **Time Buffers**: Allow small time buffers for network delays

### Common Pitfalls

- **Clock Skew**: Account for minor time differences between systems
- **Gas Estimation**: Vesting validation adds computational cost
- **Partial Fills**: Ensure UI handles partial period claims correctly
- **Final Period**: Last period may have different amount due to rounding

## Gas Optimization

The VestingControl extension is designed for gas efficiency:

- **Stateless**: No storage reads/writes
- **Minimal Computation**: Simple arithmetic operations
- **Event-Driven**: Efficient logging for off-chain tracking
- **Batch Operations**: Can be combined with other extensions

## Testing

```bash
# Run extension tests
npm test -- VestingControl

# Run integration tests
npm run test:integration -- vesting

# Test specific scenarios
npm run test -- --grep "startup vesting"
```

## Configuration

Update your config to include the VestingControl deployment address:

```js
// config.js
export default {
  extensions: {
    vestingControl: {
      address: '0x...', // VestingControl contract address
    },
  },
};
```

## Support

For questions, issues, or feature requests:

- 📚 [Documentation](./Extensions.md)
- 🐛 [Issue Tracker](https://github.com/1inch/limit-order-protocol/issues)
- 💬 [Discord Community](https://discord.gg/1inch)
- 📧 [Developer Support](mailto:dev@1inch.io)

---

**💡 Pro Tip**: Use the VestingControl extension in combination with other extensions like GasStation for gasless vesting claims!
