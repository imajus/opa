# Product Requirements Document: OPA Frontend Pages (PoC)

## 1. Introduction / Overview

OPA (Order Protocol Automation) is a no-code visual tool that enables users to build, sign, and execute advanced trading strategies on the 1inch Limit Order Protocol (LOP). This proof-of-concept (PoC) focuses on delivering the first public-facing frontend for OPA, comprised of four pages—Landing, Strategy Builder, Create Order, and Fill Order—implemented in the existing `/frontend` Next.js project.

## 2. Goals

1. Provide a minimal but functional UI that lets makers compose strategies and create signed orders, and lets takers fill those orders.
2. Showcase the flexibility of LOP extensions from the shared `builder/` package.
3. Operate fully client-side with no backend persistence; page state is passed via base64-encoded URL parameters.
4. Demonstrate cross-wallet interoperability using RainbowKit (ethers under the hood).

## 3. User Stories

1. **Maker – Simple Strategy**  
   _As a DeFi power user, I want to select the Gas Station extension, specify basic swap parameters, and sign my order so that I can share a gasless trade with friends._
2. **Maker – Advanced Strategy**  
   _As a professional trader, I want to create a Dutch Auction strategy with additional Chainlink price predicate parameters so that my order fills only under favourable market conditions._
3. **Taker – Fill Order**  
   _As a newcomer, I want to load a shared Fill Order link, quickly approve token spending, and execute the trade without touching all the LOP complexity._

## 4. Functional Requirements

### 4.1 Landing Page (`/`)

1. Display project logo (`/frontend/public/landing-logo.png`), name "OPA", and few-sentences description.
2. Primary CTA button: “Build a Strategy” → `/strategy`.
3. Secondary CTA link: GitHub repo (opens new tab).

### 4.2 Strategy Builder Page (`/strategy`)

1. List available LOP extensions imported from `builder/src/index.js` (Gas Station, Chainlink Calculator, Dutch Auction Calculator, Range Amount Calculator).
2. Allow users to select one or multiple extensions (prevent incompatible combinations by detecting hook collisions using builder API).
3. List parameters supported per extension for the reference, do not accept any values at this stage yet.
4. Submit button serialises selected extensions to base64 JSON and navigates to `/create?blueprint=...`.

### 4.3 Create Order Page (`/create`)

1. Parse `blueprint` query param and initialise builder instance.
   a. If the `blueprint` query param is missing, create a simple order with no extensions.
2. Render editable fields for all order parameters: makerAsset, makerAmount, takerAsset, takerAmount, receiver, expiration, nonce, partial/multiple fill flags, plus all extensions-specific params.
3. Fetch chainId & account via RainbowKit; enforce wallet connection before signing.
4. On “Review & Sign”, build ERC-20 permit (use mockup implementation for this) and call `builder.build(signer, params)` from shared package.
5. After successful build, navigate to `/fill?order=...` with base64-encoded result (order struct, signature, extension data).

### 4.4 Fill Order Page (`/fill`)

1. Parse `order` query param (required); display summary (assets, amounts, strategy description).
2. Detect taker wallet network; allow switching if necessary.
3. Step 1 button: “Approve [Token]” – sends ERC-20 `approve()` for takerAsset.
4. Step 2 button: “Fill Order” – sends LOP `fillOrder()` tx with serialized order & signature.
5. On success, show confirmation & Etherscan link.

## 5. SDK / Tooling

- **Framework:** Next.js (App Router) with React 18
- **Wallet:** RainbowKit + ethers v6
- **UI:** TailwindCSS; orange (#F97316) & green (#10B981) theme accents
- **Builder Integration:** Import `builder/` package source via local path alias or direct symlink in `frontend/package.json` (e.g., "builder": "file:../builder") to reuse extension wrappers and order-building logic.

## 6. Non-Goals (Out of Scope)

1. Order cancellation UI
2. Server-side persistence or database
3. Gas/price simulation or slippage protection
4. i18n/localisation

## 7. Design Considerations (Optional)

- Clean, single-column layout with step-by-step cards.
- Use orange for primary actions, green for success states.
- Responsive up to mobile breakpoint (sm) and desktop (lg).

## 8. Technical Considerations (Optional)

1. Support any EVM network by reading `chainId` from wallet; do not hard-code network list.
2. Handle extension hook collisions in the UI before building the order.

## 9. Success Metrics

- Demo success during hackathon: create & fill at least one Gas Station order on a localhost fork of mainnet.

## 10. Optional / Stretch Goals

1. Strategy sharing gallery with social previews.
2. Persist blueprints to GitHub Gist or IPFS for shorter links.
3. Order simulation (price impact, gas estimate).

## 11. Open Questions

1. Final approach for importing `builder/` (symlink vs npm workspace publish)? - symlink
2. Predicate builder UI scope (Chainlink price predicates mentioned but not yet implemented) - skip for now
3. Should we pre-detect ERC-20 permit support, or require maker to toggle it manually? - let's presume that it's always supported
