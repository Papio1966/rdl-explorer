import { ArrowRightLeft, Database, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  entityTypeLabel,
  getRdlSource,
  rdlEntityRoute,
  RDL_SOURCES,
  type RdlSourceKey,
} from "../rdl/catalog";
import {
  loadCrossRdlIntelligence,
  type CrossRdlIntelligenceProjection,
} from "../rdl/intelligence";

function sourceKeyFromParam(value: string | null, fallback: RdlSourceKey): RdlSourceKey {
  return getRdlSource(value ?? undefined)?.key ?? fallback;
}

export function RdlIntelligencePage() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<CrossRdlIntelligenceProjection>();
  const [error, setError] = useState(false);

  useEffect(() => {
    loadCrossRdlIntelligence().then(setData).catch(() => setError(true));
  }, []);

  const left = sourceKeyFromParam(params.get("left"), "cfihos");
  const right = sourceKeyFromParam(params.get("right"), "water-desalination");
  const type = params.get("type") ?? "all";

  const mappings = useMemo(
    () =>
      data?.mappings.filter((mapping) => {
        const pair = new Set<RdlSourceKey>([
          mapping.left.sourceKey,
          mapping.right.sourceKey,
        ]);
        return (
          pair.has(left) &&
          pair.has(right) &&
          (type === "all" || mapping.left.entityType === type)
        );
      }) ?? [],
    [data, left, right, type],
  );

  const entityTypes = useMemo(
    () => Array.from(new Set(data?.mappings.map((mapping) => mapping.left.entityType) ?? [])).sort(),
    [data],
  );

  const leftCounts = data?.byType[left] ?? {};
  const rightCounts = data?.byType[right] ?? {};
  const types = Array.from(
    new Set([...Object.keys(leftCounts), ...Object.keys(rightCounts)]),
  ).sort();

  function set(key: string, value: string) {
    const next = new URLSearchParams(params);
    next.set(key, value);
    setParams(next);
  }

  return (
    <div className="content-page rdl-intelligence-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">Cross-RDL intelligence</div>
          <h1>Compare RDLs</h1>
        </div>
        <p>
          Derived mappings are kept separate from authoritative source relationships and always
          show method, confidence and status.
        </p>
      </div>

      <div className="rdl-intelligence-warning">
        <ShieldCheck size={19} />
        <div>
          <strong>Governance boundary</strong>
          <p>
            Exact-name matches are candidate <em>possible matches</em>, not equivalence. Approval
            or stronger mapping types require explicit governance.
          </p>
        </div>
      </div>

      <div className="rdl-compare-controls">
        <label>
          Left RDL
          <select value={left} onChange={(event) => set("left", event.target.value)}>
            {RDL_SOURCES.map((source) => (
              <option value={source.key} key={source.key}>
                {source.shortName}
              </option>
            ))}
          </select>
        </label>
        <ArrowRightLeft aria-hidden="true" />
        <label>
          Right RDL
          <select value={right} onChange={(event) => set("right", event.target.value)}>
            {RDL_SOURCES.map((source) => (
              <option value={source.key} key={source.key}>
                {source.shortName}
              </option>
            ))}
          </select>
        </label>
        <label>
          Entity type
          <select value={type} onChange={(event) => set("type", event.target.value)}>
            <option value="all">All types</option>
            {entityTypes.map((entityType) => (
              <option key={entityType} value={entityType}>
                {entityTypeLabel(entityType)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <div role="alert" className="rdl-search-state">
          Cross-RDL intelligence projection could not be loaded.
        </div>
      )}
      {!data && !error && (
        <div role="status" className="rdl-search-state">
          Loading cross-RDL intelligence…
        </div>
      )}

      {data && (
        <>
          <section className="rdl-intelligence-section">
            <h2>Overlap and gap profile</h2>
            <p className="rdl-intelligence-copy">
              Counts show source coverage by entity type. They are structural coverage indicators,
              not claims of semantic completeness.
            </p>
            <div
              className="rdl-gap-table"
              role="table"
              aria-label="RDL entity type overlap and gap profile"
            >
              <div className="rdl-gap-row rdl-gap-head" role="row">
                <span>Entity type</span>
                <span>{getRdlSource(left)?.shortName}</span>
                <span>{getRdlSource(right)?.shortName}</span>
                <span>Candidate exact-name overlap</span>
              </div>
              {types.map((entityType) => {
                const overlap = data.mappings.filter((mapping) => {
                  if (mapping.left.entityType !== entityType) {
                    return false;
                  }
                  const pair = new Set<RdlSourceKey>([
                    mapping.left.sourceKey,
                    mapping.right.sourceKey,
                  ]);
                  return pair.has(left) && pair.has(right);
                }).length;

                return (
                  <div className="rdl-gap-row" role="row" key={entityType}>
                    <span>{entityTypeLabel(entityType)}</span>
                    <span>{leftCounts[entityType] ?? 0}</span>
                    <span>{rightCounts[entityType] ?? 0}</span>
                    <span>{overlap}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rdl-intelligence-section">
            <div className="rdl-intelligence-section-heading">
              <div>
                <h2>Candidate mappings</h2>
                <p className="rdl-intelligence-copy">
                  {mappings.length} deterministic candidates for the selected pair and type.
                </p>
              </div>
            </div>
            <div className="rdl-mapping-list">
              {mappings.slice(0, 100).map((mapping, index) => (
                <div
                  className="rdl-mapping-card"
                  key={`${mapping.left.packageKey}:${mapping.left.nativeIdentifier}:${mapping.right.packageKey}:${mapping.right.nativeIdentifier}:${index}`}
                >
                  <div className="rdl-mapping-entities">
                    <Link
                      to={rdlEntityRoute(
                        mapping.left.sourceKey,
                        mapping.left.entityType,
                        mapping.left.nativeIdentifier,
                      )}
                    >
                      <small>
                        {getRdlSource(mapping.left.sourceKey)?.shortName} ·{" "}
                        {entityTypeLabel(mapping.left.entityType)}
                      </small>
                      <strong>{mapping.left.name}</strong>
                      <code>{mapping.left.nativeIdentifier}</code>
                    </Link>
                    <ArrowRightLeft size={18} />
                    <Link
                      to={rdlEntityRoute(
                        mapping.right.sourceKey,
                        mapping.right.entityType,
                        mapping.right.nativeIdentifier,
                      )}
                    >
                      <small>
                        {getRdlSource(mapping.right.sourceKey)?.shortName} ·{" "}
                        {entityTypeLabel(mapping.right.entityType)}
                      </small>
                      <strong>{mapping.right.name}</strong>
                      <code>{mapping.right.nativeIdentifier}</code>
                    </Link>
                  </div>
                  <div className="rdl-mapping-meta">
                    <span className="rdl-mapping-type">
                      {mapping.mappingType.replaceAll("_", " ")}
                    </span>
                    <span>
                      <Database size={13} /> {mapping.provenanceMethod.replaceAll("_", " ")}
                    </span>
                    <span>Confidence {(mapping.confidence * 100).toFixed(0)}%</span>
                    <span>Status {mapping.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
