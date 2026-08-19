import {
  createPublicClient, createWalletClient, encodeFunctionData, fallback, getAddress,
  http, type Address, type Chain, type Hex, type PublicClient,
} from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import type { Env } from "../types";

/* Chain plumbing for the market worker. Same node discipline as app227 and the
 * airdrop scripts: the keyed DRPC node leads, public nodes catch the overflow.
 * The pools are Aerodrome volatile (vAMM) pairs; in both, token0 is the
 * project token and token1 is USDC (verified on chain 19 Aug 2026). */

const FALLBACK_RPCS = [
  "https://base-rpc.publicnode.com",
  "https://base.drpc.org",
  "https://1rpc.io/base",
];

export function transportFor(env: Env) {
  const urls = [env.DRPC_URL, env.RPC_URL, ...FALLBACK_RPCS]
    .filter((u): u is string => Boolean(u))
    .filter((u, i, all) => all.indexOf(u) === i);
  return fallback(urls.map((url) => http(url, { retryCount: 2, timeout: 8_000 })), { rank: false });
}

export function chainFor(env: Env): Chain {
  return {
    id: Number(env.CHAIN_ID),
    name: "base",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [env.RPC_URL] } },
  };
}

export function reader(env: Env): PublicClient {
  return createPublicClient({ chain: chainFor(env), transport: transportFor(env) });
}

export function account(key: string): PrivateKeyAccount {
  return privateKeyToAccount(key as Hex);
}
export function wallet(env: Env, acct: PrivateKeyAccount) {
  return createWalletClient({ account: acct, chain: chainFor(env), transport: transportFor(env) });
}

export const ERC20_ABI = [
  { type: "function", name: "balanceOf", stateMutability: "view",
    inputs: [{ name: "o", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "allowance", stateMutability: "view",
    inputs: [{ name: "o", type: "address" }, { name: "s", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable",
    inputs: [{ name: "s", type: "address" }, { name: "v", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "totalSupply", stateMutability: "view",
    inputs: [], outputs: [{ type: "uint256" }] },
] as const;

export const POOL_ABI = [
  { type: "function", name: "getReserves", stateMutability: "view",
    inputs: [], outputs: [{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }] },
] as const;

/* Aerodrome Router. Route = (from, to, stable, factory). */
export const ROUTER_ABI = [
  { type: "function", name: "getAmountsOut", stateMutability: "view",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "routes", type: "tuple[]", components: [
        { name: "from", type: "address" }, { name: "to", type: "address" },
        { name: "stable", type: "bool" }, { name: "factory", type: "address" }] },
    ],
    outputs: [{ type: "uint256[]" }] },
  { type: "function", name: "swapExactTokensForTokens", stateMutability: "nonpayable",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      { name: "routes", type: "tuple[]", components: [
        { name: "from", type: "address" }, { name: "to", type: "address" },
        { name: "stable", type: "bool" }, { name: "factory", type: "address" }] },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ type: "uint256[]" }] },
] as const;

/* topic0 of the Aerodrome Pool `Swap` event, used to settle a trade from its
   own receipt: Swap(sender, to, amount0In, amount1In, amount0Out, amount1Out) */
export const SWAP_TOPIC =
  "0xb3e2773606abfd36b5bd91394b3a54d1398336c65005baf7bf7a05efeffaf75b";

export interface Route { from: Address; to: Address; stable: boolean; factory: Address }

export function route(from: string, to: string, stable: boolean, factory: string): Route {
  return {
    from: getAddress(from.toLowerCase()),
    to: getAddress(to.toLowerCase()),
    stable,
    factory: getAddress(factory.toLowerCase()),
  };
}

export function swapData(amountIn: bigint, minOut: bigint, r: Route, to: Address, deadline: bigint): Hex {
  return encodeFunctionData({
    abi: ROUTER_ABI, functionName: "swapExactTokensForTokens",
    args: [amountIn, minOut, [r], to, deadline],
  });
}

export function approveData(spender: Address, value: bigint): Hex {
  return encodeFunctionData({ abi: ERC20_ABI, functionName: "approve", args: [spender, value] });
}

export interface Reserves { token: bigint; usdc: bigint }

export async function readReserves(rd: PublicClient, pool: string): Promise<Reserves> {
  const [r0, r1] = await rd.readContract({
    address: getAddress(pool.toLowerCase()), abi: POOL_ABI, functionName: "getReserves",
  }) as readonly [bigint, bigint, bigint];
  return { token: r0, usdc: r1 };
}

/* price of one whole token in USD, from reserves (token 18 dp, USDC 6 dp) */
export function priceFrom(res: Reserves): number {
  if (res.token === 0n) return 0;
  return (Number(res.usdc) / 1e6) / (Number(res.token) / 1e18);
}

export function fdvFrom(price: number, tokenTotalSupply: bigint): number {
  return price * (Number(tokenTotalSupply) / 1e18);
}

/* decode amount0Out/amount1Out (and In) from a Swap log's data (4 x uint256) */
export function decodeSwap(data: Hex): { a0In: bigint; a1In: bigint; a0Out: bigint; a1Out: bigint } {
  const hex = data.slice(2);
  const word = (i: number) => BigInt("0x" + hex.slice(i * 64, (i + 1) * 64));
  return { a0In: word(0), a1In: word(1), a0Out: word(2), a1Out: word(3) };
}
