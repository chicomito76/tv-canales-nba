import { useRef } from "react";
import {
  Home,
  Users,
  CalendarDays,
  Heart,
  RefreshCw,
  WifiOff,
  Radio,
  Ban,
  Clock3,
  ArrowUpRight,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import type { Game, ResolvedBroadcast } from "../services/types";
import { chileTime, dateKey, dayLabel, shiftDate } from "../utils/date";
import { teams } from "../data/teams";
export type Page = "home" | "teams" | "date" | "favorites" | "admin";

export function Header({
  onHome,
  onAdmin,
}: {
  onHome: () => void;
  onAdmin: () => void;
}) {
  const timer = useRef<number | undefined>(undefined);
  const longPress = () => {
    timer.current = window.setTimeout(onAdmin, 1400);
  };
  const cancelLongPress = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = undefined;
  };
  return (
    <header>
      <button
        type="button"
        className="brand brand-button"
        onClick={onHome}
        onPointerDown={longPress}
        onPointerUp={cancelLongPress}
        onPointerCancel={cancelLongPress}
        onPointerLeave={cancelLongPress}
        aria-label="TV Canales NBA. Mantén presionado para abrir el modo administrador."
      >
        <span className="brand-icon">
          <Radio size={22} />
        </span>
        <div>
          <h1>TV Canales NBA</h1>
          <p>
            Hora de Chile <span className="tiny-dot" />
          </p>
        </div>
      </button>
      <span className="header-label">
        TU CANCHA.
        <br />
        TU IDIOMA.
      </span>
    </header>
  );
}

export function BottomNavigation({
  page,
  onChange,
}: {
  page: Page;
  onChange: (p: Page) => void;
}) {
  const links = [
    ["home", "Inicio", Home],
    ["teams", "Equipos", Users],
    ["date", "Fecha", CalendarDays],
    ["favorites", "Favoritos", Heart],
  ] as const;
  return (
    <nav className="bottom-nav" aria-label="Navegación principal">
      {links.map(([id, label, Icon]) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          aria-current={page === id ? "page" : undefined}
          className={page === id ? "active" : ""}
        >
          <Icon size={22} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

export function ChannelBadge({ name }: { name: string }) {
  return (
    <span className="channel">
      <Radio size={12} />
      {name}
    </span>
  );
}

export function FavoriteButton({
  team,
  selected,
  onToggle,
}: {
  team: string;
  selected: boolean;
  onToggle: (t: string) => void;
}) {
  return (
    <button
      className={"favorite " + (selected ? "selected" : "")}
      onClick={() => onToggle(team)}
      aria-label={`${selected ? "Quitar" : "Añadir"} ${team} ${selected ? "de" : "a"} favoritos`}
      aria-pressed={selected}
    >
      <Heart size={19} fill={selected ? "currentColor" : "none"} />
    </button>
  );
}

export function GameCard({
  game,
  broadcast,
  favorites,
  toggle,
  showDay = false,
}: {
  game: Game;
  broadcast: ResolvedBroadcast;
  favorites: string[];
  toggle: (t: string) => void;
  showDay?: boolean;
}) {
  return (
    <article className="game-card">
      <div className="game-meta">
        <span>
          <Clock3 size={13} />
          {showDay && `${dayLabel(dateKey(game.utc))} · `}
          {chileTime(game.utc)}
        </span>
        <span>NBA · TEMPORADA REGULAR</span>
      </div>
      <div className="match">
        {[
          [game.away, game.awayCode],
          [game.home, game.homeCode],
        ].map(([name, code], i) => (
          <div key={name} className="team-row">
            <span className={"crest crest-" + i}>{code}</span>
            <span className="team-name">
              {name}
              <small>{i === 0 ? "Visitante" : "Local"}</small>
            </span>
            <FavoriteButton
              team={name}
              selected={favorites.includes(name)}
              onToggle={toggle}
            />
          </div>
        ))}
        <span className="versus">vs</span>
      </div>
      <div className={"broadcast " + broadcast.status}>
        {broadcast.status === "confirmed" ? (
          <>
            <span className="broadcast-label">EN ESPAÑOL</span>
            <div className="channels">
              {broadcast.channels.map((c) => (
                <ChannelBadge key={c} name={c} />
              ))}
            </div>
          </>
        ) : broadcast.status === "none" ? (
          <>
            <Ban size={15} />
            No hay transmisión en español
          </>
        ) : (
          <>
            <Clock3 size={15} />
            Transmisión pendiente de confirmar
          </>
        )}
        {broadcast.source === "local" && (
          <span className="local-source">
            <ShieldCheck size={12} /> Ajuste local
          </span>
        )}
      </div>
    </article>
  );
}

export function TeamSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="field">
      Tu equipo
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {teams.map((t) => (
          <option key={t}>{t}</option>
        ))}
      </select>
    </label>
  );
}

export function DateSelector({
  value,
  onChange,
  today,
}: {
  value: string;
  onChange: (v: string) => void;
  today: string;
}) {
  return (
    <div>
      <div className="date-tabs">
        {[-1, 0, 1].map((n) => (
          <button
            key={n}
            className={value === shiftDate(today, n) ? "selected" : ""}
            onClick={() => onChange(shiftDate(today, n))}
          >
            {["Ayer", "Hoy", "Mañana"][n + 1]}
          </button>
        ))}
      </div>
      <label className="field">
        Elegir otra fecha
        <input
          aria-label="Fecha de partidos"
          type="date"
          value={value}
          onChange={(e) => {
            if (e.target.value) onChange(e.target.value);
          }}
        />
      </label>
    </div>
  );
}

export function UpdateStatus({
  updated,
  busy,
  onRefresh,
}: {
  updated?: string;
  busy: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="update">
      <span>
        <i />{" "}
        {updated
          ? `Actualizado: ${dayLabel(dateKey(updated)).toLowerCase()} ${chileTime(updated)}`
          : "Sin datos descargados"}
      </span>
      <button disabled={busy} onClick={onRefresh}>
        <RefreshCw size={13} className={busy ? "spin" : ""} />
        {busy ? "Actualizando" : "Actualizar"}
      </button>
    </div>
  );
}

export function EmptyState({
  text = "No hay partidos en el calendario para este día.",
}: {
  text?: string;
}) {
  return (
    <div className="empty">
      <CalendarDays size={30} />
      <h3>La cancha descansa</h3>
      <p>{text}</p>
    </div>
  );
}

export function OfflineNotice() {
  return (
    <p className="notice" role="status">
      <WifiOff size={15} />
      Datos guardados sin conexión
    </p>
  );
}

export function LoadingState() {
  return (
    <p className="empty" role="status">
      Cargando tu agenda…
    </p>
  );
}

export function SearchActions({ onChange }: { onChange: (p: Page) => void }) {
  return (
    <div className="search-actions">
      <button onClick={() => onChange("teams")}>
        <Users />
        <span>
          Buscar por
          <br />
          <strong>equipo</strong>
        </span>
        <ArrowUpRight size={17} />
      </button>
      <button onClick={() => onChange("date")}>
        <CalendarDays />
        <span>
          Buscar por
          <br />
          <strong>fecha</strong>
        </span>
        <ArrowUpRight size={17} />
      </button>
    </div>
  );
}

export function SectionTitle({
  title,
  count,
}: {
  title: string;
  count?: number;
}) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      {count !== undefined && (
        <span>
          {count} {count === 1 ? "partido" : "partidos"}{" "}
          <ChevronRight size={12} />
        </span>
      )}
    </div>
  );
}
