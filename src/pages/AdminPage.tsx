import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  Download,
  RotateCcw,
  Save,
  ShieldCheck,
  Upload,
} from "lucide-react";
import type {
  Broadcast,
  BroadcastStatus,
  Game,
  ResolvedBroadcast,
} from "../services/types";
import { channelCatalog } from "../data/channels";
import { chileTime, dateKey, dayLabel, longDate } from "../utils/date";

export function AdminPage({
  games,
  today,
  getBroadcast,
  getAutomaticBroadcast,
  hasLocalOverride,
  saveOverride,
  removeOverride,
  importOverrides,
  exportText,
  onExit,
}: {
  games: Game[];
  today: string;
  getBroadcast: (id: string) => ResolvedBroadcast;
  getAutomaticBroadcast: (id: string) => ResolvedBroadcast;
  hasLocalOverride: (id: string) => boolean;
  saveOverride: (id: string, broadcast: Broadcast) => void;
  removeOverride: (id: string) => void;
  importOverrides: (input: unknown) => void;
  exportText: string;
  onExit: () => void;
}) {
  const ordered = useMemo(
    () =>
      [...games].sort((a, b) => {
        const da = dateKey(a.utc);
        const db = dateKey(b.utc);
        const ra = da === today ? 0 : da > today ? 1 : 2;
        const rb = db === today ? 0 : db > today ? 1 : 2;
        return ra - rb || Date.parse(a.utc) - Date.parse(b.utc);
      }),
    [games, today],
  );
  const [gameId, setGameId] = useState(ordered[0]?.id ?? "");
  const current = ordered.find((g) => g.id === gameId) ?? ordered[0];
  const effective = current
    ? getBroadcast(current.id)
    : ({ status: "pending", channels: [], source: "automatic" } as const);
  const automatic = current
    ? getAutomaticBroadcast(current.id)
    : ({ status: "pending", channels: [], source: "automatic" } as const);

  const [status, setStatus] = useState<BroadcastStatus>(effective.status);
  const [channels, setChannels] = useState<string[]>(effective.channels);
  const [extra, setExtra] = useState("");
  const [message, setMessage] = useState("");

  const known = new Set<string>(channelCatalog);
  const syncDraft = () => {
    const b = current ? getBroadcast(current.id) : effective;
    setStatus(b.status);
    setChannels(b.channels.filter((c) => known.has(c)));
    setExtra(b.channels.filter((c) => !known.has(c)).join(", "));
    setMessage("");
  };

  useEffect(() => {
    syncDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  const toggleChannel = (name: string) =>
    setChannels((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name],
    );

  const save = () => {
    if (!current) return;
    const extraChannels = extra
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    const chosen = [...channels, ...extraChannels];
    if (status === "confirmed" && chosen.length === 0) {
      setMessage("Selecciona al menos un canal o cambia el estado.");
      return;
    }
    saveOverride(current.id, {
      status,
      channels: status === "confirmed" ? chosen : [],
    });
    setMessage("Corrección guardada en este iPhone.");
  };

  const reset = () => {
    if (!current) return;
    removeOverride(current.id);
    setStatus(automatic.status);
    setChannels(automatic.channels.filter((c) => known.has(c)));
    setExtra(automatic.channels.filter((c) => !known.has(c)).join(", "));
    setMessage("Se restauraron los datos automáticos.");
  };

  const exportBackup = () => {
    const blob = new Blob([exportText], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tv-canales-nba-correcciones-${today}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const importBackup = async (file?: File) => {
    if (!file) return;
    try {
      importOverrides(JSON.parse(await file.text()));
      setMessage("Copia importada correctamente.");
      setTimeout(syncDraft, 0);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "No se pudo importar la copia.");
    }
  };

  return (
    <>
      <div className="admin-head">
        <button onClick={onExit} className="admin-back">
          <ArrowLeft size={18} /> Salir
        </button>
        <span className="admin-badge">
          <ShieldCheck size={14} /> ADMIN LOCAL
        </span>
      </div>
      <span className="eyebrow">CORRECCIONES PERSONALES</span>
      <h2 className="page-title">Modo administrador</h2>
      <p className="intro">
        Tus cambios se guardan solo en este dispositivo y siempre tienen prioridad
        sobre los datos automáticos.
      </p>

      {current ? (
        <>
          <label className="field">
            Partido
            <select value={current.id} onChange={(e) => setGameId(e.target.value)}>
              {ordered.map((g) => (
                <option key={g.id} value={g.id}>
                  {dayLabel(dateKey(g.utc))} {chileTime(g.utc)} · {g.awayCode} vs {g.homeCode}
                </option>
              ))}
            </select>
          </label>

          <section className="admin-game">
            <small>{longDate(dateKey(current.utc))} · {chileTime(current.utc)}</small>
            <strong>{current.away}</strong>
            <span>vs</span>
            <strong>{current.home}</strong>
            <div className="automatic-line">
              Automático: {automatic.status === "confirmed"
                ? automatic.channels.join(" · ")
                : automatic.status === "none"
                  ? "Sin transmisión en español"
                  : "Pendiente"}
            </div>
            {hasLocalOverride(current.id) && (
              <div className="override-line"><Check size={13} /> Hay una corrección local activa</div>
            )}
          </section>

          <div className="admin-status" role="group" aria-label="Estado de transmisión">
            {([
              ["confirmed", "Confirmado"],
              ["pending", "Pendiente"],
              ["none", "Ninguno"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                className={status === value ? "selected" : ""}
                onClick={() => setStatus(value)}
              >
                {label}
              </button>
            ))}
          </div>

          {status === "confirmed" && (
            <>
              <h3 className="admin-section-title">Canales / plataformas</h3>
              <div className="channel-grid">
                {channelCatalog.map((name) => (
                  <label key={name} className={channels.includes(name) ? "checked" : ""}>
                    <input
                      type="checkbox"
                      checked={channels.includes(name)}
                      onChange={() => toggleChannel(name)}
                    />
                    <span>{name}</span>
                  </label>
                ))}
              </div>
              <label className="field">
                Otro canal (separa varios con coma)
                <input
                  value={extra}
                  onChange={(e) => setExtra(e.target.value)}
                  placeholder="Ej.: Canal nuevo"
                />
              </label>
            </>
          )}

          {message && <p className="admin-message">{message}</p>}
          <div className="admin-actions">
            <button className="primary" onClick={save}>
              <Save size={16} /> Guardar corrección
            </button>
            <button className="secondary" onClick={reset} disabled={!hasLocalOverride(current.id)}>
              <RotateCcw size={16} /> Restaurar automático
            </button>
          </div>
        </>
      ) : (
        <p className="empty">No hay partidos cercanos cargados.</p>
      )}

      <section className="backup-box">
        <h3>Respaldo de tus correcciones</h3>
        <p>Úsalo antes de borrar Safari, reinstalar la PWA o cambiar de iPhone.</p>
        <div className="backup-actions">
          <button onClick={exportBackup}><Download size={15} /> Exportar copia</button>
          <label className="import-button">
            <Upload size={15} /> Importar copia
            <input
              type="file"
              accept="application/json,.json"
              onChange={(e) => void importBackup(e.target.files?.[0])}
            />
          </label>
        </div>
      </section>
      <p className="admin-hint">Para volver a entrar: mantén presionado “TV Canales NBA” durante 1,4 segundos.</p>
    </>
  );
}
