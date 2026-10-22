import { useCallback, useMemo, useState } from "react";
import type { Broadcast } from "../services/types";

const KEY = "tv-nba-broadcast-overrides-v2";

export interface BroadcastOverride extends Broadcast {
  updatedAt: string;
}

export type BroadcastOverrides = Record<string, BroadcastOverride>;

function readOverrides(): BroadcastOverrides {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as BroadcastOverrides;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

export function useBroadcastOverrides() {
  const [overrides, setOverrides] = useState<BroadcastOverrides>(readOverrides);
  const [warning, setWarning] = useState(false);

  const persist = useCallback((next: BroadcastOverrides) => {
    setOverrides(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      setWarning(false);
    } catch {
      setWarning(true);
    }
  }, []);

  const saveOverride = useCallback(
    (gameId: string, broadcast: Broadcast) => {
      persist({
        ...overrides,
        [gameId]: {
          status: broadcast.status,
          channels: broadcast.channels,
          updatedAt: new Date().toISOString(),
        },
      });
    },
    [overrides, persist],
  );

  const removeOverride = useCallback(
    (gameId: string) => {
      const next = { ...overrides };
      delete next[gameId];
      persist(next);
    },
    [overrides, persist],
  );

  const importOverrides = useCallback(
    (input: unknown) => {
      const value = input as BroadcastOverrides;
      if (!value || typeof value !== "object" || Array.isArray(value))
        throw new Error("La copia de seguridad no es válida.");
      const next: BroadcastOverrides = {};
      for (const [id, item] of Object.entries(value)) {
        if (
          !item ||
          !["confirmed", "pending", "none"].includes(item.status) ||
          !Array.isArray(item.channels) ||
          item.channels.some((c) => typeof c !== "string")
        )
          throw new Error("La copia contiene una transmisión no válida.");
        next[id] = {
          status: item.status,
          channels: item.channels,
          updatedAt: item.updatedAt || new Date().toISOString(),
        };
      }
      persist(next);
    },
    [persist],
  );

  const exportText = useMemo(
    () => JSON.stringify(overrides, null, 2),
    [overrides],
  );

  return {
    overrides,
    saveOverride,
    removeOverride,
    importOverrides,
    exportText,
    warning,
  };
}
