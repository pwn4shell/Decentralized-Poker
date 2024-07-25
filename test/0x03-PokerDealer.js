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

describe("PokerDealer", function () {
  let PokerDealer;
  let pokerDealer;
  let owner;
  let addr1;
  let addr2;
  let addr3;
  let addrs;

  beforeEach(async function () {
    // Deploy the PokerHandEvaluator contract
    const PokerHandEvaluator = await ethers.getContractFactory("PokerHandEvaluator");
    const pokerHandEvaluator = await PokerHandEvaluator.deploy();
    await pokerHandEvaluator.waitForDeployment();

    // Deploy the PokerDealer contract
    PokerDealer = await ethers.getContractFactory("PokerDealer");
    [owner, addr1, addr2, addr3, ...addrs] = await ethers.getSigners();
    pokerDealer = await PokerDealer.deploy(pokerHandEvaluator.target);
    await pokerDealer.waitForDeployment();
});

  describe("Hand Management", function () {
    it("Should allow a user to create a hand", async function () {
      const handPublicKey = ethers.encodeBytes32String("publicKey1");
      await expect(pokerDealer.connect(owner).createHand(handPublicKey, 3))
        .to.emit(pokerDealer, "HandCreated")
        .withArgs(1, owner.address, handPublicKey, 3);
      const hand = await pokerDealer.hands(1);
      expect(hand.dealer).to.equal(owner.address);
      expect(hand.maxPlayers).to.equal(3);
      expect(hand.blockNumber).to.equal(0);
    });

    it("Should allow a player to join a hand", async function () {
      const handPublicKey = ethers.encodeBytes32String("publicKey1");
      await pokerDealer.connect(owner).createHand(handPublicKey, 3);
      const handPublicKey2 = ethers.encodeBytes32String("publicKey2");
      await expect(pokerDealer.connect(addr1).joinHand(1, handPublicKey2))
        .to.emit(pokerDealer, "PlayerJoined")
        .withArgs(1, addr1.address, handPublicKey2);

      const players = await pokerDealer.getPlayersInHand(1);
      expect(players).to.include(addr1.address);
    });

    it("Should close the hand when a player reveals their private key", async function () {
      const handPrivateKey1 = ethers.encodeBytes32String("secret1");
      const handPublicKey1 = ethers.keccak256(handPrivateKey1);
      await pokerDealer.connect(owner).createHand(handPublicKey1, 2);
      // Define Private/Public Key
      const handPrivateKey2 = ethers.encodeBytes32String("secret2");
      const handPublicKey2 = ethers.keccak256(handPrivateKey2);
      await pokerDealer.connect(addr2).joinHand(1, handPublicKey2);
      let handId = await pokerDealer.handCount();
      await ethers.provider.send("evm_mine", []);
      await ethers.provider.send("evm_mine", []);
      const blockHash = await pokerDealer.getHash(handId.toString());
      const cards1 = shuffleAndDeal(blockHash,handPrivateKey1);
      const cards2 = shuffleAndDeal(blockHash,handPrivateKey2);
      await pokerDealer.connect(owner).flop(handId, cards1[2], cards1[3], cards1[4]);
      await pokerDealer.connect(addr2).flop(handId, cards2[2], cards2[3], cards2[4]);
      await pokerDealer.connect(owner).turn(handId, cards1[5]);
      await pokerDealer.connect(addr2).turn(handId, cards2[5]);
      await pokerDealer.connect(owner).river(handId, cards1[6]);
      await pokerDealer.connect(addr2).river(handId, cards2[6]);
      await pokerDealer.connect(owner).closeHand(handId, handPrivateKey1);
      await expect(pokerDealer.connect(addr2).closeHand(handId, handPrivateKey2))
        .to.emit(pokerDealer, "HandClosed")
        .withArgs(1, addr2.address, handPrivateKey2);
        const handDetails = await pokerDealer.getHandDetails(handId);
      expect(handDetails[1]).to.be.gt(0);
    });

    it("Should fail to join a hand if it is full", async function () {
      const handPublicKey = ethers.encodeBytes32String("publicKey1");
      await pokerDealer.connect(owner).createHand(handPublicKey, 3);
      const handPublicKey2 = ethers.encodeBytes32String("publicKey2");
      await pokerDealer.connect(addr1).joinHand(1, handPublicKey2);
      const handPublicKey3 = ethers.encodeBytes32String("publicKey3");
      await pokerDealer.connect(addr2).joinHand(1, handPublicKey3);
      const handPublicKey4 = ethers.encodeBytes32String("publicKey4");
      await expect(pokerDealer.connect(addr3).joinHand(1, handPublicKey4))
        .to.be.revertedWith("Hand is full");
    });
  });


  describe("Edge Cases", function () {
    it("Should prevent creating a hand with zero players", async function () {
      const handPublicKey = ethers.encodeBytes32String("publicKey1");
      await expect(
        pokerDealer.connect(owner).createHand(handPublicKey, 0)
      ).to.be.revertedWith("Increase maxPlayers");
    });

    it("Should prevent a player from joining the same hand multiple times", async function () {
      const handPublicKey = ethers.encodeBytes32String("publicKey1");
      await pokerDealer.connect(owner).createHand(handPublicKey, 3);
      const handPublicKey2 = ethers.encodeBytes32String("publicKey2");
      await pokerDealer.connect(addr1).joinHand(1, handPublicKey2);
      await expect(
        pokerDealer.connect(addr1).joinHand(1, handPublicKey2)
      ).to.be.revertedWith("Player already joined");
    });

    it("Should prevent joining a non-existent hand", async function () {
      const handPublicKey = ethers.encodeBytes32String("publicKey1");
      await expect(
        pokerDealer.connect(addr1).joinHand(999, handPublicKey)
      ).to.be.revertedWith("Hand does not exist");
    });



    it("Should prevent revealing private key with invalid hash", async function () {
      const handPrivateKey1 = ethers.encodeBytes32String("secret1");
      const handPublicKey1 = ethers.keccak256(handPrivateKey1);
      await pokerDealer.connect(owner).createHand(handPublicKey1, 2);
      // Define Private/Public Key
      const handPrivateKey2 = ethers.encodeBytes32String("secret2");
      const handPublicKey2 = ethers.keccak256(handPrivateKey2);
      await pokerDealer.connect(addr2).joinHand(1, handPublicKey2);
      let handId = await pokerDealer.handCount();
      await ethers.provider.send("evm_mine", []);
      await ethers.provider.send("evm_mine", []);
      const blockHash = await pokerDealer.getHash(handId.toString());
      const cards1 = shuffleAndDeal(blockHash,handPrivateKey1);
      const cards2 = shuffleAndDeal(blockHash,handPrivateKey2);
      await pokerDealer.connect(owner).flop(handId, cards1[2], cards1[3], cards1[4]);
      await pokerDealer.connect(addr2).flop(handId, cards2[2], cards2[3], cards2[4]);
      await pokerDealer.connect(owner).turn(handId, cards1[5]);
      await pokerDealer.connect(addr2).turn(handId, cards2[5]);
      await pokerDealer.connect(owner).river(handId, cards1[6]);
      await pokerDealer.connect(addr2).river(handId, cards2[6]);
      const invalidPrivateKey = ethers.encodeBytes32String("invalidPrivateKey");
      await expect(
        pokerDealer.connect(addr2).closeHand(handId, invalidPrivateKey)
      ).to.be.revertedWith("Invalid key");
    });

    it("Should prevent closing a hand that doesn't exist", async function () {
      await expect(
        pokerDealer.connect(addr1).closeHand(999, ethers.encodeBytes32String("privateKey"))
      ).to.be.revertedWith("Hand does not exist");
    });

    it("Should prevent dealer from joining their own hand again", async function () {
      const handPublicKey = ethers.encodeBytes32String("publicKey1");
      await pokerDealer.connect(owner).createHand(handPublicKey, 3);
      await expect(
        pokerDealer.connect(owner).joinHand(1, handPublicKey)
      ).to.be.revertedWith("Player already joined");
    });

    it("Should handle null public keys", async function () {
      const invalidPublicKey = ethers.encodeBytes32String("");
      await expect(
        pokerDealer.connect(owner).createHand(invalidPublicKey, 3, { value: ethers.parseEther("1.0") })
      ).to.be.revertedWith("Invalid key");
    });
  });

});
