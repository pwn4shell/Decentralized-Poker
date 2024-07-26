const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PokerGame", function () {
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
    console.log('t1')
    // Set up initial balances
    await usdc.mint(addr1.address, ethers.parseEther("1000"));
    await usdc.mint(addr2.address, ethers.parseEther("1000"));
    await usdc.mint(addr3.address, ethers.parseEther("1000"));
    console.log('t2')
    await usdc.connect(addr1).approve(await pokerChips.getAddress(), ethers.parseEther("1000"));
    await usdc.connect(addr2).approve(await pokerChips.getAddress(), ethers.parseEther("1000"));
    await usdc.connect(addr3).approve(await pokerChips.getAddress(), ethers.parseEther("1000"));
    console.log('t3')
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
      const tx = await pokerGame.createGame(6, ethers.parseEther("1"), ethers.parseEther("2"), ethers.randomBytes(32));
      const receipt = await tx.wait();
      gameId = receipt.logs[0].args[0];
    });

    it("Should allow a player to join the game", async function () {
      const handPublicKey = ethers.randomBytes(32);
      await pokerChips.connect(addr1).approve(await pokerGame.getAddress(), ethers.parseEther("200"));

      await expect(pokerGame.connect(addr1).joinGame(gameId, 0, handPublicKey))
        .to.emit(pokerGame, "PlayerJoined");

      const game = await pokerGame.games(gameId);
      expect(game.activePlayers).to.equal(1);
    });

    it("Should fail to join a game with insufficient chips", async function () {
      const handPublicKey = ethers.randomBytes(32);
      await pokerChips.connect(addr1).approve(await pokerGame.getAddress(), ethers.parseEther("100"));

      await expect(pokerGame.connect(addr1).joinGame(gameId, 0, handPublicKey))
        .to.be.revertedWith("Insufficient chips for buy-in");
    });
  });

  describe("Game Flow", function () {
    let gameId;

    beforeEach(async function () {
      const tx = await pokerGame.createGame(2, ethers.parseEther("1"), ethers.parseEther("2"), ethers.randomBytes(32));
      const receipt = await tx.wait();
      gameId = receipt.logs[0].args[0];

      await pokerChips.connect(addr1).approve(await pokerGame.getAddress(), ethers.parseEther("200"));
      await pokerChips.connect(addr2).approve(await pokerGame.getAddress(), ethers.parseEther("200"));

      await pokerGame.connect(addr1).joinGame(gameId, 0, ethers.randomBytes(32));
      await pokerGame.connect(addr2).joinGame(gameId, 1, ethers.randomBytes(32));
    });

    it("Should start the game when enough players have joined", async function () {
      const game = await pokerGame.games(gameId);
      expect(game.state).to.equal(1); // PreFlop
      expect(game.activePlayers).to.equal(2);
    });

    it("Should allow players to take actions", async function () {
      await expect(pokerGame.connect(addr1).playerAction(gameId, 2, 0)) // Call
        .to.emit(pokerGame, "Action");

      await expect(pokerGame.connect(addr2).playerAction(gameId, 3, ethers.parseEther("4"))) // Raise
        .to.emit(pokerGame, "Action");
    });

    it("Should advance to the next round when all players have acted", async function () {
      await pokerGame.connect(addr1).playerAction(gameId, 2, 0); // Call
      await pokerGame.connect(addr2).playerAction(gameId, 1, 0); // Check

      const game = await pokerGame.games(gameId);
      expect(game.state).to.equal(2); // Flop
    });
  });

  describe("Showdown and Winner Determination", function () {
    let gameId;

    beforeEach(async function () {
      const tx = await pokerGame.createGame(2, ethers.parseEther("1"), ethers.parseEther("2"), ethers.randomBytes(32));
      const receipt = await tx.wait();
      gameId = receipt.logs[0].args[0];

      await pokerChips.connect(addr1).approve(await pokerGame.getAddress(), ethers.parseEther("200"));
      await pokerChips.connect(addr2).approve(await pokerGame.getAddress(), ethers.parseEther("200"));

      await pokerGame.connect(addr1).joinGame(gameId, 0, ethers.randomBytes(32));
      await pokerGame.connect(addr2).joinGame(gameId, 1, ethers.randomBytes(32));

      // Simulate game progression to showdown
      await pokerGame.connect(addr1).playerAction(gameId, 2, 0); // Call
      await pokerGame.connect(addr2).playerAction(gameId, 1, 0); // Check
      await pokerGame.connect(addr1).playerAction(gameId, 1, 0); // Check
      await pokerGame.connect(addr2).playerAction(gameId, 1, 0); // Check
      await pokerGame.connect(addr1).playerAction(gameId, 1, 0); // Check
      await pokerGame.connect(addr2).playerAction(gameId, 1, 0); // Check
    });

    it("Should allow players to reveal their hands", async function () {
      const game = await pokerGame.games(gameId);
      expect(game.state).to.equal(5); // Showdown

      await pokerGame.connect(addr1).revealHand(gameId, ethers.randomBytes(32));
      await pokerGame.connect(addr2).revealHand(gameId, ethers.randomBytes(32));

      // Check that the game has reset and started a new round
      const newGame = await pokerGame.games(gameId);
      expect(newGame.state).to.equal(1); // PreFlop
    });

    it("Should award the pot to the winner", async function () {
      const initialBalance = await pokerChips.balanceOf(addr1.address);

      await pokerGame.connect(addr1).revealHand(gameId, ethers.randomBytes(32));
      await pokerGame.connect(addr2).revealHand(gameId, ethers.randomBytes(32));

      const finalBalance = await pokerChips.balanceOf(addr1.address);
      expect(finalBalance).to.not.equal(initialBalance); // The balance should change
    });
  });
});