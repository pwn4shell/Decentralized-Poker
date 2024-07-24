
# ODP - Open Decentralized Poker

Welcome to ODP The Open Decentralized Poker Project! This project aims to create a fully decentralized p2p poker game using EVM smart contracts and cryptography to ensure fairness and security. Below you will find a detailed overview of the different components of the project.

## Project Structure

### Contracts

#### `contracts/PokerHandSolver.sol`

This contract is responsible for comparing poker hands to determine the winner. It contains the logic to evaluate the strength of different poker hands and find out which one is the strongest.

#### `contracts/PokerChips.sol`

This contract implements an ERC20 token named "PokerChips" used in the game. Players use PokerChips to place bets, and winnings are paid out in PokerChips.

#### `contracts/Dealer.sol` (2do)

The Dealer contract handles the generation of private card dealing using Zero Knowledge Proofs. The cards are dealt in a way that is verifiable on-chain, ensuring fairness. At the end of the game, all players reveal their keys to decode their hands, allowing all parties to see the cards.

#### `contracts/GameLogic.sol` (2do)

This contract contains the core logic for the poker game, including the betting rounds and dealing of the community cards (flop, turn, river). It manages the flow of the game and ensures that all rules are followed correctly.

#### `contracts/Casino.sol` (2do)

The Casino contract encompasses the broader logic of the game, including funding player accounts, joining games, and other administrative tasks necessary for the smooth operation of the poker client.

### Frontend

#### dApp Client

The frontend client should provide a interface which brings the game to the end user. We have access to a web2 frontend which could be modified to use the smart contracts on the backend. There's still fundamental work to be done on the contracts and dealing mechanism before starting on the UI.

## Unit Tests

Unit tests are written in Hardhat and can be found in the `test/` directory. These tests attempt to ensure that all the contracts function as expected and adhere to the defined rules and logic of the game.

Feel free to add more tests and put in a pull request ♥️

## Getting Started

To get started with the Decentralized Poker Client, follow these steps:

1. **Clone the repository:**

    ```bash
    git clone https://github.com/your-repo/decentralized-poker-client.git
    cd decentralized-poker-client
    ```

2. **Install dependencies:**

    ```bash
    npm install
    ```

3. **Compile the contracts:**

    ```bash
    npx hardhat compile
    ```

4. **Run the tests:**

    ```bash
    npx hardhat test
    ```

## Legal Disclaimer
This software is intended for educational and experimentation purposes only. The use of this software to facilitate real money gambling may be illegal in your jurisdiction. You are solely responsible for ensuring that your use of this software complies with all applicable local, national, and international laws.

Online gambling is heavily regulated or banned in many jurisdictions. You must check with your local legislation before using this software. This software is provided "as is", without warranty of any kind, express or implied. The developers and contributors of this software shall not be held liable for any damages arising from the use of this software. This software is not fit for production use. It is intended solely for research and educational purposes.By using this software, you acknowledge and agree that you are responsible for complying with all applicable laws and regulations. The contributors to this open source software disclaim all liability for any use of this software in violation of regional law or regulation around the world.

## Links

For more information, tutorials, and updates, check out the following links:

- [James Bachini Blog](https://jamesbachini.com)
- [James Bachini YouTube Channel](https://www.youtube.com/c/JamesBachini?sub_confirmation=1)
- [James Bachini on Substack](https://bachini.substack.com)
- [James Bachini Podcast on Spotify](https://podcasters.spotify.com/pod/show/jamesbachini)
- [James Bachini on Spotify](https://open.spotify.com/show/2N0D9nvdxoe9rY3jxE4nOZ)
- [James Bachini on Twitter](https://twitter.com/james_bachini)
- [James Bachini on LinkedIn](https://www.linkedin.com/in/james-bachini/)
- [James Bachini on GitHub](https://github.com/jamesbachini)

We hope you enjoy using the Decentralized Poker Client! If you have any questions or feedback, feel free to reach out through any of the links above.
