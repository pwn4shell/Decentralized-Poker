const { expect } = require("chai");
const { ethers } = require("hardhat");

function shuffleDeck(hash) {
    let deck = [...Array(52).keys()].map(i => i + 1); // [1 to 52]
    let shuffledDeck = [...deck];
    for (let i = 0; i < shuffledDeck.length; i++) {
        let combined = ethers.solidityPacked(["bytes32", "uint256"], [hash, i]);
        let randomIndex = BigInt(ethers.keccak256(combined), 16) % BigInt(shuffledDeck.length);
        let temp = shuffledDeck[i];
        shuffledDeck[i] = shuffledDeck[randomIndex];
        shuffledDeck[randomIndex] = temp;
    }
    return shuffledDeck;
  }
  
  function shuffleAndDeal(blockHash, privateKey) {
    let combinedHash = ethers.keccak256(ethers.concat([
        ethers.getBytes(blockHash), 
        ethers.getBytes(privateKey)
    ]));
    let shuffledDeck = shuffleDeck(combinedHash);
    return shuffledDeck.slice(0, 7);
  }

describe("PokerGame.sol", function () {
  let pokerGame;
  let handEvaluator;
  let pokerChips;
  let pokerDealer;
  let owner;
  let addr1;
  let addr2;
  let addr3;

  beforeEach(async function () {
    [owner, addr1, addr2, addr3] = await ethers.getSigners();
    const HandEvaluator = await ethers.getContractFactory("PokerHandEvaluator");
    handEvaluator = await HandEvaluator.deploy();
    MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy("USD Coin", "USDC");
    const PokerChips = await ethers.getContractFactory("PokerChips");
    pokerChips = await PokerChips.deploy(await usdc.getAddress());
    const PokerDealer = await ethers.getContractFactory("PokerDealer");
    pokerDealer = await PokerDealer.deploy();
    const PokerGame = await ethers.getContractFactory("PokerGame");
    pokerGame = await PokerGame.deploy(await handEvaluator.getAddress(), await pokerChips.getAddress(), await pokerDealer.getAddress());
    // Set up initial balances
    await usdc.mint(addr1.address, ethers.parseEther("1000"));
    await usdc.mint(addr2.address, ethers.parseEther("1000"));
    await usdc.mint(addr3.address, ethers.parseEther("1000"));
    await usdc.connect(addr1).approve(await pokerChips.getAddress(), ethers.parseEther("1000"));
    await usdc.connect(addr2).approve(await pokerChips.getAddress(), ethers.parseEther("1000"));
    await usdc.connect(addr3).approve(await pokerChips.getAddress(), ethers.parseEther("1000"));
    await pokerChips.connect(addr1).depositUSDC(ethers.parseEther("1000"));
    await pokerChips.connect(addr2).depositUSDC(ethers.parseEther("1000"));
    await pokerChips.connect(addr3).depositUSDC(ethers.parseEther("1000"));
  });

  describe("Game Creation", function () {
    it("Should create a new game", async function () {
      const maxPlayers = 6;
      const smallBlind = ethers.parseEther("1");
      const bigBlind = ethers.parseEther("2");
      const handPublicKey = ethers.randomBytes(32);
      await expect(pokerGame.createGame(maxPlayers, smallBlind, bigBlind, handPublicKey))
        .to.emit(pokerGame, "GameCreated");
      const game = await pokerGame.games(1);
      expect(game.maxPlayers).to.equal(maxPlayers);
      expect(game.smallBlind).to.equal(smallBlind);
      expect(game.bigBlind).to.equal(bigBlind);
    });

    it("Should fail to create a game with invalid parameters", async function () {
      await expect(pokerGame.createGame(1, ethers.parseEther("1"), ethers.parseEther("2"), ethers.randomBytes(32)))
        .to.be.revertedWith("Invalid number of players");

      await expect(pokerGame.createGame(6, ethers.parseEther("1"), ethers.parseEther("3"), ethers.randomBytes(32)))
        .to.be.revertedWith("Big blind must be twice the small blind");
    });
  });

  describe("Joining a Game", function () {
    let gameId;

    beforeEach(async function () {
      const tx = await pokerGame.createGame(6, 10, 20, ethers.randomBytes(32));
      const receipt = await tx.wait();
      gameId = receipt.logs[0].args[0];
    });

    it("Should allow a player to join the game", async function () {
      const handPublicKey = ethers.randomBytes(32);
      await pokerChips.connect(addr1).approve(await pokerGame.getAddress(), 2000);

      await expect(pokerGame.connect(addr1).joinGame(gameId, 0, handPublicKey))
        .to.emit(pokerGame, "PlayerJoined");

      const game = await pokerGame.games(gameId);
      expect(game.activePlayers).to.equal(1);
    });

    it("Should fail to join a game with insufficient chips", async function () {
      const handPublicKey = ethers.randomBytes(32);
      await pokerChips.connect(addr1).approve(await pokerGame.getAddress(), 1000);
      await expect(pokerGame.connect(addr1).joinGame(gameId, 0, handPublicKey))
        .to.be.reverted;
    });
  });

  describe("Game Flow", function () {
    let gameId;

    beforeEach(async function () {
      const tx = await pokerGame.createGame(2, 10, 20, ethers.randomBytes(32));
      const receipt = await tx.wait();
      gameId = receipt.logs[0].args[0];

      await pokerChips.connect(addr1).approve(await pokerGame.getAddress(), 2000);
      await pokerChips.connect(addr2).approve(await pokerGame.getAddress(), 2000);

      await pokerGame.connect(addr1).joinGame(gameId, 0, ethers.randomBytes(32));
      await pokerGame.connect(addr2).joinGame(gameId, 1, ethers.randomBytes(32));
      await pokerGame.dealHand(gameId);
    });

    it("Should start the game when enough players have joined", async function () {
      const game = await pokerGame.games(gameId);
      expect(game.state).to.equal(1); // PreFlop
      expect(game.activePlayers).to.equal(2);
    });

    it("Should allow players to take actions", async function () {
      await expect(pokerGame.connect(addr1).playerAction(gameId, 2, 0)) // Call
        .to.emit(pokerGame, "Action");
      await expect(pokerGame.connect(addr2).playerAction(gameId, 3, 50)) // Raise
        .to.emit(pokerGame, "Action");
    });

    it("Should advance to the next round when all players have acted", async function () {
      await pokerGame.connect(addr1).playerAction(gameId, 2, 0); // Call
      await pokerGame.connect(addr2).playerAction(gameId, 2, 0); // Call
      const game = await pokerGame.games(gameId);
      expect(game.state).to.equal(2); // Flop
    });
  });

  describe("Simulate a Hand", function () {
    let gameId;
    let initialBalance1;
    let initialBalance2;
    let initialBalance3;

    beforeEach(async function () {
      const tx = await pokerGame.createGame(9, 1, 2, ethers.randomBytes(32));
      const receipt = await tx.wait();
      gameId = receipt.logs[0].args[0];

      await pokerChips.connect(addr1).approve(await pokerGame.getAddress(), 2000);
      await pokerChips.connect(addr2).approve(await pokerGame.getAddress(), 2000);
      await pokerChips.connect(addr3).approve(await pokerGame.getAddress(), 2000);

    });

    it("Should simulate heads up play", async function () {
        initialBalance1 = await pokerChips.balanceOf(addr1.address);
        initialBalance2 = await pokerChips.balanceOf(addr1.address);
        const handPrivateKey1 = ethers.encodeBytes32String("secret1");
        const handPublicKey1 = ethers.keccak256(handPrivateKey1);
        const handPrivateKey2 = ethers.encodeBytes32String("secret2");
        const handPublicKey2 = ethers.keccak256(handPrivateKey2);
        await pokerGame.connect(addr1).joinGame(gameId, 1, handPublicKey1);
        await pokerGame.connect(addr2).joinGame(gameId, 3, handPublicKey2);
        await pokerGame.connect(addr1).dealHand(gameId);
        const dealer = await pokerGame.getDealer(gameId);
        expect(dealer).to.equal(addr1.address);
        const hid = pokerGame.getHandId(gameId);
        await ethers.provider.send("evm_mine", []);
        await ethers.provider.send("evm_mine", []);
        const blockHash = await pokerDealer.getHash(hid);
        const cards1 = shuffleAndDeal(blockHash,handPrivateKey1);
        const cards2 = shuffleAndDeal(blockHash,handPrivateKey2);
        // Simulate game progression to showdown
        await pokerGame.connect(addr2).playerAction(gameId, 1, 0); // Check - heads up bb goes first preflop
        await pokerGame.connect(addr1).playerAction(gameId, 2, 0); // Call
        await pokerDealer.connect(addr1).flop(hid, cards1[2], cards1[3], cards1[4]);
        await pokerDealer.connect(addr2).flop(hid, cards2[2], cards2[3], cards2[4]);
        await pokerGame.connect(addr1).playerAction(gameId, 1, 0); // Check - dealer goes first all other rounds
        await pokerGame.connect(addr2).playerAction(gameId, 1, 0); // Check
        await pokerDealer.connect(addr1).turn(hid, cards1[5]);
        await pokerDealer.connect(addr2).turn(hid, cards2[5]);
        await pokerGame.connect(addr1).playerAction(gameId, 1, 0); // Check
        await pokerGame.connect(addr2).playerAction(gameId, 1, 0); // Check
        await pokerDealer.connect(addr1).river(hid, cards1[6]);
        await pokerDealer.connect(addr2).river(hid, cards2[6]);
        await pokerGame.connect(addr1).playerAction(gameId, 1, 0); // Check
        await pokerGame.connect(addr2).playerAction(gameId, 1, 0); // Check
        const gamex = await pokerGame.games(gameId);
        await pokerGame.connect(addr1).revealHand(gameId, handPrivateKey1, ethers.randomBytes(32));
        const game = await pokerGame.games(gameId);
        expect(game.state).to.equal(5); // showdown
        await pokerGame.connect(addr2).revealHand(gameId, handPrivateKey2, ethers.randomBytes(32));
        const newGame = await pokerGame.games(gameId);
        expect(newGame.state).to.equal(0); // Waiting
        const finalBalance1 = await pokerChips.balanceOf(addr1.address);
        const finalBalance2 = await pokerChips.balanceOf(addr2.address);
        expect(finalBalance1).to.not.equal(initialBalance1); // The balance should change
        expect(finalBalance2).to.not.equal(initialBalance2); // The balance should change
    });

    it("Should simulate 3 player game", async function () {
        initialBalance1 = await pokerChips.balanceOf(addr1.address);
        initialBalance2 = await pokerChips.balanceOf(addr2.address);
        initialBalance3 = await pokerChips.balanceOf(addr3.address);
        const handPrivateKey1 = ethers.encodeBytes32String("secret1");
        const handPublicKey1 = ethers.keccak256(handPrivateKey1);
        const handPrivateKey2 = ethers.encodeBytes32String("secret2");
        const handPublicKey2 = ethers.keccak256(handPrivateKey2);
        const handPrivateKey3 = ethers.encodeBytes32String("secret3");
        const handPublicKey3 = ethers.keccak256(handPrivateKey3);
        await pokerGame.connect(addr1).joinGame(gameId, 0, handPublicKey1);
        await pokerGame.connect(addr2).joinGame(gameId, 1, handPublicKey2);
        await pokerGame.connect(addr3).joinGame(gameId, 2, handPublicKey3);
        await pokerGame.connect(addr1).dealHand(gameId);
        const dealer = await pokerGame.getDealer(gameId);
        expect(dealer).to.equal(addr2.address);
        const hid = pokerGame.getHandId(gameId);
        await ethers.provider.send("evm_mine", []);
        await ethers.provider.send("evm_mine", []);
        const blockHash = await pokerDealer.getHash(hid);
        const cards1 = shuffleAndDeal(blockHash, handPrivateKey1);
        const cards2 = shuffleAndDeal(blockHash, handPrivateKey2);
        const cards3 = shuffleAndDeal(blockHash, handPrivateKey3);
        await pokerGame.connect(addr2).playerAction(gameId, 2, 0); // Call
        await pokerGame.connect(addr3).playerAction(gameId, 2, 0); // Call
        await pokerGame.connect(addr1).playerAction(gameId, 1, 0); // Check
        await pokerDealer.connect(addr1).flop(hid, cards1[2], cards1[3], cards1[4]);
        await pokerDealer.connect(addr2).flop(hid, cards2[2], cards2[3], cards2[4]);
        await pokerDealer.connect(addr3).flop(hid, cards3[2], cards3[3], cards3[4]);
        await pokerGame.connect(addr3).playerAction(gameId, 1, 0); // Check
        await pokerGame.connect(addr1).playerAction(gameId, 1, 0); // Check
        await pokerGame.connect(addr2).playerAction(gameId, 1, 0); // Check
        await pokerDealer.connect(addr3).turn(hid, cards3[5]);
        await pokerDealer.connect(addr1).turn(hid, cards1[5]);
        await pokerDealer.connect(addr2).turn(hid, cards2[5]);
        await pokerGame.connect(addr3).playerAction(gameId, 1, 0); // Check
        await pokerGame.connect(addr1).playerAction(gameId, 1, 0); // Check
        await pokerGame.connect(addr2).playerAction(gameId, 1, 0); // Check
        await pokerDealer.connect(addr1).river(hid, cards1[6]);
        await pokerDealer.connect(addr2).river(hid, cards2[6]);
        await pokerDealer.connect(addr3).river(hid, cards3[6]);
        await pokerGame.connect(addr3).playerAction(gameId, 1, 0); // Check
        await pokerGame.connect(addr1).playerAction(gameId, 1, 0); // Check
        await pokerGame.connect(addr2).playerAction(gameId, 1, 0); // Check
        await pokerGame.connect(addr1).revealHand(gameId, handPrivateKey1, ethers.randomBytes(32));
        await pokerGame.connect(addr2).revealHand(gameId, handPrivateKey2, ethers.randomBytes(32));
        await pokerGame.connect(addr3).revealHand(gameId, handPrivateKey3, ethers.randomBytes(32));
        const game = await pokerGame.games(gameId);
        expect(game.state).to.equal(0); // Waiting
        const finalBalance1 = await pokerChips.balanceOf(addr1.address);
        const finalBalance2 = await pokerChips.balanceOf(addr2.address);
        const finalBalance3 = await pokerChips.balanceOf(addr3.address);
        expect(finalBalance1).to.not.equal(initialBalance1); // Balance should change
        expect(finalBalance2).to.not.equal(initialBalance2); // Balance should change
        expect(finalBalance3).to.not.equal(initialBalance3); // Balance should change
    });
    

  });
});