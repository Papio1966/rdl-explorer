import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Columns3,
  Database,
  LoaderCircle,
  Rows3,
  XCircle,
} from "lucide-react";
import {
  inspectCfihosWorksheet,
  type CfihosWorksheetInspection,
} from "../cfihos/workbook";
import {
  cfihosSourceStandardRepository,
} from "../cfihos/repository/CfihosSourceStandardRepository";
import type {
  CfihosSourceStandardDiagnostics,
} from "../cfihos/model/sourceStandard";

const SHEETS = [
  "source standard",
  "CFIHOS object equivalent mappin",
  "tag class",
  "equipment class",
  "tag or equip class src standard",
  "tag equip class prop src std",
  "property picklist values",
] as const;

type LoadState =
  | { status: "loading" }
  | {
      status: "success";
      inspections: CfihosWorksheetInspection[];
      diagnostics: CfihosSourceStandardDiagnostics;
    }
  | {
      status: "error";
      message: string;
    };

export function SourceStandardsInspectionPage() {
  const [state, setState] = useState<LoadState>({
    status: "loading",
  });

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [inspections, diagnostics] =
          await Promise.all([
            Promise.all(
              SHEETS.map((sheetName) =>
                inspectCfihosWorksheet(
                  sheetName,
                  5,
                ),
              ),
            ),

            cfihosSourceStandardRepository.getDiagnostics(),
          ]);

        if (!active) {
          return;
        }

        setState({
          status: "success",
          inspections,
          diagnostics,
        });
      } catch (error) {
        if (!active) {
          return;
        }

        setState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unable to inspect the Source Standards domain.",
        });
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  if (state.status === "loading") {
    return (
      <div
        className="placeholder-page"
        style={pageStyle}
      >
        <div className="eyebrow">
          Schema inspection
        </div>

        <h1>Source Standards</h1>

        <p>
          Inspecting the CFIHOS Source Standards
          domain and validating its relationships to
          classes, properties and picklist values.
        </p>

        <div className="placeholder-panel">
          <LoaderCircle
            className="spin"
            size={22}
          />

          <div>
            <strong>
              Inspecting Source Standards
            </strong>

            <span>
              Reading worksheets, resolving class
              domains and validating references…
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div
        className="placeholder-page"
        style={pageStyle}
      >
        <div className="eyebrow">
          Schema inspection
        </div>

        <h1>Source Standards</h1>

        <div className="placeholder-panel">
          <XCircle size={22} />

          <div>
            <strong>
              Unable to inspect Source Standards
            </strong>

            <span>{state.message}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="placeholder-page"
      style={pageStyle}
    >
      <div className="eyebrow">
        Schema inspection
      </div>

      <h1>Source Standards</h1>

      <p>
        Validating the official CFIHOS Source
        Standards domain before enabling the
        production reference-standard browser and
        traceability views.
      </p>

      <div className="placeholder-panel">
        <Database size={22} />

        <div>
          <strong>
            Source Standards domain loaded
          </strong>

          <span>
            Validated standards, class references,
            property provenance and picklist-value
            source references.
          </span>
        </div>
      </div>

      <SourceStandardDiagnosticsPanel
        diagnostics={state.diagnostics}
      />

      {state.inspections.map((inspection) => (
        <WorksheetInspection
          key={inspection.sheetName}
          inspection={inspection}
        />
      ))}

      <div style={{ height: 48 }} />
    </div>
  );
}

type SourceStandardDiagnosticsPanelProps = {
  diagnostics: CfihosSourceStandardDiagnostics;
};

function SourceStandardDiagnosticsPanel({
  diagnostics,
}: SourceStandardDiagnosticsPanelProps) {
  const hasReferenceIssues =
    diagnostics
      .unresolvedStandardClassRelationshipCount >
      0 ||
    diagnostics
      .unresolvedStandardPropertyRelationshipCount >
      0 ||
    diagnostics
      .unresolvedStandardPicklistReferenceCount >
      0;

  const hasClassResolutionIssues =
    diagnostics.unknownClassRelationshipCount >
      0 ||
    diagnostics
      .unknownClassPropertyRelationshipCount >
      0;

  const hasWarnings =
    hasReferenceIssues ||
    hasClassResolutionIssues;

  return (
    <section style={sectionStyle}>
      <div style={diagnosticHeadingStyle}>
        <div>
          <div style={diagnosticTitleStyle}>
            <Database size={19} />

            <strong>
              Source Standards diagnostics
            </strong>
          </div>

          <div style={diagnosticDescriptionStyle}>
            Referential integrity and class-domain
            resolution across standards, classes,
            class properties and picklist values.
          </div>
        </div>

        <div
          style={{
            ...statusBadgeStyle,
            background: hasWarnings
              ? "#fff4e5"
              : "var(--brand-soft)",
            color: hasWarnings
              ? "#9a6414"
              : "var(--brand-dark)",
          }}
        >
          {hasWarnings ? (
            <>
              <AlertTriangle size={15} />
              Review required
            </>
          ) : (
            <>
              <CheckCircle2 size={15} />
              Domain valid
            </>
          )}
        </div>
      </div>

      <div style={diagnosticGroupStyle}>
        <div style={diagnosticGroupHeadingStyle}>
          Domain size
        </div>

        <div style={metricGridStyle}>
          <DiagnosticMetric
            label="Source Standards"
            value={
              diagnostics.sourceStandardCount
            }
          />

          <DiagnosticMetric
            label="Class → Standard"
            value={
              diagnostics.classRelationshipCount
            }
          />

          <DiagnosticMetric
            label="Class → Property → Standard"
            value={
              diagnostics.propertyRelationshipCount
            }
          />

          <DiagnosticMetric
            label="Picklist value references"
            value={
              diagnostics.picklistValueReferenceCount
            }
          />
        </div>
      </div>

      <div style={diagnosticGroupStyle}>
        <div style={diagnosticGroupHeadingStyle}>
          Class-domain resolution
        </div>

        <div style={metricGridStyle}>
          <DiagnosticMetric
            label="Tag Class → Standard"
            value={
              diagnostics.tagClassRelationshipCount
            }
          />

          <DiagnosticMetric
            label="Equipment Class → Standard"
            value={
              diagnostics
                .equipmentClassRelationshipCount
            }
          />

          <DiagnosticMetric
            label="Unknown class → Standard"
            value={
              diagnostics
                .unknownClassRelationshipCount
            }
            warning={
              diagnostics
                .unknownClassRelationshipCount >
              0
            }
          />

          <DiagnosticMetric
            label="Tag Class property provenance"
            value={
              diagnostics
                .tagClassPropertyRelationshipCount
            }
          />

          <DiagnosticMetric
            label="Equipment property provenance"
            value={
              diagnostics
                .equipmentClassPropertyRelationshipCount
            }
          />

          <DiagnosticMetric
            label="Unknown property class"
            value={
              diagnostics
                .unknownClassPropertyRelationshipCount
            }
            warning={
              diagnostics
                .unknownClassPropertyRelationshipCount >
              0
            }
          />
        </div>
      </div>

      <div style={diagnosticGroupStyle}>
        <div style={diagnosticGroupHeadingStyle}>
          Referential integrity
        </div>

        <div style={metricGridStyle}>
          <DiagnosticMetric
            label="Unresolved class standards"
            value={
              diagnostics
                .unresolvedStandardClassRelationshipCount
            }
            warning={
              diagnostics
                .unresolvedStandardClassRelationshipCount >
              0
            }
          />

          <DiagnosticMetric
            label="Unresolved property standards"
            value={
              diagnostics
                .unresolvedStandardPropertyRelationshipCount
            }
            warning={
              diagnostics
                .unresolvedStandardPropertyRelationshipCount >
              0
            }
          />

          <DiagnosticMetric
            label="Unresolved picklist standards"
            value={
              diagnostics
                .unresolvedStandardPicklistReferenceCount
            }
            warning={
              diagnostics
                .unresolvedStandardPicklistReferenceCount >
              0
            }
          />

          <DiagnosticMetric
            label="Standards without usage"
            value={
              diagnostics
                .standardsWithoutUsageCount
            }
          />
        </div>
      </div>

      {diagnostics.standardsWithoutUsageCount >
        0 && (
        <div style={noteStyle}>
          <strong>Note:</strong> standards without
          usage are not necessarily invalid. They
          exist in the Source Standard master data
          but currently have no class, property or
          picklist-value reference in the inspected
          CFIHOS relationships.
        </div>
      )}
    </section>
  );
}

type DiagnosticMetricProps = {
  label: string;
  value: number;
  warning?: boolean;
};

function DiagnosticMetric({
  label,
  value,
  warning = false,
}: DiagnosticMetricProps) {
  return (
    <div
      style={{
        padding: "15px 16px",
        border: "1px solid var(--line)",
        borderRadius: 9,
        background: warning
          ? "#fffaf2"
          : "#f8faf9",
      }}
    >
      <div
        style={{
          color: warning
            ? "#9a6414"
            : "var(--ink)",
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "-0.03em",
        }}
      >
        {value}
      </div>

      <div
        style={{
          marginTop: 3,
          color: "var(--muted)",
          fontSize: 10.5,
          fontWeight: 600,
          lineHeight: 1.35,
        }}
      >
        {label}
      </div>
    </div>
  );
}

type WorksheetInspectionProps = {
  inspection: CfihosWorksheetInspection;
};

function WorksheetInspection({
  inspection,
}: WorksheetInspectionProps) {
  return (
    <section style={sectionStyle}>
      <div style={headingStyle}>
        <div>
          <div style={eyebrowStyle}>
            Source Standards schema
          </div>

          <h2 style={titleStyle}>
            {inspection.sheetName}
          </h2>
        </div>

        <div style={statsStyle}>
          <span style={statStyle}>
            <Columns3 size={16} />
            {inspection.headers.length} columns
          </span>

          <span style={statStyle}>
            <Rows3 size={16} />
            {inspection.rowCount} rows
          </span>
        </div>
      </div>

      <div style={{ marginBottom: 28 }}>
        <div style={subheadingStyle}>
          Column headers
        </div>

        <div style={headerListStyle}>
          {inspection.headers.map((header) => (
            <span
              key={header}
              style={headerChipStyle}
            >
              {header}
            </span>
          ))}
        </div>
      </div>

      <div>
        <div style={subheadingStyle}>
          First {inspection.sampleRows.length} rows
        </div>

        <div style={tableWrapperStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                {inspection.headers.map(
                  (header) => (
                    <th
                      key={header}
                      style={tableHeaderStyle}
                    >
                      {header}
                    </th>
                  ),
                )}
              </tr>
            </thead>

            <tbody>
              {inspection.sampleRows.map(
                (row, rowIndex) => (
                  <tr key={rowIndex}>
                    {inspection.headers.map(
                      (header) => (
                        <td
                          key={header}
                          style={{
                            ...tableCellStyle,
                            borderBottom:
                              rowIndex <
                              inspection.sampleRows
                                .length -
                                1
                                ? "1px solid var(--line)"
                                : "none",
                          }}
                        >
                          {formatCellValue(
                            row[header],
                          )}
                        </td>
                      ),
                    )}
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

const pageStyle = {
  boxSizing: "border-box" as const,
  width: "100%",
  minHeight: "100%",
  paddingBottom: 48,
};

const sectionStyle = {
  marginTop: 32,
  width: "100%",
  maxWidth: 1200,
  padding: 24,
  boxSizing: "border-box" as const,
  border: "1px solid var(--line)",
  borderRadius: 12,
  background: "white",
};

const diagnosticHeadingStyle = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 24,
  marginBottom: 26,
};

const diagnosticTitleStyle = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  marginBottom: 6,
};

const diagnosticDescriptionStyle = {
  color: "var(--muted)",
  fontSize: 12.5,
  lineHeight: 1.55,
};

const statusBadgeStyle = {
  display: "inline-flex",
  flex: "0 0 auto",
  alignItems: "center",
  gap: 7,
  padding: "7px 10px",
  borderRadius: 8,
  fontSize: 11,
  fontWeight: 700,
};

const diagnosticGroupStyle = {
  marginTop: 24,
};

const diagnosticGroupHeadingStyle = {
  marginBottom: 10,
  color: "#485652",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase" as const,
};

const metricGridStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 10,
};

const noteStyle = {
  marginTop: 20,
  padding: "12px 14px",
  borderRadius: 8,
  background: "#f7f9f8",
  color: "var(--muted)",
  fontSize: 11.5,
  lineHeight: 1.55,
};

const headingStyle = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 24,
  marginBottom: 24,
};

const eyebrowStyle = {
  marginBottom: 6,
  color: "var(--brand)",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase" as const,
};

const titleStyle = {
  margin: 0,
  fontSize: 24,
};

const statsStyle = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 18,
  color: "var(--muted)",
  fontSize: 13,
};

const statStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};

const subheadingStyle = {
  marginBottom: 10,
  fontSize: 12,
  fontWeight: 700,
};

const headerListStyle = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 8,
};

const headerChipStyle = {
  padding: "7px 10px",
  borderRadius: 7,
  background: "var(--brand-soft)",
  color: "var(--brand-dark)",
  fontSize: 12,
  fontWeight: 600,
};

const tableWrapperStyle = {
  width: "100%",
  maxWidth: "100%",
  overflowX: "auto" as const,
  overflowY: "hidden" as const,
  border: "1px solid var(--line)",
  borderRadius: 10,
  WebkitOverflowScrolling: "touch" as const,
};

const tableStyle = {
  width: "max-content",
  minWidth: "100%",
  borderCollapse: "collapse" as const,
  tableLayout: "fixed" as const,
  fontSize: 12,
};

const tableHeaderStyle = {
  width: 170,
  minWidth: 170,
  maxWidth: 170,
  padding: "11px 12px",
  borderBottom: "1px solid var(--line)",
  background: "#f6f8f7",
  color: "#35423f",
  textAlign: "left" as const,
  verticalAlign: "top" as const,
  fontSize: 10.5,
  fontWeight: 700,
  lineHeight: 1.35,
  whiteSpace: "normal" as const,
  overflowWrap: "anywhere" as const,
};

const tableCellStyle = {
  width: 170,
  minWidth: 170,
  maxWidth: 170,
  padding: "11px 12px",
  color: "var(--muted)",
  verticalAlign: "top" as const,
  lineHeight: 1.45,
  whiteSpace: "normal" as const,
  overflowWrap: "anywhere" as const,
};

function formatCellValue(
  value: unknown,
): string {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  if (typeof value === "string") {
    return value;
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}