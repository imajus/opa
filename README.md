## Description

**OPA** (Order Protocol Automation) is an easy-to-use no-code tool for building smart trading and liquidity strategies on the 1inch Limit Order Protocol (LOP). It’s made for both DeFi pros and regular traders, letting anyone create powerful automation without any coding or deep DeFi knowledge.

- **User-Friendly and Finance-Focused:**

  OPA unlocks the full potential of LOP, allowing users to create advanced trading strategies like stop-loss, follow-the-whale, NFT-gated, or custom ones. Its simple interface makes it easy for even central exchange traders to jump in and focus on their goals while OPA handles the technical details.

- **Easy Setup and Sharing:**

  You can export and share your strategies as templates, helping experienced users share their setups with others who can customize and use them quickly. This makes learning easier and encourages collaboration in DeFi.

- **Safe and Non-Custodial:**

  Orders are made and signed right from your wallet—OPA never holds your funds. This keeps everything secure and builds trust.

- **Trusted and Open:**

  All orders run on the well-audited, open 1inch LOP smart contracts. The system is transparent and open to community review.

- **Flexible Building Blocks for Creative Strategies:**

  Instead of fixed templates, OPA offers core tools like logic, math modules, and workflows to help users build and share their own unique trading strategies, creating a new community-driven market powered by LOP.

## Vision

OPA democratizes high-performance DeFi automation. It empowers anyone—from solo traders to DAOs—to create, share, and deploy world-class order strategies, unlocking use cases that neither legacy CEXes nor most DeFi apps can touch. By making advanced automation accessible, collaborative, and secure, OPA brings the next generation of financial creativity to everyone.

> With OPA, users focus on strategy—not syntax or protocols—while tapping into the unmatched flexibility and security of the 1inch Limit Order Protocol. Welcome to DeFi, supercharged for the next era of trading innovation.

## How it's made

### Open-Source, Extensible Tooling

Each tool and building block is created through a simple JavaScript API. There are existing LOP extensions which were converted to OPA tools, and few created from scratch:

- [UniswapCalculator](./backend/docs/extensions/UniswapCalculator.md) (new) - Enable dynamic amount calculations based on current market prices from Uniswap V3 pools
- [VestingControl](./backend/docs/extensions/VestingControl.md) (new) - Enable token vesting with cliff periods and scheduled unlocks for investor protection
- [GasStation](./backend/docs/extensions/GasStation.md) (unfinished) - Enable gasless limit order execution with automated WETH-based fee coverage

### Dedicated, Modular Stage Handlers

Each protocol extension point— Maker/Taker Amount Calculators, Pre- and Post-Interactions—is managed, rendered, and validated independently, ensuring maintainability and clear separation of concerns.

### Modern Web Stack

Built on React, JavaScript/TypeScript, ethers.js, Hardhat and the official 1inch SDK.

Variety of 1Inch API endpoints has been integrated:

- [Token API](./frontend/lib/1inch/Token.js) - dropdown list of suggested tokens on Create Order page
- [Balances API](./frontend/lib/1inch/Balance.js) - token holdings verification on Fill Order page
- [Domains API](./frontend/lib/1inch/Domains.js) - converting between ENS domain ⇄ address for better UX
- [Spot Price API](./frontend/lib/1inch/Spot.js) - suggesting taking amont on Create Order page and displaying token prices on Fill Order page

### Live Demo

- [Live Demo](https://opa-577.pages.dev/)
- [Transaction](https://basescan.org/tx/0x8a3dac2433c7ecd83f33e39cbf86bad59e79c3d015d38813579c51ec13af18d5) created during the presentation
