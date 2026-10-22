import type { Snapshot } from "./types";
import { teams } from "../data/teams";
const KEY = "tv-nba-snapshot-v1";
export function validateSnapshot(input: unknown): Snapshot {
  const s = input as Snapshot;
  if (
    !s?.schedule ||
    !Array.isArray(s.schedule.games) ||
    !s.broadcasts?.games ||
    Array.isArray(s.broadcasts.games) ||
    !Number.isFinite(Date.parse(s.broadcasts.lastUpdated))
  )
    throw new Error("Formato JSON no válido. Revisa los archivos de datos.");
  const ids = new Set<string>();
  for (const g of s.schedule.games) {
    if (
      !g.id ||
      ids.has(g.id) ||
      !/^\d{4}-\d{2}-\d{2}T.*Z$/.test(g.utc) ||
      !Number.isFinite(Date.parse(g.utc)) ||
      !teams.some((t) => t === g.away) ||
      !teams.some((t) => t === g.home) ||
      !g.awayCode ||
      !g.homeCode
    )
      throw new Error("Hay un partido no válido o duplicado en schedule.json.");
    ids.add(g.id);
  }
  for (const b of Object.values(s.broadcasts.games))
    if (
      !b ||
      !["confirmed", "none", "pending"].includes(b.status) ||
      !Array.isArray(b.channels) ||
      b.channels.some((c) => typeof c !== "string")
    )
      throw new Error("Hay una transmisión no válida en broadcasts.json.");
  return s;
}
export async function loadData(): Promise<{
  data: Snapshot;
  cached: boolean;
  storageWarning: boolean;
}> {
  try {
    const [schedule, broadcasts] = await Promise.all(
      ["schedule", "broadcasts"].map(async (name) => {
        const response = await fetch(
          `${import.meta.env.BASE_URL}data/${name}.json`,
          { cache: "no-store", signal: AbortSignal.timeout(10000) },
        );
        if (!response.ok)
          throw new Error("No se pudieron descargar los datos.");
        return response.json() as Promise<unknown>;
      }),
    );
    const data = validateSnapshot({ schedule, broadcasts });
    let storageWarning = false;
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      storageWarning = true;
    }
    return { data, cached: false, storageWarning };
  } catch (error) {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(KEY);
    } catch {
      /* Storage can be unavailable in private mode. */
    }
    if (raw)
      return {
        data: validateSnapshot(JSON.parse(raw)),
        cached: true,
        storageWarning: false,
      };
    throw error;
  }
}
