import type { Env } from "../../shared/types";

/* Farcaster reads via Neynar: fid → username and primary verified address.
   The username feeds the leaderboard handle; the address is the money target
   (frozen at claim time in phase 4). Degrades to nulls when the key is unset
   or the call fails — the app must still work before the secret is added. */

export interface FarcasterProfile {
  username: string | null;
  address: string | null;
  address_source: "primary" | "first_verified" | "none";
}

const EMPTY: FarcasterProfile = { username: null, address: null, address_source: "none" };

export async function fetchProfile(env: Env, fid: number): Promise<FarcasterProfile> {
  if (!env.NEYNAR_API_KEY) return EMPTY;
  try {
    const url = `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`;
    const response = await fetch(url, {
      headers: { "x-api-key": env.NEYNAR_API_KEY, accept: "application/json" },
    });
    if (!response.ok) return EMPTY;
    const data = (await response.json()) as {
      users?: Array<{
        username?: string;
        verified_addresses?: { primary?: { eth_address?: string }; eth_addresses?: string[] };
      }>;
    };
    const user = data.users?.[0];
    if (!user) return EMPTY;

    const primary = user.verified_addresses?.primary?.eth_address ?? null;
    const first = user.verified_addresses?.eth_addresses?.[0] ?? null;
    const address = primary ?? first;
    return {
      username: user.username ?? null,
      address,
      address_source: primary ? "primary" : first ? "first_verified" : "none",
    };
  } catch {
    return EMPTY;
  }
}

/* The public handle for a fid. A username renders as @name; without one, the
   Farcaster convention is !fid — never a bare number that reads like a count. */
export function handle(username: string | null, fid: number): string {
  return username ? `@${username}` : `!${fid}`;
}
