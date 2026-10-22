import type { ReactNode } from "react";
import {
  SearchActions,
  SectionTitle,
  TeamSelector,
  DateSelector,
  FavoriteButton,
  EmptyState,
} from "../components/UI";
import type { Page } from "../components/UI";
import { longDate } from "../utils/date";
export function HomePage({
  today,
  count,
  children,
  onChange,
}: {
  today: string;
  count: number;
  children: ReactNode;
  onChange: (p: Page) => void;
}) {
  return (
    <>
      <section className="hero">
        <img src={`${import.meta.env.BASE_URL}images/hero-jokic.png`} alt="" />
        <div className="hero-copy">
          <span className="eyebrow">EL JUEGO NOS CONECTA</span>
          <h2>
            Tu noche.
            <br />
            Tu básquet.
          </h2>
          <p>Encuentra dónde verlo en español.</p>
          <span className="hero-pill">
            <span /> NBA · EN TU IDIOMA
          </span>
        </div>
      </section>
      <SearchActions onChange={onChange} />
      <SectionTitle title="Hoy en la cancha" count={count} />
      <p className="date-caption">{longDate(today)}</p>
      {children}
    </>
  );
}
export function TeamPage({
  team,
  setTeam,
  children,
}: {
  team: string;
  setTeam: (s: string) => void;
  children: ReactNode;
}) {
  return (
    <>
      <span className="eyebrow">SIGUE A LOS TUYOS</span>
      <h2 className="page-title">Buscar por equipo</h2>
      <p className="intro">Hoy primero. También ayer y mañana.</p>
      <TeamSelector value={team} onChange={setTeam} />
      <SectionTitle title={team} />
      {children}
    </>
  );
}
export function DatePage({
  date,
  setDate,
  today,
  children,
}: {
  date: string;
  setDate: (s: string) => void;
  today: string;
  children: ReactNode;
}) {
  return (
    <>
      <span className="eyebrow">TU AGENDA NBA</span>
      <h2 className="page-title">Buscar por fecha</h2>
      <DateSelector value={date} onChange={setDate} today={today} />
      <SectionTitle title="Partidos del día" />
      <p className="date-caption">{longDate(date)}</p>
      {children}
    </>
  );
}
export function FavoritesPage({
  favorites,
  toggle,
  children,
  onTeams,
}: {
  favorites: string[];
  toggle: (s: string) => void;
  children: ReactNode;
  onTeams: () => void;
}) {
  return (
    <>
      <span className="eyebrow">SIEMPRE EN PRIMERA FILA</span>
      <h2 className="page-title">Tus favoritos</h2>
      <p className="intro">Tus equipos, guardados en este dispositivo.</p>
      {favorites.map((team) => (
        <div className="favorite-row" key={team}>
          <span>{team}</span>
          <FavoriteButton team={team} selected onToggle={toggle} />
        </div>
      ))}
      {favorites.length ? (
        <>
          <SectionTitle title="Partidos cercanos" />
          {children}
        </>
      ) : (
        <>
          <EmptyState text="Toca el corazón junto a un equipo para añadirlo aquí." />
          <button className="primary" onClick={onTeams}>
            Elegir un equipo
          </button>
        </>
      )}
    </>
  );
}
