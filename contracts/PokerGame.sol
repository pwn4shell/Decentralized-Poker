// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IPokerHandEvaluator {
    function compareHands(uint8[7] memory hand1, uint8[7] memory hand2) external pure returns (uint8);
    function evaluateHand(uint8[7] memory hand) external pure returns (uint8);
}

interface IPokerChips {
    function balanceOf(address account) external view returns (uint);
    function transferFrom(address sender, address recipient, uint amount) external returns (bool);
    function transfer(address recipient, uint amount) external returns (bool);
}

interface IPokerDealer {
    function createHand(bytes32 handPublicKey, uint8 maxPlayers) external returns (uint);
    function joinHand(uint gid, bytes32 handPublicKey) external;
    function closeHand(uint gid, bytes32 privateKey) external;
    function getPrivateKey(uint gid, address player) external view returns (bytes32);
    function getFlop(uint gid) external view returns (uint8, uint8, uint8);
    function getTurn(uint gid) external view returns (uint8);
    function getRiver(uint gid) external view returns (uint8);
    function getPlayerCards(uint gid, address player) external view returns (uint8, uint8);
}

contract PokerGame {
    enum GameState { Waiting, PreFlop, Flop, Turn, River, Showdown }
    enum PlayerAction { Fold, Check, Call, Raise }

    struct Player {
        address addr;
        uint chips;
        uint currentBet;
        bool hasFolded;
        bool hasActed;
        bytes32 handPublicKey;
    }

    struct Game {
        GameState state;
        uint8 maxPlayers;
        uint8 activePlayers;
        uint pot;
        uint currentBet;
        uint smallBlind;
        uint bigBlind;
        uint8 dealerPosition;
        uint8 currentPlayerTurn;
        mapping(uint8 => Player) players;
        uint lastActionTime;
        uint[] hands;
    }

    IPokerHandEvaluator public handEvaluator;
    IPokerChips public pokerChips;
    IPokerDealer public pokerDealer;

    mapping(uint => Game) public games;
    uint gameCount = 0;

    uint public constant MAX_PLAYERS = 9;
    uint public constant ACTION_TIMEOUT = 30 seconds;

    event GameCreated(uint indexed gid, uint8 maxPlayers, uint smallBlind, uint bigBlind);
    event PlayerJoined(uint indexed gid, address player, uint8 seatIndex);
    event NewRound(uint indexed gid, uint indexed hid);
    event Action(uint indexed gid, address player, PlayerAction action, uint amount);
    event CommunityCardsDealt(uint indexed gid, uint8 flop1, uint8 flop2, uint8 flop3, uint8 turn, uint8 river);
    event PotAwarded(uint indexed gid, address winner, uint amount);

    constructor(address _handEvaluator, address _pokerChips, address _pokerDealer) {
        handEvaluator = IPokerHandEvaluator(_handEvaluator);
        pokerChips = IPokerChips(_pokerChips);
        pokerDealer = IPokerDealer(_pokerDealer);
    }

    function createGame(uint8 _maxPlayers, uint _smallBlind, uint _bigBlind) external returns (uint) {
        require(_maxPlayers >= 2 && _maxPlayers <= MAX_PLAYERS, "Invalid number of players");
        require(_bigBlind == _smallBlind * 2, "Big blind must be twice the small blind");
        gameCount ++;
        Game storage newGame = games[gameCount];
        newGame.maxPlayers = _maxPlayers;
        newGame.smallBlind = _smallBlind;
        newGame.bigBlind = _bigBlind;
        newGame.state = GameState.Waiting;
        emit GameCreated(gameCount, _maxPlayers, _smallBlind, _bigBlind);
        return gameCount;
    }

    function joinGame(uint _gid, uint8 _seatIndex, bytes32 _handPublicKey) external {
        Game storage game = games[_gid];
        require(game.state == GameState.Waiting, "Game is not in waiting state");
        require(_seatIndex < game.maxPlayers, "Invalid seat index");
        require(game.players[_seatIndex].addr == address(0), "Seat is already taken");
        require(game.activePlayers < game.maxPlayers, "Game is full");
        uint buyIn = game.bigBlind * 100;
        require(pokerChips.balanceOf(msg.sender) >= buyIn, "Insufficient chips for buy-in");
        pokerChips.transferFrom(msg.sender, address(this), buyIn);
        game.players[_seatIndex] = Player({
            addr: msg.sender,
            chips: buyIn,
            currentBet: 0,
            hasFolded: false,
            hasActed: false,
            handPublicKey: _handPublicKey
        });
        game.activePlayers++;
        emit PlayerJoined(_gid, msg.sender, _seatIndex);
    }

    function dealHand(uint _gid) external {
        Game storage game = games[_gid];
        require(game.state == GameState.Waiting, "Game is not in waiting state");
        require(game.activePlayers >= 2, "Not enough players to start the game");
        game.state = GameState.PreFlop;
        game.dealerPosition = (game.dealerPosition + 1) % game.activePlayers;
        game.currentPlayerTurn = (game.dealerPosition + 3) % game.activePlayers;
        uint8 smallBlindPos = (game.dealerPosition + 1) % game.activePlayers;
        uint8 bigBlindPos = (game.dealerPosition + 2) % game.activePlayers;
        postBlind(_gid, smallBlindPos, game.smallBlind);
        postBlind(_gid, bigBlindPos, game.bigBlind);
        game.currentBet = game.bigBlind;
        game.lastActionTime = block.timestamp;
        bytes32 dealerKey = game.players[game.dealerPosition].handPublicKey;
        uint hid = pokerDealer.createHand(dealerKey, game.activePlayers);
        game.hands.push(hid);
        for (uint8 i = 0; i < game.maxPlayers; i++) {
            Player storage player = game.players[i];
            if (player.addr != address(0) && player.handPublicKey != dealerKey) { // security - can another user duplicate the dealerKey
                pokerDealer.joinHand(hid, player.handPublicKey);
            }
        }
        emit NewRound(_gid, hid);
    }

    function postBlind(uint _gid, uint8 _playerPosition, uint _blindAmount) internal {
        Game storage game = games[_gid];
        Player storage player = game.players[_playerPosition];
        require(player.chips >= _blindAmount, "Player doesn't have enough chips for blind");
        player.chips -= _blindAmount;
        player.currentBet = _blindAmount;
        game.pot += _blindAmount;
    }

    function playerAction(uint _gid, PlayerAction _action, uint _amount) external {
        Game storage game = games[_gid];
        Player storage currentPlayer = game.players[game.currentPlayerTurn];
        require(game.state != GameState.Waiting, "Game hasn't started yet");
        require(currentPlayer.addr == msg.sender, "It's not your turn");
        require(!currentPlayer.hasFolded, "You have already folded");
        require(block.timestamp <= game.lastActionTime + ACTION_TIMEOUT, "Action timeout, please call nextPlayer");

        if (_action == PlayerAction.Fold) {
            currentPlayer.hasFolded = true;
            game.activePlayers--;
        } else if (_action == PlayerAction.Check) {
            require(currentPlayer.currentBet == game.currentBet, "Cannot check, must call or raise");
        } else if (_action == PlayerAction.Call) {
            uint callAmount = game.currentBet - currentPlayer.currentBet;
            require(currentPlayer.chips >= callAmount, "Not enough chips to call");
            currentPlayer.chips -= callAmount;
            currentPlayer.currentBet = game.currentBet;
            game.pot += callAmount;
        } else if (_action == PlayerAction.Raise) {
            require(_amount > game.currentBet, "Raise amount must be greater than current bet");
            require(currentPlayer.chips >= _amount, "Not enough chips to raise");
            uint raiseAmount = _amount - currentPlayer.currentBet;
            currentPlayer.chips -= raiseAmount;
            currentPlayer.currentBet = _amount;
            game.currentBet = _amount;
            game.pot += raiseAmount;
        }
        currentPlayer.hasActed = true;
        emit Action(_gid, msg.sender, _action, _amount);
        nextPlayer(_gid);
    }

    function nextPlayer(uint _gid) public {
        Game storage game = games[_gid];
        require(game.state != GameState.Waiting, "Game hasn't started yet");
        do {
            game.currentPlayerTurn = (game.currentPlayerTurn + 1) % game.maxPlayers;
        } while (game.players[game.currentPlayerTurn].hasFolded || game.players[game.currentPlayerTurn].addr == address(0));
        if (isRoundComplete(game)) {
            advanceToNextRound(_gid);
        } else {
            game.lastActionTime = block.timestamp;
        }
    }

    function isRoundComplete(Game storage game) internal view returns (bool) {
        uint8 playersToAct = 0;
        for (uint8 i = 0; i < game.maxPlayers; i++) {
            Player storage player = game.players[i];
            if (player.addr != address(0) && !player.hasFolded) {
                if (!player.hasActed || player.currentBet != game.currentBet) {
                    playersToAct++;
                }
            }
        }
        return playersToAct == 0;
    }

    function advanceToNextRound(uint _gid) internal {
        Game storage game = games[_gid];
        if (game.activePlayers == 1) {
            determineWinners(_gid);
        } else {
            if (game.state == GameState.PreFlop) {
                game.state = GameState.Flop;
            } else if (game.state == GameState.Flop) {
                game.state = GameState.Turn;
            } else if (game.state == GameState.Turn) {
                game.state = GameState.River;
            } else if (game.state == GameState.River) {
                game.state = GameState.Showdown;
                return;
            }
            resetBets(game);
            game.currentPlayerTurn = (game.dealerPosition + 1) % game.maxPlayers;
            game.lastActionTime = block.timestamp;
            emit NewRound(_gid, game.state);
        }
    }

    function resetBets(Game storage game) internal {
        for (uint8 i = 0; i < game.maxPlayers; i++) {
            Player storage player = game.players[i];
            if (player.addr != address(0) && !player.hasFolded) {
                player.currentBet = 0;
                player.hasActed = false;
            }
        }
        game.currentBet = 0;
    }

    function revealHand(uint _gid, bytes32 _privateKey, bytes32 _nextPublicKey) external {
        Game storage game = games[_gid];
        uint hid = game.hands[game.hands.length - 1];
        require(game.state == GameState.Showdown, "Not in showdown state");
        uint8 revealed = 0;
        for (uint8 i = 0; i < game.maxPlayers; i++) {
            Player storage player = game.players[i];
            if (player.addr == msg.sender) {
                pokerDealer.closeHand(hid, _privateKey);
                player.handPublicKey = _nextPublicKey;
                revealed++;
            } else if (player.addr != address(0)) {
                bytes32 pk = pokerDealer.getPrivateKey(hid, player.addr);
                if (pk != 0x0) revealed++;
            }
        }
        if (revealed == game.activePlayers) determineWinners(_gid);
    }

    function determineWinners(uint _gid) internal {
        Game storage game = games[_gid];
        uint hid = game.hands[game.hands.length - 1];
        uint8[5] memory communityCards = getCommunityCards(hid);
        address[] memory potentialWinners = new address[](game.maxPlayers);
        uint8 winnerCount = 0;
        uint8[7] memory bestHand;
        bool firstPlayer = true;

        for (uint8 i = 0; i < game.maxPlayers; i++) {
            Player storage player = game.players[i];
            if (player.addr != address(0) && !player.hasFolded) {
                uint8[2] memory playerCards = getPlayerCards(hid, player.addr);
                uint8[7] memory currentHand = combineCards(playerCards, communityCards);
                
                if (firstPlayer) {
                    bestHand = currentHand;
                    potentialWinners[0] = player.addr;
                    winnerCount = 1;
                    firstPlayer = false;
                } else {
                    uint8 result = handEvaluator.compareHands(currentHand, bestHand);
                    if (result == 1) {
                        bestHand = currentHand;
                        potentialWinners[0] = player.addr;
                        winnerCount = 1;
                    } else if (result == 0) {
                        potentialWinners[winnerCount] = player.addr;
                        winnerCount++;
                    }
                }
            }
        }

        uint winnerPot = game.pot / winnerCount;
        resetGame(game);    
        for (uint8 j = 0; j < winnerCount; j++) {
            if (potentialWinners[j] != address(0)) {
                pokerChips.transfer(potentialWinners[j], winnerPot);
                emit PotAwarded(_gid, potentialWinners[j], winnerPot);
            }
        }
    }

    function getCommunityCards(uint _hid) internal view returns (uint8[5] memory) {
        (uint8 flop1, uint8 flop2, uint8 flop3) = pokerDealer.getFlop(_hid);
        uint8 turn = pokerDealer.getTurn(_hid);
        uint8 river = pokerDealer.getRiver(_hid);
        return [flop1, flop2, flop3, turn, river];
    }

    function getPlayerCards(uint _hid, address playerAddr) internal view returns (uint8[2] memory) {
        (uint8 card1, uint8 card2) = pokerDealer.getPlayerCards(_hid, playerAddr);
        return [card1, card2];
    }

    function combineCards(uint8[2] memory playerCards, uint8[5] memory communityCards) internal pure returns (uint8[7] memory) {
        return [playerCards[0], playerCards[1], communityCards[0], communityCards[1], communityCards[2], communityCards[3], communityCards[4]];
    }

    function resetGame(Game storage game) internal {
        game.state = GameState.Waiting;
        game.pot = 0;
        game.currentBet = 0;
        for (uint8 i = 0; i < game.maxPlayers; i++) {
            Player storage player = game.players[i];
            if (player.addr != address(0)) {
                player.currentBet = 0;
                player.hasFolded = false;
                player.hasActed = false;
            }
        }
    }

}
