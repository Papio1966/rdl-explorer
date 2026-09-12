import { createContext, useContext } from "react";
import type { RdlScopeKey } from "./catalog";

export type RdlScopeContextValue = {
  scope: RdlScopeKey;
  setScope: (scope: RdlScopeKey) => void;
  releaseKey: string | null;
  setReleaseKey: (releaseKey: string) => void;
};

export const RdlScopeContext = createContext<RdlScopeContextValue | null>(null);

export function useRdlScope() {
  const value = useContext(RdlScopeContext);
  if (!value) throw new Error("useRdlScope must be used inside RdlScopeProvider");
  return value;
}
