// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "hardhat/console.sol";

interface IPokerHandEvaluator {
    function compareHands(uint8[7] memory hand1, uint8[7] memory hand2) external pure returns (int8);
}

contract PokerDealer {

    struct Hand {
        address dealer;
        address winner;
        uint8 maxPlayers;
        uint256 blockNumber;
        address[] playerAddresses;
        mapping(address => uint8) card1;
        mapping(address => uint8) card2;
        mapping(address => uint8) card3;
        mapping(address => uint8) card4;
        mapping(address => uint8) card5;
        mapping(address => uint8) card6;
        mapping(address => uint8) card7;
        uint8 flop1;
        uint8 flop2;
        uint8 flop3;
        uint8 turn;
        uint8 river;
        mapping(address => bytes32) handPublicKey;
        mapping(address => bytes32) handPrivateKey;
    }

    mapping(uint256 => Hand) public hands;
    uint256 public handCount;
    uint8[52] public deck;
    address public evaluator;
    uint8 nullCard = 0;

    event HandCreated(uint256 handId, address dealer, bytes32 handPublicKey, uint8 maxPlayers);
    event PlayerJoined(uint256 handId, address player, bytes32 handPublicKey);
    event HandClosed(uint256 handId, address player, bytes32 privateKey);

    constructor(address _evaluator) {
        evaluator = _evaluator;
        createDeck();
    }

    function createDeck() internal {
        for (uint8 i = 0; i < 52; i++) {
            deck[i] = i + 1;
        }
    }

    function createHand(bytes32 _handPublicKey, uint8 _maxPlayers) public returns (uint256) {
        require(_maxPlayers >= 2, "Increase maxPlayers");
        require(_handPublicKey != 0x0, "Invalid key");
        handCount++;
        Hand storage newHand = hands[handCount];
        newHand.dealer = msg.sender;
        newHand.winner = address(0);
        newHand.maxPlayers = _maxPlayers;
        newHand.blockNumber = 0;
        newHand.playerAddresses.push(msg.sender);
        newHand.handPublicKey[msg.sender] = _handPublicKey;
        emit HandCreated(handCount, msg.sender, _handPublicKey, _maxPlayers);
        return handCount;
    }

    function joinHand(uint256 _handId, bytes32 _handPublicKey) public {
        Hand storage hand = hands[_handId];
        require(_handPublicKey != 0x0, "Invalid key");
        require(hand.dealer != address(0), "Hand does not exist");
        require(hand.playerAddresses.length < hand.maxPlayers, "Hand is full");
        require(hand.handPublicKey[msg.sender] == 0x0, "Player already joined");
        hand.playerAddresses.push(msg.sender);
        hand.handPublicKey[msg.sender] = _handPublicKey;
        if (hand.playerAddresses.length == hand.maxPlayers) hand.blockNumber = block.number + 1;
        emit PlayerJoined(_handId, msg.sender, _handPublicKey);
    }

    function flop(uint256 _handId, uint8 _card3 , uint8 _card4, uint8 _card5) public {
        Hand storage hand = hands[_handId];
        require(hand.dealer != address(0), "Hand does not exist");
        require(block.number >= hand.blockNumber, "Too Soon");
        require(hand.handPublicKey[msg.sender] != 0x0, "Player not found in hand");
        require(hand.card3[msg.sender] == nullCard, "Player already revealed");
        require(_card3 != nullCard, "Invalid flop card 3");
        require(_card4 != nullCard, "Invalid flop card 4");
        require(_card5 != nullCard, "Invalid flop card 5");
        hand.card3[msg.sender] = _card3;
        hand.card4[msg.sender] = _card4;
        hand.card5[msg.sender] = _card5;
        bool allRevealed = true;
        for (uint256 i = 0; i < hand.playerAddresses.length; i++) {
            if (hand.card3[hand.playerAddresses[i]] == nullCard) {
                allRevealed = false;
                break;
            }
        }
        if (allRevealed) {
            for (uint256 i = 0; i < hand.playerAddresses.length; i++) {
                hand.flop1 += hand.card3[hand.playerAddresses[i]];
                hand.flop2 += hand.card4[hand.playerAddresses[i]];
                hand.flop3 += hand.card5[hand.playerAddresses[i]];
            }
            hand.flop1 = uint8((hand.flop1 % 52) + 1);
            hand.flop2 = uint8((hand.flop2 % 52) + 1);
            hand.flop3 = uint8((hand.flop3 % 52) + 1);
        }
    }

    function turn(uint256 _handId, uint8 _card6) public {
        Hand storage hand = hands[_handId];
        require(hand.dealer != address(0), "Hand does not exist");
        require(block.number >= hand.blockNumber, "Too Soon");
        require(hand.handPublicKey[msg.sender] != 0x0, "Player not found in hand");
        require(hand.card6[msg.sender] == nullCard, "Player already revealed");
        require(_card6 != nullCard, "Invalid turn card");
        hand.card6[msg.sender] = _card6;
        bool allRevealed = true;
        for (uint256 i = 0; i < hand.playerAddresses.length; i++) {
            if (hand.card6[hand.playerAddresses[i]] == nullCard) {
                allRevealed = false;
                break;
            }
        }
        if (allRevealed) {
            for (uint256 i = 0; i < hand.playerAddresses.length; i++) {
                hand.turn += hand.card6[hand.playerAddresses[i]];
            }
            hand.turn = uint8((hand.turn % 52) + 1);
        }
    }

    function river(uint256 _handId, uint8 _card7) public {
        Hand storage hand = hands[_handId];
        require(hand.dealer != address(0), "Hand does not exist");
        require(block.number >= hand.blockNumber, "Too Soon");
        require(hand.handPublicKey[msg.sender] != 0x0, "Player not found in hand");
        require(hand.card7[msg.sender] == nullCard, "Player already revealed");
        require(_card7 != nullCard, "Invalid river card");
        hand.card7[msg.sender] = _card7;
        bool allRevealed = true;
        for (uint256 i = 0; i < hand.playerAddresses.length; i++) {
            if (hand.card7[hand.playerAddresses[i]] == nullCard) {
                allRevealed = false;
                break;
            }
        }
        if (allRevealed) {
            for (uint256 i = 0; i < hand.playerAddresses.length; i++) {
                hand.river += hand.card7[hand.playerAddresses[i]];
            }
            hand.river = uint8((hand.river % 52) + 1);
        }
    }

    function closeHand(uint256 _handId, bytes32 _privateKey) public {
        Hand storage hand = hands[_handId];
        require(hand.dealer != address(0), "Hand does not exist");
        require(block.number >= hand.blockNumber, "Too Soon");
        require(hand.card7[msg.sender] != nullCard, "Cant close before turn");
        require(hand.winner == address(0), "Hand is already closed");
        require(hand.handPublicKey[msg.sender] != 0x0, "Player not found in hand");
        require(hand.handPrivateKey[msg.sender] == 0x0, "Player already revealed");
        require(keccak256(abi.encodePacked(_privateKey)) == hand.handPublicKey[msg.sender], "Invalid key");
        hand.handPrivateKey[msg.sender] = _privateKey;
        uint8[7] memory dealtCards = shuffleAndDeal(blockhash(hand.blockNumber), _privateKey);
        hand.card1[msg.sender] = dealtCards[0];
        hand.card2[msg.sender] = dealtCards[1];
        require(dealtCards[2] == hand.card3[msg.sender], "Invalid card 3");
        require(dealtCards[3] == hand.card4[msg.sender], "Invalid card 4");
        require(dealtCards[4] == hand.card5[msg.sender], "Invalid card 5");
        require(dealtCards[5] == hand.card6[msg.sender], "Invalid card 6");
        require(dealtCards[6] == hand.card7[msg.sender], "Invalid card 7");
        emit HandClosed(_handId, msg.sender, _privateKey);
        // Check if all players have revealed their keys
        bool allRevealed = true;
        for (uint256 i = 0; i < hand.playerAddresses.length; i++) {
            if (hand.handPrivateKey[hand.playerAddresses[i]] == 0x0) {
                allRevealed = false;
                break;
            }
        }
        if (allRevealed) {
            // Determine winner via PokerHandEvaluator.sol

            //IPokerHandEvaluator(evaluator).compareHands();

            hand.winner = hand.dealer;
        }
    }

     function shuffleDeck(bytes32 hash) public view returns (uint8[52] memory) {
        uint8[52] memory shuffledDeck = deck;
        for (uint256 i = 0; i < shuffledDeck.length; i++) {
            uint256 randomIndex = uint256(keccak256(abi.encodePacked(hash, i))) % shuffledDeck.length;
            uint8 temp = shuffledDeck[i];
            shuffledDeck[i] = shuffledDeck[randomIndex];
            shuffledDeck[randomIndex] = temp;
        }
        return shuffledDeck;
    }

    function shuffleAndDeal(bytes32 blockHash, bytes32 privateKey) public view returns (uint8[7] memory) {
        bytes32 combinedHash = keccak256(abi.encodePacked(blockHash, privateKey));
        uint8[52] memory shuffledDeck = shuffleDeck(combinedHash);
        return [shuffledDeck[0], shuffledDeck[1], shuffledDeck[2], shuffledDeck[3], shuffledDeck[4], shuffledDeck[5], shuffledDeck[6]];
    }

    function getPlayersInHand(uint256 handId) public view returns (address[] memory) {
        return hands[handId].playerAddresses;
    }

    function getHandDetails(uint256 handId) public view returns (address[] memory, uint256) {
        Hand storage hand = hands[handId];
        return (hand.playerAddresses, hand.blockNumber);
    }

    function getFlop(uint256 handId) public view returns (uint8, uint8, uint8) {
        return (hands[handId].flop1, hands[handId].flop2, hands[handId].flop3);
    }

    function getTurn(uint256 handId) public view returns (uint8) {
        return hands[handId].turn;
    }

    function getRiver(uint256 handId) public view returns (uint8) {
        return hands[handId].river;
    }

    function getHash(uint256 handId) public view returns (bytes32) {
        return blockhash(hands[handId].blockNumber);
    }
}
