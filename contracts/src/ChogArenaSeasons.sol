// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/// @title ChogArenaSeasons
/// @notice Season config, weekly ranking roots, server-attested match records bound to Chog token ids,
/// and merkle prize claims paid in $CHOG from the shop-funded prize vault (this contract).
/// @dev The owner can never withdraw $CHOG: unclaimed prizes can only roll over into a later season.
contract ChogArenaSeasons is Ownable2Step, Pausable, ReentrancyGuard, EIP712 {
    using SafeERC20 for IERC20;

    error BadWindow();
    error SeasonNotActive();
    error SeasonNotEnded();
    error ClaimWindowClosed();
    error ClaimWindowOpen();
    error RootAlreadySet();
    error Underfunded();
    error AlreadyClaimed();
    error InvalidProof();
    error ClaimTooLarge();
    error DailyCapExceeded();
    error BadSignature();
    error Expired();
    error MatchReplayed();
    error NotTokenOwner();
    error ZeroAddress();

    struct Season {
        uint64 start;
        uint64 end;
        uint64 claimDeadline;
        bytes32 prizeRoot;
        uint128 prizePool;
        uint128 claimed;
    }

    /// @notice A server-authoritative match result. The game server replays the match from its seed and
    /// move log, then signs this struct. Anyone (usually the player) can submit it.
    struct MatchResult {
        uint256 seasonId;
        uint256 tokenId;
        address player;
        bool won;
        uint32 score;
        bytes32 matchId;
        uint64 deadline;
    }

    bytes32 public constant MATCH_TYPEHASH = keccak256(
        "MatchResult(uint256 seasonId,uint256 tokenId,address player,bool won,uint32 score,bytes32 matchId,uint64 deadline)"
    );

    IERC20 public immutable chog;
    IERC721 public immutable chogNft;

    address public attestor;
    uint256 public seasonCount;
    /// @notice $CHOG committed to season prize pools and not yet claimed.
    uint256 public totalCommitted;
    /// @notice Launch safety caps.
    uint256 public maxClaimPerWallet;
    uint256 public dailyClaimCap;

    mapping(uint256 => Season) public seasons;
    mapping(uint256 => mapping(uint256 => bytes32)) public weeklyRoots;
    mapping(uint256 => mapping(address => bool)) public hasClaimed;
    mapping(uint256 => mapping(uint256 => uint32)) public wins;
    mapping(uint256 => mapping(uint256 => uint32)) public matches;
    mapping(uint256 => mapping(uint256 => uint64)) public points;
    mapping(bytes32 => bool) public usedMatch;
    mapping(uint256 => uint256) public claimedOnDay;

    event SeasonCreated(uint256 indexed seasonId, uint64 start, uint64 end, uint64 claimDeadline);
    event WeeklyRoot(uint256 indexed seasonId, uint256 indexed week, bytes32 root);
    event PrizeRootSet(uint256 indexed seasonId, bytes32 root, uint128 pool);
    event MatchRecorded(
        uint256 indexed seasonId,
        uint256 indexed tokenId,
        address indexed player,
        bool won,
        uint32 score,
        bytes32 matchId
    );
    event Claimed(uint256 indexed seasonId, address indexed account, uint256 amount);
    event RolledOver(uint256 indexed fromSeason, uint256 amount);
    event AttestorSet(address attestor);
    event CapsSet(uint256 maxClaimPerWallet, uint256 dailyClaimCap);

    constructor(
        address owner_,
        IERC20 chog_,
        IERC721 chogNft_,
        address attestor_,
        uint256 maxClaimPerWallet_,
        uint256 dailyClaimCap_
    ) Ownable(owner_) EIP712("ChogArena", "1") {
        chog = chog_;
        chogNft = chogNft_;
        _setAttestor(attestor_);
        maxClaimPerWallet = maxClaimPerWallet_;
        dailyClaimCap = dailyClaimCap_;
    }

    // ---------------------------------------------------------------- admin

    function createSeason(uint64 start, uint64 end, uint64 claimDeadline) external onlyOwner returns (uint256 id) {
        if (start >= end || end >= claimDeadline) revert BadWindow();
        id = ++seasonCount;
        seasons[id] = Season(start, end, claimDeadline, bytes32(0), 0, 0);
        emit SeasonCreated(id, start, end, claimDeadline);
    }

    function setWeeklyRoot(uint256 seasonId, uint256 week, bytes32 root) external onlyOwner {
        if (seasons[seasonId].end == 0) revert SeasonNotActive();
        weeklyRoots[seasonId][week] = root;
        emit WeeklyRoot(seasonId, week, root);
    }

    /// @notice Commit the end-of-season prize merkle root. The pool must already sit in this contract,
    /// uncommitted, so every root is fully backed.
    function setPrizeRoot(uint256 seasonId, bytes32 root, uint128 pool) external onlyOwner {
        Season storage s = seasons[seasonId];
        if (s.end == 0) revert SeasonNotActive();
        if (block.timestamp < s.end) revert SeasonNotEnded();
        if (s.prizeRoot != bytes32(0)) revert RootAlreadySet();
        if (chog.balanceOf(address(this)) < totalCommitted + pool) revert Underfunded();
        s.prizeRoot = root;
        s.prizePool = pool;
        totalCommitted += pool;
        emit PrizeRootSet(seasonId, root, pool);
    }

    /// @notice After the claim window, release the unclaimed remainder back to the uncommitted balance
    /// so it can back a future season. Funds never leave the contract this way.
    function rollover(uint256 seasonId) external onlyOwner {
        Season storage s = seasons[seasonId];
        if (block.timestamp <= s.claimDeadline) revert ClaimWindowOpen();
        uint256 rest = uint256(s.prizePool) - s.claimed;
        s.prizePool = s.claimed;
        totalCommitted -= rest;
        emit RolledOver(seasonId, rest);
    }

    function setAttestor(address attestor_) external onlyOwner {
        _setAttestor(attestor_);
    }

    function setCaps(uint256 maxClaimPerWallet_, uint256 dailyClaimCap_) external onlyOwner {
        maxClaimPerWallet = maxClaimPerWallet_;
        dailyClaimCap = dailyClaimCap_;
        emit CapsSet(maxClaimPerWallet_, dailyClaimCap_);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ---------------------------------------------------------------- matches

    function recordMatch(MatchResult calldata r, bytes calldata signature) external whenNotPaused {
        if (block.timestamp > r.deadline) revert Expired();
        Season storage s = seasons[r.seasonId];
        if (block.timestamp < s.start || block.timestamp >= s.end) revert SeasonNotActive();
        if (usedMatch[r.matchId]) revert MatchReplayed();
        if (chogNft.ownerOf(r.tokenId) != r.player) revert NotTokenOwner();

        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(MATCH_TYPEHASH, r.seasonId, r.tokenId, r.player, r.won, r.score, r.matchId, r.deadline)
            )
        );
        if (ECDSA.recover(digest, signature) != attestor) revert BadSignature();

        usedMatch[r.matchId] = true;
        matches[r.seasonId][r.tokenId] += 1;
        if (r.won) wins[r.seasonId][r.tokenId] += 1;
        points[r.seasonId][r.tokenId] += r.score;
        emit MatchRecorded(r.seasonId, r.tokenId, r.player, r.won, r.score, r.matchId);
    }

    function matchDigest(MatchResult calldata r) external view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(MATCH_TYPEHASH, r.seasonId, r.tokenId, r.player, r.won, r.score, r.matchId, r.deadline)
            )
        );
    }

    // ---------------------------------------------------------------- claims

    /// @notice Leaf = keccak256(bytes.concat(keccak256(abi.encode(account, amount)))) (OpenZeppelin standard tree).
    function claim(uint256 seasonId, uint256 amount, bytes32[] calldata proof) external nonReentrant whenNotPaused {
        Season storage s = seasons[seasonId];
        if (s.prizeRoot == bytes32(0)) revert SeasonNotEnded();
        if (block.timestamp > s.claimDeadline) revert ClaimWindowClosed();
        if (hasClaimed[seasonId][msg.sender]) revert AlreadyClaimed();
        if (maxClaimPerWallet != 0 && amount > maxClaimPerWallet) revert ClaimTooLarge();

        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(msg.sender, amount))));
        if (!MerkleProof.verifyCalldata(proof, s.prizeRoot, leaf)) revert InvalidProof();

        uint256 day = block.timestamp / 1 days;
        uint256 today = claimedOnDay[day] + amount;
        if (dailyClaimCap != 0 && today > dailyClaimCap) revert DailyCapExceeded();
        if (uint256(s.claimed) + amount > s.prizePool) revert Underfunded();

        claimedOnDay[day] = today;
        hasClaimed[seasonId][msg.sender] = true;
        // casting to 'uint128' is safe because amount <= prizePool - claimed, both uint128
        // forge-lint: disable-next-line(unsafe-typecast)
        s.claimed += uint128(amount);
        totalCommitted -= amount;
        chog.safeTransfer(msg.sender, amount);
        emit Claimed(seasonId, msg.sender, amount);
    }

    function _setAttestor(address attestor_) internal {
        if (attestor_ == address(0)) revert ZeroAddress();
        attestor = attestor_;
        emit AttestorSet(attestor_);
    }
}
