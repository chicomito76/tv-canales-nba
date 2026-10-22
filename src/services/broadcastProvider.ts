import type { Broadcast, Broadcasts, ResolvedBroadcast } from "./types";
import type { BroadcastOverrides } from "../hooks/useBroadcastOverrides";

const canonical = new Map<string, string>([
  ["espn", "ESPN"],
  ["espn2", "ESPN 2"],
  ["espn 2", "ESPN 2"],
  ["espn3", "ESPN 3"],
  ["espn 3", "ESPN 3"],
  ["espn4", "ESPN 4"],
  ["espn 4", "ESPN 4"],
  ["espn5", "ESPN 5"],
  ["espn 5", "ESPN 5"],
  ["espn6", "ESPN 6"],
  ["espn 6", "ESPN 6"],
  ["espn7", "ESPN 7"],
  ["espn 7", "ESPN 7"],
  ["espn deportes", "ESPN Deportes"],
  ["disney plus", "Disney+"],
  ["disney+", "Disney+"],
  ["tnt", "TNT Sports"],
  ["tnt sports", "TNT Sports"],
  ["tnt sports premium", "TNT Sports Premium"],
  ["hbo max", "HBO Max"],
  ["max", "HBO Max"],
  ["prime video", "Prime Video"],
  ["amazon prime video", "Prime Video"],
  ["cdn deportes", "CDN Deportes"],
  ["movistar", "Movistar"],
  ["movistar plus", "Movistar"],
  ["movistar plus+", "Movistar"],
  ["m+ deportes", "Movistar Deportes"],
  ["movistar deportes", "Movistar Deportes"],
  ["movistar deportes 2", "Movistar Deportes 2"],
  ["movistar deportes 3", "Movistar Deportes 3"],
  ["dazn", "DAZN"],
  ["dazn baloncesto", "DAZN Baloncesto"],
  ["dazn baloncesto 2", "DAZN Baloncesto 2"],
  ["dazn baloncesto 3", "DAZN Baloncesto 3"],
  ["nba tv alternativa español", "NBA TV alternativa español"],
]);

function normalizeName(input: string): string {
  const clean = input.trim().replace(/\s+/g, " ");
  return canonical.get(clean.toLocaleLowerCase("es")) ?? clean;
}

export function deduplicateChannels(channels: string[]): string[] {
  const seen = new Set<string>();
  return channels
    .map(normalizeName)
    .filter((c) => {
      const key = c.toLocaleLowerCase("es");
      if (!c || key === "nba tv" || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/**
 * Keep the most useful label that is currently known. Generic family labels
 * are suppressed when a more precise member of that family is available.
 */
export function preferPreciseChannels(channels: string[]): string[] {
  const items = deduplicateChannels(channels);
  const has = (name: string) => items.includes(name);
  const any = (prefix: string) => items.some((c) => c.startsWith(prefix));

  return items.filter((name) => {
    // ESPN: ESPN is only a fallback when a specific ESPN signal is unknown.
    if (name === "ESPN" && items.some((c) => /^ESPN (2|3|4|5|6|7|Deportes)$/.test(c)))
      return false;

    // TNT: keep Premium over the broader TNT Sports label.
    if (name === "TNT Sports" && has("TNT Sports Premium")) return false;

    // Movistar / DAZN: prefer the most precise linear signal. DAZN remains a
    // fallback only if no Movistar or DAZN Baloncesto signal is known.
    if (
      name === "Movistar" &&
      (any("Movistar Deportes") || any("DAZN Baloncesto"))
    )
      return false;
    if (
      name === "Movistar Deportes" &&
      items.some((c) => /^Movistar Deportes [23]$/.test(c))
    )
      return false;
    if (
      name === "DAZN" &&
      (any("Movistar Deportes") || any("DAZN Baloncesto"))
    )
      return false;
    if (
      name === "DAZN Baloncesto" &&
      items.some((c) => /^DAZN Baloncesto [23]$/.test(c))
    )
      return false;

    return true;
  });
}

function resolveBroadcast(b?: Broadcast): Broadcast {
  if (!b || b.status === "pending") return { status: "pending", channels: [] };
  if (b.status === "none") return { status: "none", channels: [] };
  const channels = preferPreciseChannels(b.channels);
  return channels.length
    ? { status: "confirmed", channels }
    : { status: "pending", channels: [] };
}

export function createBroadcastProvider(
  data: Broadcasts,
  overrides: BroadcastOverrides = {},
) {
  function getBroadcast(id: string): ResolvedBroadcast {
    const local = overrides[id];
    if (local) return { ...resolveBroadcast(local), source: "local" };
    return { ...resolveBroadcast(data.games[id]), source: "automatic" };
  }
  return {
    getBroadcast,
    getChannels: (id: string) => getBroadcast(id).channels,
    getBroadcastStatus: (id: string) => getBroadcast(id).status,
    hasLocalOverride: (id: string) => Boolean(overrides[id]),
    getAutomaticBroadcast: (id: string): ResolvedBroadcast => ({
      ...resolveBroadcast(data.games[id]),
      source: "automatic",
    }),
  };
}
