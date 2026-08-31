import {
  CircleAlert,
  LoaderCircle,
  Ruler,
  Search,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {
  cfihosUnitOfMeasureRepository,
} from "../cfihos/repository/CfihosUnitOfMeasureRepository";
import type {
  CfihosUnitOfMeasure,
} from "../cfihos/model/unitOfMeasure";
import "./UnitsOfMeasurePage.css";

type LoadState =
  | { status: "loading" }
  | { status: "success"; units: CfihosUnitOfMeasure[] }
  | { status: "error"; message: string };

export function UnitsOfMeasurePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [searchQuery, setSearchQuery] = useState("");
  const dimensionFilter = searchParams.get("dimension") ?? "all";

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const units = await cfihosUnitOfMeasureRepository.getUnits();
        if (!active) return;
        setState({ status: "success", units });
      } catch (error) {
        if (!active) return;
        setState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unable to load CFIHOS Units of Measure.",
        });
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  const dimensions = useMemo(() => {
    if (state.status !== "success") return [];

    const byId = new Map<
      string,
      { id: string; code: string | null; name: string | null; count: number }
    >();

    for (const unit of state.units) {
      if (!unit.dimensionId) continue;
      const existing = byId.get(unit.dimensionId);
      if (existing) {
        existing.count += 1;
      } else {
        byId.set(unit.dimensionId, {
          id: unit.dimensionId,
          code: unit.dimensionCode,
          name: unit.dimensionName,
          count: 1,
        });
      }
    }

    return Array.from(byId.values()).sort((a, b) =>
      (a.name ?? a.code ?? a.id).localeCompare(
        b.name ?? b.code ?? b.id,
        undefined,
        { sensitivity: "base", numeric: true },
      ),
    );
  }, [state]);

  const effectiveDimensionFilter = useMemo(() => {
    if (dimensionFilter === "all") return "all";
    return dimensions.some((dimension) => dimension.id === dimensionFilter)
      ? dimensionFilter
      : "all";
  }, [dimensionFilter, dimensions]);

  const filteredUnits = useMemo(() => {
    if (state.status !== "success") return [];
    const query = searchQuery.trim().toLowerCase();

    return state.units.filter((unit) => {
      if (
        effectiveDimensionFilter !== "all" &&
        unit.dimensionId !== effectiveDimensionFilter
      ) {
        return false;
      }

      if (!query) return true;

      return [
        unit.id,
        unit.uneceCommonCode,
        unit.name,
        unit.symbol,
        unit.dimensionId,
        unit.dimensionCode,
        unit.dimensionName,
        unit.systemId,
        unit.systemCode,
        unit.systemName,
        ...unit.synonyms,
      ].some((value) => value?.toLowerCase().includes(query));
    });
  }, [effectiveDimensionFilter, searchQuery, state]);

  function openUnit(unit: CfihosUnitOfMeasure) {
    navigate(`/units/${encodeURIComponent(unit.id)}`);
  }

  if (state.status === "loading") {
    return (
      <StatusScreen
        icon={<LoaderCircle className="uom-spinner" size={24} />}
        title="Loading Units of Measure"
        message="Loading the CFIHOS Unit of Measure reference domain…"
      />
    );
  }

  if (state.status === "error") {
    return (
      <StatusScreen
        icon={<CircleAlert size={24} />}
        title="Unable to load Units of Measure"
        message={state.message}
      />
    );
  }

  return (
    <div className="uom-explorer">
      <aside className="uom-browser">
        <div className="uom-browser-heading">
          <div>
            <div className="uom-eyebrow">Reference</div>
            <h1>Units of Measure</h1>
          </div>
          <span className="uom-count">{state.units.length}</span>
        </div>

        <div className="uom-search">
          <Search size={16} />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search units, symbols, codes..."
            aria-label="Search Units of Measure"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="Clear Unit of Measure search"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <label className="uom-filter">
          <span>Dimension</span>
          <select
            value={effectiveDimensionFilter}
            onChange={(event) => {
              const nextDimension = event.target.value;
              if (nextDimension === "all") {
                setSearchParams({});
              } else {
                setSearchParams({ dimension: nextDimension });
              }
            }}
          >
            <option value="all">All dimensions</option>
            {dimensions.map((dimension) => (
              <option key={dimension.id} value={dimension.id}>
                {dimension.name ?? dimension.code ?? dimension.id} ({dimension.count})
              </option>
            ))}
          </select>
        </label>

        <div className="uom-result-count">
          {filteredUnits.length} {filteredUnits.length === 1 ? "unit" : "units"}
        </div>

        <div className="uom-list">
          {filteredUnits.map((unit) => (
            <button
              type="button"
              key={unit.id}
              className="uom-list-item"
              onClick={() => openUnit(unit)}
            >
              <span className="uom-list-name">{unit.name}</span>
              <span className="uom-list-meta">
                {unit.symbol ?? "No symbol"}
                {unit.uneceCommonCode ? ` · ${unit.uneceCommonCode}` : ""}
              </span>
              <span className="uom-list-id">{unit.id}</span>
            </button>
          ))}
        </div>
      </aside>

      <main className="uom-detail">
        <EmptySelection
          unitCount={state.units.length}
          dimensionCount={dimensions.length}
        />
      </main>
    </div>
  );
}

function EmptySelection({
  unitCount,
  dimensionCount,
}: {
  unitCount: number;
  dimensionCount: number;
}) {
  return (
    <div className="uom-empty-selection">
      <div className="uom-empty-icon">
        <Ruler size={28} />
      </div>
      <div className="uom-eyebrow">Reference domain</div>
      <h1>Units of Measure</h1>
      <p>
        Browse the CFIHOS unit catalogue by name, symbol, code or dimension.
      </p>
      <div className="uom-empty-stats">
        <span><strong>{unitCount}</strong> units</span>
        <span><strong>{dimensionCount}</strong> dimensions</span>
      </div>
    </div>
  );
}

function StatusScreen({
  icon,
  title,
  message,
}: {
  icon: ReactNode;
  title: string;
  message: string;
}) {
  return (
    <div className="uom-status">
      {icon}
      <div>
        <strong>{title}</strong>
        <span>{message}</span>
      </div>
    </div>
  );
}
