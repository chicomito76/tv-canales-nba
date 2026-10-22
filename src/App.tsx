import { useEffect, useState } from "react";
import {
  Header,
  BottomNavigation,
  GameCard,
  UpdateStatus,
  OfflineNotice,
  LoadingState,
  EmptyState,
  FavoriteButton,
} from "./components/UI";
import type { Page } from "./components/UI";
import { HomePage, TeamPage, DatePage, FavoritesPage } from "./pages/Views";
import { AdminPage } from "./pages/AdminPage";
import { createScheduleProvider } from "./services/scheduleProvider";
import { createBroadcastProvider } from "./services/broadcastProvider";
import { loadData } from "./services/dataLoader";
import type { Snapshot, Game } from "./services/types";
import { dateKey } from "./utils/date";
import { useFavorites } from "./hooks/useFavorites";
import { useBroadcastOverrides } from "./hooks/useBroadcastOverrides";
const pageFromHash = (): Page => {
  const p = location.hash.slice(1);
  return p === "teams" || p === "date" || p === "favorites" || p === "admin" ? p : "home";
};
export default function App() {
  const [page, setPage] = useState<Page>(pageFromHash),
    [team, setTeam] = useState("Denver Nuggets"),
    [today, setToday] = useState(dateKey()),
    [date, setDate] = useState(dateKey()),
    [data, setData] = useState<Snapshot>(),
    [busy, setBusy] = useState(true),
    [cached, setCached] = useState(false),
    [offline, setOffline] = useState(!navigator.onLine),
    [error, setError] = useState(""),
    [storageWarning, setStorageWarning] = useState(false);
  const { favorites, toggle, warning } = useFavorites();
  const {
    overrides,
    saveOverride,
    removeOverride,
    importOverrides,
    exportText,
    warning: overrideWarning,
  } = useBroadcastOverrides();
  async function refresh() {
    setBusy(true);
    setError("");
    try {
      const result = await loadData();
      setData(result.data);
      setCached(result.cached);
      setStorageWarning(result.storageWarning);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No fue posible cargar los datos.",
      );
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void refresh();
    const sync = () => {
      setOffline(!navigator.onLine);
      if (navigator.onLine) void refresh();
    };
    const hash = () => {
      setPage(pageFromHash());
      window.scrollTo({ top: 0 });
    };
    const tick = () => setToday(dateKey());
    const timer = window.setInterval(tick, 30000);
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    window.addEventListener("hashchange", hash);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
      window.removeEventListener("hashchange", hash);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  const navigate = (p: Page) => {
    location.hash = p;
    setPage(p);
    window.scrollTo({ top: 0 });
  };
  const schedule = createScheduleProvider(data?.schedule.games ?? [], today),
    broadcasts = createBroadcastProvider(
      data?.broadcasts ?? { lastUpdated: "", games: {} },
      overrides,
    );
  const cards = (games: Game[], showDay = false) =>
    games.length ? (
      games.map((g) => (
        <GameCard
          key={g.id}
          game={g}
          broadcast={broadcasts.getBroadcast(g.id)}
          favorites={favorites}
          toggle={toggle}
          showDay={showDay}
        />
      ))
    ) : (
      <EmptyState />
    );
  const favoriteGames = [
    ...new Map(
      favorites
        .flatMap((t) => schedule.getGamesByTeam(t))
        .map((g) => [g.id, g]),
    ).values(),
  ].sort((a, b) => {
    const rank = (g: Game) =>
      dateKey(g.utc) === today ? 0 : dateKey(g.utc) > today ? 1 : 2;
    return rank(a) - rank(b) || Date.parse(a.utc) - Date.parse(b.utc);
  });
  return (
    <div className="app">
      <Header onHome={() => navigate("home")} onAdmin={() => navigate("admin")} />
      <main id="main">
        {(offline || cached) && data && <OfflineNotice />}
        {(warning || storageWarning || overrideWarning) && (
          <p className="notice">
            El navegador no permite guardar todos los datos en este dispositivo.
          </p>
        )}
        {data?.schedule.demo && (
          <p className="demo-notice">
            MODO DEMOSTRACIÓN · Partidos y canales ficticios
          </p>
        )}
        {error && (
          <div className="error" role="alert">
            {error}
            <button onClick={() => void refresh()}>Reintentar</button>
          </div>
        )}
        {busy && !data ? (
          <LoadingState />
        ) : data ? (
          <div key={page} className="page">
            {page === "home" ? (
              <HomePage
                today={today}
                count={schedule.getGamesForToday().length}
                onChange={navigate}
              >
                {cards(schedule.getGamesForToday())}
              </HomePage>
            ) : page === "teams" ? (
              <TeamPage team={team} setTeam={setTeam}>
                <div className="follow-row">
                  <span>Guardar como favorito</span>
                  <FavoriteButton
                    team={team}
                    selected={favorites.includes(team)}
                    onToggle={toggle}
                  />
                </div>
                {cards(schedule.getGamesByTeam(team), true)}
              </TeamPage>
            ) : page === "date" ? (
              <DatePage date={date} setDate={setDate} today={today}>
                {cards(schedule.getGamesByDate(date))}
              </DatePage>
            ) : page === "favorites" ? (
              <FavoritesPage
                favorites={favorites}
                toggle={toggle}
                onTeams={() => navigate("teams")}
              >
                {cards(favoriteGames, true)}
              </FavoritesPage>
            ) : (
              <AdminPage
                games={[
                  ...schedule.getGamesForYesterday(),
                  ...schedule.getGamesForToday(),
                  ...schedule.getGamesForTomorrow(),
                ]}
                today={today}
                getBroadcast={broadcasts.getBroadcast}
                getAutomaticBroadcast={broadcasts.getAutomaticBroadcast}
                hasLocalOverride={broadcasts.hasLocalOverride}
                saveOverride={saveOverride}
                removeOverride={removeOverride}
                importOverrides={importOverrides}
                exportText={exportText}
                onExit={() => navigate("home")}
              />
            )}
          </div>
        ) : null}
        <UpdateStatus
          updated={data?.broadcasts.lastUpdated}
          busy={busy}
          onRefresh={() => void refresh()}
        />
        <p className="footnote">
          Todos los horarios en America/Santiago.
          <br />
          Solo transmisiones en español · Sin rastreo
        </p>
      </main>
      {page !== "admin" && <BottomNavigation page={page} onChange={navigate} />}
    </div>
  );
}
