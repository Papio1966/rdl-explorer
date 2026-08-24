import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Info,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import "./ValidationPage.css";

type ValidationStatus = "validated" | "finding" | "observation" | "closed";
type MetricTone = "normal" | "attention";

type ValidationMetric = {
  value: string;
  label: string;
  tone: MetricTone;
};

type ValidationItem = {
  title: string;
  summary: string;
  evidence: string[];
  status: ValidationStatus;
};

type ValidationSectionData = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  items: ValidationItem[];
};

type ValidationSnapshot = {
  schemaVersion: number;
  source: {
    standard: string;
    workbook: string;
    workbookUrl: string;
    validatedAt: string;
    scope: string;
  };
  summary: ValidationMetric[];
  sections: ValidationSectionData[];
};

const statusMeta: Record<ValidationStatus, { label: string; icon: typeof CheckCircle2 }> = {
  validated: { label: "Validated", icon: CheckCircle2 },
  finding: { label: "Data quality finding", icon: AlertTriangle },
  observation: { label: "Observation", icon: Info },
  closed: { label: "Investigated / explained", icon: CheckCircle2 },
};

function ValidationCard({ item }: { item: ValidationItem }) {
  const [open, setOpen] = useState(false);
  const meta = statusMeta[item.status];
  const Icon = meta.icon;

  return (
    <article className={`validation-card validation-card-${item.status}`}>
      <div className="validation-card-main">
        <div className={`validation-card-icon validation-card-icon-${item.status}`}>
          <Icon size={18} strokeWidth={2} />
        </div>
        <div className="validation-card-copy">
          <div className="validation-card-topline">
            <h3>{item.title}</h3>
            <span className={`validation-status validation-status-${item.status}`}>{meta.label}</span>
          </div>
          <p>{item.summary}</p>
        </div>
        <button
          type="button"
          className="validation-evidence-button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Hide evidence" : "View evidence"}
          <ChevronDown className={open ? "validation-chevron-open" : ""} size={16} />
        </button>
      </div>

      {open && (
        <div className="validation-evidence">
          <div className="validation-evidence-label">Evidence</div>
          <ul>
            {item.evidence.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

function ValidationSection({ section }: { section: ValidationSectionData }) {
  return (
    <section className="validation-section">
      <div className="validation-section-heading">
        <div>
          <div className="validation-eyebrow">{section.eyebrow}</div>
          <h2>{section.title}</h2>
          <p>{section.description}</p>
        </div>
        <span className="validation-section-count">{section.items.length}</span>
      </div>
      <div className="validation-card-list">
        {section.items.map((item) => (
          <ValidationCard key={item.title} item={item} />
        ))}
      </div>
    </section>
  );
}

function formatValidationDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function ValidationPage() {
  const [snapshot, setSnapshot] = useState<ValidationSnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadSnapshot() {
      try {
        const response = await fetch("/validation-snapshot.json", {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = (await response.json()) as ValidationSnapshot;
        setSnapshot(data);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        const message = error instanceof Error ? error.message : "Unknown error";
        setLoadError(message);
      }
    }

    void loadSnapshot();

    return () => controller.abort();
  }, []);

  if (loadError) {
    return (
      <div className="validation-page">
        <section className="validation-hero">
          <div className="validation-hero-icon">
            <AlertTriangle size={27} strokeWidth={1.9} />
          </div>
          <div className="validation-hero-copy">
            <div className="validation-eyebrow">Reference-data assurance</div>
            <h1>Validation snapshot unavailable</h1>
            <p>
              The Explorer could not load the published validation snapshot. The reference-data
              browser remains available, but validation evidence cannot be displayed at this time.
            </p>
            <p>
              <strong>Load error:</strong> {loadError}
            </p>
          </div>
        </section>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="validation-page">
        <section className="validation-hero">
          <div className="validation-hero-icon">
            <ShieldCheck size={27} strokeWidth={1.9} />
          </div>
          <div className="validation-hero-copy">
            <div className="validation-eyebrow">Reference-data assurance</div>
            <h1>Loading validation snapshot…</h1>
            <p>Loading the published CFIHOS validation evidence.</p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="validation-page">
      <section className="validation-hero">
        <div className="validation-hero-icon">
          <ShieldCheck size={27} strokeWidth={1.9} />
        </div>
        <div className="validation-hero-copy">
          <div className="validation-eyebrow">Reference-data assurance</div>
          <h1>CFIHOS Model Validation</h1>
          <p>
            Structural and referential-integrity validation of the {snapshot.source.standard}
            Reference Data Library used by the Explorer. Results distinguish validated model
            behaviour from upstream data-quality findings and clarification items.
          </p>
        </div>
        <div className="validation-snapshot-badge">
          <CircleDot size={14} />
          Audit snapshot
        </div>
      </section>

      <section className="validation-metrics" aria-label="Validation summary">
        {snapshot.summary.map((metric) => (
          <div
            key={metric.label}
            className={`validation-metric${metric.tone === "attention" ? " validation-metric-attention" : ""}`}
          >
            <strong>{metric.value}</strong>
            <span>{metric.label}</span>
          </div>
        ))}
      </section>

      <div className="validation-note">
        <Info size={17} />
        <div>
          <strong>How to read this page</strong>
          <p>
            “Validated” means the relevant CFIHOS relationships reconcile against the supplied CORE
            workbook. Findings are reported without silently repairing the source data. Observations
            identify areas where modelling intent may warrant clarification. The engineering
            <code>/source</code> console remains separate from this reviewer-facing summary.
          </p>
        </div>
      </div>

      {snapshot.sections.map((section) => (
        <ValidationSection key={section.id} section={section} />
      ))}

      <footer className="validation-footer">
        <ShieldCheck size={18} />
        <div>
          <strong>Validation provenance</strong>
          <span>
            {snapshot.source.standard} · {snapshot.source.workbook} · snapshot generated from the
            validation completed {formatValidationDate(snapshot.source.validatedAt)}. CFIHOS/JIP36
            remains the authoritative source for the standard and reference data.
          </span>
        </div>
      </footer>
    </div>
  );
}
