// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./LotteryMath.sol";

interface IRandomnessProvider {
    function requestRandom(uint256 requestId) external;
}

contract Lottery {
    using LotteryMath for uint256;

    enum State { OPEN, DRAWING, PAID }

    address public owner;
    address public randomnessProvider;
    State public state;

    uint256 public ticketPrice;
    address[] private players;

    address public lastWinner;
    uint256 public lastPrize;

    uint256 public requestId;

    mapping(address => uint256) public ticketsByAddress;

    // ✅ Withdrawal Pattern: "pull payments"
    mapping(address => uint256) public pendingWithdrawals;

    event TicketBought(address indexed buyer, uint256 amount, uint256 totalPlayers, uint256 pot);
    event ProviderSet(address indexed provider);
    event DrawRequested(uint256 indexed requestId, uint256 playersCount, uint256 pot);
    event WinnerSelected(address indexed winner, uint256 prize, uint256 randomWord);
    event PrizeWithdrawn(address indexed winner, uint256 amount);

    error NotOwner();
    error NotProvider();
    error WrongState();
    error NotEnoughETH();
    error NoPlayers();
    error NotWinner();
    error NothingToWithdraw();
    error ProviderNotSet();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyProvider() {
        if (msg.sender != randomnessProvider) revert NotProvider();
        _;
    }

    modifier inState(State s) {
        if (state != s) revert WrongState();
        _;
    }

    constructor(uint256 _ticketPriceWei) {
        owner = msg.sender;
        ticketPrice = _ticketPriceWei;
        state = State.OPEN;
    }

    function setProvider(address _provider) external onlyOwner {
        randomnessProvider = _provider;
        emit ProviderSet(_provider);
    }

    function buyTicket() external payable inState(State.OPEN) {
        if (msg.value != ticketPrice) revert NotEnoughETH();

        players.push(msg.sender);
        ticketsByAddress[msg.sender] += 1;

        emit TicketBought(msg.sender, 1, players.length, address(this).balance);
    }

    function getPlayersCount() external view returns (uint256) {
        return players.length;
    }

    function getPot() external view returns (uint256) {
        return address(this).balance;
    }

    function requestDraw() external onlyOwner inState(State.OPEN) {
        if (players.length == 0) revert NoPlayers();
        if (randomnessProvider == address(0)) revert ProviderNotSet();

        state = State.DRAWING;
        requestId += 1;

        // Oracle-style request
        IRandomnessProvider(randomnessProvider).requestRandom(requestId);

        emit DrawRequested(requestId, players.length, address(this).balance);
    }

    // IMPORTANT: randomness can ONLY come from provider (prevents manipulation)
    function fulfillRandom(uint256 randomWord) external onlyProvider inState(State.DRAWING) {
        uint256 idx = randomWord.winnerIndex(players.length);
        address winner = players[idx];

        uint256 prize = address(this).balance;

        lastWinner = winner;
        lastPrize = prize;

        // ✅ Withdrawal Pattern: store credit, winner withdraws later
        pendingWithdrawals[winner] += prize;

        state = State.PAID;

        emit WinnerSelected(winner, prize, randomWord);
    }

    function withdrawPrize() external inState(State.PAID) {
        if (msg.sender != lastWinner) revert NotWinner();

        uint256 amount = pendingWithdrawals[msg.sender];
        if (amount == 0) revert NothingToWithdraw();

        // ✅ effects before interaction
        pendingWithdrawals[msg.sender] = 0;
        lastPrize = 0;

        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "ETH transfer failed");

        emit PrizeWithdrawn(msg.sender, amount);

        delete players;
        lastWinner = address(0);
        state = State.OPEN;
    }

    receive() external payable {}
}
