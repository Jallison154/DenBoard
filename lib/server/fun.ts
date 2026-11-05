import { DateTime } from "luxon";
import type { FunItem, FunSlice } from "../types";
import type { DenBoardConfig } from "./config";

const UA = "DenBoard/2.0 (+https://github.com/Jallison154/DenBoard)";

/** Splits "Why did X? Because Y." so the screen can reveal the punchline after a beat. */
function splitJoke(joke: string): FunItem {
  const m = joke.match(/^(.+?[?])\s+(.+)$/s);
  if (m && m[2].length > 2) return { kind: "joke", text: m[1].trim(), punchline: m[2].trim() };
  return { kind: "joke", text: joke.trim() };
}

async function jokes(n: number): Promise<FunItem[]> {
  const res = await fetch(`https://icanhazdadjoke.com/search?limit=30&page=${1 + Math.floor(Math.random() * 20)}`, {
    headers: { Accept: "application/json", "User-Agent": UA },
    signal: AbortSignal.timeout(10000),
    cache: "no-store"
  });
  if (!res.ok) throw new Error(`dadjoke HTTP ${res.status}`);
  const d = await res.json();
  const list: string[] = (d.results ?? []).map((r: { joke: string }) => r.joke).filter((j: string) => j.length < 160);
  return shuffle(list).slice(0, n).map(splitJoke);
}

async function facts(n: number): Promise<FunItem[]> {
  const out = await Promise.all(
    Array.from({ length: n }, async () => {
      const res = await fetch("https://uselessfacts.jph.ph/api/v2/facts/random?language=en", {
        headers: { Accept: "application/json", "User-Agent": UA },
        signal: AbortSignal.timeout(10000),
        cache: "no-store"
      });
      if (!res.ok) return null;
      const d = await res.json();
      const text = String(d.text ?? "").replace(/`/g, "'").trim();
      return text && text.length < 200 ? ({ kind: "fact", text } as FunItem) : null;
    })
  );
  const seen = new Set<string>();
  return out.filter((f): f is FunItem => !!f && !seen.has(f.text) && !!seen.add(f.text));
}

async function onThisDay(tz: string, n: number): Promise<FunItem[]> {
  const now = DateTime.now().setZone(tz);
  const res = await fetch(
    `https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/selected/${now.toFormat("MM")}/${now.toFormat("dd")}`,
    { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10000), cache: "no-store" }
  );
  if (!res.ok) throw new Error(`onthisday HTTP ${res.status}`);
  const d = await res.json();
  const items: FunItem[] = (d.selected ?? [])
    .filter((s: { text: string }) => s.text.length < 180)
    .map((s: { text: string; year: number }) => ({
      kind: "history" as const,
      text: s.text,
      meta: `${now.toFormat("LLLL d")}, ${s.year}`
    }));
  return shuffle(items).slice(0, n);
}

function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

const FALLBACK: FunItem[] = [
  { kind: "joke", text: "Why don't mountains get cold?", punchline: "They wear snow caps." },
  { kind: "fact", text: "Octopuses have three hearts and blue blood." },
  { kind: "joke", text: "What do you call a fake noodle?", punchline: "An impasta." }
];

export async function loadFun(config: DenBoardConfig): Promise<FunSlice> {
  const f = config.display.fun;
  const settled = await Promise.allSettled([
    f.jokes ? jokes(8) : Promise.resolve([]),
    f.facts ? facts(6) : Promise.resolve([]),
    f.history ? onThisDay(config.location.timezone, 4) : Promise.resolve([])
  ]);
  const lists = settled.map((s) => (s.status === "fulfilled" ? s.value : []));
  // Interleave so the screen alternates joke → fact → history
  const items: FunItem[] = [];
  for (let i = 0; i < 8; i++) for (const l of lists) if (l[i]) items.push(l[i]);
  return { items: items.length ? items : FALLBACK, updatedAt: Date.now() };
}
