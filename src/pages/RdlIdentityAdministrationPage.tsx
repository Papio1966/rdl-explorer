import { KeyRound, ShieldCheck, UserRoundCheck, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { ENTERPRISE_IDENTITY_DEMO } from "../rdl/enterpriseIdentityDemo";
import {
  changeDirectRole,
  changeGroupMapping,
  changeUserStatus,
  loadEnterpriseIdentitySession,
  loadIdentityAdminSummary,
  type EnterpriseIdentitySession,
  type IdentityAdminSummary,
} from "../rdl/enterpriseIdentityService";
import "./RdlIdentityAdministrationPage.css";

export function RdlIdentityAdministrationPage() {
  const [session, setSession] = useState<EnterpriseIdentitySession | null>(null);
  const [live, setLive] = useState<IdentityAdminSummary | null>(null);
  const [subject, setSubject] = useState("");
  const [role, setRole] = useState("");
  const [group, setGroup] = useState("");
  const [rationale, setRationale] = useState("");
  const [message, setMessage] = useState("");

  async function refresh() {
    const [nextSession, nextSummary] = await Promise.all([
      loadEnterpriseIdentitySession(),
      loadIdentityAdminSummary(),
    ]);
    setSession(nextSession);
    setLive(nextSession && nextSummary ? nextSummary : null);
    if (nextSummary) {
      setSubject((current) => current || nextSummary.users[0]?.subject_key || "");
      setRole((current) => current || nextSummary.availableRoles[0] || "");
    }
  }

  useEffect(() => { void refresh(); }, []);

  const data = live ?? ENTERPRISE_IDENTITY_DEMO;
  const demo = !live;

  async function mutate(action: () => Promise<unknown>, success: string) {
    setMessage("");
    try {
      await action();
      setMessage(success);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Identity administration request failed.");
    }
  }

  return (
    <div className="identity-admin-page">
      <header>
        <div className="identity-eyebrow"><KeyRound size={16} /> RDL-027 · Enterprise SSO, User Identity & Role Administration</div>
        <h1>Identity & access administration</h1>
        <p>Normalize trusted enterprise OIDC identity, map groups and roles, enforce separation-of-duties controls, and retain an append-only administration trail.</p>
      </header>

      <section className={`identity-mode ${demo ? "demo" : "live"}`}>
        <ShieldCheck size={18} />
        <div>
          <strong>{demo ? "Read-only identity demonstration" : "Enterprise SSO session active"}</strong>
          <span>{demo ? "No live directory or role-administration data is exposed without a trusted SSO session and identity-admin authorization." : `Signed in as ${session?.displayName} (${session?.email})`}</span>
        </div>
      </section>

      <section aria-labelledby="identity-principles">
        <h2 id="identity-principles">Access principles</h2>
        <div className="identity-principles">
          <article><UserRoundCheck /><strong>OIDC at the enterprise boundary</strong><span>The application consumes signed, normalized claims from the trusted SSO gateway; browser-provided identity is never trusted.</span></article>
          <article><UsersRound /><strong>Central role administration</strong><span>Direct roles and group mappings are explicit and auditable. Existing workflow authorization remains authoritative during migration.</span></article>
          <article><ShieldCheck /><strong>Separation of duties</strong><span>Identity administrators cannot grant themselves identity-admin authority, revoke their own identity-admin role, or disable their own account.</span></article>
        </div>
      </section>

      {!demo && (
        <section aria-labelledby="administration-heading">
          <h2 id="administration-heading">Administration</h2>
          <div className="identity-admin-controls">
            <label>User<select value={subject} onChange={(event) => setSubject(event.target.value)}>{data.users.map((user) => <option key={user.subject_key} value={user.subject_key}>{user.display_name} · {user.email}</option>)}</select></label>
            <label>Role<select value={role} onChange={(event) => setRole(event.target.value)}>{data.availableRoles.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label>Rationale<input value={rationale} onChange={(event) => setRationale(event.target.value)} placeholder="Required audit rationale" /></label>
            <div className="identity-button-row">
              <button type="button" onClick={() => void mutate(() => changeDirectRole({ action: "assign", subject, role, rationale }), "Role assigned.")}>Assign role</button>
              <button type="button" onClick={() => void mutate(() => changeDirectRole({ action: "revoke", subject, role, rationale }), "Role revoked.")}>Revoke role</button>
              <button type="button" onClick={() => void mutate(() => changeUserStatus({ subject, status: "disabled", rationale }), "User disabled.")}>Disable user</button>
              <button type="button" onClick={() => void mutate(() => changeUserStatus({ subject, status: "active", rationale }), "User re-enabled.")}>Re-enable user</button>
            </div>
            <label>Enterprise group<input value={group} onChange={(event) => setGroup(event.target.value)} placeholder="OIDC group claim" /></label>
            <div className="identity-button-row">
              <button type="button" onClick={() => void mutate(() => changeGroupMapping({ action: "create", group, role, rationale }), "Group mapping enabled.")}>Enable group mapping</button>
              <button type="button" onClick={() => void mutate(() => changeGroupMapping({ action: "disable", group, role, rationale }), "Group mapping disabled.")}>Disable group mapping</button>
            </div>
          </div>
          {message && <p role="status" className="identity-message">{message}</p>}
        </section>
      )}

      <section aria-labelledby="directory-heading">
        <h2 id="directory-heading">Enterprise identity directory</h2>
        <div className="identity-table" tabIndex={0} aria-label="Enterprise identity directory">
          <table><thead><tr><th>User</th><th>Subject</th><th>Status</th><th>Direct roles</th></tr></thead><tbody>{data.users.length ? data.users.map((user) => <tr key={user.subject_key}><th scope="row">{user.display_name}<br /><small>{user.email}</small></th><td><code>{user.subject_key}</code></td><td>{user.status}</td><td>{user.direct_roles.length ? user.direct_roles.join(", ") : "None"}</td></tr>) : <tr><td colSpan={4}>No enterprise identities recorded.</td></tr>}</tbody></table>
        </div>
      </section>

      <section aria-labelledby="group-heading">
        <h2 id="group-heading">Group-to-role mappings</h2>
        <div className="identity-table" tabIndex={0} aria-label="Enterprise group to role mappings">
          <table><thead><tr><th>Enterprise group</th><th>RDL role</th><th>Status</th></tr></thead><tbody>{data.groupMappings.length ? data.groupMappings.map((mapping, index) => <tr key={`${mapping.group_key}:${mapping.role_key}:${index}`}><th scope="row">{mapping.group_key}</th><td>{mapping.role_key}</td><td>{mapping.status}</td></tr>) : <tr><td colSpan={3}>No group mappings configured.</td></tr>}</tbody></table>
        </div>
      </section>

      <section className="identity-boundary" aria-labelledby="boundary-heading">
        <h2 id="boundary-heading">Deployment boundary</h2>
        <p>RDL Explorer does not implement an identity provider. Production deployment integrates with the enterprise IdP through an OIDC-capable gateway or platform identity layer, which validates the token and forwards only signed normalized claims. RDL Explorer then resolves application roles and lifecycle authorization.</p>
        <p><strong>No automatic privilege promotion.</strong> SSO authentication proves identity; it does not itself grant standards-governance authority.</p>
      </section>
    </div>
  );
}
