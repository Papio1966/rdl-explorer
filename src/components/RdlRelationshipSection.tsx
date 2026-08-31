import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import type { RdlDetailLinkedEntity } from "../rdl/entityDetail";

type Props = {
  id: string;
  title: string;
  items: RdlDetailLinkedEntity[];
  emptyText?: string;
};

const COLLAPSED_COUNT = 5;
const DISCLOSURE_THRESHOLD = 10;

function attributeSummary(attributes: Record<string, string>) {
  return Object.entries(attributes)
    .filter(([, value]) => Boolean(value))
    .slice(0, 3);
}

export function RdlRelationshipSection({ id, title, items, emptyText }: Props) {
  const [expanded, setExpanded] = useState(false);
  if (!items.length && !emptyText) return null;
  const canCollapse = items.length > DISCLOSURE_THRESHOLD;
  const visible = canCollapse && !expanded ? items.slice(0, COLLAPSED_COUNT) : items;

  return (
    <section className="rdl-detail-section" id={id} aria-labelledby={`${id}-heading`}>
      <div className="rdl-detail-section-heading">
        <div>
          <h2 id={`${id}-heading`}>{title}</h2>
          {items.length > 0 && <span>{items.length} relationship{items.length === 1 ? "" : "s"}</span>}
        </div>
      </div>
      {items.length ? (
        <div className="rdl-detail-relationship-list">
          {visible.map((item) => {
            const attributes = attributeSummary(item.attributes);
            return (
              <article className="rdl-detail-relationship-card" key={`${id}:${item.key}`}>
                <div className="rdl-detail-relationship-copy">
                  <span className="rdl-entity-type">{item.entityType.replaceAll("_", " ")}</span>
                  <Link to={item.href}>{item.name}</Link>
                  <code>{item.nativeIdentifier}</code>
                  {item.definition && <p>{item.definition}</p>}
                </div>
                <div className="rdl-detail-relationship-meta">
                  <span>{item.relationshipLabel}</span>
                  {attributes.map(([key, value]) => <small key={key}><b>{key.replaceAll("_", " ")}:</b> {value}</small>)}
                </div>
              </article>
            );
          })}
        </div>
      ) : <p className="rdl-detail-empty">{emptyText}</p>}
      {canCollapse && (
        <div className="rdl-detail-disclosure">
          <button type="button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            {expanded ? "Show less" : `Show all ${items.length} ${title.toLowerCase()}`}
          </button>
          {!expanded && <span>Showing the first {COLLAPSED_COUNT}</span>}
        </div>
      )}
    </section>
  );
}
