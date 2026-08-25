import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { RdlScopeKey } from "./catalog";

const STORAGE_KEY = "rdl-explorer:scope";
const VALID_SCOPES = new Set<RdlScopeKey>(["all", "cfihos", "ccus", "water-desalination"]);

type RdlScopeContextValue = {
  scope: RdlScopeKey;
  setScope: (scope: RdlScopeKey) => void;
};

const RdlScopeContext = createContext<RdlScopeContextValue | null>(null);

export function RdlScopeProvider({ children }: { children: ReactNode }) {
  const [scope, setScopeState] = useState<RdlScopeKey>(() => {
    if (typeof window === "undefined") return "all";
    const stored = window.localStorage.getItem(STORAGE_KEY) as RdlScopeKey | null;
    return stored && VALID_SCOPES.has(stored) ? stored : "all";
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, scope);
  }, [scope]);

  const value = useMemo(() => ({ scope, setScope: setScopeState }), [scope]);
  return <RdlScopeContext.Provider value={value}>{children}</RdlScopeContext.Provider>;
}

export function useRdlScope() {
  const value = useContext(RdlScopeContext);
  if (!value) throw new Error("useRdlScope must be used inside RdlScopeProvider");
  return value;
}
