// SPDX-License-Identifier: MIT
//
// BYKO - Genesis deployment
// Initial supply: 790,227 BYKO, fixed forever
// Network: Base
//
// Genesis ERC-20 token on Base.
// Fixed supply. No further minting.
// No owner privileges. Immutable after deployment.

pragma solidity ^0.8.24;

import "@openzeppelin/contracts@5.4.0/token/ERC20/ERC20.sol";

contract BYKO is ERC20 {
    uint256 public constant MAX_SUPPLY = 790_227 * 10 ** 18;

    constructor() ERC20("BYKO", "BYKO") {
        _mint(msg.sender, MAX_SUPPLY);
    }
}
