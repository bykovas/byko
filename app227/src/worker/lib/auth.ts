import { createClient, type Errors } from "@farcaster/quick-auth";
import type { Env } from "../../shared/types";

/* Quick Auth: the client sends a Farcaster-signed JWT as a Bearer token; we
   verify it against the domain the app is served from and recover the fid.
   The verifier is asymmetric — no shared secret, the fid cannot be forged. */

const client = createClient();

export interface Identity {
  fid: number;
}

/* Returns the fid, or null when the Authorization header is missing or the
   token fails verification. Never throws to the caller. */
export async function authenticate(request: Request): Promise<Identity | null> {
  const header = request.headers.get("Authorization");
  if (!header || !header.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  if (!token) return null;

  const domain = new URL(request.url).hostname;
  try {
    const payload = await client.verifyJwt({ token, domain });
    const fid = Number(payload.sub);
    return Number.isInteger(fid) && fid > 0 ? { fid } : null;
  } catch (err) {
    /* Errors.InvalidTokenError and network hiccups both mean "no identity". */
    void (err as Errors.InvalidTokenError);
    return null;
  }
}
