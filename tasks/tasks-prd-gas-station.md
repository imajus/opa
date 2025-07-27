## Relevant Files

## Reference

- `orig/AggregationRouterV6.sol` - Source code of 1Inch LOP + Aggregation smart contract.
- `node_modules/@1inch/limit-order-protocol-contract/contracts/extensions/DutchAuctionCalculator.sol` - an example implementation of `getMakerAsset`/`getTakerAsset` extension
- `node_modules/@1inch/limit-order-protocol-contract/contracts/extensions/OrderIdInvalidator.sol` - an example implementation of `preInteraction` extension
- `test/extensions` - tests for pre-build extensions

## To Be Modified

- `contracts/extensions/GasStation.sol` - Core Gas Station extension implementing dynamic taking amount, flash-loan, swap, and repayment logic.
- `contracts/extensions/FlashLoanAdapter.sol` - Minimal adapter that wraps Aave v3 `flashLoanSimple` for delegatecall from pre-interaction.
- `ignition/modules/GasStation.js` - Ignition deployment module for the Gas Station contract.
- `ignition/modules/AllExtensions.js` - Aggregates and exports all extension deployment modules; update to include Gas Station.
- `test/extensions/GasStation.test.js` - Full unit & integration test-suite covering happy & failure paths.
- `test/helpers/fixtures.js` - Shared Hardhat fixtures extended to deploy and initialise Gas Station.
- `README.md` - Project documentation; will gain a section on Gas Station usage.
- `tasks/prd-gas-station.md` - Original Product Requirements Document.
- `tasks/tasks-prd-gas-station.md` - This generated task list to track progress.

## Tasks

- [ ] 1.0 Contract Implementation – Gas Station Extension

  - [ ] 1.1 Design storage layout & immutables (`takerFeeBps`, `gasStipend`, aggregator & WETH addresses).
  - [ ] 1.2 Implement `getTakerAmount()` & `getMakerAmount()` math using 1inch Aggregator spot price minus fees & gas reimbursement.
  - [ ] 1.3 Implement **pre-interaction** to obtain flash-loan via `FlashLoanAdapter` (delegatecall pattern).
  - [ ] 1.4 Implement **post-interaction**: swap Maker asset → WETH, repay flash-loan (`amount + fee`), reimburse Taker (gas + fee).
  - [ ] 1.5 Write NatSpec comments & inline docs; run `solhint`.
  - [ ] 1.6 Internal review & refactor for gas efficiency (non-goal optimisations kept minimal).

- [ ] 2.0 External Protocol Integration & Adapters

  - [ ] 2.1 Scaffold `FlashLoanAdapter.sol` calling Aave v3 `flashLoanSimple` for WETH with delegatecall compatibility.
  - [ ] 2.2 Implement adapter accounting to ensure correct repayment expectations.
  - [ ] 2.3 Wire 1inch Aggregator oracle call into extension; validate path & decimals.
  - [ ] 2.4 Update `AllExtensions.js` to include Gas Station deployment export.
  - [ ] 2.5 Unit test adapter logic in isolation (mocking Aave pool).

- [ ] 3.0 Testing & Verification

  - [ ] 3.1 Extend `test/helpers/fixtures.js` to deploy Gas Station, mocks, and fixtures.
  - [ ] 3.2 Write `GasStation.test.js` happy-path: Maker swaps stablecoin → WETH, Taker reimbursed +1 %.
  - [ ] 3.3 Write failure test: swap returns insufficient WETH -> transaction reverts.
  - [ ] 3.4 Edge-case tests: rounding errors, extreme gas price, unsupported token.
  - [ ] 3.5 Measure gas usage; assert ≤ 600 k via `eth_estimateGas`.
  - [ ] 3.6 Run coverage & ensure >90 % for new contracts.
  - [ ] 3.7 Add GitHub Actions job to run tests & coverage on every PR.

- [ ] 4.0 Deployment & CI Pipeline

  - [ ] 4.1 Create `ignition/modules/GasStation.js` with constructor params and proper dependency wiring.
  - [ ] 4.2 Add deployment script for local network.

- [ ] 5.0 Documentation & Demo Resources

  - [ ] 5.1 Create `docs/extensions/GasStation.md` with Gas Station overview, parameters, and example order JSON.
