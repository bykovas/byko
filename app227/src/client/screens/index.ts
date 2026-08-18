import { check } from "./check";
import { claim } from "./claim";
import { go } from "./go";
import { how } from "./how";
import { noAdvance } from "./no-advance";
import { paid } from "./paid";
import { sealed } from "./sealed";
import { why } from "./why";
import type { ScreenName } from "../tape";

export const screens: Record<ScreenName, () => HTMLElement> = {
  why,
  how,
  claim,
  paid,
  go,
  check,
  sealed,
  "no-advance": noAdvance,
};
