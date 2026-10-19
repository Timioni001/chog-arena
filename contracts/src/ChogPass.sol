// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/// @title ChogPass
/// @notice Premium season pass sold in MON. A share of every sale (and every sponsor top-up) goes
/// into that season's MON prize pool, which pays out to the season board through a merkle root,
/// the same way ChogArenaSeasons pays $CHOG. The rest accrues to the treasury, withdrawn by pull.
contract ChogPass is Ownable2Step, Pausable, ReentrancyGuard {
    error UnknownSeason();
    error SeasonOver();
    error SeasonNotEnded();
    error BadWindow();
    error WrongPrice();
    error AlreadyOwned();
    error RootAlreadySet();
    error RootNotSet();
    error ClaimWindowClosed();
    error ClaimWindowOpen();
    error AlreadyClaimed();
    error InvalidProof();
    error OverCommitted();
    error ZeroAddress();
    error BadBps();
    error TransferFailed();
    error NothingToWithdraw();

    struct Season {
        uint128 price; // wei per pass
        uint64 end; // passes and sponsorship close here
        uint64 claimDeadline; // prizes claimable until here
        uint128 pool; // MON in the prize pool (pass share + sponsors + rollovers)
        uint128 claimed;
        bytes32 root;
        uint32 sold;
    }

    /// Share of each pass sale that goes to the prize pool, in basis points. Capped at 90%.
    uint16 public prizeBps;
    address public treasury;
    uint256 public treasuryOwed;

    mapping(uint256 => Season) public seasons;
    mapping(uint256 => mapping(address => bool)) public hasPass;
    mapping(uint256 => mapping(address => bool)) public hasClaimed;

    event SeasonSet(uint256 indexed seasonId, uint128 price, uint64 end, uint64 claimDeadline);
    event PassBought(uint256 indexed seasonId, address indexed buyer, address indexed holder, uint256 price, uint256 toPool);
    event Sponsored(uint256 indexed seasonId, address indexed from, uint256 amount, string note);
    event PrizeRootSet(uint256 indexed seasonId, bytes32 root, uint128 pool);
    event Claimed(uint256 indexed seasonId, address indexed account, uint256 amount);
    event RolledOver(uint256 indexed fromSeason, uint256 indexed toSeason, uint256 amount);
    event TreasuryWithdrawn(address indexed to, uint256 amount);
    event TreasurySet(address treasury);
    event PrizeBpsSet(uint16 bps);

    constructor(address owner_, address treasury_, uint16 prizeBps_) Ownable(owner_) {
        _setTreasury(treasury_);
        _setPrizeBps(prizeBps_);
    }

    // ---------------------------------------------------------------- admin

    /// @notice Create or update a season. The window can't change once its prize root is set.
    function setSeason(uint256 seasonId, uint128 price, uint64 end, uint64 claimDeadline) external onlyOwner {
        Season storage s = seasons[seasonId];
        if (s.root != bytes32(0)) revert RootAlreadySet();
        if (seasonId == 0 || (s.end == 0 && end <= block.timestamp) || claimDeadline <= end) revert BadWindow();
        s.price = price;
        s.end = end;
        s.claimDeadline = claimDeadline;
        emit SeasonSet(seasonId, price, end, claimDeadline);
    }

    /// @notice Commit the season's whole MON pool to a payout root once the season has ended.
    function setPrizeRoot(uint256 seasonId, bytes32 root) external onlyOwner {
        Season storage s = seasons[seasonId];
        if (s.end == 0) revert UnknownSeason();
        if (block.timestamp < s.end) revert SeasonNotEnded();
        if (s.root != bytes32(0)) revert RootAlreadySet();
        s.root = root;
        emit PrizeRootSet(seasonId, root, s.pool);
    }

    /// @notice After the claim window, move what nobody claimed into a later season's pool.
    function rollover(uint256 fromSeason, uint256 toSeason) external onlyOwner {
        Season storage f = seasons[fromSeason];
        Season storage t = seasons[toSeason];
        if (f.end == 0 || t.end == 0) revert UnknownSeason();
        if (block.timestamp <= f.claimDeadline) revert ClaimWindowOpen();
        if (t.root != bytes32(0)) revert RootAlreadySet();
        uint128 rest = f.pool - f.claimed;
        f.pool = f.claimed;
        t.pool += rest;
        emit RolledOver(fromSeason, toSeason, rest);
    }

    function setTreasury(address treasury_) external onlyOwner {
        _setTreasury(treasury_);
    }

    function setPrizeBps(uint16 bps) external onlyOwner {
        _setPrizeBps(bps);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ---------------------------------------------------------------- players

    /// @notice Buy the season pass for yourself.
    function buy(uint256 seasonId) external payable {
        _buy(seasonId, msg.sender);
    }

    /// @notice Gift the season pass to another wallet.
    function buyFor(uint256 seasonId, address holder) external payable {
        if (holder == address(0)) revert ZeroAddress();
        _buy(seasonId, holder);
    }

    /// @notice Anyone (a sponsor, the treasury, a fan) can add MON to a season's prize pool.
    function sponsor(uint256 seasonId, string calldata note) external payable whenNotPaused {
        Season storage s = seasons[seasonId];
        if (s.end == 0) revert UnknownSeason();
        if (s.root != bytes32(0)) revert RootAlreadySet();
        s.pool += uint128(msg.value);
        emit Sponsored(seasonId, msg.sender, msg.value, note);
    }

    function claim(uint256 seasonId, uint256 amount, bytes32[] calldata proof) external nonReentrant whenNotPaused {
        Season storage s = seasons[seasonId];
        if (s.root == bytes32(0)) revert RootNotSet();
        if (block.timestamp > s.claimDeadline) revert ClaimWindowClosed();
        if (hasClaimed[seasonId][msg.sender]) revert AlreadyClaimed();
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(msg.sender, amount))));
        if (!MerkleProof.verifyCalldata(proof, s.root, leaf)) revert InvalidProof();
        if (uint256(s.claimed) + amount > s.pool) revert OverCommitted();
        hasClaimed[seasonId][msg.sender] = true;
        s.claimed += uint128(amount);
        emit Claimed(seasonId, msg.sender, amount);
        _send(msg.sender, amount);
    }

    /// @notice Sends the treasury its accrued share. Callable by anyone; funds only go to `treasury`.
    function withdrawTreasury() external nonReentrant {
        uint256 amount = treasuryOwed;
        if (amount == 0) revert NothingToWithdraw();
        treasuryOwed = 0;
        emit TreasuryWithdrawn(treasury, amount);
        _send(treasury, amount);
    }

    // ---------------------------------------------------------------- views

    function poolOf(uint256 seasonId) external view returns (uint256) {
        return seasons[seasonId].pool;
    }

    // ---------------------------------------------------------------- internal

    function _buy(uint256 seasonId, address holder) internal nonReentrant whenNotPaused {
        Season storage s = seasons[seasonId];
        if (s.end == 0) revert UnknownSeason();
        if (block.timestamp >= s.end) revert SeasonOver();
        if (msg.value != s.price) revert WrongPrice();
        if (hasPass[seasonId][holder]) revert AlreadyOwned();
        hasPass[seasonId][holder] = true;
        s.sold += 1;
        uint256 toPool = (msg.value * prizeBps) / 10_000;
        s.pool += uint128(toPool);
        treasuryOwed += msg.value - toPool;
        emit PassBought(seasonId, msg.sender, holder, msg.value, toPool);
    }

    function _send(address to, uint256 amount) internal {
        (bool ok,) = payable(to).call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    function _setTreasury(address treasury_) internal {
        if (treasury_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        emit TreasurySet(treasury_);
    }

    function _setPrizeBps(uint16 bps) internal {
        if (bps > 9_000) revert BadBps();
        prizeBps = bps;
        emit PrizeBpsSet(bps);
    }
}
