// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "hardhat/console.sol";

contract PokerDealer {

    struct Hand {
        address dealer;
        uint8 maxPlayers;
        uint blockNumber;
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

    mapping(uint => Hand) public hands;
    uint public handCount;
    uint8[52] public deck;
    address public evaluator;
    uint8 nullCard = 0;

    event HandCreated(uint handId, address dealer, bytes32 handPublicKey, uint8 maxPlayers);
    event PlayerJoined(uint handId, address player, bytes32 handPublicKey);
    event HandClosed(uint handId, address player, bytes32 privateKey);

    constructor() {
        createDeck();
    }

    function createDeck() internal {
        for (uint8 i = 0; i < 52; i++) {
            deck[i] = i + 1;
        }
    }

    function createHand(bytes32 _handPublicKey, uint8 _maxPlayers) public returns (uint) {
        require(_maxPlayers >= 2, "Increase maxPlayers");
        require(_handPublicKey != 0x0, "Invalid key");
        handCount++;
        Hand storage newHand = hands[handCount];
        newHand.dealer = msg.sender;
        newHand.maxPlayers = _maxPlayers;
        newHand.blockNumber = 0;
        newHand.playerAddresses.push(msg.sender);
        newHand.handPublicKey[msg.sender] = _handPublicKey;
        emit HandCreated(handCount, msg.sender, _handPublicKey, _maxPlayers);
        return handCount;
    }

    function joinHand(uint _hid, bytes32 _handPublicKey) public {
        Hand storage hand = hands[_hid];
        require(_handPublicKey != 0x0, "Invalid key");
        require(hand.dealer != address(0), "Hand does not exist");
        require(hand.playerAddresses.length < hand.maxPlayers, "Hand is full");
        require(hand.handPublicKey[msg.sender] == 0x0, "Player already joined");
        hand.playerAddresses.push(msg.sender);
        hand.handPublicKey[msg.sender] = _handPublicKey;
        if (hand.playerAddresses.length == hand.maxPlayers) hand.blockNumber = block.number + 1;
        emit PlayerJoined(_hid, msg.sender, _handPublicKey);
    }

    function flop(uint _hid, uint8 _card3 , uint8 _card4, uint8 _card5) public {
        Hand storage hand = hands[_hid];
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
        for (uint i = 0; i < hand.playerAddresses.length; i++) {
            if (hand.card3[hand.playerAddresses[i]] == nullCard) {
                allRevealed = false;
                break;
            }
        }
        if (allRevealed) {
            for (uint i = 0; i < hand.playerAddresses.length; i++) {
                hand.flop1 += hand.card3[hand.playerAddresses[i]];
                hand.flop2 += hand.card4[hand.playerAddresses[i]];
                hand.flop3 += hand.card5[hand.playerAddresses[i]];
            }
            hand.flop1 = uint8((hand.flop1 % 52) + 1);
            hand.flop2 = uint8((hand.flop2 % 52) + 1);
            hand.flop3 = uint8((hand.flop3 % 52) + 1);
        }
    }

    function turn(uint _hid, uint8 _card6) public {
        Hand storage hand = hands[_hid];
        require(hand.dealer != address(0), "Hand does not exist");
        require(block.number >= hand.blockNumber, "Too Soon");
        require(hand.handPublicKey[msg.sender] != 0x0, "Player not found in hand");
        require(hand.card6[msg.sender] == nullCard, "Player already revealed");
        require(_card6 != nullCard, "Invalid turn card");
        hand.card6[msg.sender] = _card6;
        bool allRevealed = true;
        for (uint i = 0; i < hand.playerAddresses.length; i++) {
            if (hand.card6[hand.playerAddresses[i]] == nullCard) {
                allRevealed = false;
                break;
            }
        }
        if (allRevealed) {
            for (uint i = 0; i < hand.playerAddresses.length; i++) {
                hand.turn += hand.card6[hand.playerAddresses[i]];
            }
            hand.turn = uint8((hand.turn % 52) + 1);
        }
    }

    function river(uint _hid, uint8 _card7) public {
        Hand storage hand = hands[_hid];
        require(hand.dealer != address(0), "Hand does not exist");
        require(block.number >= hand.blockNumber, "Too Soon");
        require(hand.handPublicKey[msg.sender] != 0x0, "Player not found in hand");
        require(hand.card7[msg.sender] == nullCard, "Player already revealed");
        require(_card7 != nullCard, "Invalid river card");
        hand.card7[msg.sender] = _card7;
        bool allRevealed = true;
        for (uint i = 0; i < hand.playerAddresses.length; i++) {
            if (hand.card7[hand.playerAddresses[i]] == nullCard) {
                allRevealed = false;
                break;
            }
        }
        if (allRevealed) {
            for (uint i = 0; i < hand.playerAddresses.length; i++) {
                hand.river += hand.card7[hand.playerAddresses[i]];
            }
            hand.river = uint8((hand.river % 52) + 1);
        }
    }

    function closeHand(uint _hid, bytes32 _privateKey) public {
        Hand storage hand = hands[_hid];
        require(hand.dealer != address(0), "Hand does not exist");
        require(block.number >= hand.blockNumber, "Too Soon");
        require(hand.card7[msg.sender] != nullCard, "Cant close before turn");
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
        emit HandClosed(_hid, msg.sender, _privateKey);
    }

    function shuffleDeck(bytes32 hash) public view returns (uint8[52] memory) {
        uint8[52] memory shuffledDeck = deck;
        for (uint i = 0; i < shuffledDeck.length; i++) {
            uint randomIndex = uint(keccak256(abi.encodePacked(hash, i))) % shuffledDeck.length;
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

    function getPlayersInHand(uint _hid) public view returns (address[] memory) {
        return hands[_hid].playerAddresses;
    }

    function getHand(uint _hid) public view returns (address, uint8, uint) {
        return (hands[_hid].dealer, hands[_hid].maxPlayers, hands[_hid].blockNumber);
    }

    function getFlop(uint _hid) public view returns (uint8, uint8, uint8) {
        return (hands[_hid].flop1, hands[_hid].flop2, hands[_hid].flop3);
    }

    function getTurn(uint _hid) public view returns (uint8) {
        return hands[_hid].turn;
    }

    function getRiver(uint _hid) public view returns (uint8) {
        return hands[_hid].river;
    }

    function getHash(uint _hid) public view returns (bytes32) {
        return blockhash(hands[_hid].blockNumber);
    }

    function getPrivateKey(uint _hid, address _player) public view returns (bytes32) {
        return hands[_hid].handPrivateKey[_player];
    }

    function getPlayerCards(uint _hid, address _player) public view returns (uint8, uint8) {
        return (hands[_hid].card1[_player], hands[_hid].card2[_player]);
    }
}
