import {
  BookOpen, Boxes, CircleGauge, Database, FileText, CalendarRange, ClipboardList, GitBranch, Info,
  CircleHelp, Mail, Inbox, Menu, Sparkles, Shapes, Ruler, ShieldCheck, Tags, LibraryBig, X,
  UserRoundCheck, ChevronDown, Settings2, Workflow, BrainCircuit,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { GlobalRdlSearch } from "./GlobalRdlSearch";
import { RdlScopeSelector } from "./RdlScopeSelector";

const PILOT_FEEDBACK_EMAIL = "alessandro@papioconsulting.eu";
const NAV_STORAGE_KEY = "rdl-explorer:nav-sections";

type NavItem = { label: string; to: string; icon: typeof CircleGauge };
type NavSection = { label: string; icon: typeof CircleGauge; alwaysOpen?: boolean; items: NavItem[] };

const navigation: NavSection[] = [
  { label: "Explore", icon: CircleGauge, alwaysOpen: true, items: [{ label: "Overview", to: "/", icon: CircleGauge }, { label: "RDL Catalogue", to: "/rdls", icon: LibraryBig }] },
  { label: "Classes", icon: Tags, items: [{ label: "Tag Classes", to: "/classes/tag", icon: Tags }, { label: "Equipment Classes", to: "/classes/equipment", icon: Boxes }] },
  { label: "Information", icon: FileText, items: [{ label: "Document Types", to: "/documents", icon: FileText }, { label: "Disciplines", to: "/disciplines", icon: Shapes }, { label: "Lifecycle Requirements", to: "/lifecycle", icon: CalendarRange }] },
  { label: "Reference", icon: BookOpen, items: [{ label: "Data Dictionary", to: "/dictionary", icon: BookOpen }, { label: "Source Standards", to: "/standards", icon: Database }, { label: "Units of Measure", to: "/units", icon: Ruler }] },
  { label: "Model", icon: GitBranch, items: [{ label: "Data Model", to: "/model", icon: GitBranch }] },
  { label: "Operate", icon: CircleGauge, items: [{ label: "Standards Control Tower", to: "/control-tower", icon: CircleGauge }, { label: "My Work Queue", to: "/work-queue", icon: Inbox }] },
  { label: "Govern", icon: Workflow, items: [{ label: "Cross-RDL Intelligence", to: "/intelligence", icon: GitBranch }, { label: "Mapping Governance", to: "/governance", icon: ShieldCheck }, { label: "Enterprise RDL Hierarchy", to: "/hierarchy", icon: LibraryBig }, { label: "Extension Governance", to: "/extensions", icon: ShieldCheck }, { label: "Effective Publication", to: "/publication", icon: LibraryBig }, { label: "Package Distribution", to: "/distribution", icon: LibraryBig }, { label: "Consumer Integration", to: "/integration", icon: LibraryBig }, { label: "Release Impact", to: "/impact", icon: GitBranch }, { label: "Migration Planning", to: "/migration", icon: ClipboardList }] },
  { label: "AI", icon: BrainCircuit, items: [{ label: "AI Standards Intelligence", to: "/ai-intelligence", icon: Sparkles }, { label: "AI Trust & Evaluation", to: "/ai-trust", icon: ShieldCheck }, { label: "AI Assistant", to: "/assistant", icon: Sparkles }] },
  { label: "Administration", icon: Settings2, items: [{ label: "Identity & Access", to: "/identity-admin", icon: UserRoundCheck }, { label: "Organizations & Tenancy", to: "/tenant-admin", icon: LibraryBig }] },
  { label: "Contract", icon: ClipboardList, items: [{ label: "CIS Builder", to: "/cis", icon: ClipboardList }] },
  { label: "Quality", icon: ShieldCheck, items: [{ label: "Validation", to: "/validation", icon: ShieldCheck }] },
  { label: "Help", icon: CircleHelp, items: [{ label: "About RDL Explorer", to: "/about", icon: Info }, { label: "User Guide", to: "/help", icon: CircleHelp }] },
];

const ADMIN_ROUTES = ["/identity-admin", "/tenant-admin"];
const MULTI_RDL_ROUTES = ["/control-tower", "/work-queue", "/intelligence", "/governance", "/hierarchy", "/extensions", "/publication", "/distribution", "/integration", "/impact", "/migration", "/ai-intelligence", "/ai-trust"];

function activeSectionFor(pathname: string) {
  return navigation.find((section) => section.items.some((item) => item.to === "/" ? pathname === "/" : pathname.startsWith(item.to)))?.label;
}

export function AppShell() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const activeSection = activeSectionFor(location.pathname);
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set(["Explore"]);
    try { return new Set(JSON.parse(window.localStorage.getItem(NAV_STORAGE_KEY) || "[]")); }
    catch { return new Set(["Explore"]); }
  });

  useEffect(() => {
    if (!activeSection) return;
    setExpanded((current) => {
      if (current.has(activeSection)) return current;
      const next = new Set(current); next.add(activeSection); return next;
    });
  }, [activeSection]);
  useEffect(() => { window.localStorage.setItem(NAV_STORAGE_KEY, JSON.stringify([...expanded])); }, [expanded]);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(".navigation .nav-link-active")?.scrollIntoView({ block: "nearest" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [location.pathname, expanded]);

  const scopeMode = useMemo(() => ADMIN_ROUTES.some((route) => location.pathname.startsWith(route)) ? "hidden" : MULTI_RDL_ROUTES.some((route) => location.pathname.startsWith(route)) ? "filter" : "scope", [location.pathname]);

  function toggleSection(label: string) {
    setExpanded((current) => { const next = new Set(current); next.has(label) ? next.delete(label) : next.add(label); return next; });
  }

  return (
    <div className="app">
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><GitBranch size={20} strokeWidth={2.25} /></div>
          <div><div className="brand-name">RDL</div><div className="brand-subtitle">Explorer</div></div>
          <span className="pilot-badge">Pilot</span>
          <button className="sidebar-close" type="button" aria-label="Close navigation" onClick={() => setSidebarOpen(false)}><X size={20} /></button>
        </div>

        <nav className="navigation" aria-label="Primary navigation">
          {navigation.map((section) => {
            const SectionIcon = section.icon;
            const isOpen = section.alwaysOpen || expanded.has(section.label) || activeSection === section.label;
            return (
              <div className={`nav-section ${isOpen ? "nav-section-open" : ""}`} key={section.label}>
                {section.alwaysOpen ? <div className="nav-heading nav-heading-static"><SectionIcon size={13}/><span>{section.label}</span></div> : (
                  <button className="nav-heading nav-heading-button" type="button" aria-expanded={isOpen} onClick={() => toggleSection(section.label)}>
                    <SectionIcon size={13}/><span>{section.label}</span><ChevronDown size={14} className="nav-section-chevron" />
                  </button>
                )}
                {isOpen && <div className="nav-items">
                  {section.items.map((item) => { const Icon = item.icon; return (
                    <NavLink key={item.to} to={item.to} end={item.to === "/"} onClick={() => setSidebarOpen(false)} className={({ isActive }) => `nav-link ${isActive ? "nav-link-active" : ""}`}>
                      <Icon size={17} strokeWidth={1.9} /><span>{item.label}</span>
                    </NavLink>
                  ); })}
                </div>}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-footer-label">Loaded RDLs</div>
          <div className="sidebar-version">CFIHOS 2.0 + 2 candidate extensions</div>
          <a className="pilot-feedback-link" href={`mailto:${PILOT_FEEDBACK_EMAIL}?subject=RDL%20Explorer%20pilot%20feedback`}><Mail size={14} />Send pilot feedback</a>
        </div>
      </aside>

      {sidebarOpen && <button type="button" className="sidebar-overlay" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}

      <div className="workspace" style={{ height: "100vh", minHeight: 0, overflow: "hidden" }}>
        <header className="topbar">
          <button type="button" className="mobile-menu" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}><Menu size={21} /></button>
          <GlobalRdlSearch />
          {scopeMode !== "hidden" && <RdlScopeSelector mode={scopeMode} />}
          {scopeMode === "hidden" && <span className="topbar-context-label"><Settings2 size={15}/> Administration</span>}
        </header>
        <main className="main-content" tabIndex={0} style={{ height: "calc(100vh - var(--topbar-height))", minHeight: 0, overflowX: "hidden", overflowY: "auto", overscrollBehavior: "contain" }}><Outlet /></main>
      </div>
    </div>
  );
}
