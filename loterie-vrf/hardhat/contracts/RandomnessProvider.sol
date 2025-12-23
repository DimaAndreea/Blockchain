// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * Minimal interface for the Lottery contract
 * so the provider can call back with randomness.
 */
interface ILottery {
    function fulfillRandom(uint256 randomWord) external;
}

/**
 * RandomnessProvider
 * ------------------
 * This contract simulates a VRF / Oracle.
 *
 * Architecture:
 * - Lottery requests randomness
 * - Provider emits an event (as if it asked an oracle)
 * - Provider later delivers a random number back to Lottery
 *
 * This demonstrates:
 * - inter-contract communication
 * - oracle / VRF pattern
 * - anti-manipulation (Lottery accepts randomness ONLY from provider)
 */
contract RandomnessProvider {
    address public owner;
    address public lottery;

    event RandomRequested(uint256 indexed requestId, address indexed lottery);
    event RandomDelivered(uint256 indexed requestId, uint256 randomWord);

    error NotOwner();
    error NotLottery();
    error LotteryNotSet();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyLottery() {
        if (msg.sender != lottery) revert NotLottery();
        _;
    }

    constructor(address _lottery) {
        owner = msg.sender;
        lottery = _lottery;
    }

    /**
     * Allows owner to change Lottery address (safety / upgrade).
     */
    function setLottery(address _lottery) external onlyOwner {
        lottery = _lottery;
    }

    /**
     * Called by Lottery when it wants randomness.
     * In a real VRF, this would contact Chainlink / oracle network.
     */
    function requestRandom(uint256 requestId) external onlyLottery {
        if (lottery == address(0)) revert LotteryNotSet();
        emit RandomRequested(requestId, msg.sender);
    }

    /**
     * Simulates the VRF callback.
     * Owner manually delivers randomness (for local demo).
     */
    function deliverRandom(uint256 requestId, uint256 randomWord)
        external
        onlyOwner
    {
        emit RandomDelivered(requestId, randomWord);
        ILottery(lottery).fulfillRandom(randomWord);
    }
}
