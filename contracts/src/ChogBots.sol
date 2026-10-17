// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title ChogBots
/// @notice Optional onchain companions and cosmetics for Chog Arena (ERC-1155).
/// Ids flagged soulbound can be minted and burned but never transferred between wallets.
contract ChogBots is ERC1155, Ownable2Step, Pausable {
    error NotMinter();
    error Soulbound(uint256 id);

    mapping(address => bool) public isMinter;
    mapping(uint256 => bool) public soulbound;

    event MinterSet(address indexed minter, bool allowed);
    event SoulboundSet(uint256 indexed id, bool locked);

    constructor(address owner_, string memory uri_) ERC1155(uri_) Ownable(owner_) {}

    modifier onlyMinter() {
        if (!isMinter[msg.sender]) revert NotMinter();
        _;
    }

    function setMinter(address minter, bool allowed) external onlyOwner {
        isMinter[minter] = allowed;
        emit MinterSet(minter, allowed);
    }

    function setSoulbound(uint256 id, bool locked) external onlyOwner {
        soulbound[id] = locked;
        emit SoulboundSet(id, locked);
    }

    function setURI(string calldata uri_) external onlyOwner {
        _setURI(uri_);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function mint(address to, uint256 id, uint256 amount) external onlyMinter whenNotPaused {
        _mint(to, id, amount, "");
    }

    /// @notice Holders can burn their own bots (used for offchain merge upgrades).
    function burn(uint256 id, uint256 amount) external {
        _burn(msg.sender, id, amount);
    }

    function _update(address from, address to, uint256[] memory ids, uint256[] memory values)
        internal
        override
        whenNotPaused
    {
        if (from != address(0) && to != address(0)) {
            for (uint256 i; i < ids.length; ++i) {
                if (soulbound[ids[i]]) revert Soulbound(ids[i]);
            }
        }
        super._update(from, to, ids, values);
    }
}
