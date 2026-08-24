import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Columns3,
  FileText,
  LoaderCircle,
  Rows3,
  XCircle,
} from "lucide-react";
import {
  inspectCfihosWorksheet,
  type CfihosWorksheetInspection,
} from "../cfihos/workbook";
import {
  cfihosDocumentRepository,
} from "../cfihos/repository/CfihosDocumentRepository";
import type {
  CfihosDocumentDomainDiagnostics,
} from "../cfihos/model/document";

const SHEETS = [
  "discipline",
  "document type",
  "discipline document type",
] as const;

type LoadState =
  | { status: "loading" }
  | {
      status: "success";
      inspections: CfihosWorksheetInspection[];
      diagnostics: CfihosDocumentDomainDiagnostics;
    }
  | { status: "error"; message: string };

export function DocumentSchemaInspectionPage() {
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

            cfihosDocumentRepository.getDiagnostics(),
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
              : "Unable to inspect the document domain worksheets.",
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

        <h1>Documents & Disciplines</h1>

        <div className="placeholder-panel">
          <LoaderCircle
            className="spin"
            size={22}
          />

          <div>
            <strong>
              Inspecting CFIHOS document domain
            </strong>

            <span>
              Reading worksheets and validating
              relationships…
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

        <h1>Documents & Disciplines</h1>

        <div className="placeholder-panel">
          <XCircle size={22} />

          <div>
            <strong>
              Unable to inspect document domain
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

      <h1>Documents & Disciplines</h1>

      <p>
        Validating the official CFIHOS Document Type,
        Discipline and Discipline Document Type
        relationship model before enabling the
        production browsers.
      </p>

      <div className="placeholder-panel">
        <FileText size={22} />

        <div>
          <strong>
            Document domain loaded successfully
          </strong>

          <span>
            Validated the shared Document and
            Discipline repository against the
            official workbook.
          </span>
        </div>
      </div>

      <DocumentDiagnostics
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

type DocumentDiagnosticsProps = {
  diagnostics: CfihosDocumentDomainDiagnostics;
};

function DocumentDiagnostics({
  diagnostics,
}: DocumentDiagnosticsProps) {
  const hasReferenceIssues =
    diagnostics.unresolvedDisciplineCount >
      0 ||
    diagnostics.unresolvedDocumentTypeCount >
      0;

  const hasWarnings =
    hasReferenceIssues ||
    diagnostics.duplicateDisciplineCodeCount >
      0 ||
    diagnostics
      .duplicateDocumentTypeShortCodeCount >
      0;

  return (
    <section style={sectionStyle}>
      <div style={diagnosticHeadingStyle}>
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              marginBottom: 6,
            }}
          >
            <FileText size={19} />

            <strong>
              Document domain diagnostics
            </strong>
          </div>

          <div style={diagnosticDescriptionStyle}>
            Referential integrity and indexing checks
            across Discipline, Document Type and
            Discipline Document Type.
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

      <div style={metricGridStyle}>
        <DiagnosticMetric
          label="Disciplines"
          value={
            diagnostics.disciplineCount
          }
        />

        <DiagnosticMetric
          label="Document Types"
          value={
            diagnostics.documentTypeCount
          }
        />

        <DiagnosticMetric
          label="Relationships"
          value={
            diagnostics.relationshipCount
          }
        />

        <DiagnosticMetric
          label="Unresolved disciplines"
          value={
            diagnostics.unresolvedDisciplineCount
          }
          warning={
            diagnostics.unresolvedDisciplineCount >
            0
          }
        />

        <DiagnosticMetric
          label="Unresolved document types"
          value={
            diagnostics.unresolvedDocumentTypeCount
          }
          warning={
            diagnostics
              .unresolvedDocumentTypeCount >
            0
          }
        />

        <DiagnosticMetric
          label="Duplicate discipline codes"
          value={
            diagnostics
              .duplicateDisciplineCodeCount
          }
          warning={
            diagnostics
              .duplicateDisciplineCodeCount >
            0
          }
        />

        <DiagnosticMetric
          label="Duplicate document codes"
          value={
            diagnostics
              .duplicateDocumentTypeShortCodeCount
          }
          warning={
            diagnostics
              .duplicateDocumentTypeShortCodeCount >
            0
          }
        />

        <DiagnosticMetric
          label="Orphan Document Types"
          value={
            diagnostics.orphanDocumentTypeCount
          }
        />

        <DiagnosticMetric
          label="Orphan Disciplines"
          value={
            diagnostics.orphanDisciplineCount
          }
        />
      </div>

      {(diagnostics.orphanDocumentTypeCount >
        0 ||
        diagnostics.orphanDisciplineCount >
          0) && (
        <div style={orphanNoteStyle}>
          <strong>Note:</strong> orphan records are
          not necessarily invalid. They represent
          master-data records that currently have no
          Discipline Document Type relationship.
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
            Document domain schema
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
  marginBottom: 24,
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

const metricGridStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 10,
};

const orphanNoteStyle = {
  marginTop: 18,
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