// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract PokerDealer {

    struct Hand {
        address dealer;
        address winner;
        uint8 maxPlayers;
        uint256 ante;
        uint256 blockNumber;
        address[] playerAddresses;
        mapping(address => Card) card1;
        mapping(address => Card) card2;
        mapping(address => bytes32) handPublicKey;
        mapping(address => bytes32) handPrivateKey;
    }

    struct Card {
        uint8 value; // 2-14, where 11=J, 12=Q, 13=K, 14=A
        uint8 suit;  // 0=hearts, 1=diamonds, 2=clubs, 3=spades
    }

    mapping(uint256 => Hand) public hands;
    uint256 public handCount;
    Card[52] public deck;

    event HandCreated(uint256 handId, address dealer, bytes32 handPublicKey, uint8 maxPlayers);
    event PlayerJoined(uint256 handId, address player, bytes32 handPublicKey);
    event HandClosed(uint256 handId, address player, bytes32 privateKey);

    constructor() {
        createDeck();
    }

    function createDeck() internal {
        uint8 index = 0;
        for (uint8 suit = 0; suit < 4; suit++) {
            for (uint8 value = 2; value <= 14; value++) {
                deck[index] = Card(value, suit);
                index++;
            }
        }
    }

    function createHand(bytes32 _handPublicKey, uint8 _maxPlayers) public payable returns (uint256) {
        require(_maxPlayers >= 2, "Increase maxPlayers");
        require(_handPublicKey != 0x0, "Invalid key");
        handCount++;
        Hand storage newHand = hands[handCount];
        newHand.dealer = msg.sender;
        newHand.winner = address(0);
        newHand.maxPlayers = _maxPlayers;
        newHand.ante = msg.value;
        newHand.blockNumber = 0;
        newHand.playerAddresses.push(msg.sender);
        newHand.handPublicKey[msg.sender] = _handPublicKey;
        emit HandCreated(handCount, msg.sender, _handPublicKey, _maxPlayers);
        return handCount;
    }

    function joinHand(uint256 _handId, bytes32 _handPublicKey) public payable {
        Hand storage hand = hands[_handId];
        require(_handPublicKey != 0x0, "Invalid key");
        require(hand.dealer != address(0), "Hand does not exist");
        require(msg.value == hand.ante, "Incorrect ante amount");
        require(hand.playerAddresses.length < hand.maxPlayers, "Hand is full");
        require(hand.handPublicKey[msg.sender] == 0x0, "Player already joined");
        hand.playerAddresses.push(msg.sender);
        hand.handPublicKey[msg.sender] = _handPublicKey;
        if (hand.playerAddresses.length == hand.maxPlayers) hand.blockNumber = block.number + 1;
        emit PlayerJoined(_handId, msg.sender, _handPublicKey);
    }

    function closeHand(uint256 _handId, bytes32 _privateKey) public {
        Hand storage hand = hands[_handId];
        require(hand.dealer != address(0), "Hand does not exist");
        require(block.number >= hand.blockNumber, "Too Soon");
        require(hand.winner == address(0), "Hand is already closed");
        require(hand.handPublicKey[msg.sender] != 0x0, "Player not found in hand");
        require(hand.handPrivateKey[msg.sender] == 0x0, "Player already revealed");
        require(keccak256(abi.encodePacked(_privateKey)) == hand.handPublicKey[msg.sender], "Invalid key");
        hand.handPrivateKey[msg.sender] = _privateKey;
        Card[2] memory dealtCards = shuffleAndDeal(blockhash(hand.blockNumber), _privateKey);
        hand.card1[msg.sender] = dealtCards[0];
        hand.card2[msg.sender] = dealtCards[1];
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
            hand.winner = hand.dealer;
        }
    }

     function shuffleDeck(bytes32 hash) public view returns (Card[52] memory) {
        Card[52] memory shuffledDeck = deck;
        for (uint256 i = 0; i < shuffledDeck.length; i++) {
            uint256 randomIndex = uint256(keccak256(abi.encodePacked(hash, i))) % shuffledDeck.length;
            Card memory temp = shuffledDeck[i];
            shuffledDeck[i] = shuffledDeck[randomIndex];
            shuffledDeck[randomIndex] = temp;
        }
        return shuffledDeck;
    }

    function shuffleAndDeal(bytes32 blockHash, bytes32 privateKey) public view returns (Card[2] memory) {
        bytes32 combinedHash = keccak256(abi.encodePacked(blockHash, privateKey));
        Card[52] memory shuffledDeck = shuffleDeck(combinedHash);
        return [shuffledDeck[0], shuffledDeck[1]];
    }


    function getPlayersInHand(uint256 handId) public view returns (address[] memory) {
        return hands[handId].playerAddresses;
    }

    function getHandDetails(uint256 handId) public view returns (address[] memory, uint256) {
        Hand storage hand = hands[handId];
        return (hand.playerAddresses, hand.blockNumber);
    }
}
