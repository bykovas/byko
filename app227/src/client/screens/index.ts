import { start } from "./start";
import { auth } from "./auth";
import { profile } from "./profile";
import { checks } from "./checks";
import { check } from "./check";
import { result } from "./result";
import { metrics } from "./metrics";

/* Seven screens, addressed as #/name. Names are provisional — rename to the
   architecture's own vocabulary when the flows land. */
export const screens: Record<string, () => HTMLElement> = {
  start, auth, profile, checks, check, result, metrics,
};
