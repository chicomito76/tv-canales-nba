(() => {
  "use strict";

  const VERSION = "2.1.0";
  const OVERRIDE_KEY = "tv-nba-broadcast-overrides-v2";
  const NBA_SCHEDULE_URL =
    "https://cdn.nba.com/static/json/staticData/scheduleLeagueV2_1.json";
  const originalFetch = window.fetch.bind(window);
  const base = new URL("./", location.href);

  const TEAM_NAMES = {
    ATL: "Atlanta Hawks", BOS: "Boston Celtics", BKN: "Brooklyn Nets",
    CHA: "Charlotte Hornets", CHI: "Chicago Bulls", CLE: "Cleveland Cavaliers",
    DAL: "Dallas Mavericks", DEN: "Denver Nuggets", DET: "Detroit Pistons",
    GSW: "Golden State Warriors", HOU: "Houston Rockets", IND: "Indiana Pacers",
    LAC: "LA Clippers", LAL: "Los Angeles Lakers", MEM: "Memphis Grizzlies",
    MIA: "Miami Heat", MIL: "Milwaukee Bucks", MIN: "Minnesota Timberwolves",
    NOP: "New Orleans Pelicans", NYK: "New York Knicks", OKC: "Oklahoma City Thunder",
    ORL: "Orlando Magic", PHI: "Philadelphia 76ers", PHX: "Phoenix Suns",
    POR: "Portland Trail Blazers", SAC: "Sacramento Kings", SAS: "San Antonio Spurs",
    TOR: "Toronto Raptors", UTA: "Utah Jazz", WAS: "Washington Wizards",
  };

  const CHANNELS = [
    "ESPN", "ESPN 2", "ESPN 3", "ESPN 4", "ESPN 5", "ESPN 6", "ESPN 7", "ESPN Deportes", "Disney+",
    "TNT Sports", "TNT Sports Premium", "HBO Max", "Prime Video",
    "CDN Deportes", "Movistar", "Movistar Deportes", "Movistar Deportes 2",
    "Movistar Deportes 3", "DAZN", "DAZN Baloncesto", "DAZN Baloncesto 2",
    "DAZN Baloncesto 3", "NBA TV alternativa español",
  ];

  const canonical = new Map([
    ["espn", "ESPN"], ["espn2", "ESPN 2"], ["espn 2", "ESPN 2"],
    ["espn3", "ESPN 3"], ["espn 3", "ESPN 3"],
    ["espn4", "ESPN 4"], ["espn 4", "ESPN 4"],
    ["espn5", "ESPN 5"], ["espn 5", "ESPN 5"],
    ["espn6", "ESPN 6"], ["espn 6", "ESPN 6"],
    ["espn7", "ESPN 7"], ["espn 7", "ESPN 7"],
    ["espn deportes", "ESPN Deportes"], ["disney plus", "Disney+"],
    ["disney+", "Disney+"], ["tnt", "TNT Sports"], ["tnt sports", "TNT Sports"],
    ["tnt sports premium", "TNT Sports Premium"], ["max", "HBO Max"],
    ["hbo max", "HBO Max"], ["prime video", "Prime Video"],
    ["amazon prime video", "Prime Video"], ["cdn deportes", "CDN Deportes"],
    ["movistar plus+", "Movistar"], ["movistar plus", "Movistar"],
    ["movistar", "Movistar"], ["movistar deportes", "Movistar Deportes"],
    ["movistar deportes 2", "Movistar Deportes 2"],
    ["movistar deportes 3", "Movistar Deportes 3"], ["dazn", "DAZN"],
    ["dazn baloncesto", "DAZN Baloncesto"],
    ["dazn baloncesto 2", "DAZN Baloncesto 2"],
    ["dazn baloncesto 3", "DAZN Baloncesto 3"],
    ["nba tv alternativa español", "NBA TV alternativa español"],
  ]);

  function normalizeName(input) {
    const clean = String(input || "").trim().replace(/\s+/g, " ");
    return canonical.get(clean.toLocaleLowerCase("es")) || clean;
  }

  function preferPrecise(channels) {
    const seen = new Set();
    const items = channels
      .map(normalizeName)
      .filter((name) => {
        const key = name.toLocaleLowerCase("es");
        if (!name || key === "nba tv" || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    const has = (name) => items.includes(name);
    const any = (prefix) => items.some((name) => name.startsWith(prefix));
    const hasSpecificMovistar = items.some((name) => /^Movistar Deportes [23]$/.test(name));
    const hasSpecificDazn = items.some((name) => /^DAZN Baloncesto [23]$/.test(name));

    return items.filter((name) => {
      if (name === "ESPN" && items.some((c) => /^ESPN (2|3|4|5|6|7|Deportes)$/.test(c)))
        return false;
      if (name === "TNT Sports" && has("TNT Sports Premium")) return false;

      // Movistar/DAZN: maximum useful precision available.
      if (name === "Movistar" && (any("Movistar Deportes") || any("DAZN Baloncesto")))
        return false;
      if (name === "Movistar Deportes" && hasSpecificMovistar) return false;
      if (name === "DAZN" && (any("Movistar") || any("DAZN Baloncesto"))) return false;
      if (name === "DAZN Baloncesto" && hasSpecificDazn) return false;
      return true;
    });
  }

  function readOverrides() {
    try {
      const raw = localStorage.getItem(OVERRIDE_KEY);
      const value = raw ? JSON.parse(raw) : {};
      return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    } catch {
      return {};
    }
  }

  function writeOverrides(value) {
    localStorage.setItem(OVERRIDE_KEY, JSON.stringify(value));
  }

  function normalizeBroadcast(item) {
    if (!item || item.status === "pending") return { status: "pending", channels: [] };
    if (item.status === "none") return { status: "none", channels: [] };
    const channels = preferPrecise(Array.isArray(item.channels) ? item.channels : []);
    return channels.length
      ? { status: "confirmed", channels }
      : { status: "pending", channels: [] };
  }

  function jsonResponse(data, response) {
    return new Response(JSON.stringify(data), {
      status: response?.status || 200,
      statusText: response?.statusText || "OK",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  function scheduleFromNBA(payload) {
    const dates = payload?.leagueSchedule?.gameDates;
    if (!Array.isArray(dates)) throw new Error("Formato NBA inesperado");
    const games = [];
    for (const block of dates) {
      for (const game of block?.games || []) {
        const utc = game?.gameDateTimeUTC;
        const awayCode = game?.awayTeam?.teamTricode;
        const homeCode = game?.homeTeam?.teamTricode;
        if (!utc || !TEAM_NAMES[awayCode] || !TEAM_NAMES[homeCode]) continue;
        const time = Date.parse(utc);
        if (!Number.isFinite(time)) continue;
        if (time < Date.parse("2026-10-20T00:00:00Z") || time > Date.parse("2027-04-12T12:00:00Z"))
          continue;
        // Regular-season game IDs use the 002 prefix. This excludes preseason,
        // All-Star and the Cup championship while allowing the NBA CDN to add
        // newly assigned regular-season Cup games automatically.
        if (game.gameId && !String(game.gameId).startsWith("002")) continue;
        let day = String(game.gameCode || "").split("/")[0];
        if (!/^\d{8}$/.test(day)) {
          const d = String(game.gameDateEst || "").match(/(\d{4})-(\d{2})-(\d{2})/);
          day = d ? `${d[1]}${d[2]}${d[3]}` : "";
        }
        const id = day
          ? `${day}-${awayCode}-${homeCode}`
          : `NBA-${game.gameId || `${awayCode}-${homeCode}-${utc}`}`;
        games.push({
          id,
          utc,
          away: TEAM_NAMES[awayCode],
          home: TEAM_NAMES[homeCode],
          awayCode,
          homeCode,
        });
      }
    }
    if (games.length < 100) throw new Error("Calendario NBA incompleto");
    const unique = [...new Map(games.map((g) => [g.id, g])).values()];
    unique.sort((a, b) => Date.parse(a.utc) - Date.parse(b.utc));
    return { games: unique };
  }

  async function fetchOfficialSchedule() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await originalFetch(NBA_SCHEDULE_URL, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("NBA schedule HTTP error");
      return scheduleFromNBA(await response.json());
    } finally {
      clearTimeout(timer);
    }
  }

  // Patch only the two data files consumed by the existing application. This
  // lets v2 work without recompiling the React bundle and keeps v1 as fallback.
  window.fetch = async (input, init) => {
    const requestUrl = new URL(
      typeof input === "string" || input instanceof URL ? input : input.url,
      location.href,
    );

    if (requestUrl.origin === location.origin && requestUrl.pathname.endsWith("/data/schedule.json")) {
      try {
        const schedule = await fetchOfficialSchedule();
        return jsonResponse(schedule);
      } catch {
        return originalFetch(input, init);
      }
    }

    if (requestUrl.origin === location.origin && requestUrl.pathname.endsWith("/data/broadcasts.json")) {
      const response = await originalFetch(input, init);
      if (!response.ok) return response;
      try {
        const data = await response.clone().json();
        const games = {};
        for (const [id, item] of Object.entries(data.games || {}))
          games[id] = normalizeBroadcast(item);
        const overrides = readOverrides();
        let newest = Date.parse(data.lastUpdated || "") || 0;
        for (const [id, item] of Object.entries(overrides)) {
          games[id] = normalizeBroadcast(item);
          const t = Date.parse(item.updatedAt || "") || 0;
          if (t > newest) newest = t;
        }
        return jsonResponse(
          {
            ...data,
            lastUpdated: newest ? new Date(newest).toISOString() : data.lastUpdated,
            games,
          },
          response,
        );
      } catch {
        return response;
      }
    }

    return originalFetch(input, init);
  };

  function chileDateKey(value = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Santiago",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(value);
    const get = (type) => parts.find((p) => p.type === type)?.value || "";
    return `${get("year")}-${get("month")}-${get("day")}`;
  }

  function shiftDate(key, days) {
    const d = new Date(`${key}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function chileTime(utc) {
    return new Intl.DateTimeFormat("es-CL", {
      timeZone: "America/Santiago",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(utc));
  }

  function gameChileDate(utc) {
    return chileDateKey(new Date(utc));
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  async function localJson(name) {
    const response = await originalFetch(new URL(`data/${name}.json`, base), { cache: "no-store" });
    if (!response.ok) throw new Error("No se pudieron leer los datos locales.");
    return response.json();
  }

  async function adminSchedule() {
    try {
      return await fetchOfficialSchedule();
    } catch {
      return localJson("schedule");
    }
  }

  function automaticFor(data, id) {
    return normalizeBroadcast(data?.games?.[id]);
  }

  function injectAdminStyles() {
    if (document.getElementById("tvnba-v2-styles")) return;
    const style = document.createElement("style");
    style.id = "tvnba-v2-styles";
    style.textContent = `
      .v2-admin-overlay{position:fixed;inset:0;z-index:99999;background:#10040af7;color:#fff;overflow:auto;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:calc(18px + env(safe-area-inset-top)) 18px calc(28px + env(safe-area-inset-bottom));}
      .v2-admin{max-width:560px;margin:0 auto}.v2-admin button,.v2-admin select,.v2-admin input{font:inherit}.v2-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px}.v2-close{background:none;border:0;color:#f3d8e3;min-height:44px;padding:0 8px;font-size:14px}.v2-badge{font-size:10px;letter-spacing:1px;color:#ff8db4;border:1px solid #7c294b;background:#401226;border-radius:999px;padding:8px 10px}.v2-admin h2{font-size:30px;letter-spacing:-1px;margin:8px 0}.v2-intro{color:#b8aab0;font-size:13px;line-height:1.6;margin-bottom:20px}.v2-field{display:block;color:#b8aab0;font-size:11px;margin:16px 0}.v2-field select,.v2-field input[type=text]{display:block;width:100%;margin-top:8px;padding:13px;color:#fff;background:#2d1322;border:1px solid #643047;border-radius:12px;min-height:48px;font-size:15px}.v2-game{padding:16px;border-radius:16px;background:linear-gradient(120deg,#31101f,#1f0d16);border:1px solid #54243a;margin:15px 0;display:grid;gap:5px}.v2-game small{color:#b990a0}.v2-auto{border-top:1px solid #4a2233;margin-top:8px;padding-top:9px;color:#c4a2b0;font-size:11px;line-height:1.5}.v2-local{color:#ff91b7;font-size:11px}.v2-status{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;padding:4px;background:#28131e;border-radius:14px;margin:18px 0}.v2-status button{border:0;min-height:44px;background:none;color:#b99aa8;border-radius:10px}.v2-status button.on{background:linear-gradient(135deg,#da1f5e,#a9143e);color:#fff}.v2-title{font-size:14px;margin:20px 0 10px}.v2-channels{display:grid;grid-template-columns:1fr 1fr;gap:8px}.v2-channels label{display:flex;align-items:center;min-height:44px;padding:9px 10px;border:1px solid #492136;background:#241019;border-radius:11px;color:#bfa1ae;font-size:11px}.v2-channels label.on{border-color:#c52a5f;background:#3a1225;color:#fff}.v2-channels input{margin-right:8px}.v2-msg{font-size:11px;color:#f3c2d5;background:#351427;border-radius:10px;padding:10px 12px}.v2-actions{display:grid;gap:9px;margin-top:16px}.v2-primary,.v2-secondary{border:0;min-height:46px;border-radius:12px;color:#fff;font-weight:600}.v2-primary{background:#cb205b}.v2-secondary{background:transparent;border:1px solid #5b2b40;color:#d5b2c0}.v2-secondary:disabled{opacity:.45}.v2-backup{margin-top:28px;padding:16px;border:1px solid #492438;border-radius:16px;background:#1e0d15}.v2-backup h3{font-size:14px;margin:0 0 6px}.v2-backup p{font-size:10px;color:#ad8e9a;line-height:1.5}.v2-backup-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}.v2-backup button,.v2-import{display:flex;align-items:center;justify-content:center;min-height:44px;padding:8px;border:1px solid #612a43;border-radius:10px;background:none;color:#f2c6d7;font-size:10px}.v2-import input{position:absolute;opacity:0;width:1px;height:1px}.v2-hint{text-align:center;color:#8f707d;font-size:9px;line-height:1.6;margin:18px}.v2-version{font-size:9px;color:#805f6c}@media(max-width:390px){.v2-channels{grid-template-columns:1fr}}`;
    document.head.appendChild(style);
  }

  async function openAdmin() {
    if (document.querySelector(".v2-admin-overlay")) return;
    injectAdminStyles();
    const [schedule, automatic] = await Promise.all([
      adminSchedule(),
      localJson("broadcasts"),
    ]);
    const today = chileDateKey();
    const nearby = (schedule.games || [])
      .filter((g) => {
        const d = gameChileDate(g.utc);
        return d === shiftDate(today, -1) || d === today || d === shiftDate(today, 1);
      })
      .sort((a, b) => Date.parse(a.utc) - Date.parse(b.utc));

    const overlay = document.createElement("div");
    overlay.className = "v2-admin-overlay";
    overlay.innerHTML = `<div class="v2-admin"><div class="v2-top"><button class="v2-close">← Salir</button><span class="v2-badge">ADMIN LOCAL</span></div><div class="v2-version">TV Canales NBA v${VERSION}</div><h2>Modo administrador</h2><p class="v2-intro">Tus correcciones se guardan solo en este iPhone y tienen prioridad sobre los datos automáticos.</p><label class="v2-field">Partido<select id="v2-game"></select></label><div id="v2-editor"></div><section class="v2-backup"><h3>Respaldo de correcciones</h3><p>Exporta una copia antes de borrar Safari, reinstalar la app o cambiar de iPhone.</p><div class="v2-backup-row"><button id="v2-export">Exportar copia</button><label class="v2-import">Importar copia<input id="v2-import" type="file" accept="application/json,.json"></label></div></section><p class="v2-hint">Para volver a entrar, mantén presionado “TV Canales NBA” durante 1,4 segundos.</p></div>`;
    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";

    const select = overlay.querySelector("#v2-game");
    const editor = overlay.querySelector("#v2-editor");
    const labelDay = (key) => key === today ? "Hoy" : key === shiftDate(today,1) ? "Mañana" : "Ayer";
    for (const game of nearby) {
      const option = document.createElement("option");
      option.value = game.id;
      option.textContent = `${labelDay(gameChileDate(game.utc))} ${chileTime(game.utc)} · ${game.awayCode} vs ${game.homeCode}`;
      select.appendChild(option);
    }

    let draft = { status: "pending", channels: [] };
    function renderEditor() {
      const game = nearby.find((g) => g.id === select.value) || nearby[0];
      if (!game) {
        editor.innerHTML = `<p class="v2-msg">No hay partidos cargados para ayer, hoy o mañana.</p>`;
        return;
      }
      const overrides = readOverrides();
      const local = overrides[game.id];
      const auto = automaticFor(automatic, game.id);
      draft = normalizeBroadcast(local || auto);
      const extra = draft.channels.filter((c) => !CHANNELS.includes(c));
      const autoText = auto.status === "confirmed" ? auto.channels.join(" · ") : auto.status === "none" ? "No hay transmisión en español" : "Pendiente";
      editor.innerHTML = `<section class="v2-game"><small>${escapeHtml(labelDay(gameChileDate(game.utc)))} · ${escapeHtml(chileTime(game.utc))}</small><strong>${escapeHtml(game.away)}</strong><span>vs</span><strong>${escapeHtml(game.home)}</strong><div class="v2-auto">Automático: ${escapeHtml(autoText)}</div>${local ? '<div class="v2-local">✓ Corrección local activa</div>' : ""}</section><div class="v2-status"><button data-status="confirmed">Confirmado</button><button data-status="pending">Pendiente</button><button data-status="none">Ninguno</button></div><div id="v2-channel-area"></div><p id="v2-msg"></p><div class="v2-actions"><button id="v2-save" class="v2-primary">Guardar corrección</button><button id="v2-reset" class="v2-secondary" ${local ? "" : "disabled"}>Restaurar automático</button></div>`;

      const area = editor.querySelector("#v2-channel-area");
      function renderChannels() {
        editor.querySelectorAll("[data-status]").forEach((b) => b.classList.toggle("on", b.dataset.status === draft.status));
        if (draft.status !== "confirmed") {
          area.innerHTML = "";
          return;
        }
        area.innerHTML = `<h3 class="v2-title">Canales / plataformas</h3><div class="v2-channels">${CHANNELS.map((name) => `<label class="${draft.channels.includes(name) ? "on" : ""}"><input type="checkbox" value="${escapeHtml(name)}" ${draft.channels.includes(name) ? "checked" : ""}><span>${escapeHtml(name)}</span></label>`).join("")}</div><label class="v2-field">Otro canal (separa varios con coma)<input id="v2-extra" type="text" value="${escapeHtml(extra.join(", "))}" placeholder="Ej.: Canal nuevo"></label>`;
        area.querySelectorAll('input[type="checkbox"]').forEach((input) => {
          input.addEventListener("change", () => {
            const name = input.value;
            draft.channels = input.checked
              ? [...draft.channels, name]
              : draft.channels.filter((c) => c !== name);
            input.closest("label").classList.toggle("on", input.checked);
          });
        });
      }
      renderChannels();
      editor.querySelectorAll("[data-status]").forEach((button) => {
        button.addEventListener("click", () => {
          draft.status = button.dataset.status;
          if (draft.status !== "confirmed") draft.channels = [];
          renderChannels();
        });
      });
      editor.querySelector("#v2-save").addEventListener("click", () => {
        const extraInput = editor.querySelector("#v2-extra");
        const extras = extraInput ? extraInput.value.split(",").map((x) => x.trim()).filter(Boolean) : [];
        const channels = preferPrecise([...draft.channels, ...extras]);
        const msg = editor.querySelector("#v2-msg");
        if (draft.status === "confirmed" && !channels.length) {
          msg.className = "v2-msg";
          msg.textContent = "Selecciona al menos un canal o cambia el estado.";
          return;
        }
        const next = readOverrides();
        next[game.id] = {
          status: draft.status,
          channels: draft.status === "confirmed" ? channels : [],
          updatedAt: new Date().toISOString(),
        };
        writeOverrides(next);
        msg.className = "v2-msg";
        msg.textContent = "Corrección guardada. Se aplicará al volver a la app.";
        setTimeout(() => location.reload(), 450);
      });
      editor.querySelector("#v2-reset").addEventListener("click", () => {
        const next = readOverrides();
        delete next[game.id];
        writeOverrides(next);
        setTimeout(() => location.reload(), 250);
      });
    }

    select.addEventListener("change", renderEditor);
    renderEditor();

    overlay.querySelector(".v2-close").addEventListener("click", () => {
      overlay.remove();
      document.body.style.overflow = "";
    });
    overlay.querySelector("#v2-export").addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(readOverrides(), null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tv-canales-nba-correcciones-${today}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    overlay.querySelector("#v2-import").addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
        const clean = {};
        for (const [id, item] of Object.entries(parsed)) {
          if (!item || !["confirmed", "pending", "none"].includes(item.status) || !Array.isArray(item.channels)) throw new Error();
          clean[id] = {
            status: item.status,
            channels: item.status === "confirmed" ? preferPrecise(item.channels) : [],
            updatedAt: item.updatedAt || new Date().toISOString(),
          };
        }
        writeOverrides(clean);
        location.reload();
      } catch {
        alert("La copia de seguridad no es válida.");
      }
    });
  }

  function attachAdminGesture() {
    const brand = document.querySelector(".brand");
    if (!brand || brand.dataset.v2Admin === "1") return;
    brand.dataset.v2Admin = "1";
    let timer = 0;
    let opened = false;
    const start = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        opened = true;
        void openAdmin();
      }, 1400);
    };
    const cancel = () => clearTimeout(timer);
    brand.addEventListener("pointerdown", start);
    brand.addEventListener("pointerup", cancel);
    brand.addEventListener("pointercancel", cancel);
    brand.addEventListener("pointerleave", cancel);
    brand.addEventListener(
      "click",
      (event) => {
        if (opened) {
          event.preventDefault();
          event.stopImmediatePropagation();
          opened = false;
        }
      },
      true,
    );
  }

  const observer = new MutationObserver(attachAdminGesture);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  addEventListener("DOMContentLoaded", attachAdminGesture);

  // Exposed only for troubleshooting from Safari Web Inspector.
  window.TVCanalesNBAv2 = { version: VERSION, openAdmin, preferPrecise };
})();
