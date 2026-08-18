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
}

type StateListener = (kind: "chain" | "check") => void;

const listeners = new Set<StateListener>();
let enrichmentStarted = false;

const state: AppState = {
  claimed: false,
  noAdvance: new URLSearchParams(location.search).get("noadvance") === "1",
  chain: { ...FIXTURE_CHAIN },
  game: { ...FIXTURE_GAME },
  check: {
    ...FIXTURE_CHECK,
    sources: [{ ...FIXTURE_CHECK.sources[0] }, { ...FIXTURE_CHECK.sources[1] }],
  },
};

export function getState(): Readonly<AppState> {
  return state;
}

export function markClaimed(): void {
  state.claimed = true;
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

  void fetchClaimEnrichment().then((check) => {
    if (!check) return;
    state.check = check;
    notify("check");
  });
}
