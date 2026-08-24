import {
  ChevronRight,
  Hash,
  X,
} from "lucide-react";
import type {
  CfihosDisciplineDocumentType,
} from "../../cfihos/model/document";
import "./DisciplineDocumentTypeDrawer.css";

type DisciplineDocumentTypeDrawerProps = {
  relationship: CfihosDisciplineDocumentType;
  onClose: () => void;
  onOpenDiscipline?: (
    disciplineId: string,
  ) => void;
  onOpenDocumentType?: (
    documentTypeId: string,
  ) => void;
};

export function DisciplineDocumentTypeDrawer({
  relationship,
  onClose,
  onOpenDiscipline,
  onOpenDocumentType,
}: DisciplineDocumentTypeDrawerProps) {
  return (
    <div
      className="document-relationship-drawer-layer"
      role="presentation"
      onMouseDown={onClose}
    >
      <aside
        className="document-relationship-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`Discipline Document Type: ${relationship.documentTypeName}`}
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        <header className="document-relationship-drawer-header">
          <div>
            <div className="document-relationship-eyebrow">
              Discipline Document Type
            </div>

            <h2>
              {relationship.documentTypeName}
            </h2>

            <div className="document-relationship-id">
              <Hash size={13} />
              {relationship.id}
            </div>
          </div>

          <button
            type="button"
            className="document-relationship-drawer-close"
            onClick={onClose}
            aria-label="Close relationship details"
          >
            <X size={18} />
          </button>
        </header>

        <div className="document-relationship-drawer-body">
          {relationship.documentTypeDescription && (
            <p className="document-relationship-description">
              {
                relationship.documentTypeDescription
              }
            </p>
          )}

          <DrawerSection title="Relationship">
            <DrawerRow label="Discipline">
              {onOpenDiscipline ? (
                <button
                  type="button"
                  className="document-relationship-link"
                  onClick={() =>
                    onOpenDiscipline(
                      relationship.disciplineId,
                    )
                  }
                >
                  <span>
                    {
                      relationship.disciplineCode
                    }{" "}
                    ·{" "}
                    {
                      relationship.disciplineName
                    }
                  </span>

                  <ChevronRight size={13} />
                </button>
              ) : (
                <>
                  {relationship.disciplineCode} ·{" "}
                  {relationship.disciplineName}
                </>
              )}
            </DrawerRow>

            <DrawerRow label="Document Type">
              {onOpenDocumentType ? (
                <button
                  type="button"
                  className="document-relationship-link"
                  onClick={() =>
                    onOpenDocumentType(
                      relationship.documentTypeId,
                    )
                  }
                >
                  <span>
                    {
                      relationship.documentTypeShortCode
                    }{" "}
                    ·{" "}
                    {
                      relationship.documentTypeName
                    }
                  </span>

                  <ChevronRight size={13} />
                </button>
              ) : (
                <>
                  {
                    relationship.documentTypeShortCode
                  }{" "}
                  · {relationship.documentTypeName}
                </>
              )}
            </DrawerRow>

            <DrawerRow label="Context code">
              {
                relationship.disciplineDocumentTypeShortCode ??
                "Not specified"
              }
            </DrawerRow>

            <DrawerRow label="Asset type">
              {displayValue(
                relationship.assetTypeReference,
              )}
            </DrawerRow>

            <DrawerRow label="Representation">
              {displayValue(
                relationship.representationType,
              )}
            </DrawerRow>
          </DrawerSection>

          <DrawerSection title="Delivery">
            <DrawerRow label="Native file timing">
              {displayValue(
                relationship.nativeFileDeliveryTiming,
              )}
            </DrawerRow>

            <DrawerRow label="Native format">
              {displayValue(
                relationship.nativeDocumentFormat,
              )}
            </DrawerRow>

            <DrawerRow label="Authenticated record">
              {displayValue(
                relationship.authenticatedRecordFormat,
              )}
            </DrawerRow>

            <DrawerRow label="Hardcopy required">
              {displayNullableBoolean(
                relationship.hardcopyRequired,
              )}
            </DrawerRow>

            <DrawerRow label="Translation required">
              {displayNullableBoolean(
                relationship.translatedDocumentRequired,
              )}
            </DrawerRow>
          </DrawerSection>

          <DrawerSection title="Lifecycle requirements">
            <LifecycleRow
              label="Detailed engineering"
              value={
                relationship.requiredStatusDetailedEngineering
              }
            />

            <LifecycleRow
              label="Construction"
              value={
                relationship.requiredStatusConstruction
              }
            />

            <LifecycleRow
              label="Commissioning"
              value={
                relationship.requiredStatusCommissioning
              }
            />

            <LifecycleRow
              label="Startup"
              value={
                relationship.requiredStatusStartup
              }
            />

            <LifecycleRow
              label="Operations"
              value={
                relationship.requiredStatusOperations
              }
            />
          </DrawerSection>

          <DrawerSection title="Review">
            <DrawerRow label="Review type">
              {displayValue(
                relationship.reviewType,
              )}
            </DrawerRow>

            <DrawerRow label="Comment">
              {relationship.comment ? (
                <span className="document-relationship-multiline">
                  {relationship.comment}
                </span>
              ) : (
                "None"
              )}
            </DrawerRow>
          </DrawerSection>

          <DrawerSection title="Reference">
            <DrawerRow label="Synonyms">
              {relationship.synonyms.length >
              0
                ? relationship.synonyms.join(
                    ", ",
                  )
                : "None"}
            </DrawerRow>
          </DrawerSection>
        </div>
      </aside>
    </div>
  );
}

type DrawerSectionProps = {
  title: string;
  children: React.ReactNode;
};

function DrawerSection({
  title,
  children,
}: DrawerSectionProps) {
  return (
    <section className="document-relationship-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

type DrawerRowProps = {
  label: string;
  children: React.ReactNode;
};

function DrawerRow({
  label,
  children,
}: DrawerRowProps) {
  return (
    <div className="document-relationship-row">
      <div className="document-relationship-row-label">
        {label}
      </div>

      <div className="document-relationship-row-value">
        {children}
      </div>
    </div>
  );
}

type LifecycleRowProps = {
  label: string;
  value: string | null;
};

function LifecycleRow({
  label,
  value,
}: LifecycleRowProps) {
  return (
    <DrawerRow label={label}>
      <span
        className={`document-lifecycle-status ${
          isSpecified(value)
            ? "document-lifecycle-status-active"
            : ""
        }`}
      >
        {displayValue(value)}
      </span>
    </DrawerRow>
  );
}

function displayNullableBoolean(
  value: boolean | null,
): string {
  if (value === null) {
    return "Not specified";
  }

  return value ? "Yes" : "No";
}

function displayValue(
  value: string | null,
): string {
  if (!value) {
    return "Not specified";
  }

  const normalized =
    value.trim().toLowerCase();

  if (
    normalized === "" ||
    normalized === "-" ||
    normalized === "—"
  ) {
    return "Not specified";
  }

  return value;
}

function isSpecified(
  value: string | null,
): boolean {
  if (!value) {
    return false;
  }

  const normalized =
    value.trim().toLowerCase();

  return ![
    "",
    "-",
    "—",
    "not specified",
    "not applicable",
  ].includes(normalized);
}