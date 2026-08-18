import {
  FIXTURE_CHAIN,
  FIXTURE_CHECK,
  FIXTURE_GAME,
  fetchClaimEnrichment,
  fetchHolderEnrichment,
  type ChainFigures,
  type CheckData,
  type GameFigures,
} from "./data";

export interface AppState {
  claimed: boolean;
  readonly noAdvance: boolean;
  chain: ChainFigures;
  game: GameFigures;
  check: CheckData;
  /* today's facts, served one at a time — second opens after the first */
  checks: CheckData[];
  checkIndex: number;
}

type StateListener = (kind: "chain" | "check") => void;

const listeners = new Set<StateListener>();
let enrichmentStarted = false;

const fixtureCheck = (): CheckData => ({
  ...FIXTURE_CHECK,
  sources: [{ ...FIXTURE_CHECK.sources[0] }, { ...FIXTURE_CHECK.sources[1] }],
});

const state: AppState = {
  claimed: false,
  noAdvance: new URLSearchParams(location.search).get("noadvance") === "1",
  chain: { ...FIXTURE_CHAIN },
  game: { ...FIXTURE_GAME },
  check: fixtureCheck(),
  checks: [fixtureCheck()],
  checkIndex: 0,
};

export function getState(): Readonly<AppState> {
  return state;
}

export function markClaimed(): void {
  state.claimed = true;
}

/* Advance to the second fact of the day. Returns false when there is none. */
export function advanceCheck(): boolean {
  if (state.checkIndex >= state.checks.length - 1) return false;
  state.checkIndex += 1;
  state.check = state.checks[state.checkIndex];
  return true;
}

export function subscribe(listener: StateListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(kind: "chain" | "check"): void {
  for (const listener of listeners) listener(kind);
}

export function startEnrichment(): void {
  if (enrichmentStarted) return;
  enrichmentStarted = true;

  void fetchHolderEnrichment().then((figures) => {
    if (!figures) return;
    state.chain.holders = figures.holders;
    state.chain.pool = figures.pool;
    notify("chain");
  });

  void fetchClaimEnrichment().then((checks) => {
    if (!checks || checks.length === 0) return;
    state.checks = checks;
    state.checkIndex = Math.min(state.checkIndex, checks.length - 1);
    state.check = checks[state.checkIndex];
    notify("check");
  });
}
