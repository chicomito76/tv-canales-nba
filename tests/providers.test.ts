import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createBroadcastProvider,
  deduplicateChannels,
} from "../src/services/broadcastProvider.ts";
import { createScheduleProvider } from "../src/services/scheduleProvider.ts";
import { dateKey, chileTime, shiftDate } from "../src/utils/date.ts";
import { validateSnapshot } from "../src/services/dataLoader.ts";
const provider = createBroadcastProvider({
  lastUpdated: "2026-10-22T14:35:00Z",
  games: {
    a: { status: "confirmed", channels: ["ESPN 2", " espn 2 ", "Disney+"] },
    b: { status: "none", channels: ["ESPN"] },
    c: { status: "pending", channels: ["ESPN"] },
    d: { status: "confirmed", channels: ["NBA TV"] },
    e: { status: "confirmed", channels: ["NBA TV alternativa español"] },
  },
});
test("confirmed deduplicates names, preserving open channel list", () =>
  assert.deepEqual(provider.getChannels("a"), ["ESPN 2", "Disney+"]));
test("missing and pending never become none", () => {
  assert.equal(provider.getBroadcastStatus("missing"), "pending");
  assert.equal(provider.getBroadcastStatus("c"), "pending");
  assert.deepEqual(provider.getChannels("c"), []);
});
test("none is explicit and ignores stray channels", () => {
  assert.equal(provider.getBroadcastStatus("b"), "none");
  assert.deepEqual(provider.getChannels("b"), []);
});
test("unverified NBA TV excluded; verified Spanish label accepted", () => {
  assert.equal(provider.getBroadcastStatus("d"), "pending");
  assert.deepEqual(provider.getChannels("e"), ["NBA TV alternativa español"]);
});
test("open list supports future names", () =>
  assert.deepEqual(deduplicateChannels([" New Channel ", "New Channel"]), [
    "New Channel",
  ]));
test("UTC midnight maps to Chile previous date", () => {
  assert.equal(dateKey("2026-10-23T01:30:00Z"), "2026-10-22");
  assert.equal(chileTime("2026-10-23T01:30:00Z"), "22:30");
});
test("Chile summer and winter offsets", () => {
  assert.equal(chileTime("2026-01-15T02:00:00Z"), "23:00");
  assert.equal(chileTime("2026-07-15T02:00:00Z"), "22:00");
});
test("calendar arithmetic crosses month and year", () => {
  assert.equal(shiftDate("2026-12-31", 1), "2027-01-01");
  assert.equal(shiftDate("2026-03-01", -1), "2026-02-28");
});
const game = {
  id: "today",
  utc: "2026-10-23T01:30:00Z",
  away: "Denver Nuggets",
  home: "Oklahoma City Thunder",
  awayCode: "DEN",
  homeCode: "OKC",
};
test("team filter limits dates and prioritizes today", () => {
  const s = createScheduleProvider(
    [
      game,
      { ...game, id: "yesterday", utc: "2026-10-22T01:30:00Z" },
      { ...game, id: "tomorrow", utc: "2026-10-24T01:30:00Z" },
      { ...game, id: "future", utc: "2026-10-25T01:30:00Z" },
    ],
    "2026-10-22",
  );
  assert.deepEqual(
    s.getGamesByTeam("Denver Nuggets").map((g) => g.id),
    ["today", "tomorrow", "yesterday"],
  );
  assert.equal(s.getGamesForToday().length, 1);
  assert.equal(s.getGamesForTomorrow()[0].id, "tomorrow");
  assert.equal(s.getGamesForYesterday()[0].id, "yesterday");
});
test("invalid data rejected before replacing offline snapshot", () =>
  assert.throws(() =>
    validateSnapshot({
      schedule: { games: [game, game] },
      broadcasts: { lastUpdated: "2026-10-22T14:35:00Z", games: {} },
    }),
  ));
