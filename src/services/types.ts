export interface Game {
  id: string;
  utc: string;
  away: string;
  home: string;
  awayCode: string;
  homeCode: string;
}
export type BroadcastStatus = "confirmed" | "none" | "pending";
export interface Broadcast {
  status: BroadcastStatus;
  channels: string[];
}
export interface ResolvedBroadcast extends Broadcast {
  source: "automatic" | "local";
}
export interface Schedule {
  demo?: boolean;
  games: Game[];
}
export interface Broadcasts {
  demo?: boolean;
  lastUpdated: string;
  games: Record<string, Broadcast>;
}
export interface Snapshot {
  schedule: Schedule;
  broadcasts: Broadcasts;
}
