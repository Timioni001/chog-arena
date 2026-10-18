// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ChogArenaSeasons} from "../src/ChogArenaSeasons.sol";
import {ChogShop} from "../src/ChogShop.sol";
import {ChogBots} from "../src/ChogBots.sol";

/// Deploys the three contracts with launch caps. The deployer is a temporary owner so it can wire the
/// shop as the bots minter; ownership is then handed to OWNER (the multisig), which must call
/// acceptOwnership() on each contract (Ownable2Step).
///
/// forge script script/Deploy.s.sol --rpc-url monad --broadcast --verify
contract Deploy is Script {
    function run() external {
        address owner = vm.envAddress("OWNER_MULTISIG");
        IERC20 chog = IERC20(vm.envAddress("CHOG_TOKEN_ADDRESS"));
        IERC721 chogNft = IERC721(vm.envAddress("CHOG_NFT_ADDRESS"));
        address attestor = vm.envAddress("ATTESTOR_ADDRESS");
        address treasury = vm.envAddress("TREASURY_ADDRESS");
        string memory botsUri = vm.envOr("BOTS_URI", string("https://chogarena.xyz/api/bots/{id}.json"));

        vm.startBroadcast();
        address deployer = msg.sender;

        // Launch caps: 5,000 CHOG per wallet claim, 100,000 CHOG claimed per day, 20,000 CHOG shop spend per wallet per day.
        ChogArenaSeasons seasons = new ChogArenaSeasons(deployer, chog, chogNft, attestor, 5_000 ether, 100_000 ether);
        ChogBots bots = new ChogBots(deployer, botsUri);
        // 30% burned, 40% to the season prize vault, 30% to treasury.
        ChogShop shop = new ChogShop(deployer, chog, bots, treasury, address(seasons), 3_000, 4_000, 20_000 ether);

        bots.setMinter(address(shop), true);

        seasons.transferOwnership(owner);
        bots.transferOwnership(owner);
        shop.transferOwnership(owner);
        vm.stopBroadcast();

        console2.log("ChogArenaSeasons", address(seasons));
        console2.log("ChogBots", address(bots));
        console2.log("ChogShop", address(shop));
    }
}
