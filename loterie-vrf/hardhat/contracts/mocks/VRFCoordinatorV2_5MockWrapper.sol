// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {VRFCoordinatorV2_5Mock} from
    "@chainlink/contracts/src/v0.8/vrf/mocks/VRFCoordinatorV2_5Mock.sol";

contract VRFCoordinatorV2_5MockWrapper is VRFCoordinatorV2_5Mock {
    constructor(
        uint96 baseFee,
        uint96 gasPriceLinkWei,
        int256 weiPerUnitLink
    )
        VRFCoordinatorV2_5Mock(
            baseFee,
            gasPriceLinkWei,
            weiPerUnitLink
        )
    {}
}
