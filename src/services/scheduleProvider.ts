import type { Game } from "./types";
import { dateKey, shiftDate } from "../utils/date";
export function createScheduleProvider(games: Game[], today = dateKey()) {
  const ordered = [...games].sort(
    (a, b) => Date.parse(a.utc) - Date.parse(b.utc),
  );
  const getGamesByDate = (date: string) =>
    ordered.filter((g) => dateKey(g.utc) === date);
  return {
    getGamesByDate,
    getGamesForToday: () => getGamesByDate(today),
    getGamesForTomorrow: () => getGamesByDate(shiftDate(today, 1)),
    getGamesForYesterday: () => getGamesByDate(shiftDate(today, -1)),
    getGamesByTeam: (team: string) =>
      [today, shiftDate(today, 1), shiftDate(today, -1)].flatMap((day) =>
        getGamesByDate(day).filter((g) => g.home === team || g.away === team),
      ),
  };
}
