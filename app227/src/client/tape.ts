import { append, element } from "./dom";
import { getState } from "./state";

export type ScreenName = "why" | "how" | "claim" | "paid" | "go" | "check" | "sealed" | "no-advance";

type CellKey =
  | "tx"
  | "trades"
  | "pool"
  | "holders"
  | "supply"
  | "status"
  | "readers"
  | "working"
  | "paid"
  | "sent"
  | "next";

interface TapeCell {
  key: CellKey;
  text: string;
}

const HOT: Record<ScreenName, { chain: CellKey; game: CellKey }> = {
  why: { chain: "tx", game: "readers" },
  how: { chain: "trades", game: "working" },
  claim: { chain: "pool", game: "paid" },
  paid: { chain: "tx", game: "sent" },
  go: { chain: "holders", game: "next" },
  check: { chain: "supply", game: "status" },
  sealed: { chain: "pool", game: "status" },
  "no-advance": { chain: "supply", game: "next" },
};

/* Screens remount on every hash change. A shared epoch lets each new tape
   resume the CSS animation at the visit's current phase instead of at zero. */
const tapeStartedAt = performance.now();

function grouped(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

function padded(value: number): string {
  return String(value).padStart(3, "0");
}

function chainCells(): TapeCell[] {
  const { chain, claimed } = getState();
  return [
    { key: "tx", text: `TX ${chain.tx + (claimed ? 1 : 0)}` },
    { key: "trades", text: `TRADES ${chain.trades}` },
    { key: "pool", text: `POOL ${grouped(chain.pool)} BYKO` },
    { key: "holders", text: `HOLDERS ${grouped(chain.holders)}` },
    { key: "supply", text: `SUPPLY ${grouped(chain.supply)} FIXED` },
  ];
}

function gameCells(screen: ScreenName): TapeCell[] {
  const { game, claimed } = getState();
  const cells: TapeCell[] = [];
  if (screen === "check") cells.push({ key: "status", text: `CHECK ${padded(game.checkNumber)} OPEN` });
  if (screen === "sealed") cells.push({ key: "status", text: `CHECK ${padded(game.checkNumber)} SEALED` });

  cells.push(
    { key: "readers", text: `READERS ${padded(screen === "sealed" ? game.readers + 1 : game.readers)}` },
    { key: "working", text: `WORKING ${padded(game.working + (claimed ? 1 : 0))}` },
    { key: "paid", text: `PAID ${padded(game.paid + (claimed ? 1 : 0))}` },
    { key: "sent", text: `SENT ${grouped(game.sent + (claimed ? 227 : 0))} BYKO` },
  );
  /* byko.html's 05/06 rows swap the countdown for the leading CHECK cell. */
  if (screen !== "check" && screen !== "sealed")
    cells.push({ key: "next", text: `NEXT CHECK ${game.nextCheck}` });
  return cells;
}

function tapeRow(
  label: string,
  cells: TapeCell[],
  hot: CellKey,
  elapsedSeconds: number,
  slow = false,
): HTMLElement {
  const row = element("div", "trow");
  const labelCell = element("span", "tlab", label);
  const windowCell = element("div", "twin");
  const run = element("div", slow ? "tin slow" : "tin");
  run.style.animationDelay = `${-elapsedSeconds}s`;

  for (let copy = 0; copy < 2; copy += 1) {
    for (const cell of cells) {
      const span = element("span");
      if (copy === 1) span.setAttribute("aria-hidden", "true");
      if (copy === 0 && cell.key === hot) append(span, element("b", undefined, cell.text));
      else span.textContent = cell.text;
      run.append(span);
    }
  }

  windowCell.append(run);
  append(row, labelCell, windowCell);
  return row;
}

export function buildTape(screen: ScreenName): HTMLElement {
  const tape = element("div", "tape");
  const hot = HOT[screen];
  const elapsedSeconds = (performance.now() - tapeStartedAt) / 1_000;
  append(
    tape,
    tapeRow("CHAIN", chainCells(), hot.chain, elapsedSeconds),
    tapeRow("GAME", gameCells(screen), hot.game, elapsedSeconds, true),
  );
  return tape;
}
