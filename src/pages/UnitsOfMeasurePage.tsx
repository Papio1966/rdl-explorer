import {
  CircleAlert,
  Hash,
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
  useParams,
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
  | {
      status: "success";
      units: CfihosUnitOfMeasure[];
    }
  | {
      status: "error";
      message: string;
    };

export function UnitsOfMeasurePage() {
  const navigate = useNavigate();
  const { unitId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const [state, setState] = useState<LoadState>({
    status: "loading",
  });
  const [searchQuery, setSearchQuery] = useState("");

  const dimensionFilter =
    searchParams.get("dimension") ?? "all";

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const units = await cfihosUnitOfMeasureRepository.getUnits();

        if (!active) {
          return;
        }

        setState({ status: "success", units });
      } catch (error) {
        if (!active) {
          return;
        }

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
    if (state.status !== "success") {
      return [];
    }

    const byId = new Map<
      string,
      {
        id: string;
        code: string | null;
        name: string | null;
        count: number;
      }
    >();

    for (const unit of state.units) {
      if (!unit.dimensionId) {
        continue;
      }

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
    if (dimensionFilter === "all") {
      return "all";
    }

    return dimensions.some(
      (dimension) => dimension.id === dimensionFilter,
    )
      ? dimensionFilter
      : "all";
  }, [dimensionFilter, dimensions]);

  const filteredUnits = useMemo(() => {
    if (state.status !== "success") {
      return [];
    }

    const query = searchQuery.trim().toLowerCase();

    return state.units.filter((unit) => {
      if (
        effectiveDimensionFilter !== "all" &&
        unit.dimensionId !== effectiveDimensionFilter
      ) {
        return false;
      }

      if (!query) {
        return true;
      }

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

  const selectedUnit = useMemo(() => {
    if (state.status !== "success" || !unitId) {
      return null;
    }

    return (
      state.units.find(
        (unit) => unit.id.toUpperCase() === unitId.toUpperCase(),
      ) ?? null
    );
  }, [state, unitId]);

  const dimensionUnits = useMemo(() => {
    if (
      state.status !== "success" ||
      !selectedUnit?.dimensionId
    ) {
      return [];
    }

    return state.units.filter(
      (unit) => unit.dimensionId === selectedUnit.dimensionId,
    );
  }, [selectedUnit, state]);

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
              className={`uom-list-item ${
                unit.id === selectedUnit?.id ? "uom-list-item-selected" : ""
              }`}
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
        {!unitId ? (
          <EmptySelection unitCount={state.units.length} dimensionCount={dimensions.length} />
        ) : !selectedUnit ? (
          <StatusScreen
            icon={<CircleAlert size={24} />}
            title="Unit of Measure not found"
            message={`No CFIHOS Unit of Measure was found for ${unitId}.`}
            embedded
          />
        ) : (
          <UnitDetail
            unit={selectedUnit}
            dimensionUnits={dimensionUnits}
            onOpenUnit={openUnit}
          />
        )}
      </main>
    </div>
  );
}

type UnitDetailProps = {
  unit: CfihosUnitOfMeasure;
  dimensionUnits: CfihosUnitOfMeasure[];
  onOpenUnit: (unit: CfihosUnitOfMeasure) => void;
};

function UnitDetail({ unit, dimensionUnits, onOpenUnit }: UnitDetailProps) {
  const otherUnits = dimensionUnits.filter((candidate) => candidate.id !== unit.id);

  return (
    <div className="uom-detail-inner">
      <header className="uom-detail-header">
        <div className="uom-eyebrow">Unit of Measure</div>
        <div className="uom-title-row">
          <div>
            <h1>{unit.name}</h1>
            <div className="uom-id">
              <Hash size={13} />
              {unit.id}
            </div>
          </div>

          {unit.symbol && <span className="uom-symbol-badge">{unit.symbol}</span>}
        </div>
      </header>

      <div className="uom-card-grid">
        <section className="uom-card">
          <h2>Reference</h2>
          <DetailRow label="UNECE code" value={unit.uneceCommonCode} />
          <DetailRow label="Symbol" value={unit.symbol} />
          <DetailRow
            label="Synonyms"
            value={unit.synonyms.length > 0 ? unit.synonyms.join(", ") : null}
          />
        </section>

        <section className="uom-card">
          <h2>Dimension</h2>
          <DetailRow label="Dimension" value={unit.dimensionName} />
          <DetailRow label="Dimension code" value={unit.dimensionCode} mono />
          <DetailRow label="CFIHOS dimension ID" value={unit.dimensionId} mono />
        </section>

        <section className="uom-card">
          <h2>Measurement system</h2>
          <DetailRow label="System" value={unit.systemName} />
          <DetailRow label="System code" value={unit.systemCode} mono />
          <DetailRow label="CFIHOS system ID" value={unit.systemId} mono />
        </section>
      </div>

      <section className="uom-family-section">
        <div className="uom-section-heading">
          <div>
            <div className="uom-eyebrow">Dimension family</div>
            <h2>{unit.dimensionName ?? unit.dimensionCode ?? "Related units"}</h2>
            <p>
              Other CFIHOS Units of Measure that belong to the same dimension.
            </p>
          </div>
          <span>{dimensionUnits.length}</span>
        </div>

        {otherUnits.length === 0 ? (
          <div className="uom-empty-card">No other units share this dimension.</div>
        ) : (
          <div className="uom-family-grid">
            {otherUnits.map((candidate) => (
              <button
                type="button"
                key={candidate.id}
                onClick={() => onOpenUnit(candidate)}
              >
                <strong>{candidate.name}</strong>
                <span>{candidate.symbol ?? candidate.uneceCommonCode ?? candidate.id}</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
}) {
  return (
    <div className="uom-detail-row">
      <span>{label}</span>
      <strong className={mono ? "uom-mono" : ""}>{value ?? "Not specified"}</strong>
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
  embedded = false,
}: {
  icon: ReactNode;
  title: string;
  message: string;
  embedded?: boolean;
}) {
  return (
    <div className={embedded ? "uom-status uom-status-embedded" : "uom-status"}>
      {icon}
      <div>
        <strong>{title}</strong>
        <span>{message}</span>
      </div>
    </div>
  );
}
