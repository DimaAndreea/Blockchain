// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@chainlink/contracts/src/v0.8/vrf/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/vrf/interfaces/VRFCoordinatorV2Interface.sol";

contract LotteryVRF is VRFConsumerBaseV2 {
    enum State { OPEN, DRAWING, PAID }

    address public owner;
    State public state;

    uint256 public ticketPrice;
    address[] private players;

    address public lastWinner;
    uint256 public lastPrize;

    uint256 public lastRequestId;

    VRFCoordinatorV2Interface public COORDINATOR;

    uint64 public subscriptionId;
    bytes32 public keyHash;
    uint32 public callbackGasLimit;
    uint16 public requestConfirmations;
    uint32 public numWords = 1;

    event TicketBought(address indexed buyer, uint256 amount, uint256 totalPlayers, uint256 pot);
    event DrawRequested(uint256 indexed requestId);
    event WinnerSelected(address indexed winner, uint256 prize, uint256 randomWord);
    event PrizeWithdrawn(address indexed winner, uint256 amount);

    error NotOwner();
    error WrongState();
    error NotEnoughETH();
    error NoPlayers();
    error NotWinner();
    error NothingToWithdraw();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier inState(State s) {
        if (state != s) revert WrongState();
        _;
    }

    constructor(
        uint256 _ticketPriceWei,
        address _vrfCoordinator,
        uint64 _subId,
        bytes32 _keyHash,
        uint32 _callbackGasLimit,
        uint16 _confirmations
    ) VRFConsumerBaseV2(_vrfCoordinator) {
        owner = msg.sender;
        ticketPrice = _ticketPriceWei;
        state = State.OPEN;

        COORDINATOR = VRFCoordinatorV2Interface(_vrfCoordinator);
        subscriptionId = _subId;
        keyHash = _keyHash;
        callbackGasLimit = _callbackGasLimit;
        requestConfirmations = _confirmations;
    }

    function buyTicket() external payable inState(State.OPEN) {
        if (msg.value != ticketPrice) revert NotEnoughETH();
        players.push(msg.sender);
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
        state = State.DRAWING;

        lastRequestId = COORDINATOR.requestRandomWords(
            keyHash,
            subscriptionId,
            requestConfirmations,
            callbackGasLimit,
            numWords
        );

        emit DrawRequested(lastRequestId);
    }

    function fulfillRandomWords(uint256 /*requestId*/, uint256[] memory randomWords) internal override {
        uint256 idx = randomWords[0] % players.length;
        address winner = players[idx];

        lastWinner = winner;
        lastPrize = address(this).balance;
        state = State.PAID;

        emit WinnerSelected(winner, lastPrize, randomWords[0]);
    }

    function withdrawPrize() external inState(State.PAID) {
        if (msg.sender != lastWinner) revert NotWinner();

        uint256 amount = lastPrize;
        if (amount == 0) revert NothingToWithdraw();

        lastPrize = 0;

        (bool ok, ) = payable(msg.sender).call{ value: amount }("");
        require(ok, "ETH transfer failed");

        emit PrizeWithdrawn(msg.sender, amount);

        delete players;
        state = State.OPEN;
    }

    receive() external payable {}
}
