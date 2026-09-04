import { ArrowLeft, Database, FileSearch } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { RdlRelationshipSection } from "../components/RdlRelationshipSection";
import { entityTypeLabel, getDefaultReleaseKey, getRdlRelease, getRdlSource } from "../rdl/catalog";
import { type RdlDetailLinkedEntity, type RdlEntityDetailProjection } from "../rdl/entityDetail";
import { loadRdlEntityDetailRuntime } from "../rdl/runtimeDetail";
import "./RdlEntityPage.css";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; detail: RdlEntityDetailProjection }
  | { status: "missing" }
  | { status: "error"; message: string };

function HierarchyLinks({ title, items }: { title: string; items: RdlDetailLinkedEntity[] }) {
  if (!items.length) return null;
  return <div className="rdl-detail-hierarchy-group"><h3>{title}</h3><div>{items.map((item) => <Link key={item.key} to={item.href}><strong>{item.name}</strong><code>{item.nativeIdentifier}</code></Link>)}</div></div>;
}

function detailLabels(entityType: string) {
  return {
    relatedClasses: entityType === "tag_class"
      ? "Related Equipment Classes"
      : entityType === "equipment_class"
        ? "Related Tag Classes"
        : "Related Classes",
    usedByClasses: entityType === "source_standard" ? "Classes" : "Used by Classes",
  };
}

export function RdlEntityPage() {
  const { sourceKey = "", releaseKey: routeReleaseKey, entityType = "", nativeIdentifier = "" } = useParams();
  const releaseKey = routeReleaseKey ?? getDefaultReleaseKey(sourceKey) ?? "";
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });
    loadRdlEntityDetailRuntime({ sourceKey, releaseKey, entityType, nativeIdentifier })
      .then((detail) => {
        if (!active) return;
        setState(detail ? { status: "ready", detail } : { status: "missing" });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setState({ status: "error", message: error instanceof Error ? error.message : "Unable to load RDL entity detail." });
      });
    return () => { active = false; };
  }, [sourceKey, releaseKey, entityType, nativeIdentifier]);

  const source = getRdlSource(sourceKey);
  const release = getRdlRelease(sourceKey, releaseKey);
  const detail = state.status === "ready" ? state.detail : null;
  const labels = detailLabels(detail?.record.entityType ?? entityType);

  const sections = useMemo(() => {
    if (!detail) return [];
    const items = [
      { id: "rdl-definition", label: "Definition", show: true },
      { id: "rdl-classification", label: "Classification", show: detail.classification.length > 0 },
      { id: "rdl-hierarchy", label: "Hierarchy", show: detail.hierarchy.parents.length + detail.hierarchy.children.length > 0 },
      { id: "rdl-properties", label: "Properties", show: detail.properties.length > 0 },
      { id: "rdl-units-of-measure", label: "Units of Measure", show: detail.unitsOfMeasure.length > 0 },
      { id: "rdl-allowed-values", label: "Allowed Values", show: detail.allowedValues.length > 0 },
      { id: "rdl-related-classes", label: labels.relatedClasses, show: detail.relatedClasses.length > 0 },
      { id: "rdl-used-by-classes", label: labels.usedByClasses, show: detail.usedByClasses.length > 0 },
      { id: "rdl-required-documents", label: "Required Documents", show: detail.requiredDocuments.length > 0 },
      { id: "rdl-required-by-classes", label: "Required by Classes", show: detail.requiredByClasses.length > 0 },
      { id: "rdl-disciplines", label: "Discipline Requirements", show: detail.disciplines.length > 0 },
      { id: "rdl-document-types", label: "Document Types", show: detail.documentTypes.length > 0 },
      { id: "rdl-information-requirements", label: "Information Requirements", show: detail.informationRequirements.length > 0 },
      { id: "rdl-source-standards", label: "Source Standards", show: detail.sourceStandards.length > 0 },
      { id: "rdl-property-mappings", label: "Property Mappings", show: detail.propertyMappings.length > 0 },
      { id: "rdl-picklist-values", label: "Picklist Values", show: detail.controlledValues.length > 0 },
      { id: "rdl-provenance", label: "Provenance", show: true },
    ];
    return items.filter((item) => item.show);
  }, [detail, labels.relatedClasses, labels.usedByClasses]);

  if (state.status === "loading") return <div className="content-page"><div role="status" className="rdl-search-state">Loading release-aware RDL entity detail…</div></div>;
  if (state.status === "error") return <div className="content-page"><div role="alert" className="rdl-search-state"><strong>RDL entity detail could not be loaded</strong><span>{state.message}</span><Link to="/search">Return to global search</Link></div></div>;
  if (state.status === "missing" || !detail || !source || !release) return <div className="content-page"><div className="rdl-search-state"><strong>RDL entity not found in this release</strong><Link to="/search">Return to global search</Link></div></div>;

  const record = detail.record;
  const sectionKey = `${record.sourceKey}:${record.releaseKey}:${record.entityType}:${record.nativeIdentifier}`;
  return <div className="content-page rdl-entity-page rdl-rich-entity-page">
    <Link className="rdl-back-link" to={`/search?source=${encodeURIComponent(record.sourceKey)}&release=${encodeURIComponent(record.releaseKey)}&q=${encodeURIComponent(record.nativeIdentifier)}`}><ArrowLeft size={16} />Back to search</Link>

    <header className="rdl-entity-hero">
      <div><div className="eyebrow">{entityTypeLabel(record.entityType)}</div><h1>{record.name || record.nativeIdentifier}</h1><code>{record.nativeIdentifier}</code></div>
      <div className="rdl-entity-source"><Database size={19} /><div><small>RDL SOURCE</small><strong>{source.name}</strong><span>{release.versionLabel} · {release.status}</span></div></div>
    </header>

    <nav className="rdl-detail-contents" aria-label="On this page">
      <span>On this page</span>
      <div>{sections.map((section) => <a key={section.id} href={`#${section.id}`}>{section.label}</a>)}</div>
    </nav>

    <section className="rdl-detail-section" id="rdl-definition" aria-labelledby="rdl-definition-heading">
      <h2 id="rdl-definition-heading">Definition</h2>
      <p className="rdl-detail-definition">{record.definition || "No definition is supplied for this source record."}</p>
    </section>

    <section className="rdl-detail-section" id="rdl-classification" aria-labelledby="rdl-classification-heading">
      <h2 id="rdl-classification-heading">Classification</h2>
      <dl className="rdl-detail-classification">{detail.classification.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>
    </section>

    {(detail.hierarchy.parents.length > 0 || detail.hierarchy.children.length > 0) && <section className="rdl-detail-section" id="rdl-hierarchy" aria-labelledby="rdl-hierarchy-heading">
      <h2 id="rdl-hierarchy-heading">Hierarchy</h2>
      <div className="rdl-detail-hierarchy"><HierarchyLinks title="Parent" items={detail.hierarchy.parents} /><HierarchyLinks title="Children" items={detail.hierarchy.children} /></div>
    </section>}

    <RdlRelationshipSection key={`${sectionKey}:properties`} id="rdl-properties" title="Properties" items={detail.properties} />
    <RdlRelationshipSection key={`${sectionKey}:units`} id="rdl-units-of-measure" title="Units of Measure" items={detail.unitsOfMeasure} />
    <RdlRelationshipSection key={`${sectionKey}:values`} id="rdl-allowed-values" title="Allowed Values" items={detail.allowedValues} />
    <RdlRelationshipSection key={`${sectionKey}:related`} id="rdl-related-classes" title={labels.relatedClasses} items={detail.relatedClasses} />
    <RdlRelationshipSection key={`${sectionKey}:used-by`} id="rdl-used-by-classes" title={labels.usedByClasses} items={detail.usedByClasses} />
    <RdlRelationshipSection key={`${sectionKey}:required-docs`} id="rdl-required-documents" title="Required Documents" items={detail.requiredDocuments} />
    <RdlRelationshipSection key={`${sectionKey}:required-by`} id="rdl-required-by-classes" title="Required by Classes" items={detail.requiredByClasses} />
    <RdlRelationshipSection key={`${sectionKey}:disciplines`} id="rdl-disciplines" title="Discipline Requirements" items={detail.disciplines} />
    <RdlRelationshipSection key={`${sectionKey}:documents`} id="rdl-document-types" title="Document Types" items={detail.documentTypes} />
    <RdlRelationshipSection key={`${sectionKey}:information`} id="rdl-information-requirements" title="Information Requirements" items={detail.informationRequirements} />
    <RdlRelationshipSection key={`${sectionKey}:standards`} id="rdl-source-standards" title="Source Standards" items={detail.sourceStandards} />
    <RdlRelationshipSection key={`${sectionKey}:property-mappings`} id="rdl-property-mappings" title="Property Mappings" items={detail.propertyMappings} />
    <RdlRelationshipSection key={`${sectionKey}:picklist-values`} id="rdl-picklist-values" title="Picklist Values" items={detail.controlledValues} />

    <section className="rdl-detail-section" id="rdl-provenance" aria-labelledby="rdl-provenance-heading">
      <h2 id="rdl-provenance-heading">Provenance</h2>
      <dl className="rdl-detail-provenance">
        <dt>Source</dt><dd>{record.sourceName}</dd>
        <dt>Release</dt><dd>{record.versionLabel} · {record.releaseStatus}</dd>
        <dt>Release key</dt><dd><code>{record.releaseKey}</code></dd>
        <dt>Package</dt><dd><code>{record.packageKey}</code></dd>
        <dt>Source sheet</dt><dd>{record.sourceSheet}</dd>
        <dt>Entity type</dt><dd>{entityTypeLabel(record.entityType)}</dd>
      </dl>
    </section>

    <div className="rdl-provenance-note"><FileSearch size={19} /><div><strong>Release-isolated rich detail</strong><p>Every entity and relationship on this page is resolved inside <code>{record.releaseKey}</code> and <code>{record.packageKey}</code>. Historical and successor packages cannot silently leak into this view.</p></div></div>
  </div>;
}
