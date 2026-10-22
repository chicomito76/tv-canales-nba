import type { Broadcast, Broadcasts } from "./types";
export function deduplicateChannels(channels: string[]): string[] {
  const seen = new Set<string>();
  return channels
    .map((c) => c.trim().replace(/\s+/g, " "))
    .filter((c) => {
      const key = c.toLocaleLowerCase("es");
      if (!c || key === "nba tv" || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
export function createBroadcastProvider(data: Broadcasts) {
  function getBroadcast(id: string): Broadcast {
    const b = data.games[id];
    if (!b || b.status === "pending")
      return { status: "pending", channels: [] };
    if (b.status === "none") return { status: "none", channels: [] };
    const channels = deduplicateChannels(b.channels);
    return channels.length
      ? { status: "confirmed", channels }
      : { status: "pending", channels: [] };
  }
  return {
    getBroadcast,
    getChannels: (id: string) => getBroadcast(id).channels,
    getBroadcastStatus: (id: string) => getBroadcast(id).status,
  };
}
