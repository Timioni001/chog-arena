// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ChogShop} from "../src/ChogShop.sol";
import {ChogBots} from "../src/ChogBots.sol";
import {MockChog} from "./mocks/Mocks.sol";

contract ChogShopTest is Test {
    MockChog chog;
    ChogBots bots;
    ChogShop shop;
    address owner = makeAddr("owner");
    address treasury = makeAddr("treasury");
    address vault = makeAddr("vault");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        chog = new MockChog();
        bots = new ChogBots(owner, "ipfs://bots/{id}.json");
        shop = new ChogShop(owner, chog, bots, treasury, vault, 2_000, 3_000, 10_000 ether);
        vm.startPrank(owner);
        bots.setMinter(address(shop), true);
        shop.setItem(1, 100 ether, 0, 0, true, 0); // offchain cosmetic
        shop.setItem(2, 250 ether, 10, 2, true, 7); // limited onchain bot id 7
        vm.stopPrank();
        chog.mint(alice, 1_000_000 ether);
        vm.prank(alice);
        chog.approve(address(shop), type(uint256).max);
    }

    function test_buySplitsFunds() public {
        vm.prank(alice);
        shop.buy(1, 3, 300 ether);
        assertEq(chog.balanceOf(shop.BURN()), 60 ether);
        assertEq(chog.balanceOf(vault), 90 ether);
        assertEq(chog.balanceOf(treasury), 150 ether);
        assertEq(chog.balanceOf(address(shop)), 0);
    }

    function test_buyMintsBot() public {
        vm.prank(alice);
        shop.buy(2, 2, 500 ether);
        assertEq(bots.balanceOf(alice, 7), 2);
    }

    function test_walletLimit() public {
        vm.startPrank(alice);
        shop.buy(2, 2, 500 ether);
        vm.expectRevert(ChogShop.WalletLimit.selector);
        shop.buy(2, 1, 250 ether);
    }

    function test_supplyLimit() public {
        vm.prank(owner);
        shop.setItem(3, 1 ether, 2, 0, true, 0);
        vm.startPrank(alice);
        shop.buy(3, 2, 2 ether);
        vm.expectRevert(ChogShop.SoldOut.selector);
        shop.buy(3, 1, 1 ether);
    }

    function test_slippageGuard() public {
        vm.prank(alice);
        vm.expectRevert(ChogShop.PriceTooHigh.selector);
        shop.buy(1, 1, 99 ether);
    }

    function test_dailyCapResetsNextDay() public {
        vm.startPrank(alice);
        shop.buy(1, 100, type(uint256).max); // 10_000 ether, exactly the cap
        vm.expectRevert(ChogShop.DailyCapExceeded.selector);
        shop.buy(1, 1, type(uint256).max);
        vm.warp(block.timestamp + 1 days);
        shop.buy(1, 1, type(uint256).max);
    }

    function test_inactiveItem() public {
        vm.prank(alice);
        vm.expectRevert(ChogShop.ItemInactive.selector);
        shop.buy(99, 1, type(uint256).max);
    }

    function test_pause() public {
        vm.prank(owner);
        shop.pause();
        vm.prank(alice);
        vm.expectRevert();
        shop.buy(1, 1, 100 ether);
    }

    function test_onlyOwnerAdmin() public {
        vm.prank(bob);
        vm.expectRevert();
        shop.setSplit(0, 0);
        vm.prank(owner);
        vm.expectRevert(ChogShop.BadSplit.selector);
        shop.setSplit(6_000, 5_000);
    }

    function testFuzz_splitConservesValue(uint16 burnBps, uint16 prizeBps, uint128 price, uint32 qty) public {
        burnBps = uint16(bound(burnBps, 0, 10_000));
        prizeBps = uint16(bound(prizeBps, 0, 10_000 - burnBps));
        price = uint128(bound(price, 1, 1_000 ether));
        qty = uint32(bound(qty, 1, 50));
        vm.startPrank(owner);
        shop.setSplit(burnBps, prizeBps);
        shop.setItem(9, price, 0, 0, true, 0);
        shop.setDailyWalletCap(0);
        vm.stopPrank();

        uint256 before = chog.balanceOf(alice);
        vm.prank(alice);
        shop.buy(9, qty, type(uint256).max);
        uint256 total = uint256(price) * qty;
        assertEq(before - chog.balanceOf(alice), total);
        assertEq(chog.balanceOf(shop.BURN()) + chog.balanceOf(vault) + chog.balanceOf(treasury), total);
        assertEq(chog.balanceOf(address(shop)), 0);
    }
}

contract ChogBotsTest is Test {
    ChogBots bots;
    address owner = makeAddr("owner");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        bots = new ChogBots(owner, "ipfs://bots/{id}.json");
        vm.startPrank(owner);
        bots.setMinter(owner, true);
        bots.setSoulbound(5, true);
        bots.mint(alice, 5, 1);
        bots.mint(alice, 6, 1);
        vm.stopPrank();
    }

    function test_soulboundBlocksTransfer() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ChogBots.Soulbound.selector, 5));
        bots.safeTransferFrom(alice, bob, 5, 1, "");
    }

    function test_regularTransfers() public {
        vm.prank(alice);
        bots.safeTransferFrom(alice, bob, 6, 1, "");
        assertEq(bots.balanceOf(bob, 6), 1);
    }

    function test_soulboundCanBurn() public {
        vm.prank(alice);
        bots.burn(5, 1);
        assertEq(bots.balanceOf(alice, 5), 0);
    }

    function test_onlyMinterMints() public {
        vm.prank(alice);
        vm.expectRevert(ChogBots.NotMinter.selector);
        bots.mint(alice, 1, 1);
    }
}
