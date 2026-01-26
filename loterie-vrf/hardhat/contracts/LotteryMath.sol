// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library LotteryMath {
    error NoPlayers();

    function winnerIndex(uint256 randomWord, uint256 playersCount)
        internal
        pure
        returns (uint256)
    {
        if (playersCount == 0) revert NoPlayers();
        return randomWord % playersCount;
    }
}
