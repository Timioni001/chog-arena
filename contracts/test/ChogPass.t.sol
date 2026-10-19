// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ChogPass} from "../src/ChogPass.sol";

contract ChogPassTest is Test {
    ChogPass pass;
    address owner = makeAddr("owner");
    address treasury = makeAddr("treasury");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    uint64 end;

    function setUp() public {
        pass = new ChogPass(owner, treasury, 5_000);
        end = uint64(block.timestamp + 30 days);
        vm.prank(owner);
        pass.setSeason(1, 5 ether, end, end + 30 days);
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.deal(carol, 100 ether);
    }

    function _pool(uint256 id) internal view returns (uint128 pool) {
        (,,, pool,,,) = pass.seasons(id);
    }

    function test_buySplitsBetweenPoolAndTreasury() public {
        vm.prank(alice);
        pass.buy{value: 5 ether}(1);
        assertTrue(pass.hasPass(1, alice));
        assertEq(_pool(1), 2.5 ether);
        assertEq(pass.treasuryOwed(), 2.5 ether);
        pass.withdrawTreasury();
        assertEq(treasury.balance, 2.5 ether);
        assertEq(pass.treasuryOwed(), 0);
    }

    function test_rejectsWrongPriceDoubleBuyAndLateBuy() public {
        vm.prank(alice);
        vm.expectRevert(ChogPass.WrongPrice.selector);
        pass.buy{value: 4 ether}(1);
        vm.prank(alice);
        pass.buy{value: 5 ether}(1);
        vm.prank(alice);
        vm.expectRevert(ChogPass.AlreadyOwned.selector);
        pass.buy{value: 5 ether}(1);
        vm.warp(end);
        vm.prank(bob);
        vm.expectRevert(ChogPass.SeasonOver.selector);
        pass.buy{value: 5 ether}(1);
    }

    function test_giftAndSponsorFillThePool() public {
        vm.prank(alice);
        pass.buyFor{value: 5 ether}(1, bob);
        assertTrue(pass.hasPass(1, bob));
        assertFalse(pass.hasPass(1, alice));
        vm.prank(carol);
        pass.sponsor{value: 10 ether}(1, "gm");
        assertEq(_pool(1), 12.5 ether);
    }

    function test_rootAndClaimPayMon() public {
        vm.prank(alice);
        pass.buy{value: 5 ether}(1);
        vm.prank(carol);
        pass.sponsor{value: 7.5 ether}(1, "");
        // two-leaf tree: alice 6, bob 4
        bytes32 la = keccak256(bytes.concat(keccak256(abi.encode(alice, uint256(6 ether)))));
        bytes32 lb = keccak256(bytes.concat(keccak256(abi.encode(bob, uint256(4 ether)))));
        bytes32 root = la < lb ? keccak256(abi.encodePacked(la, lb)) : keccak256(abi.encodePacked(lb, la));
        vm.prank(owner);
        vm.expectRevert(ChogPass.SeasonNotEnded.selector);
        pass.setPrizeRoot(1, root);
        vm.warp(end + 1);
        vm.prank(owner);
        pass.setPrizeRoot(1, root);

        bytes32[] memory pa = new bytes32[](1);
        pa[0] = lb;
        uint256 before = alice.balance;
        vm.prank(alice);
        pass.claim(1, 6 ether, pa);
        assertEq(alice.balance - before, 6 ether);
        vm.prank(alice);
        vm.expectRevert(ChogPass.AlreadyClaimed.selector);
        pass.claim(1, 6 ether, pa);
        vm.prank(bob);
        vm.expectRevert(ChogPass.InvalidProof.selector);
        pass.claim(1, 5 ether, pa);
        vm.prank(carol);
        vm.expectRevert(ChogPass.RootAlreadySet.selector);
        pass.sponsor{value: 1 ether}(1, "");
    }

    function test_rolloverMovesUnclaimedToNextSeason() public {
        vm.prank(carol);
        pass.sponsor{value: 10 ether}(1, "");
        vm.prank(owner);
        pass.setSeason(2, 5 ether, end + 60 days, end + 90 days);
        vm.warp(end + 1);
        vm.prank(owner);
        pass.setPrizeRoot(1, bytes32(uint256(1)));
        vm.prank(owner);
        vm.expectRevert(ChogPass.ClaimWindowOpen.selector);
        pass.rollover(1, 2);
        vm.warp(end + 31 days);
        vm.prank(owner);
        pass.rollover(1, 2);
        assertEq(_pool(1), 0);
        assertEq(_pool(2), 10 ether);
    }

    function test_onlyOwnerAndPause() public {
        vm.prank(alice);
        vm.expectRevert();
        pass.setSeason(3, 1 ether, end, end + 1 days);
        vm.prank(owner);
        vm.expectRevert(ChogPass.BadBps.selector);
        pass.setPrizeBps(9_500);
        vm.prank(owner);
        pass.pause();
        vm.prank(alice);
        vm.expectRevert();
        pass.buy{value: 5 ether}(1);
    }

    function testFuzz_splitConservesValue(uint96 price, uint16 bps) public {
        bps = uint16(bound(bps, 0, 9_000));
        price = uint96(bound(price, 1, 50 ether));
        vm.startPrank(owner);
        pass.setPrizeBps(bps);
        pass.setSeason(1, price, end, end + 30 days);
        vm.stopPrank();
        vm.prank(alice);
        pass.buy{value: price}(1);
        assertEq(uint256(_pool(1)) + pass.treasuryOwed(), price);
        assertEq(address(pass).balance, price);
    }
}
