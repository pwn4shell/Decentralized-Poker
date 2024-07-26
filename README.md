# ODP - Open Decentralized Poker

## Table of Contents
- [Introduction](#introduction)
- [Project Overview](#project-overview)
- [Project Structure](#project-structure)
  - [Smart Contracts](#smart-contracts)
  - [Frontend](#frontend)
- [Getting Started](#getting-started)
- [Testing](#testing)
- [Challenges and Solutions](#challenges-and-solutions)
- [Contributing](#contributing)
- [Legal Disclaimer](#legal-disclaimer)
- [Resources and Links](#resources-and-links)

## Introduction

Welcome to ODP - The Open Decentralized Poker Project! Our goal is to create the first fully decentralized peer-to-peer poker game using EVM smart contracts and cryptography. This project aims to ensure fairness and security in online poker through blockchain technology.

## Project Overview

ODP is a technically challenging project due to the computational constraints of Web3 backends and the complexity of dealing cards privately in a trustless, permissionless environment. Our solution leverages the transparency of blockchain transactions while maintaining the necessary privacy for a fair poker game.

## Project Structure

### Smart Contracts

1. **PokerHandEvaluator.sol**
   - Compares poker hands to determine the winner
   - Evaluates hand strength and ranks hands

2. **PokerChips.sol**
   - Implements an ERC20 token for in-game currency
   - Handles 1:1 deposits and withdrawals with USDC
   - Both PokerChips and USDC use 6 decimal places

3. **PokerDealer.sol**
   - Manages random, private card distribution
   - Ensures on-chain verifiability of card dealing
   - Implements a solution for trustless card dealing (see [Challenges and Solutions](#challenges-and-solutions))

4. **PokerGame.sol**
   - Contains core game logic (betting rounds, blinds, dealer rotation)
   - Manages game flow and rule enforcement

### Frontend

- **dApp Client** (Future Development)
  - Will provide a user-friendly interface for the game
  - To be developed after finalizing core contract functionality

## Getting Started

To set up the ODP project locally:

1. Clone the repository:
   ```bash
   git clone https://github.com/your-repo/open-decentralized-poker.git
   cd open-decentralized-poker
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Compile the smart contracts:
   ```bash
   npx hardhat compile
   ```

## Testing

Run the test suite to ensure all contracts function as expected:

```bash
npx hardhat test
```

We encourage contributors to add more tests and submit pull requests to improve code coverage and reliability.

## Challenges and Solutions

One of the main challenges in decentralized poker is dealing cards privately while ensuring fairness. We've explored several solutions:

1. **Third-party Dealer (Oracle)**
   - Pros: Simpler implementation
   - Cons: Relies on a trusted third party
   - Demo in scripts/dealer.js and dealer-client.js

2. **Player-generated Randomness**
   - Current implementation in `PokerDealer.sol`
   - Uses a combination of player-generated keys and future block hashes
   - Pros: Fully decentralized, trustless and permissionless
   - Cons: Potential for duplicate hole cards and 6 of a kind

3. **Alternative Solutions**
   - Open to suggestions for improving the card dealing mechanism

## Contributing

We welcome contributions to the ODP project! Here's how you can help:

1. Fork the repository
2. Create a new branch for your feature or bug fix
3. Commit your changes and push to your fork
4. Submit a pull request with a clear description of your changes

Please ensure your code adheres to the project's coding standards and includes appropriate tests.

## Legal Disclaimer

This software is intended for educational and experimental purposes only. The use of this software for real money gambling may be illegal in your jurisdiction. Users are solely responsible for ensuring compliance with all applicable laws and regulations.

Online gambling is heavily regulated or prohibited in many areas. This software is provided "as is" without any warranties. The developers and contributors shall not be held liable for any damages arising from its use.

By using this software, you acknowledge that you understand and accept these terms.

## Resources and Links

For more information, tutorials, and updates, check out these resources:

- [James Bachini's Blog](https://jamesbachini.com)
- [YouTube Channel](https://www.youtube.com/c/JamesBachini?sub_confirmation=1)
- [Substack Newsletter](https://bachini.substack.com)
- [Podcast on Spotify](https://podcasters.spotify.com/pod/show/jamesbachini)
- [Twitter](https://twitter.com/james_bachini)
- [LinkedIn](https://www.linkedin.com/in/james-bachini/)
- [GitHub](https://github.com/jamesbachini)

We appreciate your interest in the Open Decentralized Poker project. For questions, feedback, or contributions, please reach out through any of the channels above.
