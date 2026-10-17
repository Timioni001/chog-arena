// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ChogBots} from "./ChogBots.sol";

/// @title ChogShop
/// @notice Spend $CHOG on cosmetics, bots and upgrades. Every purchase is split between a burn,
/// the season prize vault and the treasury, so prize pools come from sinks, never emissions.
/// The shop never holds a balance: funds are forwarded in the same transaction.
contract ChogShop is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    error ItemInactive();
    error SoldOut();
    error WalletLimit();
    error DailyCapExceeded();
    error PriceTooHigh();
    error BadSplit();
    error ZeroAddress();
    error ZeroQuantity();

    struct Item {
        uint128 price; // $CHOG wei per unit
        uint32 supply; // 0 = unlimited
        uint32 sold;
        uint32 maxPerWallet; // 0 = unlimited
        bool active;
        uint256 botId; // ERC-1155 id minted on purchase, 0 = offchain-only item
    }

    address public constant BURN = 0x000000000000000000000000000000000000dEaD;
    uint16 public constant MAX_BPS = 10_000;

    IERC20 public immutable chog;
    ChogBots public immutable bots;

    address public treasury;
    address public prizeVault;
    uint16 public burnBps;
    uint16 public prizeBps;
    /// @notice Launch safety cap on how much one wallet can spend per UTC day.
    uint256 public dailyWalletCap;

    mapping(uint256 => Item) public items;
    mapping(uint256 => mapping(address => uint32)) public boughtBy;
    mapping(address => mapping(uint256 => uint256)) public spentOnDay;

    event ItemSet(
        uint256 indexed itemId, uint128 price, uint32 supply, uint32 maxPerWallet, bool active, uint256 botId
    );
    event Purchased(
        address indexed buyer, uint256 indexed itemId, uint32 quantity, uint256 total, uint256 burned, uint256 toPrize
    );
    event SplitSet(uint16 burnBps, uint16 prizeBps);
    event RecipientsSet(address treasury, address prizeVault);
    event DailyWalletCapSet(uint256 cap);

    constructor(
        address owner_,
        IERC20 chog_,
        ChogBots bots_,
        address treasury_,
        address prizeVault_,
        uint16 burnBps_,
        uint16 prizeBps_,
        uint256 dailyWalletCap_
    ) Ownable(owner_) {
        chog = chog_;
        bots = bots_;
        _setRecipients(treasury_, prizeVault_);
        _setSplit(burnBps_, prizeBps_);
        dailyWalletCap = dailyWalletCap_;
    }

    // ---------------------------------------------------------------- admin

    function setItem(uint256 itemId, uint128 price, uint32 supply, uint32 maxPerWallet, bool active, uint256 botId)
        external
        onlyOwner
    {
        Item storage it = items[itemId];
        it.price = price;
        it.supply = supply;
        it.maxPerWallet = maxPerWallet;
        it.active = active;
        it.botId = botId;
        emit ItemSet(itemId, price, supply, maxPerWallet, active, botId);
    }

    function setSplit(uint16 burnBps_, uint16 prizeBps_) external onlyOwner {
        _setSplit(burnBps_, prizeBps_);
    }

    function setRecipients(address treasury_, address prizeVault_) external onlyOwner {
        _setRecipients(treasury_, prizeVault_);
    }

    function setDailyWalletCap(uint256 cap) external onlyOwner {
        dailyWalletCap = cap;
        emit DailyWalletCapSet(cap);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ---------------------------------------------------------------- buy

    /// @param maxTotal slippage guard against a price change between quote and inclusion.
    function buy(uint256 itemId, uint32 quantity, uint256 maxTotal) external nonReentrant whenNotPaused {
        if (quantity == 0) revert ZeroQuantity();
        Item storage it = items[itemId];
        if (!it.active) revert ItemInactive();
        if (it.supply != 0 && uint256(it.sold) + quantity > it.supply) revert SoldOut();
        uint32 already = boughtBy[itemId][msg.sender];
        if (it.maxPerWallet != 0 && uint256(already) + quantity > it.maxPerWallet) revert WalletLimit();

        uint256 total = uint256(it.price) * quantity;
        if (total > maxTotal) revert PriceTooHigh();

        uint256 day = block.timestamp / 1 days;
        uint256 spent = spentOnDay[msg.sender][day] + total;
        if (dailyWalletCap != 0 && spent > dailyWalletCap) revert DailyCapExceeded();

        // effects
        spentOnDay[msg.sender][day] = spent;
        it.sold += quantity;
        boughtBy[itemId][msg.sender] = already + quantity;

        // interactions
        uint256 burned = (total * burnBps) / MAX_BPS;
        uint256 toPrize = (total * prizeBps) / MAX_BPS;
        uint256 toTreasury = total - burned - toPrize;
        if (burned != 0) chog.safeTransferFrom(msg.sender, BURN, burned);
        if (toPrize != 0) chog.safeTransferFrom(msg.sender, prizeVault, toPrize);
        if (toTreasury != 0) chog.safeTransferFrom(msg.sender, treasury, toTreasury);
        if (it.botId != 0) bots.mint(msg.sender, it.botId, quantity);

        emit Purchased(msg.sender, itemId, quantity, total, burned, toPrize);
    }

    function quote(uint256 itemId, uint32 quantity)
        external
        view
        returns (uint256 total, uint256 burned, uint256 toPrize, uint256 toTreasury)
    {
        total = uint256(items[itemId].price) * quantity;
        burned = (total * burnBps) / MAX_BPS;
        toPrize = (total * prizeBps) / MAX_BPS;
        toTreasury = total - burned - toPrize;
    }

    // ---------------------------------------------------------------- internal

    function _setSplit(uint16 burnBps_, uint16 prizeBps_) internal {
        if (uint256(burnBps_) + prizeBps_ > MAX_BPS) revert BadSplit();
        burnBps = burnBps_;
        prizeBps = prizeBps_;
        emit SplitSet(burnBps_, prizeBps_);
    }

    function _setRecipients(address treasury_, address prizeVault_) internal {
        if (treasury_ == address(0) || prizeVault_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        prizeVault = prizeVault_;
        emit RecipientsSet(treasury_, prizeVault_);
    }
}
