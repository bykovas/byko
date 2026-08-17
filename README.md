# BYKO

Genesis ERC-20 token on Base. A coin that does nothing, reliably.

`|>` — the bar is the person, the point is the direction. Sub-brand of [bykovas.lt](https://bykovas.lt).

## Token

| | |
|---|---|
| Standard | ERC-20 |
| Network | Base |
| Chain ID | `8453` |
| Symbol | `BYKO` |
| Decimals | `18` |
| Total supply | `790,227 BYKO` — fixed forever |
| Contract | [`0x078bB16e24c8931fc007928c370422e5e38F4372`](https://basescan.org/address/0x078bB16e24c8931fc007928c370422e5e38F4372) |
| Token page | [basescan.org/token/0x078b…4372](https://basescan.org/token/0x078bB16e24c8931fc007928c370422e5e38F4372) |
| Deployed | 2 Aug 2026, by `omenas.base.eth` |
| Compiler | solidity v0.8.34 · OpenZeppelin 5.4.0 |
| Status | Verified (exact match) · running |

The contract mints once at genesis, then it can only do what ERC-20 does.
No mint function, no owner privileges, no proxy, no upgrade path. Immutable after deployment.

## Repository

```
contracts/   BYKO.sol — the whole contract, 21 lines
website/     byko site, static, self-contained
brand/       brand guide and source marks
assets/      logo, coin and social renders
docs/        specification and project documents
```

## Facts

- Supply / fixed
- Owner / none
- Tax / 0%
- Roadmap / none — the point is the direction
- 1 BYKO = 1 BYKO

## License

MIT — see [LICENSE](LICENSE). The token contract is immutable on-chain;
the license covers this repository.

## Disclaimer

BYKO is a token with no built-in functionality, no yield and no promises, and it
gives its holder no rights. It does not represent equity, debt or any claim on
anything. That one person accepts it in payment for his own work (specification
§7) is his decision alone: it grants holders nothing and obliges nobody else.
Nothing in this repository is financial advice. Verify the contract on BaseScan
before interacting.
