import { useMemo,useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  GitMerge,
  Layers3,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

import {
  buildCompanyMergeExecution,
  compareCompanyMergeComponents,
  defaultCompanyMergeTarget,
  executeCompanyMerge,
  initialMergeResolutions,
  loadCompanyMergeDetails,
  loadCompanyMergePreview,
  unresolvedMergeCategories,
  type CompanyMergeDetails,
  type CompanyMergeTarget,
  type MergeCategoryComparison,
  type MergeResolution,
  type MergeResolutionState,
} from "../rdl/companyMergeWorkbench";

import "./RdlCompanyMergeWorkbenchPage.css";

export function RdlCompanyMergeWorkbenchPage(){
  const params=
    new URLSearchParams(window.location.search);

  const [contextKey,setContextKey]=
    useState(params.get("context")??"");

  const [mappingId,setMappingId]=
    useState(params.get("mapping")??"");

  const [details,setDetails]=
    useState<CompanyMergeDetails>();

  const [comparisons,setComparisons]=
    useState<MergeCategoryComparison[]>([]);

  const [resolutions,setResolutions]=
    useState<MergeResolutionState>();

  const [target,setTarget]=
    useState<CompanyMergeTarget>({
      nativeIdentifier:"",
      name:"",
      customDefinition:"",
    });

  const [rationale,setRationale]=
    useState(
      "Governed Company merge after semantic comparison of both exact L1 contributors."
    );

  const [busy,setBusy]=useState(false);
  const [feedback,setFeedback]=useState("");
  const [result,setResult]=useState<{
    extensionChangeId:number;
    compositionId:number;
    retireExtensionChangeIds:number[];
  }>();

  const unresolved=
    useMemo(
      ()=>
        resolutions
          ?unresolvedMergeCategories(
              comparisons,
              resolutions
            )
          :[],
      [comparisons,resolutions]
    );

  const ready=
    Boolean(
      details
      &&resolutions
      &&details.preview.contextStatus==="draft"
      &&details.preview.decisionType==="merge"
      &&details.preview.left.pinned
      &&details.preview.right.pinned
      &&unresolved.length===0
      &&target.nativeIdentifier.trim()
      &&target.name.trim()
      &&rationale.trim().length>=10
    );

  async function inspect(){
    setBusy(true);
    setFeedback("");
    setResult(undefined);

    try{
      const id=Number(mappingId);

      if(!contextKey.trim())
        throw new Error(
          "Enter a draft Company context key."
        );

      if(!Number.isSafeInteger(id)||id<=0)
        throw new Error(
          "Enter a valid collision mapping id."
        );

      const preview=
        await loadCompanyMergePreview(
          contextKey.trim(),
          id
        );

      const loaded=
        await loadCompanyMergeDetails(preview);

      const compared=
        compareCompanyMergeComponents(loaded);

      setDetails(loaded);
      setComparisons(compared);
      setResolutions(
        initialMergeResolutions(compared)
      );
      setTarget(
        defaultCompanyMergeTarget(preview)
      );

      setFeedback(
        "Exact L1 contributors loaded. Resolve every semantic difference before creating the Company merge."
      );
    }catch(error){
      setDetails(undefined);
      setComparisons([]);
      setResolutions(undefined);

      setFeedback(
        error instanceof Error
          ?error.message
          :"Unable to load merge evidence."
      );
    }finally{
      setBusy(false);
    }
  }

  function resolve(
    key:MergeCategoryComparison["key"],
    resolution:MergeResolution
  ){
    setResolutions(current=>
      current
        ?{
            ...current,
            [key]:resolution,
          }
        :current
    );
  }

  async function execute(){
    if(
      !details
      ||!resolutions
    )return;

    setBusy(true);
    setFeedback("");
    setResult(undefined);

    try{
      const body=
        buildCompanyMergeExecution(
          details,
          comparisons,
          resolutions,
          target,
          rationale
        );

      const response=
        await executeCompanyMerge(body);

      setResult(response.result);

      setFeedback(
        "Company merge drafts created. The target entity and both contributor suppressions now require normal Extension Governance before publication."
      );
    }catch(error){
      setFeedback(
        error instanceof Error
          ?error.message
          :"Company merge execution failed."
      );
    }finally{
      setBusy(false);
    }
  }

  return (
    <section className="merge-workbench" aria-label="Company Merge Workbench">
      <header className="merge-hero">
        <div>
          <span className="merge-eyebrow">
            Company RDL Adoption · L1 → L2
          </span>

          <h1>
            <GitMerge size={30}/>
            Company Merge Workbench
          </h1>

          <p>
            Resolve an approved <strong>Merge</strong> collision
            component by component. The workbench compares the exact
            runtime semantics of both Industry contributors and creates
            one governed Company identity without modifying either L1
            source.
          </p>
        </div>

        <div className="merge-boundary">
          <ShieldCheck size={22}/>
          <div>
            <strong>Governance boundary</strong>
            <span>
              Collision decision first. Semantic merge second.
              Extension approval third. Publication only after all
              three are complete.
            </span>
          </div>
        </div>
      </header>

      <section className="merge-panel merge-start">
        <div className="merge-section-heading">
          <Layers3 size={20}/>
          <div>
            <h2>1. Load governed collision</h2>
            <p>
              Use the draft Company context and mapping id shown in
              Company RDL Adoption.
            </p>
          </div>
        </div>

        <div className="merge-start-grid">
          <label>
            Company context
            <input
              value={contextKey}
              onChange={event=>
                setContextKey(event.target.value)
              }
              placeholder="e.g. company-rdl-v1"
            />
          </label>

          <label>
            Collision mapping id
            <input
              value={mappingId}
              inputMode="numeric"
              onChange={event=>
                setMappingId(event.target.value)
              }
              placeholder="e.g. 1024"
            />
          </label>

          <button
            type="button"
            onClick={inspect}
            disabled={busy}
          >
            Inspect semantic differences
          </button>
        </div>

        <p className="merge-helper">
          Need to select or govern the collision first?{" "}
          <Link to="/company-adoption">
            Open Company RDL Adoption
          </Link>.
        </p>
      </section>

      {details&&(
        <>
          <section className="merge-panel">
            <div className="merge-section-heading">
              <GitMerge size={20}/>
              <div>
                <h2>2. Exact contributors</h2>
                <p>
                  Same name never implies equivalence. Identity below
                  is exact source / release / package / entity identity.
                </p>
              </div>
            </div>

            <div className="merge-contributors">
              <ContributorCard
                side="Source A"
                item={details.preview.left}
              />

              <div className="merge-arrow">
                <ArrowRight size={24}/>
              </div>

              <ContributorCard
                side="Source B"
                item={details.preview.right}
              />
            </div>

            <div className="merge-status-grid">
              <Status
                ok={
                  details.preview.contextStatus==="draft"
                }
                label={`Company context: ${details.preview.contextStatus}`}
                help="Merge execution is only allowed in a draft Company context."
              />

              <Status
                ok={
                  details.preview.decisionType==="merge"
                }
                label={`Collision decision: ${details.preview.decisionType??"not recorded"}`}
                help="Record Merge in Company RDL Adoption before component resolution."
              />

              <Status
                ok={
                  details.preview.left.pinned
                  &&details.preview.right.pinned
                }
                label={
                  details.preview.left.pinned
                  &&details.preview.right.pinned
                    ?"Both exact packages pinned"
                    :"Package adoption incomplete"
                }
                help="Both L1 packages must be adopted into this draft Company context before a whole-standard collision merge."
              />
            </div>
          </section>

          <section className="merge-panel">
            <div className="merge-section-heading">
              <Layers3 size={20}/>
              <div>
                <h2>3. Resolve semantic components</h2>
                <p>
                  Equal components are pre-resolved. Every difference
                  requires an explicit administrator choice.
                </p>
              </div>
            </div>

            <div className="merge-component-list">
              {comparisons.map(comparison=>(
                <ComponentCard
                  key={comparison.key}
                  comparison={comparison}
                  resolution={
                    resolutions?.[comparison.key]??""
                  }
                  onResolve={value=>
                    resolve(comparison.key,value)
                  }
                  customDefinition={
                    target.customDefinition
                  }
                  onCustomDefinition={value=>
                    setTarget(current=>({
                      ...current,
                      customDefinition:value,
                    }))
                  }
                />
              ))}
            </div>

            {unresolved.length>0&&(
              <div className="merge-warning">
                <TriangleAlert size={18}/>
                <span>
                  {unresolved.length} differing component
                  {unresolved.length===1?"":"s"} still require
                  explicit resolution.
                </span>
              </div>
            )}
          </section>

          <section className="merge-panel">
            <div className="merge-section-heading">
              <ShieldCheck size={20}/>
              <div>
                <h2>4. Define governed Company identity</h2>
                <p>
                  The target is a new L2 object. Both exact inherited
                  L1 contributor identities will receive explicit
                  suppression drafts.
                </p>
              </div>
            </div>

            <div className="merge-target-grid">
              <label>
                Company native identifier
                <input
                  value={target.nativeIdentifier}
                  onChange={event=>
                    setTarget(current=>({
                      ...current,
                      nativeIdentifier:event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                Company name
                <input
                  value={target.name}
                  onChange={event=>
                    setTarget(current=>({
                      ...current,
                      name:event.target.value,
                    }))
                  }
                />
              </label>

              <label className="merge-target-wide">
                Merge rationale
                <textarea
                  value={rationale}
                  onChange={event=>
                    setRationale(event.target.value)
                  }
                  rows={3}
                />
              </label>
            </div>

            <div className="merge-execution-note">
              <strong>Execution creates drafts — not a publication.</strong>
              <span>
                One Company target draft, one RDL-054
                multi-source composition with exact provenance, and
                suppression drafts for both inherited contributors.
                All remain subject to Extension Governance.
              </span>
            </div>

            <button
              type="button"
              className="merge-primary"
              onClick={execute}
              disabled={!ready||busy}
            >
              Create governed Company merge
            </button>
          </section>
        </>
      )}

      {feedback&&(
        <section
          className={
            result
              ?"merge-feedback merge-feedback-success"
              :"merge-feedback"
          }
          aria-live="polite"
        >
          {result
            ?<CheckCircle2 size={20}/>
            :<TriangleAlert size={20}/>}

          <div>
            <strong>
              {result
                ?"Merge drafts created"
                :"Workbench status"}
            </strong>

            <p>{feedback}</p>

            {result&&(
              <>
                <code>
                  composition={result.compositionId}
                  {" · "}
                  target-extension={result.extensionChangeId}
                  {" · "}
                  suppressions={result.retireExtensionChangeIds.join(", ")}
                </code>

                <p>
                  <Link to="/extensions">
                    Continue in Extension Governance
                  </Link>
                </p>
              </>
            )}
          </div>
        </section>
      )}
    </section>
  );
}

function ContributorCard({
  side,
  item,
}:{
  side:string;
  item:CompanyMergeDetails["preview"]["left"];
}){
  return (
    <article className="merge-contributor">
      <small>{side}</small>
      <h3>{item.name}</h3>
      <code>{item.nativeIdentifier}</code>

      <dl>
        <div>
          <dt>Source</dt>
          <dd>{item.sourceKey}</dd>
        </div>
        <div>
          <dt>Release</dt>
          <dd>{item.releaseKey}</dd>
        </div>
        <div>
          <dt>Package</dt>
          <dd>{item.packageKey}</dd>
        </div>
        <div>
          <dt>Entity type</dt>
          <dd>{item.entityType}</dd>
        </div>
        <div>
          <dt>Package state</dt>
          <dd>{item.pinned?"Pinned to L2":"Not pinned"}</dd>
        </div>
      </dl>
    </article>
  );
}

function Status({
  ok,
  label,
  help,
}:{
  ok:boolean;
  label:string;
  help:string;
}){
  return (
    <div className={ok?"merge-status ok":"merge-status warn"}>
      {ok
        ?<CheckCircle2 size={17}/>
        :<TriangleAlert size={17}/>}

      <div>
        <strong>{label}</strong>
        <span>{help}</span>
      </div>
    </div>
  );
}

function ComponentCard({
  comparison,
  resolution,
  onResolve,
  customDefinition,
  onCustomDefinition,
}:{
  comparison:MergeCategoryComparison;
  resolution:MergeResolution|"";
  onResolve:(value:MergeResolution)=>void;
  customDefinition:string;
  onCustomDefinition:(value:string)=>void;
}){
  return (
    <article
      className={
        comparison.equal
          ?"merge-component equal"
          :"merge-component different"
      }
    >
      <header>
        <div>
          <h3>{comparison.label}</h3>
          <span>
            {comparison.equal
              ?"No semantic difference detected"
              :"Explicit resolution required"}
          </span>
        </div>

        <select
          aria-label={`${comparison.label} resolution`}
          value={resolution}
          onChange={event=>
            onResolve(
              event.target.value as MergeResolution
            )
          }
        >
          {!comparison.equal&&(
            <option value="">
              Select resolution…
            </option>
          )}

          <option value="use_left">
            Use Source A
          </option>

          <option value="use_right">
            Use Source B
          </option>

          {comparison.key!=="definition"&&(
            <option value="combine">
              Combine
            </option>
          )}

          <option value="exclude">
            Exclude
          </option>

          {comparison.key==="definition"&&(
            <option value="custom">
              Company override
            </option>
          )}
        </select>
      </header>

      <div className="merge-diff-grid">
        <DiffColumn
          title="Source A only"
          values={comparison.leftOnly}
        />

        <DiffColumn
          title="Common"
          values={comparison.common}
        />

        <DiffColumn
          title="Source B only"
          values={comparison.rightOnly}
        />
      </div>

      {comparison.key==="definition"
        &&resolution==="custom"
        &&(
          <label className="merge-custom-definition">
            Company definition
            <textarea
              rows={4}
              value={customDefinition}
              onChange={event=>
                onCustomDefinition(event.target.value)
              }
              placeholder="Enter the governed Company definition."
            />
          </label>
        )}
    </article>
  );
}

function DiffColumn({
  title,
  values,
}:{
  title:string;
  values:string[];
}){
  return (
    <div className="merge-diff-column">
      <strong>{title}</strong>

      {values.length===0
        ?<span className="merge-empty">None</span>
        :(
          <ul>
            {values.slice(0,20).map(value=>(
              <li key={value}>{value}</li>
            ))}

            {values.length>20&&(
              <li>
                + {values.length-20} more
              </li>
            )}
          </ul>
        )}
    </div>
  );
}
