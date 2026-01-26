// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {VRFConsumerBaseV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";
import {IVRFCoordinatorV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/interfaces/IVRFCoordinatorV2Plus.sol";
import {AutomationCompatibleInterface} from "@chainlink/contracts/src/v0.8/automation/interfaces/AutomationCompatibleInterface.sol";
import {LotteryMath} from "./LotteryMath.sol";

contract Lottery is VRFConsumerBaseV2Plus, AutomationCompatibleInterface {
    // -----------------------
    // errors
    // -----------------------
    error Lottery__WrongETH();
    error Lottery__UpkeepNotNeeded(uint256 balance, uint256 players, uint256 state);
    error Lottery__OnlyWinner();
    error Lottery__NothingToWithdraw();
    error Lottery__TransferFailed();
    error Lottery__WrongState(uint256 expected, uint256 actual);

    // -----------------------
    // events
    // -----------------------
    event TicketBought(address indexed buyer, uint256 amount, uint256 totalPlayers, uint256 pot);
    event RandomnessRequested(uint256 indexed requestId);
    event WinnerSelected(address indexed winner, uint256 prize, uint256 randomWord);
    event PrizeWithdrawn(address indexed winner, uint256 amount);

    // -----------------------
    // state machine
    // -----------------------
    enum State {
        OPEN,
        CALCULATING,
        PAID
    }
    State public state;

    // -----------------------
    // lottery params
    // -----------------------
    uint256 public immutable ticketPrice;
    uint256 public immutable interval;

    // 0 = round has not started yet (no first ticket)
    uint256 public lastTimeStamp;

    address[] private players;

    // payout (pull pattern)
    address public lastWinner;
    uint256 public lastPrize;
    uint256 public previousPrize; // prize from previous round (saved after withdraw)

    mapping(address => uint256) public ticketsByAddress;

    // -----------------------
    // vrf params
    // -----------------------
    IVRFCoordinatorV2Plus public immutable COORDINATOR;
    uint256 public immutable subscriptionId;
    bytes32 public immutable keyHash;

    uint32 public constant CALLBACK_GAS_LIMIT = 100_000;
    uint16 public constant REQUEST_CONFIRMATIONS = 3;
    uint32 public constant NUM_WORDS = 1;

    uint256 public lastRequestId;

    // -----------------------
    // modifier (requirement)
    // -----------------------
    modifier inState(State expected) {
        if (state != expected) revert Lottery__WrongState(uint256(expected), uint256(state));
        _;
    }

    constructor(
        uint256 _ticketPriceWei,
        uint256 _intervalSeconds,
        address _vrfCoordinator,
        uint256 _subscriptionId,
        bytes32 _keyHash
    ) VRFConsumerBaseV2Plus(_vrfCoordinator) {
        ticketPrice = _ticketPriceWei;
        interval = _intervalSeconds;

        // round does not start until the first ticket enters
        lastTimeStamp = 0;

        COORDINATOR = IVRFCoordinatorV2Plus(_vrfCoordinator);
        subscriptionId = _subscriptionId;
        keyHash = _keyHash;

        state = State.OPEN;
    }

    // -----------------------
    // public views
    // -----------------------
    function getPlayersCount() external view returns (uint256) {
        return players.length;
    }

    function getPot() external view returns (uint256) {
        return address(this).balance;
    }

    function calcWinnerIndex(uint256 randomWord, uint256 nPlayers) public pure returns (uint256) {
        if (nPlayers == 0) return 0;
        return LotteryMath.winnerIndex(randomWord, nPlayers);
    }

    // -----------------------
    // enter lottery
    // - first ticket starts the round timer
    // - tickets allowed only when open (frontend blocks after expiry)
    // -----------------------
    function buyTicket() external payable inState(State.OPEN) {
        if (msg.value != ticketPrice) revert Lottery__WrongETH();

        // start the timer only when the first player joins the current round
        if (players.length == 0) {
            lastTimeStamp = block.timestamp;
        }

        players.push(msg.sender);
        ticketsByAddress[msg.sender] += 1;

        emit TicketBought(msg.sender, 1, players.length, address(this).balance);
    }

    // -----------------------
    // chainlink automation
    // -----------------------
    function checkUpkeep(bytes calldata)
        external
        view
        override
        returns (bool upkeepNeeded, bytes memory)
    {
        bool isOpen = (state == State.OPEN);

        // if the round hasn't started (no first ticket yet), do not perform upkeep
        bool roundStarted = (lastTimeStamp != 0);

        bool timePassed = roundStarted && (block.timestamp - lastTimeStamp) >= interval;
        bool hasPlayers = players.length > 0;
        bool hasBalance = address(this).balance > 0;

        upkeepNeeded = isOpen && timePassed && hasPlayers && hasBalance;
    }

    // automation (or anyone) can call when checkUpkeep is true
    function performUpkeep(bytes calldata) external override inState(State.OPEN) {
        (bool upkeepNeeded, ) = this.checkUpkeep("");
        if (!upkeepNeeded) {
            revert Lottery__UpkeepNotNeeded(address(this).balance, players.length, uint256(state));
        }

        state = State.CALCULATING;

        VRFV2PlusClient.RandomWordsRequest memory req = VRFV2PlusClient.RandomWordsRequest({
            keyHash: keyHash,
            subId: subscriptionId,
            requestConfirmations: REQUEST_CONFIRMATIONS,
            callbackGasLimit: CALLBACK_GAS_LIMIT,
            numWords: NUM_WORDS,
            extraArgs: VRFV2PlusClient._argsToBytes(
                VRFV2PlusClient.ExtraArgsV1({ nativePayment: false })
            )
        });

        uint256 requestId = COORDINATOR.requestRandomWords(req);
        lastRequestId = requestId;

        emit RandomnessRequested(requestId);
    }

    // -----------------------
    // vrf callback
    // -----------------------
    function fulfillRandomWords(uint256, uint256[] calldata randomWords) internal override {
        uint256 randomWord = randomWords[0];

        uint256 idx = calcWinnerIndex(randomWord, players.length);
        address winner = players[idx];

        lastWinner = winner;
        lastPrize = address(this).balance;

        state = State.PAID;

        emit WinnerSelected(winner, lastPrize, randomWord);
    }

    // -----------------------
    // withdraw (winner only)
    // -----------------------
    function withdrawPrize() external inState(State.PAID) {
        if (msg.sender != lastWinner) revert Lottery__OnlyWinner();

        uint256 amount = lastPrize;
        if (amount == 0) revert Lottery__NothingToWithdraw();

        // effects first
        previousPrize = lastPrize; // save prize before it is cleared
        lastPrize = 0;
        delete players;

        // reset round: next round starts at first ticket
        lastTimeStamp = 0;
        state = State.OPEN;

        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert Lottery__TransferFailed();

        emit PrizeWithdrawn(msg.sender, amount);
    }

    receive() external payable {}
}
