import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  GitCompareArrows,
  Layers3,
  LibraryBig,
  LockKeyhole,
  Merge,
  PackageCheck,
  Search,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { Link } from "react-router-dom";

import {
  createCompanyComposition,
  createCompanyContext,
  loadCompanyAdoptionSession,
  loadCompanyCollisionCandidates,
  loadPublishedCompanyAdoptionPackages,
  loadPublishedPackageEntities,
  pinCompanyIndustryPackage,
  recordCompanyCollisionDecision,
  type CompanyAdoptionEntity,
  type CompanyAdoptionSession,
  type CompanyAdoptionSourcePackage,
  type CompanyCollisionCandidate,
  type CompanyCollisionDecisionType,
  type CompanyContextResult,
} from "../rdl/companyRdlAdoptionService";


const DECISIONS:Array<{
  id:CompanyCollisionDecisionType;
  label:string;
  meaning:string;
}>=[
  {
    id:"merge",
    label:"Merge",
    meaning:
      "Treat both source concepts as contributors to one governed Company concept. Component-level resolution remains required.",
  },
  {
    id:"keep_separate",
    label:"Keep separate",
    meaning:
      "Retain the concepts independently without asserting equivalence.",
  },
  {
    id:"rename",
    label:"Rename",
    meaning:
      "Keep the selected concept distinct and assign a governed Company name.",
  },
  {
    id:"exclude",
    label:"Exclude",
    meaning:
      "Explicitly exclude one of the two source concepts from this Company adoption decision.",
  },
  {
    id:"defer",
    label:"Defer",
    meaning:
      "Record that the collision was reviewed but more evidence is required. Publication remains blocked.",
  },
];


export function RdlCompanyAdoptionPage(){
  const [session,setSession]=
    useState<CompanyAdoptionSession|null>();

  const [packages,setPackages]=
    useState<CompanyAdoptionSourcePackage[]>([]);

  const [context,setContext]=
    useState<CompanyContextResult>();

  const [packageId,setPackageId]=useState("");
  const [packagePinned,setPackagePinned]=useState(false);

  const [entityQuery,setEntityQuery]=useState("");
  const [entities,setEntities]=
    useState<CompanyAdoptionEntity[]>([]);

  const [selectedEntity,setSelectedEntity]=
    useState<CompanyAdoptionEntity>();

  const [collisions,setCollisions]=
    useState<CompanyCollisionCandidate[]>([]);

  const [collisionLoading,setCollisionLoading]=
    useState(false);

  const [activeMappingId,setActiveMappingId]=
    useState<number>();

  const [decisionType,setDecisionType]=
    useState<CompanyCollisionDecisionType>("defer");

  const [decisionSubjectEntityId,setDecisionSubjectEntityId]=
    useState("");

  const [decisionTargetName,setDecisionTargetName]=
    useState("");

  const [decisionRationale,setDecisionRationale]=
    useState("");

  const [feedback,setFeedback]=useState("");
  const [error,setError]=useState("");

  const [contextForm,setContextForm]=useState({
    contextKey:"company-rdl-v1",
    name:"Company RDL",
    ownerReference:"",
  });

  const [pinReason,setPinReason]=useState(
    "Adopt this published Industry standard into the governed Company RDL baseline."
  );

  const [companyEntity,setCompanyEntity]=useState({
    targetNativeIdentifier:"",
    targetName:"",
    targetDefinition:"",
    rationale:"",
  });


  useEffect(()=>{
    let active=true;

    loadCompanyAdoptionSession()
      .then(async value=>{
        if(!active)return;

        setSession(value);

        if(!value)return;

        const loaded=
          await loadPublishedCompanyAdoptionPackages();

        if(!active)return;

        setPackages(loaded);

        const cfihos=loaded.find(
          item=>
            item.sourceKey==="cfihos"
            &&item.releaseKey==="cfihos-2.0"
        );

        const initial=cfihos??loaded[0];

        if(initial)
          setPackageId(String(initial.packageId));
      })
      .catch(handleError);

    return()=>{active=false};
  },[]);


  const selectedPackage=useMemo(
    ()=>packages.find(
      item=>item.packageId===Number(packageId)
    ),
    [packages,packageId]
  );


  const unresolvedCollisions=useMemo(
    ()=>collisions.filter(item=>!item.decision),
    [collisions]
  );


  const deferredCollisions=useMemo(
    ()=>collisions.filter(
      item=>item.decision?.decisionType==="defer"
    ),
    [collisions]
  );


  const mergeCollisions=useMemo(
    ()=>collisions.filter(
      item=>item.decision?.decisionType==="merge"
    ),
    [collisions]
  );


  const selectedExcluded=useMemo(
    ()=>Boolean(
      selectedEntity
      &&collisions.some(
        item=>
          item.decision?.decisionType==="exclude"
          &&item.decision.subjectEntityId===
            selectedEntity.entityId
      )
    ),
    [collisions,selectedEntity]
  );


  const selectedRenameNames=useMemo(
    ()=>{
      if(!selectedEntity)return [];

      return [
        ...new Set(
          collisions
            .filter(
              item=>
                item.decision?.decisionType==="rename"
                &&item.decision.subjectEntityId===
                  selectedEntity.entityId
                &&item.decision.targetName
            )
            .map(
              item=>item.decision?.targetName as string
            )
        ),
      ];
    },
    [collisions,selectedEntity]
  );


  const adoptionBlockedReason=useMemo(()=>{
    if(!selectedEntity)
      return "Select an exact L1 entity first.";

    if(selectedExcluded)
      return "The selected L1 entity is explicitly excluded from this Company adoption.";

    if(unresolvedCollisions.length>0)
      return `${unresolvedCollisions.length} collision decision(s) remain unresolved.`;

    if(deferredCollisions.length>0)
      return `${deferredCollisions.length} collision decision(s) are explicitly deferred.`;

    if(mergeCollisions.length>0)
      return "At least one collision is marked Merge. Explicit component-level merge resolution is required before creating the Company composition.";

    if(selectedRenameNames.length>1)
      return "Conflicting Company rename decisions exist for the selected entity.";

    return "";
  },[
    selectedEntity,
    selectedExcluded,
    unresolvedCollisions,
    deferredCollisions,
    mergeCollisions,
    selectedRenameNames,
  ]);


  function handleError(value:unknown){
    setError(
      value instanceof Error
        ?value.message
        :"The Company adoption operation failed."
    );
  }


  async function createContext(){
    if(!session)return;

    setError("");
    setFeedback("");

    try{
      const created=await createCompanyContext({
        contextKey:contextForm.contextKey,
        name:contextForm.name,
        ownerReference:
          contextForm.ownerReference||undefined,
      });

      setContext(created);

      setFeedback(
        `Draft Company context ${created.contextKey} created.`
      );

    }catch(value){
      handleError(value);
    }
  }


  async function adoptPackage(){
    if(
      !session
      ||!context
      ||!selectedPackage
    )return;

    setError("");
    setFeedback("");

    try{
      await pinCompanyIndustryPackage({
        contextKey:context.contextKey,
        packageId:selectedPackage.packageId,
        precedence:10,
        reason:pinReason,
      });

      setPackagePinned(true);

      setFeedback(
        `${selectedPackage.sourceName} ${selectedPackage.versionLabel} is now pinned as the exact Industry baseline for ${context.contextName}.`
      );

    }catch(value){
      handleError(value);
    }
  }


  async function searchEntities(){
    if(!selectedPackage||!session)return;

    setError("");
    setFeedback("");
    setSelectedEntity(undefined);
    setCollisions([]);

    try{
      const items=await loadPublishedPackageEntities(
        selectedPackage.packageId,
        entityQuery
      );

      setEntities(items);

      if(items.length===0)
        setFeedback(
          "No published L1 entities match this search."
        );

    }catch(value){
      handleError(value);
    }
  }


  async function chooseEntity(
    entity:CompanyAdoptionEntity
  ){
    setSelectedEntity(entity);

    setCompanyEntity({
      targetNativeIdentifier:
        entity.nativeIdentifier,
      targetName:entity.name,
      targetDefinition:entity.definition??"",
      rationale:
        `Adopt ${entity.name} from the exact published Industry source into the governed Company RDL.`,
    });

    setCollisions([]);
    setActiveMappingId(undefined);

    if(!context){
      setFeedback(
        "Entity selected. Create the Company context before collision governance."
      );
      return;
    }

    await refreshCollisions(entity);
  }


  async function refreshCollisions(
    entity=selectedEntity
  ){
    if(!context||!entity)return;

    setCollisionLoading(true);
    setError("");

    try{
      const items=
        await loadCompanyCollisionCandidates(
          context.contextKey,
          entity.entityId
        );

      setCollisions(items);

    }catch(value){
      handleError(value);

    }finally{
      setCollisionLoading(false);
    }
  }


  function beginDecision(
    item:CompanyCollisionCandidate,
    type:CompanyCollisionDecisionType
  ){
    setActiveMappingId(item.mappingId);
    setDecisionType(type);

    const selectedIsParticipant=
      selectedEntity
      &&(
        item.left.entityId===selectedEntity.entityId
        ||item.right.entityId===selectedEntity.entityId
      );

    setDecisionSubjectEntityId(
      selectedIsParticipant
        ?String(selectedEntity?.entityId??"")
        :""
    );

    setDecisionTargetName(
      type==="rename"
        ?selectedEntity?.name??""
        :""
    );

    setDecisionRationale("");
  }


  async function saveDecision(
    item:CompanyCollisionCandidate
  ){
    if(!context||!session)return;

    setError("");
    setFeedback("");

    try{
      const result=
        await recordCompanyCollisionDecision({
          contextKey:context.contextKey,
          mappingId:item.mappingId,
          decisionType,
          subjectEntityId:
            ["rename","exclude"].includes(decisionType)
              ?Number(decisionSubjectEntityId)
              :undefined,
          targetName:
            decisionType==="rename"
              ?decisionTargetName
              :undefined,
          rationale:decisionRationale,
          expectedVersion:
            item.decision?.reviewVersion??0,
        });

      setFeedback(
        `Collision ${item.mappingId}: ${result.decisionType.replaceAll("_"," ")} recorded.`
      );

      setActiveMappingId(undefined);
      setDecisionRationale("");
      setDecisionTargetName("");

      await refreshCollisions();

    }catch(value){
      handleError(value);
    }
  }


  async function createAdoptionDraft(){
    if(
      !context
      ||!selectedEntity
      ||adoptionBlockedReason
    )return;

    setError("");
    setFeedback("");

    const governedName=
      selectedRenameNames[0]
      ??companyEntity.targetName;

    try{
      const result=
        await createCompanyComposition({
          contextKey:context.contextKey,
          compositionKind:"derived_copy",

          targetEntityType:
            selectedEntity.entityType,

          targetNativeIdentifier:
            companyEntity.targetNativeIdentifier,

          targetName:governedName,

          targetDefinition:
            companyEntity.targetDefinition||undefined,

          rationale:
            companyEntity.rationale,

          contributors:[
            {
              sourceEntityId:
                selectedEntity.entityId,
              contributionRole:"primary",
            },
          ],

          componentDecisions:[
            {
              componentKind:"definition",
              componentKey:"definition",
              resolution:"use_source",
              selectedSourceEntityId:
                selectedEntity.entityId,
              resolvedPayload:{},
              rationale:
                companyEntity.rationale,
            },
          ],
        });

      setFeedback(
        `Company adoption draft created: extension ${result.extensionChangeId}, composition ${result.compositionId}. Continue in Extension Governance.`
      );

    }catch(value){
      handleError(value);
    }
  }


  return (
    <div className="content-page rdl-company-adoption-page">

      <div className="page-heading">
        <div>
          <span className="eyebrow">
            Enterprise standards · L1 → L2
          </span>
          <h1>Company RDL Adoption</h1>
        </div>

        <p>
          Select exact Industry standards and entities,
          govern semantic overlaps, and create auditable
          Company/L2 standards without modifying L1.
        </p>
      </div>


      <div
        className={`rdl-governance-session ${
          session
            ?"rdl-governance-session-live"
            :""
        }`}
        role="status"
      >
        {session
          ?<>
            <UserCheck size={18}/>
            <div>
              <strong>
                Authenticated Company RDL administrator
              </strong>
              <span>
                {session.reviewer}
                {" · "}governed authoring enabled
              </span>
            </div>
          </>
          :<>
            <LockKeyhole size={18}/>
            <div>
              <strong>Read-only mode</strong>
              <span>
                A trusted RDL extension-reviewer
                identity is required.
              </span>
            </div>
          </>
        }
      </div>


      {error&&(
        <div
          className=
            "rdl-governance-feedback rdl-governance-feedback-error"
          role="alert"
        >
          {error}
        </div>
      )}

      {feedback&&(
        <div
          className="rdl-governance-feedback"
          role="status"
        >
          {feedback}
        </div>
      )}


      <section
        className="rdl-hierarchy-section"
        aria-labelledby="company-context-heading"
      >
        <h2 id="company-context-heading">
          <LibraryBig size={20}/>
          {" "}1. Create the Company/L2 context
        </h2>

        <div className="rdl-review-editor">

          <label>
            Context key
            <input
              value={contextForm.contextKey}
              onChange={event=>
                setContextForm({
                  ...contextForm,
                  contextKey:event.target.value,
                })
              }
            />
          </label>

          <label>
            Company RDL name
            <input
              value={contextForm.name}
              onChange={event=>
                setContextForm({
                  ...contextForm,
                  name:event.target.value,
                })
              }
            />
          </label>

          <button
            type="button"
            disabled={!session||Boolean(context)}
            onClick={()=>void createContext()}
          >
            <ShieldCheck size={16}/>
            {" "}Create draft Company RDL
          </button>

        </div>
      </section>


      <section
        className="rdl-hierarchy-section"
        aria-labelledby="company-baseline-heading"
      >
        <h2 id="company-baseline-heading">
          <PackageCheck size={20}/>
          {" "}2. Adopt a complete L1 standard
        </h2>

        <div className="rdl-review-editor">

          <label>
            Published L1 standard
            <select
              value={packageId}
              onChange={event=>{
                setPackageId(event.target.value);
                setPackagePinned(false);
                setEntities([]);
                setSelectedEntity(undefined);
                setCollisions([]);
              }}
              disabled={!session}
            >
              {packages.map(item=>(
                <option
                  key={item.packageId}
                  value={item.packageId}
                >
                  {item.sourceName}
                  {" · "}
                  {item.versionLabel}
                  {" · "}
                  {item.releaseKey}
                </option>
              ))}
            </select>
          </label>

          {selectedPackage&&(
            <p className="rdl-intelligence-copy">
              <strong>Exact package:</strong>{" "}
              <code>
                {selectedPackage.packageKey}
              </code>
              <br/>
              <strong>SHA-256:</strong>{" "}
              <code>
                {selectedPackage.packageSha256}
              </code>
            </p>
          )}

          <label>
            Adoption rationale
            <textarea
              rows={3}
              value={pinReason}
              onChange={event=>
                setPinReason(event.target.value)
              }
            />
          </label>

          <button
            type="button"
            disabled={
              !session
              ||!context
              ||!selectedPackage
              ||packagePinned
              ||pinReason.trim().length<10
            }
            onClick={()=>void adoptPackage()}
          >
            <ArrowRight size={16}/>
            {" "}
            {packagePinned
              ?"Industry baseline adopted"
              :"Adopt exact L1 package into L2"
            }
          </button>

        </div>
      </section>


      <section
        className="rdl-hierarchy-section"
        aria-labelledby="l1-entity-heading"
      >
        <h2 id="l1-entity-heading">
          <Search size={20}/>
          {" "}3. Selectively adopt one exact L1 entity
        </h2>

        <p className="rdl-intelligence-copy">
          Search the selected published Industry
          standard by class, identifier or name.
          Internal database IDs are no longer part of
          the normal administrator workflow.
        </p>

        <div className="rdl-review-editor">

          <label>
            Search published L1 entities
            <input
              value={entityQuery}
              onChange={event=>
                setEntityQuery(event.target.value)
              }
              placeholder=
                "e.g. Gauge, Centrifugal Pump, tag class"
            />
          </label>

          <button
            type="button"
            disabled={!session||!selectedPackage}
            onClick={()=>void searchEntities()}
          >
            <Search size={16}/>
            {" "}Search L1
          </button>

        </div>


        {entities.length>0&&(
          <div className="rdl-governance-list">

            {entities.map(entity=>(
              <article
                className="rdl-governance-card"
                key={entity.entityId}
              >
                <div
                  className="rdl-governance-card-head"
                >
                  <span className="rdl-mapping-type">
                    {entity.entityType.replaceAll("_"," ")}
                  </span>

                  {selectedEntity?.entityId===
                    entity.entityId&&(
                    <span
                      className=
                        "rdl-review-status rdl-review-status-approved"
                    >
                      selected
                    </span>
                  )}
                </div>

                <h3>{entity.name}</h3>

                <code>
                  {entity.nativeIdentifier}
                </code>

                {entity.definition&&(
                  <p>{entity.definition}</p>
                )}

                <div className="rdl-review-actions">
                  <button
                    type="button"
                    onClick={()=>
                      void chooseEntity(entity)
                    }
                  >
                    Select for Company adoption
                  </button>
                </div>
              </article>
            ))}

          </div>
        )}
      </section>


      {selectedEntity&&(
        <section
          className="rdl-hierarchy-section"
          aria-labelledby="collision-heading"
        >
          <h2 id="collision-heading">
            <GitCompareArrows size={20}/>
            {" "}4. Analyse and resolve overlaps
          </h2>

          <p className="rdl-intelligence-copy">
            <strong>Selected:</strong>{" "}
            {selectedEntity.name}
            {" · "}
            <code>
              {selectedEntity.nativeIdentifier}
            </code>
          </p>

          <p className="rdl-intelligence-copy">
            Same-name or mapped concepts are evidence
            candidates only. Every Company-context
            disposition remains explicit and auditable.
          </p>

          {collisionLoading&&(
            <p className="rdl-intelligence-copy">
              Loading collision evidence…
            </p>
          )}

          {!collisionLoading
            &&collisions.length===0&&(
            <div className="rdl-governance-feedback">
              <CheckCircle2 size={16}/>
              {" "}
              No cross-RDL collision candidates are
              currently recorded for this entity.
            </div>
          )}


          <div className="rdl-governance-list">

            {collisions.map(item=>(
              <article
                className="rdl-governance-card"
                key={item.mappingId}
              >

                <div
                  className="rdl-governance-card-head"
                >
                  <span className="rdl-mapping-type">
                    {item.mappingType.replaceAll("_"," ")}
                  </span>

                  <span>
                    {(item.confidence*100).toFixed(0)}
                    % confidence
                  </span>

                  <span
                    className={`rdl-review-status ${
                      item.decision
                        ?"rdl-review-status-approved"
                        :"rdl-review-status-candidate"
                    }`}
                  >
                    {item.decision
                      ?item.decision.decisionType
                        .replaceAll("_"," ")
                      :"decision required"
                    }
                  </span>
                </div>


                <div className="rdl-mapping-entities">

                  <div>
                    <small>
                      {item.left.sourceKey}
                      {" · "}
                      {item.left.entityType}
                    </small>
                    <strong>
                      {item.left.name}
                    </strong>
                    <code>
                      {item.left.nativeIdentifier}
                    </code>
                  </div>

                  <span aria-hidden="true">↔</span>

                  <div>
                    <small>
                      {item.right.sourceKey}
                      {" · "}
                      {item.right.entityType}
                    </small>
                    <strong>
                      {item.right.name}
                    </strong>
                    <code>
                      {item.right.nativeIdentifier}
                    </code>
                  </div>

                </div>


                {item.decision&&(
                  <div className="rdl-intelligence-copy">
                    <strong>
                      Current Company decision:
                    </strong>{" "}
                    {item.decision.decisionType
                      .replaceAll("_"," ")}

                    {item.decision.targetName&&(
                      <>
                        {" · "}
                        <strong>Name:</strong>{" "}
                        {item.decision.targetName}
                      </>
                    )}

                    <br/>

                    <small>
                      v{item.decision.reviewVersion}
                      {" · "}
                      {item.decision.decidedBy}
                    </small>

                    <p>
                      {item.decision.rationale}
                    </p>
                  </div>
                )}


                <div className="rdl-review-actions">

                  {DECISIONS.map(option=>(
                    <button
                      key={option.id}
                      type="button"
                      onClick={()=>
                        beginDecision(
                          item,
                          option.id
                        )
                      }
                    >
                      {option.id==="defer"&&(
                        <Clock3 size={14}/>
                      )}

                      {option.id==="merge"&&(
                        <Merge size={14}/>
                      )}

                      {option.label}
                    </button>
                  ))}

                </div>


                {activeMappingId===item.mappingId&&(
                  <div
                    className="rdl-review-editor"
                    aria-label=
                      "Company collision decision"
                  >

                    <strong>
                      {
                        DECISIONS.find(
                          value=>
                            value.id===decisionType
                        )?.label
                      }
                    </strong>

                    <p className="rdl-intelligence-copy">
                      {
                        DECISIONS.find(
                          value=>
                            value.id===decisionType
                        )?.meaning
                      }
                    </p>


                    {["rename","exclude"].includes(
                      decisionType
                    )&&(
                      <label>
                        Decision applies to
                        <select
                          value=
                            {decisionSubjectEntityId}
                          onChange={event=>
                            setDecisionSubjectEntityId(
                              event.target.value
                            )
                          }
                        >
                          <option
                            value={item.left.entityId}
                          >
                            {item.left.sourceKey}
                            {" · "}
                            {item.left.name}
                          </option>

                          <option
                            value={item.right.entityId}
                          >
                            {item.right.sourceKey}
                            {" · "}
                            {item.right.name}
                          </option>
                        </select>
                      </label>
                    )}


                    {decisionType==="rename"&&(
                      <label>
                        Governed Company name
                        <input
                          value={decisionTargetName}
                          onChange={event=>
                            setDecisionTargetName(
                              event.target.value
                            )
                          }
                        />
                      </label>
                    )}


                    <label>
                      Governance rationale
                      <textarea
                        rows={3}
                        value={decisionRationale}
                        onChange={event=>
                          setDecisionRationale(
                            event.target.value
                          )
                        }
                      />
                    </label>


                    <div>
                      <button
                        type="button"
                        disabled={
                          decisionRationale.trim()
                            .length<10
                          ||(
                            ["rename","exclude"]
                              .includes(decisionType)
                            &&Number(
                              decisionSubjectEntityId
                            )<=0
                          )
                          ||(
                            decisionType==="rename"
                            &&!decisionTargetName.trim()
                          )
                        }
                        onClick={()=>
                          void saveDecision(item)
                        }
                      >
                        Record governed decision
                      </button>

                      <button
                        type="button"
                        onClick={()=>
                          setActiveMappingId(
                            undefined
                          )
                        }
                      >
                        Cancel
                      </button>
                    </div>

                  </div>
                )}

              </article>
            ))}

          </div>


          <div className="rdl-publication-actions">
            <Link to="/intelligence">
              <GitCompareArrows size={16}/>
              {" "}Cross-RDL Intelligence
            </Link>

            <Link to="/governance">
              <ShieldCheck size={16}/>
              {" "}Mapping Governance
            </Link>
          </div>

        </section>
      )}


      {selectedEntity&&(
        <section
          className="rdl-hierarchy-section"
          aria-labelledby="company-composition-heading"
        >
          <h2 id="company-composition-heading">
            <Layers3 size={20}/>
            {" "}5. Create Company adoption draft
          </h2>

          <p className="rdl-intelligence-copy">
            The draft preserves the exact L1 contributor.
            It still requires the normal Extension
            Governance lifecycle before publication.
          </p>


          {adoptionBlockedReason&&(
            <div
              className=
                "rdl-governance-feedback rdl-governance-feedback-error"
              role="status"
            >
              {adoptionBlockedReason}
            </div>
          )}


          <div className="rdl-review-editor">

            <label>
              Entity type
              <input
                value={selectedEntity.entityType}
                readOnly
              />
            </label>

            <label>
              Company native identifier
              <input
                value=
                  {companyEntity.targetNativeIdentifier}
                onChange={event=>
                  setCompanyEntity({
                    ...companyEntity,
                    targetNativeIdentifier:
                      event.target.value,
                  })
                }
              />
            </label>

            <label>
              Company name
              <input
                value={
                  selectedRenameNames[0]
                  ??companyEntity.targetName
                }
                onChange={event=>
                  setCompanyEntity({
                    ...companyEntity,
                    targetName:event.target.value,
                  })
                }
                readOnly={
                  selectedRenameNames.length===1
                }
              />
            </label>

            <label>
              Company definition
              <textarea
                rows={3}
                value={
                  companyEntity.targetDefinition
                }
                onChange={event=>
                  setCompanyEntity({
                    ...companyEntity,
                    targetDefinition:
                      event.target.value,
                  })
                }
              />
            </label>

            <label>
              Adoption rationale
              <textarea
                rows={3}
                value={companyEntity.rationale}
                onChange={event=>
                  setCompanyEntity({
                    ...companyEntity,
                    rationale:event.target.value,
                  })
                }
              />
            </label>

            <button
              type="button"
              disabled={
                Boolean(adoptionBlockedReason)
                ||companyEntity.rationale
                    .trim().length<10
                ||!companyEntity
                    .targetNativeIdentifier.trim()
              }
              onClick={()=>
                void createAdoptionDraft()
              }
            >
              <ShieldCheck size={16}/>
              {" "}
              Create governed Company adoption draft
            </button>

          </div>

        </section>
      )}


      <section
        className="rdl-hierarchy-section"
        aria-labelledby="final-governance-heading"
      >
        <h2 id="final-governance-heading">
          <CheckCircle2 size={20}/>
          {" "}6. Govern and publish
        </h2>

        <p className="rdl-intelligence-copy">
          Resolve all governance before publication.
          Explicitly deferred collisions fail closed.
          Merge decisions require explicit
          component-level composition rather than
          automatic semantic collapse.
        </p>

        <div className="rdl-publication-actions">

          <Link to="/extensions">
            <ShieldCheck size={16}/>
            {" "}Extension Governance
          </Link>

          <Link to="/publication">
            <PackageCheck size={16}/>
            {" "}Effective Publication
          </Link>

        </div>
      </section>


      <div className="rdl-intelligence-warning">
        <ShieldCheck size={20}/>
        <div>
          <strong>
            RDL Explorer / DataGate boundary
          </strong>

          <p>
            RDL Explorer governs Company-standard
            composition and publication. DataGate
            consumes the published effective standard
            and never resolves raw L1 collisions itself.
          </p>
        </div>
      </div>

    </div>
  );
}
