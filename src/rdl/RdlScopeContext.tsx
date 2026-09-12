import { useEffect, useMemo, useState, useCallback, type ReactNode } from "react";
import { getDefaultReleaseKey, getRdlRelease, type RdlScopeKey, type RdlSourceKey } from "./catalog";

import { RdlScopeContext } from "./rdlScopeContextValue";
const SCOPE_STORAGE_KEY = "rdl-explorer:scope";
const RELEASE_STORAGE_KEY = "rdl-explorer:release-by-source";
const VALID_SCOPES = new Set<RdlScopeKey>(["all", "cfihos", "ccus", "water-desalination"]);

type ReleaseMap = Partial<Record<RdlSourceKey, string>>;

function initialReleaseMap(): ReleaseMap {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RELEASE_STORAGE_KEY) ?? "{}") as ReleaseMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function RdlScopeProvider({ children }: { children: ReactNode }) {
  const [scope, setScopeState] = useState<RdlScopeKey>(() => {
    if (typeof window === "undefined") return "all";
    const stored = window.localStorage.getItem(SCOPE_STORAGE_KEY) as RdlScopeKey | null;
    return stored && VALID_SCOPES.has(stored) ? stored : "all";
  });
  const [releaseBySource, setReleaseBySource] = useState<ReleaseMap>(initialReleaseMap);

  useEffect(() => { window.localStorage.setItem(SCOPE_STORAGE_KEY, scope); }, [scope]);
  useEffect(() => { window.localStorage.setItem(RELEASE_STORAGE_KEY, JSON.stringify(releaseBySource)); }, [releaseBySource]);

  const releaseKey = scope === "all"
    ? null
    : getRdlRelease(scope, releaseBySource[scope])?.key ?? getDefaultReleaseKey(scope) ?? null;

  const setReleaseKey = useCallback((next: string) => {
    if (scope === "all" || !getRdlRelease(scope, next)) return;
    setReleaseBySource((current) => ({ ...current, [scope]: next }));
  }, [scope]);

  const value = useMemo(() => ({ scope, setScope: setScopeState, releaseKey, setReleaseKey }), [scope, releaseKey, setReleaseKey]);
  return <RdlScopeContext.Provider value={value}>{children}</RdlScopeContext.Provider>;
}
