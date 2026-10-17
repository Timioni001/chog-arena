// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ChogArenaSeasons} from "../src/ChogArenaSeasons.sol";
import {MockChog, MockChogNft} from "./mocks/Mocks.sol";

contract ChogArenaSeasonsTest is Test {
    MockChog chog;
    MockChogNft nft;
    ChogArenaSeasons seasons;
    address owner = makeAddr("owner");
    uint256 attestorKey = 0xA77E57;
    address attestor;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    uint256 sid;

    function setUp() public {
        attestor = vm.addr(attestorKey);
        chog = new MockChog();
        nft = new MockChogNft();
        seasons = new ChogArenaSeasons(owner, chog, nft, attestor, 1_000 ether, 5_000 ether);
        nft.mint(alice, 42);
        nft.mint(bob, 7);
        vm.prank(owner);
        sid = seasons.createSeason(
            uint64(block.timestamp), uint64(block.timestamp + 30 days), uint64(block.timestamp + 60 days)
        );
    }

    function _result(uint256 tokenId, address player, bool won, bytes32 matchId)
        internal
        view
        returns (ChogArenaSeasons.MatchResult memory r)
    {
        r = ChogArenaSeasons.MatchResult(sid, tokenId, player, won, 120, matchId, uint64(block.timestamp + 1 hours));
    }

    function _sign(uint256 key, ChogArenaSeasons.MatchResult memory r) internal view returns (bytes memory) {
        (uint8 v, bytes32 rr, bytes32 s) = vm.sign(key, seasons.matchDigest(r));
        return abi.encodePacked(rr, s, v);
    }

    // ------------------------------------------------------------ matches

    function test_recordMatch() public {
        ChogArenaSeasons.MatchResult memory r = _result(42, alice, true, keccak256("m1"));
        seasons.recordMatch(r, _sign(attestorKey, r));
        assertEq(seasons.wins(sid, 42), 1);
        assertEq(seasons.matches(sid, 42), 1);
        assertEq(seasons.points(sid, 42), 120);
    }

    function test_replayRejected() public {
        ChogArenaSeasons.MatchResult memory r = _result(42, alice, true, keccak256("m1"));
        bytes memory sig = _sign(attestorKey, r);
        seasons.recordMatch(r, sig);
        vm.expectRevert(ChogArenaSeasons.MatchReplayed.selector);
        seasons.recordMatch(r, sig);
    }

    function test_wrongSignerRejected() public {
        ChogArenaSeasons.MatchResult memory r = _result(42, alice, true, keccak256("m1"));
        bytes memory sig_r = _sign(0xBAD, r);
        vm.expectRevert(ChogArenaSeasons.BadSignature.selector);
        seasons.recordMatch(r, sig_r);
    }

    function test_tamperedResultRejected() public {
        ChogArenaSeasons.MatchResult memory r = _result(42, alice, false, keccak256("m1"));
        bytes memory sig = _sign(attestorKey, r);
        r.won = true;
        vm.expectRevert(ChogArenaSeasons.BadSignature.selector);
        seasons.recordMatch(r, sig);
    }

    function test_progressFollowsToken() public {
        ChogArenaSeasons.MatchResult memory r = _result(42, alice, true, keccak256("m1"));
        seasons.recordMatch(r, _sign(attestorKey, r));
        vm.prank(alice);
        nft.transferFrom(alice, bob, 42);
        // alice can no longer record for 42; bob inherits its record
        ChogArenaSeasons.MatchResult memory r2 = _result(42, alice, true, keccak256("m2"));
        bytes memory sig_r2 = _sign(attestorKey, r2);
        vm.expectRevert(ChogArenaSeasons.NotTokenOwner.selector);
        seasons.recordMatch(r2, sig_r2);
        ChogArenaSeasons.MatchResult memory r3 = _result(42, bob, true, keccak256("m3"));
        seasons.recordMatch(r3, _sign(attestorKey, r3));
        assertEq(seasons.wins(sid, 42), 2);
    }

    function test_expiredRejected() public {
        ChogArenaSeasons.MatchResult memory r = _result(42, alice, true, keccak256("m1"));
        bytes memory sig = _sign(attestorKey, r);
        vm.warp(block.timestamp + 2 hours);
        vm.expectRevert(ChogArenaSeasons.Expired.selector);
        seasons.recordMatch(r, sig);
    }

    function test_outsideSeasonRejected() public {
        vm.warp(block.timestamp + 31 days);
        ChogArenaSeasons.MatchResult memory r = _result(42, alice, true, keccak256("m1"));
        bytes memory sig_r = _sign(attestorKey, r);
        vm.expectRevert(ChogArenaSeasons.SeasonNotActive.selector);
        seasons.recordMatch(r, sig_r);
    }

    // ------------------------------------------------------------ prizes

    function _leaf(address a, uint256 amt) internal pure returns (bytes32) {
        return keccak256(bytes.concat(keccak256(abi.encode(a, amt))));
    }

    function _pair(bytes32 a, bytes32 b) internal pure returns (bytes32) {
        return a < b ? keccak256(abi.encode(a, b)) : keccak256(abi.encode(b, a));
    }

    function _setupPrizes() internal returns (bytes32 la, bytes32 lb) {
        la = _leaf(alice, 600 ether);
        lb = _leaf(bob, 400 ether);
        chog.mint(address(seasons), 1_000 ether); // as if the shop's prize share had flowed in
        vm.warp(block.timestamp + 30 days);
        vm.prank(owner);
        seasons.setPrizeRoot(sid, _pair(la, lb), 1_000 ether);
    }

    function test_claim() public {
        (, bytes32 lb) = _setupPrizes();
        bytes32[] memory proof = new bytes32[](1);
        proof[0] = lb;
        vm.prank(alice);
        seasons.claim(sid, 600 ether, proof);
        assertEq(chog.balanceOf(alice), 600 ether);
        vm.prank(alice);
        vm.expectRevert(ChogArenaSeasons.AlreadyClaimed.selector);
        seasons.claim(sid, 600 ether, proof);
    }

    function test_claimWrongAmount() public {
        (, bytes32 lb) = _setupPrizes();
        bytes32[] memory proof = new bytes32[](1);
        proof[0] = lb;
        vm.prank(alice);
        vm.expectRevert(ChogArenaSeasons.InvalidProof.selector);
        seasons.claim(sid, 700 ether, proof);
    }

    function test_rootMustBeFunded() public {
        vm.warp(block.timestamp + 30 days);
        vm.prank(owner);
        vm.expectRevert(ChogArenaSeasons.Underfunded.selector);
        seasons.setPrizeRoot(sid, bytes32(uint256(1)), 1 ether);
    }

    function test_rootOnlyAfterEnd() public {
        chog.mint(address(seasons), 1 ether);
        vm.prank(owner);
        vm.expectRevert(ChogArenaSeasons.SeasonNotEnded.selector);
        seasons.setPrizeRoot(sid, bytes32(uint256(1)), 1 ether);
    }

    function test_rolloverReleasesCommitment() public {
        (bytes32 la,) = _setupPrizes();
        bytes32[] memory proof = new bytes32[](1);
        proof[0] = la;
        vm.prank(bob);
        seasons.claim(sid, 400 ether, proof);
        vm.warp(block.timestamp + 31 days);
        vm.prank(owner);
        seasons.rollover(sid);
        assertEq(seasons.totalCommitted(), 0);
        // the 600 stays in the contract, available for the next season
        assertEq(chog.balanceOf(address(seasons)), 600 ether);
    }

    function test_dailyCap() public {
        vm.prank(owner);
        seasons.setCaps(1_000 ether, 500 ether);
        (, bytes32 lb) = _setupPrizes();
        bytes32[] memory proof = new bytes32[](1);
        proof[0] = lb;
        vm.prank(alice);
        vm.expectRevert(ChogArenaSeasons.DailyCapExceeded.selector);
        seasons.claim(sid, 600 ether, proof);
    }

    function testFuzz_onlyAttestorSigs(uint256 key) public {
        key = bound(key, 1, 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364140);
        vm.assume(key != attestorKey);
        ChogArenaSeasons.MatchResult memory r = _result(42, alice, true, keccak256(abi.encode(key)));
        bytes memory sig_r = _sign(key, r);
        vm.expectRevert(ChogArenaSeasons.BadSignature.selector);
        seasons.recordMatch(r, sig_r);
    }
}
