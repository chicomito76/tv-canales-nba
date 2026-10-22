import { useState } from "react";
import { teams } from "../data/teams";
export function useFavorites() {
  const [warning, setWarning] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const v: unknown = JSON.parse(
        localStorage.getItem("tv-nba-favorites") || "[]",
      );
      return Array.isArray(v)
        ? v.filter(
            (t): t is string =>
              typeof t === "string" && teams.some((team) => team === t),
          )
        : [];
    } catch {
      return [];
    }
  });
  const toggle = (team: string) => {
    const next = favorites.includes(team)
      ? favorites.filter((t) => t !== team)
      : [...favorites, team];
    setFavorites(next);
    try {
      localStorage.setItem("tv-nba-favorites", JSON.stringify(next));
    } catch {
      setWarning(true);
    }
  };
  return { favorites, toggle, warning };
}
