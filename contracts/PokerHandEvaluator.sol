// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract PokerHandEvaluator {
    enum HandRank { HighCard, Pair, TwoPair, ThreeOfAKind, Straight, Flush, FullHouse, FourOfAKind, StraightFlush, RoyalFlush }

    struct Card {
        uint8 value; // 2-14, where 11=J, 12=Q, 13=K, 14=A
        uint8 suit;  // 0=hearts, 1=diamonds, 2=clubs, 3=spades
    }

    struct HandEvaluation {
        HandRank rank;
        uint8[5] orderedValues;
    }

    function compareHands(Card[7] memory hand1, Card[7] memory hand2) public pure returns (int8) {
        HandEvaluation memory eval1 = evaluateBestHand(hand1);
        HandEvaluation memory eval2 = evaluateBestHand(hand2);

        if (eval1.rank > eval2.rank) {
            return 1; // Hand 1 wins
        } else if (eval1.rank < eval2.rank) {
            return -1; // Hand 2 wins
        } else {
            // Same ranking, compare ordered values
            for (uint8 i = 0; i < 5; i++) {
                if (eval1.orderedValues[i] > eval2.orderedValues[i]) {
                    return 1; // Hand 1 wins
                } else if (eval1.orderedValues[i] < eval2.orderedValues[i]) {
                    return 2; // Hand 2 wins
                }
            }
            return 0; // Tie
        }
    }

    function evaluateBestHand(Card[7] memory hand) public pure returns (HandEvaluation memory) {
        HandEvaluation memory bestEvaluation = HandEvaluation(HandRank.HighCard, [uint8(0), 0, 0, 0, 0]);

        // Evaluate all 21 possible 5-card combinations from 7 cards
        for (uint8 i = 0; i < 7; i++) {
            for (uint8 j = i + 1; j < 7; j++) {
                Card[5] memory fiveCardHand;
                uint8 index = 0;
                for (uint8 k = 0; k < 7; k++) {
                    if (k != i && k != j) {
                        fiveCardHand[index] = hand[k];
                        index++;
                    }
                }
                HandEvaluation memory currentEvaluation = evaluateHand(fiveCardHand);
                if (compareHandEvaluations(currentEvaluation, bestEvaluation) > 0) {
                    bestEvaluation = currentEvaluation;
                }
            }
        }

        return bestEvaluation;
    }

    function evaluateHand(Card[5] memory hand) public pure returns (HandEvaluation memory) {
        bool isFlush = checkFlush(hand);
        bool isStraight = checkStraight(hand);
        uint8[14] memory valueCounts = countValues(hand);
        
        (HandRank rank, uint8[5] memory orderedValues) = determineHandRank(hand, isFlush, isStraight, valueCounts);
        
        return HandEvaluation(rank, orderedValues);
    }

    function checkFlush(Card[5] memory hand) private pure returns (bool) {
        uint8 suit = hand[0].suit;
        for (uint8 i = 1; i < 5; i++) {
            if (hand[i].suit != suit) return false;
        }
        return true;
    }

    function checkStraight(Card[5] memory hand) private pure returns (bool) {
        uint8[5] memory values;
        for (uint8 i = 0; i < 5; i++) {
            values[i] = hand[i].value;
        }
        sortDescending(values);

        if (values[0] == 14 && values[1] == 5 && values[2] == 4 && values[3] == 3 && values[4] == 2) {
            return true; // Ace-low straight (A, 5, 4, 3, 2)
        }

        for (uint8 i = 1; i < 5; i++) {
            if (values[i-1] != values[i] + 1) return false;
        }
        return true;
    }

    function countValues(Card[5] memory hand) private pure returns (uint8[14] memory) {
        uint8[14] memory counts;
        for (uint8 i = 0; i < 5; i++) {
            counts[hand[i].value - 2]++; // Adjust the index to be within 0-12
        }
        return counts;
    }

    function determineHandRank(Card[5] memory hand, bool isFlush, bool isStraight, uint8[14] memory valueCounts) 
        private pure returns (HandRank, uint8[5] memory) {
        uint8[5] memory orderedValues;

        if (isFlush && isStraight) {
            orderedValues = getOrderedValues(hand);
            if (orderedValues[0] == 14) { // Ace high
                return (HandRank.RoyalFlush, orderedValues);
            }
            return (HandRank.StraightFlush, orderedValues);
        }

        if (isFlush) return (HandRank.Flush, getOrderedValues(hand));
        if (isStraight) return (HandRank.Straight, getOrderedValues(hand));

        for (uint8 count = 4; count >= 2; count--) {
            for (int8 value = 13; value >= 0; value--) { // Check from Ace (14) down to 2 (0)
                if (valueCounts[uint8(value)] == count) {
                    for (uint8 i = 0; i < count; i++) {
                        orderedValues[i] = uint8(value) + 2; // Adjust back to card value
                    }
                    if (count == 4) return (HandRank.FourOfAKind, fillRemainingValues(orderedValues, count, valueCounts));
                    if (count == 3) {
                        for (int8 pairValue = 13; pairValue >= 0; pairValue--) {
                            if (valueCounts[uint8(pairValue)] == 2) {
                                orderedValues[count] = uint8(pairValue) + 2;
                                orderedValues[count + 1] = uint8(pairValue) + 2;
                                return (HandRank.FullHouse, orderedValues);
                            }
                        }
                        return (HandRank.ThreeOfAKind, fillRemainingValues(orderedValues, count, valueCounts));
                    }
                    if (count == 2) {
                        for (int8 j = 13; j >= 0; j--) {
                            if (valueCounts[uint8(j)] == 2 && uint8(j) != uint8(value)) {
                                orderedValues[count] = uint8(j) + 2;
                                orderedValues[count + 1] = uint8(j) + 2;
                                return (HandRank.TwoPair, fillRemainingValues(orderedValues, count + 2, valueCounts));
                            }
                        }
                        return (HandRank.Pair, fillRemainingValues(orderedValues, count, valueCounts));
                    }
                }
            }
        }

        return (HandRank.HighCard, getOrderedValues(hand));
    }

    function sortDescending(uint8[5] memory arr) private pure {
        for (uint8 i = 0; i < 4; i++) {
            for (uint8 j = 0; j < 4 - i; j++) {
                if (arr[j] < arr[j + 1]) {
                    uint8 temp = arr[j];
                    arr[j] = arr[j + 1];
                    arr[j + 1] = temp;
                }
            }
        }
    }

    function getOrderedValues(Card[5] memory hand) private pure returns (uint8[5] memory) {
        uint8[5] memory values;
        for (uint8 i = 0; i < 5; i++) {
            values[i] = hand[i].value;
        }
        sortDescending(values);
        return values;
    }

    function fillRemainingValues(uint8[5] memory orderedValues, uint8 index, uint8[14] memory valueCounts) 
        private pure returns (uint8[5] memory) {
        for (uint8 value = 13; value < 14 && index < 5; value--) {
            if (valueCounts[value] == 1) {
                orderedValues[index++] = value + 2; // Adjust back to card value
            }
            if (value == 0) break; // Prevent underflow
        }
        return orderedValues;
    }

    function compareHandEvaluations(HandEvaluation memory eval1, HandEvaluation memory eval2) private pure returns (int8) {
        if (eval1.rank > eval2.rank) {
            return 1;
        } else if (eval1.rank < eval2.rank) {
            return -1;
        } else {
            for (uint8 i = 0; i < 5; i++) {
                if (eval1.orderedValues[i] > eval2.orderedValues[i]) {
                    return 1;
                } else if (eval1.orderedValues[i] < eval2.orderedValues[i]) {
                    return -1;
                }
            }
            return 0;
        }
    }
}
