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

describe("PokerDealer.sol", function () {
  let PokerDealer;
  let pokerDealer;
  let owner;
  let addr1;
  let addr2;
  let addr3;
  let addrs;

  beforeEach(async function () {
    // Deploy the PokerDealer contract
    PokerDealer = await ethers.getContractFactory("PokerDealer");
    [owner, addr1, addr2, addr3, ...addrs] = await ethers.getSigners();
    pokerDealer = await PokerDealer.deploy();
    await pokerDealer.waitForDeployment();
});

  describe("Hand Management", function () {
    it("Should allow a user to create a hand", async function () {
      const handPublicKey = ethers.encodeBytes32String("publicKey1");
      const addresses = [owner.address, addr1.address, addr2.address];
      const pubKeys = [handPublicKey,handPublicKey,handPublicKey];
      await expect(pokerDealer.connect(owner).createHand(1, addresses, pubKeys))
        .to.emit(pokerDealer, "HandCreated");
      const hand = await pokerDealer.hands(1);
      expect(hand.dealer).to.equal(owner.address);
    });

    it("Should play through a heads up hand", async function () {
      const handPrivateKey1 = ethers.encodeBytes32String("secret1");
      const handPublicKey1 = ethers.keccak256(handPrivateKey1);
      const handPrivateKey2 = ethers.encodeBytes32String("secret2");
      const handPublicKey2 = ethers.keccak256(handPrivateKey2);
      const addresses = [owner.address, addr2.address];
      const pubKeys = [handPublicKey1,handPublicKey2];  
      await pokerDealer.connect(owner).createHand(2, addresses, pubKeys);
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
      await pokerDealer.connect(owner).closeHand(2, handId, owner.address, handPrivateKey1);
      await expect(pokerDealer.connect(addr2).closeHand(2, handId, addr2.address, handPrivateKey2))
        .to.emit(pokerDealer, "HandClosed");
        const handDetails = await pokerDealer.getHand(handId);
      expect(handDetails[0]).to.be.oneOf([owner.address, addr2.address]);
    });
  });


  describe("Edge Cases", function () {
    it("Should prevent creating a hand with zero players", async function () {
      const handPublicKey = ethers.encodeBytes32String("publicKey1");
      await expect(
        pokerDealer.connect(owner).createHand(1, [], [])
      ).to.be.revertedWith("Increase players");
    });
  
    it("Should prevent a player from joining the same hand multiple times", async function () {
      const handPublicKey1 = ethers.encodeBytes32String("publicKey1");
      const handPublicKey2 = ethers.encodeBytes32String("publicKey2");
      const addresses = [owner.address, owner.address];
      const pubKeys = [handPublicKey1, handPublicKey2];
      await expect(
        pokerDealer.connect(owner).createHand(1, addresses, pubKeys)
      ).to.be.revertedWith("One entry per address");
    });
  
    it("Should prevent joining a non-existent hand", async function () {
      const handPublicKey = ethers.encodeBytes32String("publicKey1");
      await expect(
        pokerDealer.connect(addr1).flop(999, 1, 2, 3)
      ).to.be.revertedWith("Hand does not exist");
    });
  
    it("Should prevent revealing private key with invalid hash", async function () {
      const handPrivateKey1 = ethers.encodeBytes32String("secret1");
      const handPublicKey1 = ethers.keccak256(handPrivateKey1);
      const handPrivateKey2 = ethers.encodeBytes32String("secret2");
      const handPublicKey2 = ethers.keccak256(handPrivateKey2);
      const addresses = [owner.address, addr2.address];
      const pubKeys = [handPublicKey1, handPublicKey2];
      await pokerDealer.connect(owner).createHand(1, addresses, pubKeys);
      let handId = await pokerDealer.handCount();
      await ethers.provider.send("evm_mine", []);
      await ethers.provider.send("evm_mine", []);
      const blockHash = await pokerDealer.getHash(handId.toString());
      const cards1 = shuffleAndDeal(blockHash, handPrivateKey1);
      const cards2 = shuffleAndDeal(blockHash, handPrivateKey2);
      await pokerDealer.connect(owner).flop(handId, cards1[2], cards1[3], cards1[4]);
      await pokerDealer.connect(addr2).flop(handId, cards2[2], cards2[3], cards2[4]);
      await pokerDealer.connect(owner).turn(handId, cards1[5]);
      await pokerDealer.connect(addr2).turn(handId, cards2[5]);
      await pokerDealer.connect(owner).river(handId, cards1[6]);
      await pokerDealer.connect(addr2).river(handId, cards2[6]);
      const invalidPrivateKey = ethers.encodeBytes32String("invalidPrivateKey");
      await expect(
        pokerDealer.connect(addr2).closeHand(1, handId, addr2.address, invalidPrivateKey)
      ).to.be.revertedWith("Invalid key");
    });
  
    it("Should prevent closing a hand that doesn't exist", async function () {
      await expect(
        pokerDealer.connect(addr1).closeHand(1, 999, addr1.address, ethers.encodeBytes32String("privateKey"))
      ).to.be.revertedWith("Hand does not exist");
    });
  
    it("Should handle null public keys", async function () {
      const handPrivateKey1 = ethers.encodeBytes32String("secret1");
      const handPublicKey1 = ethers.keccak256(handPrivateKey1);
      const handPublicKey2 = ethers.encodeBytes32String('')
      const addresses = [owner.address, addr2.address];
      const pubKeys = [handPublicKey1, handPublicKey2];
      await expect(
        pokerDealer.connect(owner).createHand(1, addresses, pubKeys)
      ).to.be.revertedWith("Invalid public key");
    });
  });

});
