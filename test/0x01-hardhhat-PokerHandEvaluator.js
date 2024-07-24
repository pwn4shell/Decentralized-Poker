const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PokerHandEvaluator", function () {
  let PokerHandEvaluator;
  let pokerHandEvaluator;

  before(async function () {
    PokerHandEvaluator = await ethers.getContractFactory("PokerHandEvaluator");
    pokerHandEvaluator = await PokerHandEvaluator.deploy();
  });

  function createCard(value, suit) {
    return { value, suit };
  }

  describe("evaluateBestHand", function () {
    it("should correctly identify a Royal Flush", async function () {
      const hand = [
        createCard(14, 0), // Ace of Hearts
        createCard(13, 0), // King of Hearts
        createCard(12, 0), // Queen of Hearts
        createCard(11, 0), // Jack of Hearts
        createCard(10, 0), // 10 of Hearts
        createCard(2, 1),  // 2 of Diamonds
        createCard(3, 2)   // 3 of Clubs
      ];

      const evaluation = await pokerHandEvaluator.evaluateBestHand(hand);
      expect(evaluation.rank).to.equal(9); // Royal Flush
    });

    it("should correctly identify a Straight Flush", async function () {
      const hand = [
        createCard(9, 0),  // 9 of Hearts
        createCard(8, 0),  // 8 of Hearts
        createCard(7, 0),  // 7 of Hearts
        createCard(6, 0),  // 6 of Hearts
        createCard(5, 0),  // 5 of Hearts
        createCard(2, 1),  // 2 of Diamonds
        createCard(3, 2)   // 3 of Clubs
      ];

      const evaluation = await pokerHandEvaluator.evaluateBestHand(hand);
      expect(evaluation.rank).to.equal(8); // Straight Flush
    });

    it("should correctly identify Four of a Kind", async function () {
      const hand = [
        createCard(10, 0), // 10 of Hearts
        createCard(10, 1), // 10 of Diamonds
        createCard(10, 2), // 10 of Clubs
        createCard(10, 3), // 10 of Spades
        createCard(7, 0),  // 7 of Hearts
        createCard(2, 1),  // 2 of Diamonds
        createCard(3, 2)   // 3 of Clubs
      ];

      const evaluation = await pokerHandEvaluator.evaluateBestHand(hand);
      expect(evaluation.rank).to.equal(7); // Four of a Kind
    });

    it("should correctly identify a Full House", async function () {
      const hand = [
        createCard(10, 0), // 10 of Hearts
        createCard(10, 1), // 10 of Diamonds
        createCard(10, 2), // 10 of Clubs
        createCard(7, 0),  // 7 of Hearts
        createCard(7, 1),  // 7 of Diamonds
        createCard(2, 1),  // 2 of Diamonds
        createCard(3, 2)   // 3 of Clubs
      ];

      const evaluation = await pokerHandEvaluator.evaluateBestHand(hand);
      expect(evaluation.rank).to.equal(6); // Full House
    });

    it("should correctly identify a Flush", async function () {
      const hand = [
        createCard(14, 0), // Ace of Hearts
        createCard(10, 0), // 10 of Hearts
        createCard(8, 0),  // 8 of Hearts
        createCard(6, 0),  // 6 of Hearts
        createCard(4, 0),  // 4 of Hearts
        createCard(2, 1),  // 2 of Diamonds
        createCard(3, 2)   // 3 of Clubs
      ];

      const evaluation = await pokerHandEvaluator.evaluateBestHand(hand);
      expect(evaluation.rank).to.equal(5); // Flush
    });

    it("should correctly identify a Straight", async function () {
      const hand = [
        createCard(10, 0), // 10 of Hearts
        createCard(9, 1),  // 9 of Diamonds
        createCard(8, 2),  // 8 of Clubs
        createCard(7, 3),  // 7 of Spades
        createCard(6, 0),  // 6 of Hearts
        createCard(2, 1),  // 2 of Diamonds
        createCard(3, 2)   // 3 of Clubs
      ];

      const evaluation = await pokerHandEvaluator.evaluateBestHand(hand);
      expect(evaluation.rank).to.equal(4); // Straight
    });

    it("should correctly identify Three of a Kind", async function () {
      const hand = [
        createCard(10, 0), // 10 of Hearts
        createCard(10, 1), // 10 of Diamonds
        createCard(10, 2), // 10 of Clubs
        createCard(7, 3),  // 7 of Spades
        createCard(6, 0),  // 6 of Hearts
        createCard(2, 1),  // 2 of Diamonds
        createCard(3, 2)   // 3 of Clubs
      ];

      const evaluation = await pokerHandEvaluator.evaluateBestHand(hand);
      expect(evaluation.rank).to.equal(3); // Three of a Kind
    });

    it("should correctly identify Two Pair", async function () {
      const hand = [
        createCard(10, 0), // 10 of Hearts
        createCard(10, 1), // 10 of Diamonds
        createCard(7, 2),  // 7 of Clubs
        createCard(7, 3),  // 7 of Spades
        createCard(6, 0),  // 6 of Hearts
        createCard(2, 1),  // 2 of Diamonds
        createCard(3, 2)   // 3 of Clubs
      ];

      const evaluation = await pokerHandEvaluator.evaluateBestHand(hand);
      expect(evaluation.rank).to.equal(2); // Two Pair
    });

    it("should correctly identify One Pair", async function () {
      const hand = [
        createCard(10, 0), // 10 of Hearts
        createCard(10, 1), // 10 of Diamonds
        createCard(8, 2),  // 8 of Clubs
        createCard(7, 3),  // 7 of Spades
        createCard(6, 0),  // 6 of Hearts
        createCard(2, 1),  // 2 of Diamonds
        createCard(3, 2)   // 3 of Clubs
      ];

      const evaluation = await pokerHandEvaluator.evaluateBestHand(hand);
      expect(evaluation.rank).to.equal(1); // One Pair
    });

    it("should correctly identify High Card", async function () {
      const hand = [
        createCard(14, 0), // Ace of Hearts
        createCard(10, 1), // 10 of Diamonds
        createCard(8, 2),  // 8 of Clubs
        createCard(7, 3),  // 7 of Spades
        createCard(5, 0),  // 5 of Hearts
        createCard(2, 1),  // 2 of Diamonds
        createCard(3, 2)   // 3 of Clubs
      ];

      const evaluation = await pokerHandEvaluator.evaluateBestHand(hand);
      expect(evaluation.rank).to.equal(0); // High Card
    });

    it("should correctly identify an Ace-low Straight", async function () {
      const hand = [
        createCard(14, 0), // Ace of Hearts
        createCard(2, 1),  // 2 of Diamonds
        createCard(3, 2),  // 3 of Clubs
        createCard(4, 3),  // 4 of Spades
        createCard(5, 0),  // 5 of Hearts
        createCard(7, 1),  // 7 of Diamonds
        createCard(9, 2)   // 9 of Clubs
      ];

      const evaluation = await pokerHandEvaluator.evaluateBestHand(hand);
      expect(evaluation.rank).to.equal(4); // Straight
    });

    it("should correctly identify the highest card among High Cards", async function () {
      const hand1 = [
        createCard(14, 0), // Ace of Hearts
        createCard(10, 1), // 10 of Diamonds
        createCard(8, 2),  // 8 of Clubs
        createCard(7, 3),  // 7 of Spades
        createCard(5, 0),  // 5 of Hearts
        createCard(2, 1),  // 2 of Diamonds
        createCard(3, 2)   // 3 of Clubs
      ];

      const hand2 = [
        createCard(13, 0), // King of Hearts
        createCard(10, 1), // 10 of Diamonds
        createCard(8, 2),  // 8 of Clubs
        createCard(7, 3),  // 7 of Spades
        createCard(5, 0),  // 5 of Hearts
        createCard(2, 1),  // 2 of Diamonds
        createCard(3, 2)   // 3 of Clubs
      ];

      const result = await pokerHandEvaluator.compareHands(hand1, hand2);
      expect(result).to.equal(1); // Hand 1 (Ace High) should win
    });

    it("should correctly identify a Full House over a Three of a Kind", async function () {
      const hand1 = [
        createCard(10, 0), // 10 of Hearts
        createCard(10, 1), // 10 of Diamonds
        createCard(10, 2), // 10 of Clubs
        createCard(7, 0),  // 7 of Hearts
        createCard(7, 1),  // 7 of Diamonds
        createCard(2, 1),  // 2 of Diamonds
        createCard(3, 2)   // 3 of Clubs
      ];

      const hand2 = [
        createCard(10, 0), // 10 of Hearts
        createCard(10, 1), // 10 of Diamonds
        createCard(10, 2), // 10 of Clubs
        createCard(8, 3),  // 8 of Spades
        createCard(6, 0),  // 6 of Hearts
        createCard(2, 1),  // 2 of Diamonds
        createCard(3, 2)   // 3 of Clubs
      ];

      const result = await pokerHandEvaluator.compareHands(hand1, hand2);
      expect(result).to.equal(1); // Hand 1 (Full House) should win
    });

    it("should correctly identify a Straight over Three of a Kind", async function () {
      const hand1 = [
        createCard(10, 0), // 10 of Hearts
        createCard(9, 1),  // 9 of Diamonds
        createCard(8, 2),  // 8 of Clubs
        createCard(7, 3),  // 7 of Spades
        createCard(6, 0),  // 6 of Hearts
        createCard(2, 1),  // 2 of Diamonds
        createCard(3, 2)   // 3 of Clubs
      ];

      const hand2 = [
        createCard(10, 0), // 10 of Hearts
        createCard(10, 1), // 10 of Diamonds
        createCard(10, 2), // 10 of Clubs
        createCard(8, 3),  // 8 of Spades
        createCard(6, 0),  // 6 of Hearts
        createCard(2, 1),  // 2 of Diamonds
        createCard(3, 2)   // 3 of Clubs
      ];

      const result = await pokerHandEvaluator.compareHands(hand1, hand2);
      expect(result).to.equal(1); // Hand 1 (Straight) should win
    });

    it("should correctly identify a Two Pair over One Pair", async function () {
      const hand1 = [
        createCard(10, 0), // 10 of Hearts
        createCard(10, 1), // 10 of Diamonds
        createCard(7, 2),  // 7 of Clubs
        createCard(7, 3),  // 7 of Spades
        createCard(6, 0),  // 6 of Hearts
        createCard(2, 1),  // 2 of Diamonds
        createCard(3, 2)   // 3 of Clubs
      ];

      const hand2 = [
        createCard(10, 0), // 10 of Hearts
        createCard(10, 1), // 10 of Diamonds
        createCard(8, 2),  // 8 of Clubs
        createCard(7, 3),  // 7 of Spades
        createCard(6, 0),  // 6 of Hearts
        createCard(2, 1),  // 2 of Diamonds
        createCard(3, 2)   // 3 of Clubs
      ];

      const result = await pokerHandEvaluator.compareHands(hand1, hand2);
      expect(result).to.equal(1); // Hand 1 (Two Pair) should win
    });
  });

  describe("compareHands", function () {
    it("should correctly compare two different hands", async function () {
      const hand1 = [
        createCard(14, 0), // Ace of Hearts
        createCard(13, 0), // King of Hearts
        createCard(12, 0), // Queen of Hearts
        createCard(11, 0), // Jack of Hearts
        createCard(10, 0), // 10 of Hearts
        createCard(2, 1),  // 2 of Diamonds
        createCard(3, 2)   // 3 of Clubs
      ];

      const hand2 = [
        createCard(10, 1), // 10 of Diamonds
        createCard(10, 2), // 10 of Clubs
        createCard(10, 3), // 10 of Spades
        createCard(9, 0),  // 9 of Hearts
        createCard(9, 1),  // 9 of Diamonds
        createCard(2, 2),  // 2 of Clubs
        createCard(3, 3)   // 3 of Spades
      ];

      const result = await pokerHandEvaluator.compareHands(hand1, hand2);
      expect(result).to.equal(1); // Hand 1 (Royal Flush) should win
    });

    it("should correctly identify a tie", async function () {
      const hand1 = [
        createCard(14, 0), // Ace of Hearts
        createCard(13, 0), // King of Hearts
        createCard(12, 0), // Queen of Hearts
        createCard(11, 0), // Jack of Hearts
        createCard(10, 0), // 10 of Hearts
        createCard(2, 1),  // 2 of Diamonds
        createCard(3, 2)   // 3 of Clubs
      ];

      const hand2 = [
        createCard(14, 1), // Ace of Diamonds
        createCard(13, 1), // King of Diamonds
        createCard(12, 1), // Queen of Diamonds
        createCard(11, 1), // Jack of Diamonds
        createCard(10, 1), // 10 of Diamonds
        createCard(2, 2),  // 2 of Clubs
        createCard(3, 3)   // 3 of Spades
      ];

      const result = await pokerHandEvaluator.compareHands(hand1, hand2);
      expect(result).to.equal(0); // Both hands are Royal Flush, should be a tie
    });

    it("should correctly compare High Card hands", async function () {
      const hand1 = [
        createCard(14, 0), // Ace of Hearts
        createCard(10, 1), // 10 of Diamonds
        createCard(8, 2),  // 8 of Clubs
        createCard(7, 3),  // 7 of Spades
        createCard(5, 0),  // 5 of Hearts
        createCard(2, 1),  // 2 of Diamonds
        createCard(3, 2)   // 3 of Clubs
      ];

      const hand2 = [
        createCard(13, 0), // King of Hearts
        createCard(10, 1), // 10 of Diamonds
        createCard(8, 2),  // 8 of Clubs
        createCard(7, 3),  // 7 of Spades
        createCard(5, 0),  // 5 of Hearts
        createCard(2, 1),  // 2 of Diamonds
        createCard(3, 2)   // 3 of Clubs
      ];

      const result = await pokerHandEvaluator.compareHands(hand1, hand2);
      expect(result).to.equal(1); // Hand 1 (Ace High) should win
    });

    it("should correctly identify a tie among High Cards", async function () {
      const hand1 = [
        createCard(14, 0), // Ace of Hearts
        createCard(13, 1), // King of Diamonds
        createCard(12, 2), // Queen of Clubs
        createCard(11, 3), // Jack of Spades
        createCard(9, 0),  // 9 of Hearts
        createCard(8, 1),  // 8 of Diamonds
        createCard(7, 2)   // 7 of Clubs
      ];

      const hand2 = [
        createCard(14, 1), // Ace of Diamonds
        createCard(13, 2), // King of Clubs
        createCard(12, 3), // Queen of Spades
        createCard(11, 0), // Jack of Hearts
        createCard(9, 1),  // 9 of Diamonds
        createCard(8, 2),  // 8 of Clubs
        createCard(7, 3)   // 7 of Spades
      ];

      const result = await pokerHandEvaluator.compareHands(hand1, hand2);
      expect(result).to.equal(0); // Both hands are High Card with same values, should be a tie
    });
  });
});
