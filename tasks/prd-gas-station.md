# Gas Station Extension for 1inch Limit Order Protocol (PoC)

## 1. Introduction / Overview

New crypto users often hold stablecoins but lack native gas tokens. This proof-of-concept (PoC) “Gas Station” extension lets a Maker pay trading gas fees indirectly by accepting slightly fewer output tokens. A Relayer (Taker) submits the order, pays gas in ETH, and is reimbursed from the swap proceeds. The extension handles flash-borrowing WETH, dynamic price quoting and repayments, achieving a single-transaction fill.

## 2. Goals

1. Enable Makers to swap token A (stablecoin) → token B (limited to WETH) without owning ETH for gas.
2. Compensate Takers for gas used and a fixed 1 % fee, paid from the Maker’s output amount.
3. Integrate Aave v3 flash-loan facility for borrowing WETH.
4. Deliver the entire flow inside a single `fillOrder` execution via get taker amount & pre/post-interaction hooks.
5. Provide JavaScript Hardhat tests that demonstrate the happy path and failure when flash-loan cannot be repaid.

## 3. User Stories

| As a …                          | I want to …                                                    | So that …                                      |
| ------------------------------- | -------------------------------------------------------------- | ---------------------------------------------- |
| **Maker** (newcomer with token) | create a limit order to receive WETH without holding ETH       | I avoid buying ETH specifically for gas        |
| **Taker / Relayer**             | submit the order, pay gas, and receive reimbursement + 1 % fee | I am economically incentivised to relay orders |
| **Protocol integrator**         | rely on the extension’s dynamic price & repayment logic        | I don’t have to maintain custom on-chain maths |

## 4. Functional Requirements

1. **Dynamic Taking Amount** – Extension must compute `takingAmount` at call time using the 1inch Aggregator spot price of Maker asset → WETH minus:
   1. lender flash-loan fee,
   2. fixed 1 % Taker fee,
   3. `gasStipend * tx.gasprice` (gas reimbursement).
2. **Maker Asset Transfer** - LOP transfers Maker's asset to the Taker. Support ERC-2612 / Permit2 so Maker can approve tokens gaslessly.
3. **Pre-interaction – Flash-loan**
   1. Borrow required WETH from Aave v3 using `flashLoanSimple`.
4. **Taker Asset Transfer** - LOP transfers Taker's asset to the Maker (no permit, pre-approved)
5. **Post-interaction – Swap**
   1. Swap received Maker asset → WETH via 1inch Aggregator, output kept in extension.
6. **Post-interaction – Repayment**
   1. Repay lender `borrowed + fee` WETH.
   2. Refund the rest `(gasReimbursement + takerFee)` in WETH to the Taker.
7. **Failure Handling** – Revert the whole transaction if flash-loan repayment fails or swap returns insufficient WETH.
8. **WETH Un-wrapping** – Allow independent un-wrapping for Maker or Taker via LOP traits (out of extension scope but tested).

## 5. SDK / Tooling

- **Contracts:** Solidity ^0.8.x
- **Build/Test:** Hardhat, JavaScript tests (Mocha + Chai via `@1inch/solidity-utils`)
- **External Deps:**
  - 1inch Limit Order Protocol
  - 1inch Aggregator (spot price + swap)
  - Aave v3 (flash loans)

## 6. Non-Goals (Out of Scope)

1. Gas optimisation / minimal calldata.
2. MEV protection or sandwich-resistant quoting.
3. Support for non-ERC20 fee-on-transfer tokens.
4. Multiple lender selection / rate shopping.
5. Off-chain order distribution UX.

## 7. Design Considerations (Optional)

- Limit output token to **WETH** for PoC simplicity; un-wrapping is handled externally.
- Fixed `takerFeeBps = 100` (1 %) is stored as an immutable in the extension.
- `gasStipend` constant (e.g. 150 k) multiplied by `tx.gasprice` approximates gas reimbursement.
- Oracle call to 1inch Aggregator doubles as swap path discovery, reducing external calls.

## 8. Technical Considerations (Optional)

- Use pre-interaction to `delegatecall` into the lending protocol adapter, minimising trusted surface.
- Ensure atomic approval via `permit()` data embedded in order.
- Carefully validate `takingAmount` maths to avoid under-repayment due to rounding.
- Flash-loan provider choice: Aave v3 WETH pool (0.05 % fee) — widely available and battle-tested.

## 9. Success Metrics

1. End-to-end test passes: Maker receives ≥ `spotPriceOut – all fees` WETH.
2. Gas usage per happy-path tx ≤ 600 k.
3. 100 % of attempted fills revert when swap output < repayment amount.

## 10. Optional / Stretch Goals

1. **Partial Fills** – allow order to be filled in chunks.
2. **Multiple Lenders** – choose lowest flash-loan fee dynamically.
3. **Aggregator Path Optimiser** – use 1inch Pathfinder API for best routes.
4. **On-chain Gas Price Oracle** – replace `tx.gasprice` estimation.
5. **Generic Taker Asset** – extend output token beyond WETH to support any ERC-20 asset, with generic flash-loan and repayment logic.
6. **Dynamic Taker Fee** - make `takerFeeBps` adjustable by the Maker.
