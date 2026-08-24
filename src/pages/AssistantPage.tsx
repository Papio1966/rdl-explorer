import { useEffect, useState } from "react";
import { AlertTriangle, Bot, ExternalLink, Search, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { cfihosRepository } from "../cfihos/repository/CfihosRepository";
import { cfihosEquipmentRepository } from "../cfihos/repository/CfihosEquipmentRepository";
import { cfihosDocumentRepository } from "../cfihos/repository/CfihosDocumentRepository";
import { cfihosPropertyRepository } from "../cfihos/repository/CfihosPropertyRepository";
import { cfihosSourceStandardRepository } from "../cfihos/repository/CfihosSourceStandardRepository";
import { cfihosClassRelationshipRepository } from "../cfihos/repository/CfihosClassRelationshipRepository";
import "./AssistantPage.css";

type EvidenceRole = "direct" | "relationship" | "candidate";
type Evidence = {
  id: string;
  kind: string;
  title: string;
  detail: string;
  href?: string;
  role?: EvidenceRole;
  source?: "cfihos" | "application";
  actionLabel?: string;
};
type RetrievalStatus = "grounded" | "candidate" | "unsupported";
type DisplayStatus = "grounded" | "interpreted" | "needs-interpretation" | "insufficient";
type RetrievalAnswer = {
  text: string;
  evidence: Evidence[];
  debug: string[];
  status: RetrievalStatus;
};
type Answer = {
  text: string;
  evidence: Evidence[];
  debug: string[];
  status: DisplayStatus;
  generated: boolean;
  notice?: string;
};




type ActiveCisContext = {
  savedAt: string;
  projectName: string;
  contractName: string;
  profileName: string;
  selectedClasses: Array<{ domain?: string; classId?: string; className?: string }>;
  selectedDisciplines: Array<{ disciplineId?: string; disciplineName?: string }>;
  result: any | null;
  overrides: Array<{ id?: string; domain?: string; action?: string; targetKey?: string; targetLabel?: string; baselineValue?: string; contractValue?: string; reason?: string }>;
};

const CIS_DRAFT_STORAGE_KEY = "cfihos-explorer:cis-builder:draft:v1";

type ApplicationCapability = {
  id: string;
  name: string;
  route: string;
  actionLabel: string;
  description: string;
  keywords: string[];
};

const applicationCapabilities: ApplicationCapability[] = [
  {
    id: "cis-builder",
    name: "Contract Information Specification Builder",
    route: "/cis",
    actionLabel: "Open CIS Builder",
    description:
      "Create and continue editing a project-specific Contract Information Specification (CIS). Define project, contract/package and specification identity; select multiple Tag and Equipment Classes and explicit disciplines; generate a locked CFIHOS baseline of asset-data properties, document/data requirements, source standards and lifecycle obligations; review provenance; record Owner/Operator exclusions, changes and additions without mutating the baseline; save/open the editable CIS as JSON; and export an EPC-facing CSV schedule.",
    keywords: [
      "cis",
      "contract information specification",
      "build cis",
      "create cis",
      "new project",
      "contract specification",
      "epc requirements",
      "information specification",
    ],
  },
  {
    id: "validation",
    name: "CFIHOS Model Validation",
    route: "/validation",
    actionLabel: "Open Validation",
    description:
      "Review the validated CFIHOS model areas, evidence, upstream data-quality findings and clarification items used by the Explorer.",
    keywords: ["validation", "validate cfihos", "data quality", "quality findings", "model issues"],
  },
  {
    id: "data-model",
    name: "CFIHOS Data Model",
    route: "/model",
    actionLabel: "Open Data Model",
    description:
      "Explore the CFIHOS reference-data model and how classes, properties, documents, standards and related structures connect.",
    keywords: ["data model", "model relationships", "how cfihos fits", "relationship model"],
  },
  {
    id: "tag-classes",
    name: "Tag Classes",
    route: "/classes/tag",
    actionLabel: "Browse Tag Classes",
    description:
      "Browse CFIHOS Tag Classes, their properties, related Equipment Classes, document requirements, source-standard provenance and other class context.",
    keywords: ["browse tag classes", "tag classes page", "find tag class"],
  },
  {
    id: "equipment-classes",
    name: "Equipment Classes",
    route: "/classes/equipment",
    actionLabel: "Browse Equipment Classes",
    description:
      "Browse CFIHOS Equipment Classes and their class context, properties, relationships, document requirements and provenance.",
    keywords: ["browse equipment classes", "equipment classes page", "find equipment class"],
  },
  {
    id: "lifecycle",
    name: "Lifecycle Requirements",
    route: "/lifecycle",
    actionLabel: "Open Lifecycle Requirements",
    description:
      "Review CFIHOS lifecycle requirements by phase, discipline and document type, including required information-status expectations.",
    keywords: ["lifecycle requirements", "lifecycle phase", "ifd", "ifc", "information status"],
  },
];

const suggestions = [
  "Why is vibration analysis required in my CIS?",
  "What have I changed from the CFIHOS baseline?",
  "I want to build a CIS for a new project. What can I do?",
  "What is an asset reference plan?",
  "What Tag Classes are applicable to mechanical equipment?",
  "Find document types related to datasheets",
  "What does CFIHOS say about centrifugal pumps?",
];

export function AssistantPage() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [busy, setBusy] = useState(false);
  const [debug, setDebug] = useState(false);
  const [activeCis, setActiveCis] = useState<ActiveCisContext | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CIS_DRAFT_STORAGE_KEY);
      if (!raw) return;
      const document = JSON.parse(raw);
      if (document?.schema !== "cfihos-cis-document-v1" || !document.workspace) return;
      const workspace = document.workspace;
      const hasCis = Boolean(workspace.result || workspace.selectedClasses?.length || workspace.projectName?.trim());
      if (!hasCis) return;
      setActiveCis({
        savedAt: document.savedAt ?? "",
        projectName: workspace.projectName ?? "",
        contractName: workspace.contractName ?? "",
        profileName: workspace.profileName ?? "Contract Information Specification",
        selectedClasses: Array.isArray(workspace.selectedClasses) ? workspace.selectedClasses : [],
        selectedDisciplines: Array.isArray(workspace.selectedDisciplines) ? workspace.selectedDisciplines : [],
        result: workspace.result ?? null,
        overrides: Array.isArray(workspace.overrides) ? workspace.overrides : [],
      });
    } catch (error) {
      console.warn("Unable to read the active CIS context.", error);
    }
  }, []);

  async function ask(value = question) {
    const q = value.trim();
    if (!q) return;
    setQuestion(q);
    setBusy(true);
    setAnswer(null);
    try {
      const retrieval = await resolveQuestion(q, activeCis);

      if (retrieval.status === "unsupported") {
        setAnswer({
          ...retrieval,
          status: "insufficient",
          generated: false,
          notice: "No generative call was made because the CFIHOS retrieval layer found no supporting evidence.",
        });
        return;
      }

      try {
        const synthesis = await synthesizeAnswer(q, retrieval, activeCis);
        setAnswer({
          ...retrieval,
          text: synthesis.answer,
          status: retrieval.status === "candidate" ? "interpreted" : "grounded",
          generated: true,
          notice:
            retrieval.status === "candidate"
              ? `AI-interpreted from retrieved CFIHOS 2.0 evidence · Verify against the evidence below · ${synthesis.model}`
              : `AI-synthesized from retrieved CFIHOS 2.0 evidence · Verify against the evidence below · ${synthesis.model}`,
          debug: [
            ...retrieval.debug,
            `GENAI: server-side synthesis`,
            `MODEL: ${synthesis.model}`,
            `SYNTHESIS STATUS: ${retrieval.status === "candidate" ? "interpreted" : "grounded"}`,
          ],
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Generative synthesis is unavailable.";
        setAnswer({
          ...retrieval,
          status: retrieval.status === "candidate" ? "needs-interpretation" : "grounded",
          generated: false,
          notice: `${message} Showing the deterministic retrieval result instead.`,
          debug: [...retrieval.debug, `GENAI FALLBACK: ${message}`],
        });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="assistant-page">
      <div className="assistant-inner">
        <header className="assistant-header">
          <div className="assistant-eyebrow">
            <Sparkles size={15} /> CFIHOS intelligence
          </div>
          <h1>CFIHOS Assistant</h1>
          <p>
            Ask about the CFIHOS reference model or how to use the Explorer. The Assistant retrieves grounded CFIHOS records and application-capability evidence first, then uses a server-side generative model to synthesize an answer without giving the model direct access to the raw workbook or the web.
          </p>
        </header>

        {activeCis && (
          <section className="assistant-cis-context">
            <div>
              <span>Active CIS</span>
              <strong>{activeCis.profileName}</strong>
              <small>
                {activeCis.projectName || "Untitled project"}
                {activeCis.contractName ? ` · ${activeCis.contractName}` : ""}
                {` · ${activeCis.selectedClasses.length} classes · ${activeCis.selectedDisciplines.length} disciplines · ${activeCis.overrides.length} overrides`}
              </small>
            </div>
            <Link to="/cis">Open CIS Builder <ExternalLink size={13} /></Link>
          </section>
        )}

        <section className="assistant-ask">
          <div className="assistant-input">
            <Search size={18} />
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void ask();
              }}
              placeholder="Ask about CFIHOS or what you can do in the Explorer…"
            />
            <button onClick={() => void ask()} disabled={busy || !question.trim()}>
              {busy ? "Searching…" : "Ask"}
            </button>
          </div>
          <div className="assistant-suggestions">
            {suggestions.map((item) => (
              <button key={item} onClick={() => void ask(item)}>
                {item}
              </button>
            ))}
          </div>
        </section>

        {!answer && (
          <section className="assistant-empty">
            <Bot size={30} />
            <h2>Grounded answers first</h2>
            <p>
              The Assistant retrieves CFIHOS evidence and Explorer capability metadata first. When server-side GenAI is configured, the model receives only that retrieved context; otherwise the deterministic retrieval result remains available as a safe fallback.
            </p>
          </section>
        )}

        {answer && (
          <>
            <section className={`assistant-answer ${answer.status}`}>
              <div className="assistant-answer-title">
                {answer.status === "needs-interpretation" || answer.status === "insufficient" ? (
                  <AlertTriangle size={20} />
                ) : (
                  <Bot size={20} />
                )}
                Answer
                <span className={`assistant-answer-status ${answer.status}`}>
                  {answer.status === "grounded"
                    ? "Grounded"
                    : answer.status === "interpreted"
                      ? "Interpreted"
                      : answer.status === "needs-interpretation"
                        ? "Needs interpretation"
                        : "Insufficient evidence"}
                </span>
              </div>
              <div className="assistant-answer-content">
                <ReactMarkdown>{answer.text}</ReactMarkdown>
              </div>
              {answer.notice && (
                <div className={`assistant-answer-note ${answer.generated ? "generated" : "fallback"}`}>
                  {answer.notice}
                </div>
              )}
            </section>

            <section className="assistant-evidence">
              <div className="assistant-section-heading">
                <div>
                  <h2>Evidence</h2>
                  <p>
                    CFIHOS records, relationships and Explorer capabilities used to ground this answer.
                  </p>
                </div>
                <span>{answer.evidence.length}</span>
              </div>
              {answer.evidence.length ? (
                <div className="assistant-evidence-grid">
                  {answer.evidence.map((item) => (
                    <article key={`${item.kind}-${item.id}-${item.role ?? "direct"}`}>
                      <div className="assistant-evidence-labels">
                        <span>{item.kind}</span>
                        {item.role === "candidate" && <em>Candidate context</em>}
                        {item.role === "relationship" && <em>Relationship evidence</em>}
                      </div>
                      <strong>{item.title}</strong>
                      <small>{item.id}</small>
                      <p>{item.detail || "No definition supplied in the source record."}</p>
                      {item.href && (
                        <Link to={item.href} className={item.source === "application" ? "assistant-capability-action" : undefined}>
                          {item.actionLabel ?? "Open in Explorer"} <ExternalLink size={13} />
                        </Link>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="assistant-no-evidence">
                  No matching CFIHOS or Explorer capability evidence was found. The Assistant will not invent an answer.
                </div>
              )}
            </section>

            <section className="assistant-debug">
              <button onClick={() => setDebug((value) => !value)}>
                {debug ? "Hide" : "Show"} retrieved context
              </button>
              {debug && <pre>{answer.debug.join("\n")}</pre>}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

async function synthesizeAnswer(question: string, retrieval: RetrievalAnswer, activeCis: ActiveCisContext | null) {
  const response = await fetch("/api/assistant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      retrievalStatus: retrieval.status,
      cisContext: activeCis ? summarizeCisForModel(activeCis) : undefined,
      evidence: retrieval.evidence.map((item) => ({
        id: item.id,
        kind: item.kind,
        title: item.title,
        detail: item.detail,
        role: item.role ?? "direct",
        source: item.source ?? "cfihos",
        actionLabel: item.actionLabel,
      })),
    }),
  });

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(
      "The GenAI API endpoint is not available in this development server. Use Vercel deployment or `npx vercel dev` for local synthesis.",
    );
  }

  const payload = (await response.json()) as { answer?: string; model?: string; error?: string };
  if (!response.ok || !payload.answer) {
    throw new Error(payload.error || `GenAI synthesis failed (${response.status}).`);
  }

  return { answer: payload.answer, model: payload.model || "configured model" };
}

async function resolveQuestion(question: string, activeCis: ActiveCisContext | null): Promise<RetrievalAnswer> {
  const normalized = question.toLowerCase();
  const debug = [
    `QUESTION: ${question}`,
    "MODE: deterministic CFIHOS + Explorer capability retrieval before server-side synthesis",
  ];

  if (activeCis && isCisContextQuestion(question)) {
    return resolveActiveCisQuestion(question, activeCis, debug);
  }

  const capability = resolveApplicationCapability(question);
  if (capability) {
    debug.push(
      "INTENT: Explorer application guidance",
      `CAPABILITY: ${capability.id} | ${capability.name}`,
      `ROUTE: ${capability.route}`,
    );
    return {
      text: `${capability.name}: ${capability.description}`,
      evidence: [
        {
          id: capability.id,
          kind: "Explorer capability",
          title: capability.name,
          detail: capability.description,
          href: capability.route,
          role: "direct",
          source: "application",
          actionLabel: capability.actionLabel,
        },
      ],
      debug,
      status: "grounded",
    };
  }

  if (
    normalized.includes("tag class") &&
    (normalized.includes("applicable") || normalized.includes("equipment"))
  ) {
    return resolveTagEquipmentQuestion(question, debug);
  }

  const query = terms(question);
  const [tags, equipment, docs, properties, standards] = await Promise.all([
    cfihosRepository.searchTagClasses(query),
    cfihosEquipmentRepository.searchEquipmentClasses(query),
    cfihosDocumentRepository.searchDocumentTypes(query),
    cfihosPropertyRepository.searchProperties(query),
    cfihosSourceStandardRepository.searchSourceStandards(query),
  ]);

  const evidence: Evidence[] = [
    ...tags.slice(0, 5).map((item) => ({
      id: item.id,
      kind: "Tag Class",
      title: item.name,
      detail: item.definition ?? "",
      href: `/classes/tag/${item.id}`,
      role: "direct" as const,
      source: "cfihos" as const,
    })),
    ...equipment.slice(0, 5).map((item) => ({
      id: item.id,
      kind: "Equipment Class",
      title: item.name,
      detail: item.definition ?? "",
      href: `/classes/equipment/${item.id}`,
      role: "direct" as const,
      source: "cfihos" as const,
    })),
    ...docs.slice(0, 5).map((item) => ({
      id: item.id,
      kind: "Document Type",
      title: item.name,
      detail: item.description ?? "",
      href: `/documents/${item.id}`,
      role: "direct" as const,
      source: "cfihos" as const,
    })),
    ...properties.slice(0, 5).map((item) => ({
      id: item.id,
      kind: "Property",
      title: item.name,
      detail: item.definition ?? "",
      href: `/dictionary/${item.id}`,
      role: "direct" as const,
      source: "cfihos" as const,
    })),
    ...standards.slice(0, 5).map((item) => ({
      id: item.id,
      kind: "Source Standard",
      title: item.code,
      detail: item.description ?? "",
      href: `/standards/${item.id}`,
      role: "direct" as const,
      source: "cfihos" as const,
    })),
  ].slice(0, 15);

  debug.push(
    `SEARCH TERMS: ${query}`,
    `EVIDENCE RECORDS: ${evidence.length}`,
    ...evidence.map((item) => `${item.kind} | ${item.id} | ${item.title} | ${item.detail}`),
  );

  if (!evidence.length) {
    return {
      text: "I could not find a CFIHOS record that supports an answer to that question. Try using a CFIHOS name, code, class, document type, property or standard.",
      evidence,
      debug,
      status: "unsupported",
    };
  }

  const exact = evidence.find((item) => item.title.toLowerCase() === query) ?? evidence[0];
  return {
    text: exact.detail
      ? `${exact.title}: ${exact.detail}`
      : `The closest CFIHOS match is ${exact.title} (${exact.id}). The source record does not contain a definition, so I am not adding one.`,
    evidence,
    debug,
    status: "grounded",
  };
}

async function resolveTagEquipmentQuestion(question: string, debug: string[]): Promise<RetrievalAnswer> {
  const requestedScope = subject(question) || "equipment";
  const allEquipment = await cfihosEquipmentRepository.getEquipmentClasses();
  const resolution = resolveEquipmentConcept(allEquipment, requestedScope);

  debug.push(
    "RELATIONSHIP INTENT: Tag Classes -> Equipment Classes",
    `REQUESTED EQUIPMENT CONCEPT: ${requestedScope}`,
    `CONCEPT RESOLUTION: ${resolution.kind}`,
    `CONCEPT CANDIDATES: ${resolution.candidates.length}`,
  );

  if (resolution.kind === "resolved" && resolution.concept) {
    const concept = resolution.concept;
    const hierarchy = await collectEquipmentHierarchy(concept.id, allEquipment);
    const relationships = (
      await Promise.all(
        hierarchy.map((item) =>
          cfihosClassRelationshipRepository.getTagClassesForEquipmentClass(item.id),
        ),
      )
    ).flat();
    const tags = Array.from(
      new Map(
        relationships.map((relationship) => [
          relationship.tagClass.id,
          relationship.tagClass,
        ]),
      ).values(),
    );

    const descendantEvidence = hierarchy
      .filter((item) => item.id !== concept.id)
      .slice(0, 10)
      .map((item) => ({
        id: item.id,
        kind: "Equipment Class · hierarchy member",
        title: item.name,
        detail: item.definition ?? "",
        href: `/classes/equipment/${item.id}`,
        role: "relationship" as const,
        source: "cfihos" as const,
      }));

    const tagEvidence = tags.slice(0, 20).map((item) => ({
      id: item.id,
      kind: "Tag Class",
      title: item.name,
      detail: item.definition ?? "",
      href: `/classes/tag/${item.id}`,
      role: "relationship" as const,
    }));

    const evidence: Evidence[] = [
      {
        id: concept.id,
        kind: "Resolved Equipment Concept",
        title: concept.name,
        detail: concept.definition ?? "",
        href: `/classes/equipment/${concept.id}`,
        role: "direct",
        source: "cfihos",
      },
      ...descendantEvidence,
      ...tagEvidence,
    ];

    debug.push(
      `RESOLVED CONCEPT: ${concept.id} | ${concept.name}`,
      `RESOLUTION BASIS: ${resolution.basis}`,
      `HIERARCHY MEMBERS INCLUDING CONCEPT: ${hierarchy.length}`,
      `DESCENDANTS: ${Math.max(0, hierarchy.length - 1)}`,
      `TAG-EQUIPMENT RELATIONSHIPS: ${relationships.length}`,
      `UNIQUE TAG CLASSES: ${tags.length}`,
      ...hierarchy.map((item) => `hierarchy | ${item.id} | ${item.name}`),
      ...tags.map((item) => `relationship | Tag Class | ${item.id} | ${item.name}`),
    );

    return {
      text: tags.length
        ? `I resolved “${requestedScope}” to the formal CFIHOS Equipment Class “${concept.name}” (${concept.id}) using ${resolution.basis}. Its hierarchy contains ${Math.max(0, hierarchy.length - 1)} descendant Equipment Class${hierarchy.length - 1 === 1 ? "" : "es"}. Explicit Tag–Equipment relationships across that hierarchy resolve to ${tags.length} Tag Class${tags.length === 1 ? "" : "es"}: ${tags.map((item) => item.name).join(", ")}.`
        : `I resolved “${requestedScope}” to the formal CFIHOS Equipment Class “${concept.name}” (${concept.id}) using ${resolution.basis}. Its hierarchy contains ${Math.max(0, hierarchy.length - 1)} descendant Equipment Class${hierarchy.length - 1 === 1 ? "" : "es"}, but I found no explicit Tag–Equipment relationships across that hierarchy.`,
      evidence,
      debug,
      status: "grounded",
    };
  }

  const [candidateEquipment, disciplines] = await Promise.all([
    cfihosEquipmentRepository.searchEquipmentClasses(requestedScope),
    cfihosDocumentRepository.getDisciplines(),
  ]);
  const matchingDisciplines = disciplines.filter((item) =>
    `${item.name} ${item.id}`.toLowerCase().includes(requestedScope.toLowerCase()),
  );

  const resolvedCandidates = resolution.candidates.slice(0, 8);
  const fallbackCandidates = candidateEquipment
    .filter((item) => !resolvedCandidates.some((candidate) => candidate.id === item.id))
    .slice(0, Math.max(0, 8 - resolvedCandidates.length));

  const evidence: Evidence[] = [
    ...resolvedCandidates.map((item) => ({
      id: item.id,
      kind: "Equipment Class",
      title: item.name,
      detail: item.definition ?? "",
      href: `/classes/equipment/${item.id}`,
      role: "candidate" as const,
      source: "cfihos" as const,
    })),
    ...matchingDisciplines.slice(0, 5).map((item) => ({
      id: item.id,
      kind: "Discipline",
      title: item.name,
      detail: "CFIHOS discipline matching the wording used in the question.",
      role: "candidate" as const,
      source: "cfihos" as const,
    })),
    ...fallbackCandidates.map((item) => ({
      id: item.id,
      kind: "Equipment Class",
      title: item.name,
      detail: item.definition ?? "",
      href: `/classes/equipment/${item.id}`,
      role: "candidate" as const,
      source: "cfihos" as const,
    })),
  ];

  debug.push(
    "SEMANTIC BOUNDARY: wording did not resolve uniquely to one formal Equipment Class concept",
    `RESOLUTION CANDIDATES: ${resolution.candidates.length}`,
    `CANDIDATE DISCIPLINES: ${matchingDisciplines.length}`,
    `TEXTUAL EQUIPMENT CANDIDATES: ${candidateEquipment.length}`,
    "NO hierarchy or Tag–Equipment traversal performed from unresolved candidates",
    ...evidence.map((item) => `candidate | ${item.kind} | ${item.id} | ${item.title}`),
  );

  return {
    text:
      `I cannot derive a definitive Tag Class list for “${requestedScope}” yet because that wording does not resolve uniquely to one formal CFIHOS Equipment Class concept. ` +
      `I found ${resolution.candidates.length} concept candidate${resolution.candidates.length === 1 ? "" : "s"}, ${matchingDisciplines.length} discipline candidate${matchingDisciplines.length === 1 ? "" : "s"}, and ${candidateEquipment.length} textual Equipment Class candidate${candidateEquipment.length === 1 ? "" : "s"}. ` +
      "These are retrieval candidates for semantic interpretation; I have deliberately not traversed unresolved candidates into a Tag Class answer.",
    evidence,
    debug,
    status: "candidate",
  };
}

function resolveEquipmentConcept(
  equipmentClasses: Awaited<ReturnType<typeof cfihosEquipmentRepository.getEquipmentClasses>>,
  requestedScope: string,
): {
  kind: "resolved" | "ambiguous" | "unresolved";
  concept: (typeof equipmentClasses)[number] | null;
  candidates: typeof equipmentClasses;
  basis: string;
} {
  const query = normalizePhrase(requestedScope);
  if (!query) {
    return { kind: "unresolved", concept: null, candidates: [], basis: "no usable concept phrase" };
  }

  const exactName = equipmentClasses.filter((item) => normalizePhrase(item.name) === query);
  if (exactName.length === 1) {
    return {
      kind: "resolved",
      concept: exactName[0],
      candidates: exactName,
      basis: "an exact CFIHOS class-name match",
    };
  }
  if (exactName.length > 1) {
    return { kind: "ambiguous", concept: null, candidates: exactName, basis: "multiple exact class-name matches" };
  }

  const exactSynonym = equipmentClasses.filter((item) =>
    (item.synonyms ?? []).some((value) => normalizePhrase(value) === query),
  );
  if (exactSynonym.length === 1) {
    return {
      kind: "resolved",
      concept: exactSynonym[0],
      candidates: exactSynonym,
      basis: "an exact CFIHOS synonym match",
    };
  }
  if (exactSynonym.length > 1) {
    return { kind: "ambiguous", concept: null, candidates: exactSynonym, basis: "multiple synonym matches" };
  }

  // A qualified grouping such as "other mechanical equipment" is a stronger concept
  // candidate than arbitrary lexical hits in definitions or parent names. Only accept this
  // when it is unique; otherwise leave the question for semantic interpretation.
  const qualifiedName = equipmentClasses.filter((item) => {
    const value = normalizePhrase(item.name);
    return value.endsWith(` ${query}`) || value.startsWith(`${query} `);
  });
  if (qualifiedName.length === 1) {
    return {
      kind: "resolved",
      concept: qualifiedName[0],
      candidates: qualifiedName,
      basis: "a unique qualified CFIHOS class-name match",
    };
  }
  if (qualifiedName.length > 1) {
    return { kind: "ambiguous", concept: null, candidates: qualifiedName, basis: "multiple qualified class-name matches" };
  }

  return { kind: "unresolved", concept: null, candidates: [], basis: "no formal concept match" };
}

async function collectEquipmentHierarchy(
  rootId: string,
  allEquipment: Awaited<ReturnType<typeof cfihosEquipmentRepository.getEquipmentClasses>>,
) {
  const byId = new Map(allEquipment.map((item) => [item.id, item]));
  const root = byId.get(rootId);
  if (!root) return [];

  const result: typeof allEquipment = [];
  const visited = new Set<string>();
  const queue = [root.id];

  while (queue.length) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const current = byId.get(currentId);
    if (!current) continue;
    result.push(current);

    const children = await cfihosEquipmentRepository.getEquipmentClassChildren(currentId);
    children
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true }))
      .forEach((child) => {
        if (!visited.has(child.id)) queue.push(child.id);
      });
  }

  return result;
}


function isCisContextQuestion(question: string) {
  const q = question.toLowerCase();
  return ["my cis", "this cis", "current cis", "baseline", "override", "owner addition", "owner additions", "what have i changed", "why is", "required in my", "selected class", "selected classes"].some((term) => q.includes(term));
}

function resolveActiveCisQuestion(question: string, cis: ActiveCisContext, debug: string[]): RetrievalAnswer {
  const q = question.toLowerCase();
  const evidence: Evidence[] = [];
  const derived = cis.result?.derived;
  debug.push("INTENT: active CIS reasoning", `ACTIVE CIS: ${cis.profileName}`, `OVERRIDES: ${cis.overrides.length}`);

  evidence.push({
    id: "active-cis",
    kind: "Active CIS",
    title: cis.profileName,
    detail: `${cis.projectName || "Untitled project"}${cis.contractName ? ` · ${cis.contractName}` : ""}. Scope: ${cis.selectedClasses.map((item) => `${item.domain ?? "class"} · ${item.className ?? item.classId}`).join("; ") || "no classes selected"}. Disciplines: ${cis.selectedDisciplines.map((item) => item.disciplineName ?? item.disciplineId).join("; ") || "none selected"}. Overrides: ${cis.overrides.length}.`,
    href: "/cis",
    role: "direct",
    source: "application",
    actionLabel: "Open CIS Builder",
  });

  if (q.includes("change") || q.includes("override") || q.includes("owner addition")) {
    for (const item of cis.overrides.slice(0, 20)) {
      evidence.push({
        id: item.id ?? item.targetKey ?? item.targetLabel ?? "override",
        kind: "CIS override",
        title: item.targetLabel ?? "Contract deviation",
        detail: `Decision: ${item.action ?? "override"}. CFIHOS baseline: ${item.baselineValue ?? "Not in baseline"}. Contract value: ${item.action === "exclude" ? "Excluded" : item.contractValue ?? "Included"}. Rationale: ${item.reason ?? "No rationale recorded"}.`,
        role: "direct",
        source: "application",
      });
    }
    return { text: `The active CIS contains ${cis.overrides.length} explicit contract deviation${cis.overrides.length === 1 ? "" : "s"}.`, evidence, debug, status: "grounded" };
  }

  const searchable = question.toLowerCase().replace(/\b(why|is|are|the|this|my|cis|required|requirement|in|what|which|does|do)\b/g, " ").split(/\s+/).filter((term) => term.length > 2);
  const matches = (value: string) => searchable.length > 0 && searchable.some((term) => value.toLowerCase().includes(term));

  for (const item of derived?.documentTypes ?? []) {
    if (!matches(`${item.documentTypeName} ${item.documentTypeId}`)) continue;
    evidence.push({ id: item.documentTypeId, kind: "CIS document requirement", title: item.documentTypeName, detail: `Included in the locked CFIHOS baseline. Asset contexts: ${(item.assetContexts ?? []).join(", ")}. Requirement mappings: ${(item.requirementIds ?? []).join(", ")}. Provenance: ${cisProvenance(item.provenance)}.`, role: "relationship", source: "cfihos", href: `/documents/${item.documentTypeId}` });
  }
  for (const item of derived?.properties ?? []) {
    if (!matches(`${item.propertyName} ${item.propertyId}`)) continue;
    evidence.push({ id: item.propertyId, kind: "CIS asset-data requirement", title: item.propertyName, detail: `Included in the locked CFIHOS baseline. Provenance: ${cisProvenance(item.provenance)}.`, role: "relationship", source: "cfihos" });
  }
  for (const item of derived?.lifecycleRequirements ?? []) {
    if (!matches(`${item.documentTypeName} ${item.disciplineName} ${item.lifecyclePhaseName}`)) continue;
    evidence.push({ id: `${item.documentTypeId}-${item.lifecyclePhase}-${item.disciplineId}`, kind: "CIS lifecycle obligation", title: `${item.lifecyclePhaseName} · ${item.documentTypeName}`, detail: `${item.disciplineName}: ${item.requiredStatus}. Provenance: ${cisProvenance(item.provenance)}.`, role: "relationship", source: "cfihos" });
  }
  for (const item of cis.overrides) {
    if (!matches(`${item.targetLabel ?? ""} ${item.reason ?? ""}`)) continue;
    evidence.push({ id: item.id ?? item.targetKey ?? "override", kind: "CIS override", title: item.targetLabel ?? "Contract deviation", detail: `Decision: ${item.action}. Baseline: ${item.baselineValue ?? "Not in baseline"}. Contract: ${item.action === "exclude" ? "Excluded" : item.contractValue ?? "Included"}. Rationale: ${item.reason ?? "No rationale recorded"}.`, role: "direct", source: "application" });
  }

  debug.push(`CIS EVIDENCE MATCHES: ${evidence.length - 1}`);
  if (evidence.length === 1) {
    return { text: "The active CIS is available, but I could not match this question to a specific baseline requirement or override.", evidence, debug, status: "candidate" };
  }
  return { text: "I found matching requirements in the active CIS and retained their CFIHOS provenance and contract decisions.", evidence: evidence.slice(0, 24), debug, status: "grounded" };
}

function cisProvenance(provenance: any[]) {
  if (!Array.isArray(provenance) || !provenance.length) return "CFIHOS";
  return Array.from(new Set(provenance.map((item) => item?.selectedClass?.className ? `${item.assetContext ? `${String(item.assetContext).replaceAll("_", " ")} · ` : ""}${item.selectedClass.className}` : item?.disciplineName ?? item?.sourceStandardCode ?? "CFIHOS"))).join("; ");
}

function summarizeCisForModel(cis: ActiveCisContext) {
  return {
    profileName: cis.profileName,
    projectName: cis.projectName,
    contractName: cis.contractName,
    cfihosVersion: cis.result?.identity?.cfihosVersion ?? "2.0",
    classes: cis.selectedClasses,
    disciplines: cis.selectedDisciplines,
    overrides: cis.overrides,
    counts: cis.result ? {
      properties: cis.result.derived?.properties?.length ?? 0,
      documentRequirements: cis.result.derived?.documentRequirements?.length ?? 0,
      documentTypes: cis.result.derived?.documentTypes?.length ?? 0,
      standards: cis.result.derived?.sourceStandards?.length ?? 0,
      lifecycleRequirements: cis.result.derived?.lifecycleRequirements?.length ?? 0,
    } : null,
  };
}

function resolveApplicationCapability(question: string) {
  const normalized = normalizePhrase(question);
  const tokens = new Set(normalized.split(" ").filter(Boolean));

  const scored = applicationCapabilities
    .map((capability) => {
      let score = 0;
      for (const keyword of capability.keywords) {
        const normalizedKeyword = normalizePhrase(keyword);
        if (normalized.includes(normalizedKeyword)) {
          score += normalizedKeyword.includes(" ") ? 8 : 4;
          continue;
        }
        const keywordTokens = normalizedKeyword.split(" ").filter(Boolean);
        const overlap = keywordTokens.filter((token) => tokens.has(token)).length;
        if (overlap === keywordTokens.length && overlap > 0) score += overlap * 2;
      }

      if (capability.id === "cis-builder") {
        if (tokens.has("cis")) score += 12;
        if (normalized.includes("contract information specification")) score += 14;
        if ((tokens.has("build") || tokens.has("create") || tokens.has("new")) && (tokens.has("project") || tokens.has("cis"))) score += 5;
      }

      return { capability, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored[0]?.score >= 6 ? scored[0].capability : null;
}

function terms(question: string) {
  return question
    .toLowerCase()
    .replace(/[?.,]/g, " ")
    .replace(
      /\b(what|is|are|a|an|the|does|cfihos|say|about|find|show|me|related|to)\b/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function subject(question: string) {
  const stop = new Set(
    "what are the tag classes applicable to for which linked associated equipment".split(" "),
  );
  return question
    .toLowerCase()
    .replace(/[?.,]/g, " ")
    .split(/\s+/)
    .filter((token) => token && !stop.has(token))
    .join(" ");
}

function normalizePhrase(value: string) {
  return value.toLowerCase().replace(/[_/-]+/g, " ").replace(/\s+/g, " ").trim();
}
