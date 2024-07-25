const { expect } = require("chai");
const { ethers } = require("hardhat");

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
      const ante = ethers.parseEther("1.0");
      await expect(pokerDealer.connect(owner).createHand(handPublicKey, 3, { value: ante }))
        .to.emit(pokerDealer, "HandCreated")
        .withArgs(1, owner.address, handPublicKey, 3);
      const hand = await pokerDealer.hands(1);
      expect(hand.dealer).to.equal(owner.address);
      expect(hand.maxPlayers).to.equal(3);
      expect(hand.ante).to.equal(ante);
      expect(hand.blockNumber).to.equal(0);
    });

    it("Should allow a player to join a hand", async function () {
      const handPublicKey = ethers.encodeBytes32String("publicKey1");
      const ante = ethers.parseEther("1.0");
      await pokerDealer.connect(owner).createHand(handPublicKey, 3, { value: ante });
      const handPublicKey2 = ethers.encodeBytes32String("publicKey2");
      await expect(pokerDealer.connect(addr1).joinHand(1, handPublicKey2, { value: ante }))
        .to.emit(pokerDealer, "PlayerJoined")
        .withArgs(1, addr1.address, handPublicKey2);

      const players = await pokerDealer.getPlayersInHand(1);
      expect(players).to.include(addr1.address);
    });

    it("Should close the hand when a player reveals their private key", async function () {
      const handPublicKey = ethers.encodeBytes32String("publicKey1");
      const ante = ethers.parseEther("1.0");
      await pokerDealer.connect(owner).createHand(handPublicKey, 3, { value: ante });
      // Define Private/Public Key
      const handPrivateKey2 = ethers.encodeBytes32String("secret");
      const handPublicKey2 = ethers.keccak256(handPrivateKey2);
      await pokerDealer.connect(addr1).joinHand(1, handPublicKey2, { value: ante });
      const handPublicKey3 = ethers.encodeBytes32String("publicKey3");
      await pokerDealer.connect(addr2).joinHand(1, handPublicKey3, { value: ante });
      await ethers.provider.send("evm_mine", []); // Advance block number to allow hand to close
      await expect(pokerDealer.connect(addr1).closeHand(1, handPrivateKey2))
        .to.emit(pokerDealer, "HandClosed")
        .withArgs(1, addr1.address, handPrivateKey2);
      const handDetails = await pokerDealer.getHandDetails(1);
      expect(handDetails[1]).to.be.gt(0); // Check if block number is set
    });

    it("Should fail to join a hand if ante is incorrect", async function () {
      const handPublicKey = ethers.encodeBytes32String("publicKey1");
      const ante = ethers.parseEther("1.0");
      await pokerDealer.connect(owner).createHand(handPublicKey, 3, { value: ante });
      const handPublicKey2 = ethers.encodeBytes32String("publicKey2");
      await expect(pokerDealer.connect(addr1).joinHand(1, handPublicKey2, { value: ethers.parseEther("0.5") }))
        .to.be.revertedWith("Incorrect ante amount");
    });

    it("Should fail to join a hand if it is full", async function () {
      const handPublicKey = ethers.encodeBytes32String("publicKey1");
      const ante = ethers.parseEther("1.0");
      await pokerDealer.connect(owner).createHand(handPublicKey, 3, { value: ante });
      const handPublicKey2 = ethers.encodeBytes32String("publicKey2");
      await pokerDealer.connect(addr1).joinHand(1, handPublicKey2, { value: ante });
      const handPublicKey3 = ethers.encodeBytes32String("publicKey3");
      await pokerDealer.connect(addr2).joinHand(1, handPublicKey3, { value: ante });
      const handPublicKey4 = ethers.encodeBytes32String("publicKey4");
      await expect(pokerDealer.connect(addr3).joinHand(1, handPublicKey4, { value: ante }))
        .to.be.revertedWith("Hand is full");
    });
  });


  describe("Edge Cases", function () {
    it("Should prevent creating a hand with zero players", async function () {
      const handPublicKey = ethers.encodeBytes32String("publicKey1");
      const ante = ethers.parseEther("1.0");
      await expect(
        pokerDealer.connect(owner).createHand(handPublicKey, 0, { value: ante })
      ).to.be.revertedWith("Increase maxPlayers");
    });

    it("Should prevent a player from joining the same hand multiple times", async function () {
      const handPublicKey = ethers.encodeBytes32String("publicKey1");
      const ante = ethers.parseEther("1.0");
      await pokerDealer.connect(owner).createHand(handPublicKey, 3, { value: ante });
      const handPublicKey2 = ethers.encodeBytes32String("publicKey2");
      await pokerDealer.connect(addr1).joinHand(1, handPublicKey2, { value: ante });
      await expect(
        pokerDealer.connect(addr1).joinHand(1, handPublicKey2, { value: ante })
      ).to.be.revertedWith("Player already joined");
    });

    it("Should prevent joining a non-existent hand", async function () {
      const handPublicKey = ethers.encodeBytes32String("publicKey1");
      const ante = ethers.parseEther("1.0");
      await expect(
        pokerDealer.connect(addr1).joinHand(999, handPublicKey, { value: ante })
      ).to.be.revertedWith("Hand does not exist");
    });



    it("Should prevent revealing private key with invalid hash", async function () {
      const handPublicKey = ethers.encodeBytes32String("publicKey1");
      const ante = ethers.parseEther("1.0");
      await pokerDealer.connect(owner).createHand(handPublicKey, 3, { value: ante });
      const handPublicKey2 = ethers.encodeBytes32String("publicKey2");
      await pokerDealer.connect(addr1).joinHand(1, handPublicKey2, { value: ante });
      const handPublicKey3 = ethers.encodeBytes32String("publicKey3");
      await pokerDealer.connect(addr2).joinHand(1, handPublicKey3, { value: ante });
      await ethers.provider.send("evm_mine", []);
      const invalidPrivateKey = ethers.encodeBytes32String("invalidPrivateKey");
      await expect(
        pokerDealer.connect(addr1).closeHand(1, invalidPrivateKey)
      ).to.be.revertedWith("Invalid key");
    });

    it("Should prevent closing a hand that doesn't exist", async function () {
      await expect(
        pokerDealer.connect(addr1).closeHand(999, ethers.encodeBytes32String("privateKey"))
      ).to.be.revertedWith("Hand does not exist");
    });

    it("Should prevent dealer from joining their own hand again", async function () {
      const handPublicKey = ethers.encodeBytes32String("publicKey1");
      const ante = ethers.parseEther("1.0");
      await pokerDealer.connect(owner).createHand(handPublicKey, 3, { value: ante });
      await expect(
        pokerDealer.connect(owner).joinHand(1, handPublicKey, { value: ante })
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
