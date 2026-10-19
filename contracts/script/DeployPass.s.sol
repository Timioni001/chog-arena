// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {ChogPass} from "../src/ChogPass.sol";

/// Deploys the premium season pass on its own, so the contracts already live don't change.
/// The deployer opens season PASS_SEASON_ID, then hands ownership to OWNER_MULTISIG, which must
/// call acceptOwnership() (Ownable2Step).
///
/// PASS_PRICE_WEI=5000000000000000000 PASS_END=<unix> PASS_CLAIM_DEADLINE=<unix> \
/// forge script script/DeployPass.s.sol --rpc-url monad --broadcast --verify
contract DeployPass is Script {
    function run() external {
        address owner = vm.envAddress("OWNER_MULTISIG");
        address treasury = vm.envAddress("TREASURY_ADDRESS");
        uint256 seasonId = vm.envOr("PASS_SEASON_ID", uint256(1));
        uint128 price = uint128(vm.envUint("PASS_PRICE_WEI"));
        uint64 end = uint64(vm.envUint("PASS_END"));
        uint64 claimDeadline = uint64(vm.envUint("PASS_CLAIM_DEADLINE"));
        uint16 prizeBps = uint16(vm.envOr("PASS_PRIZE_BPS", uint256(5_000)));

        vm.startBroadcast();
        ChogPass pass = new ChogPass(msg.sender, treasury, prizeBps);
        pass.setSeason(seasonId, price, end, claimDeadline);
        pass.transferOwnership(owner);
        vm.stopBroadcast();

        console2.log("ChogPass", address(pass));
    }
}
