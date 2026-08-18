import { buildAnchor, buildFollow, buildFooter, navigate } from "../chrome";
import { append, element } from "../dom";
import { advanceCheck, dayClosed, getState } from "../state";
import { buildShell } from "./shared";

/* Screen 06 — the day, reported back. Two states:
   06a: first fact answered, the second is open  → today band + seal + CTA
   06b: day closed (every fact answered)         → figures, all-time, ranks
   Every figure is a RECORD number: ink, mono, never blue. */

function pad3(n: number): string {
  return String(n).padStart(3, "0");
}

function dayLabel(): string {
  const now = new Date();
  return `${now.getDate()} ${now.toLocaleString("en", { month: "short" }).toLowerCase()}`;
}

function answeredCount(): number {
  const { me, answeredLocal, checks } = getState();
  return Math.min(me ? me.answeredToday : answeredLocal, checks.length);
}

function buildTodayBand(withBreakdown: boolean): HTMLElement {
  const { record, checks } = getState();
  const facts = record?.today.facts ?? checks.length;
  const answers = record?.today.answers ?? 0;
  const readers = record?.today.readers ?? 0;

  const band = element("div", "today");
  const caption = element("div", "cap2");
  const stateLabel = dayClosed()
    ? (facts > 1 ? "both answered" : "answered")
    : `${answeredCount()} of ${facts} answered`;
  append(caption, element("span", undefined, `today · ${dayLabel()}`), element("span", undefined, stateLabel));
  band.append(caption);

  const figs = element("div", "figs");
  for (const [k, v] of [["facts", facts], ["answers", answers], ["readers", readers]] as const) {
    const fig = element("div", "fig");
    append(fig, element("div", "k", k), element("div", "v", String(v)));
    figs.append(fig);
  }
  band.append(figs);

  if (withBreakdown) {
    const b = record?.today.breakdown ?? { yes: 0, no: 0, cant: 0 };
    const bd = element("div", "bd");
    for (const [label, value] of [["yes", b.yes], ["no", b.no], ["can't verify", b.cant]] as const) {
      const cell = element("span");
      cell.append(document.createTextNode(`${label} `), element("b", undefined, String(value)));
      bd.append(cell);
    }
    band.append(bd);
  }
  return band;
}

function readerSlot(index: number, handle: string | null): HTMLElement {
  const slot = element("div", "slotbox");
  append(slot, element("div", "k", `READER ${index}`), element("div", "w", handle ?? "—"));
  return slot;
}

/* 06a — first fact answered, second open. */
function sealedFirst(): HTMLElement {
  const { check: claim, checks, checkIndex, record } = getState();
  const stat = record?.facts.find((f) => f.claim_id === claim.id);
  const second = checks[checkIndex + 1] ?? checks[checkIndex];

  const mid = element("div", "mid top");
  mid.style.paddingTop = "0";
  mid.append(buildTodayBand(false));

  const lab = element("div", "lab", `claim · diary ${claim.entry}`);
  lab.style.marginTop = "18px";
  const text = element("div", "claim", claim.text);
  text.style.fontSize = "20px";
  mid.append(lab, text);

  const readers = element("div", "seal");
  const yesReaders = stat?.readers ?? [];
  for (let i = 0; i < 3; i++) readers.append(readerSlot(i + 1, yesReaders[i] ?? null));
  mid.append(readers);

  if (stat?.sealed) {
    const say = element("p", "say", "Three readers said yes. The claim is now printed with your handle under it on the site.");
    say.style.fontSize = "16.5px";
    say.style.marginTop = "18px";
    mid.append(say);

    const line = element("div", "src last");
    line.style.marginTop = "16px";
    line.style.borderTop = "1px solid var(--ink-hair)";
    const description = element("div");
    append(
      description,
      element("div", "n", "your line"),
      element("div", "t", `byko.bykovas.lt/d/${claim.entry}`),
      element("div", "d", `verified by ${yesReaders.join(" · ")}`),
    );
    const open = element("a", "o", "OPEN →");
    open.href = `https://byko.bykovas.lt/d/${claim.entry}`;
    open.target = "_blank";
    open.rel = "noopener noreferrer";
    open.setAttribute("aria-label", `OPEN → · byko.bykovas.lt/d/${claim.entry}`);
    append(line, description, open);
    mid.append(line);
  }

  const tiny = element(
    "p",
    "tiny",
    `The second fact of today is open. Check #${pad3(second.number)} · diary ${second.entry}.`,
  );
  tiny.style.color = "var(--ink-dim)";
  tiny.style.marginTop = "14px";
  mid.append(tiny);

  return buildShell(
    "sealed",
    "doc",
    buildAnchor(`check #${pad3(claim.number)} · closed`),
    mid,
    buildFooter({
      label: "Next claim",
      onClick() {
        advanceCheck();
        navigate("check");
      },
    }),
  );
}

/* 06b — day closed: figures, all-time, ranks. No CTA. */
function sealedDay(): HTMLElement {
  const { record, me } = getState();

  const mid = element("div", "mid top");
  mid.style.paddingTop = "0";
  mid.append(buildTodayBand(true));

  const thanks = element("div", "claim", "Thank you. That is the day.");
  thanks.style.fontSize = "30px";
  thanks.style.marginTop = "14px";
  const say = element("p", "say", "Two facts open tomorrow morning. Nothing is asked of you until then.");
  say.style.fontSize = "16px";
  say.style.marginTop = "10px";
  mid.append(thanks, say);

  const alltime = element("div", "alltime");
  alltime.style.marginTop = "14px";
  append(
    alltime,
    element("span", "k", "answers · all time"),
    element("span", "v", String(record?.allTime.answers ?? 0)),
  );
  mid.append(alltime);

  const head = element("div", "lbhead");
  head.style.marginTop = "14px";
  append(head, element("span", undefined, "readers by answers"), element("span", undefined, "all time"));
  mid.append(head);

  const board = record?.leaderboard ?? [];
  const shown = Math.max(board.length, 0);
  for (const row of board) {
    const line = element("div", "lbrow");
    append(
      line,
      element("span", "r", pad3(row.rank).slice(1)),
      element("span", "h", row.handle),
      element("span", "n", String(row.answers)),
    );
    mid.append(line);
  }
  /* an empty rank is information, not a gap to fill */
  const empty = element("div", "lbrow empty");
  append(
    empty,
    element("span", "r", pad3(shown + 1).slice(1)),
    element("span", "h", "—"),
    element("span", "n", "—"),
  );
  mid.append(empty);

  if (me && me.answersAllTime > 0 && me.rank !== null && !board.some((row) => row.fid === me.fid)) {
    const mine = element("div", "lbrow you");
    append(
      mine,
      element("span", "r", pad3(me.rank).slice(1)),
      element("span", "h", me.handle),
      element("span", "youtag", "YOU"),
      element("span", "n", String(me.answersAllTime)),
    );
    mid.append(mine);
  }

  const tiny = element("p", "tiny", "Ranks count answers, not verdicts.");
  tiny.style.color = "var(--ink-dim)";
  tiny.style.marginTop = "6px";
  tiny.style.fontSize = "11px";
  mid.append(tiny);

  const foot = element("footer", "foot");
  foot.style.paddingBottom = "16px";
  foot.append(buildFollow());

  return buildShell("sealed", "doc", buildAnchor(`${dayLabel()} · day closed`), mid, foot);
}

export function sealed(): HTMLElement {
  return dayClosed() ? sealedDay() : sealedFirst();
}
