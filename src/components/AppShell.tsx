import {
  BookOpen,
  Boxes,
  CircleGauge,
  Database,
  FileText,
  CalendarRange,
  ClipboardList,
  GitBranch,
  Info,
  CircleHelp,
  Mail,
  Menu,
  Sparkles,
  Shapes,
  Ruler,
  ShieldCheck,
  Tags,
  LibraryBig,
  X,
} from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { GlobalRdlSearch } from "./GlobalRdlSearch";
import { RdlScopeSelector } from "./RdlScopeSelector";

const PILOT_FEEDBACK_EMAIL = "alessandro@papioconsulting.eu";

const navigation = [
  { label: "Explore", items: [{ label: "Overview", to: "/", icon: CircleGauge }, { label: "RDL Catalogue", to: "/rdls", icon: LibraryBig }] },
  { label: "Classes", items: [{ label: "Tag Classes", to: "/classes/tag", icon: Tags }, { label: "Equipment Classes", to: "/classes/equipment", icon: Boxes }] },
  { label: "Information", items: [{ label: "Document Types", to: "/documents", icon: FileText }, { label: "Disciplines", to: "/disciplines", icon: Shapes }, { label: "Lifecycle Requirements", to: "/lifecycle", icon: CalendarRange }] },
  { label: "Reference", items: [{ label: "Data Dictionary", to: "/dictionary", icon: BookOpen }, { label: "Source Standards", to: "/standards", icon: Database }, { label: "Units of Measure", to: "/units", icon: Ruler }] },
  { label: "Model", items: [{ label: "Data Model", to: "/model", icon: GitBranch }] },
  { label: "Intelligence", items: [{ label: "Cross-RDL Intelligence", to: "/intelligence", icon: GitBranch }, { label: "Mapping Governance", to: "/governance", icon: ShieldCheck }, { label: "Enterprise RDL Hierarchy", to: "/hierarchy", icon: LibraryBig }, { label: "Extension Governance", to: "/extensions", icon: ShieldCheck }, { label: "Effective Publication", to: "/publication", icon: LibraryBig }, { label: "Package Distribution", to: "/distribution", icon: LibraryBig }, { label: "Consumer Integration", to: "/integration", icon: LibraryBig }, { label: "Release Impact", to: "/impact", icon: GitBranch }, { label: "Migration Planning", to: "/migration", icon: ClipboardList }, { label: "AI Assistant", to: "/assistant", icon: Sparkles }] },
  { label: "Contract", items: [{ label: "CIS Builder", to: "/cis", icon: ClipboardList }] },
  { label: "Quality", items: [{ label: "Validation", to: "/validation", icon: ShieldCheck }] },
  { label: "Help", items: [{ label: "About RDL Explorer", to: "/about", icon: Info }, { label: "User Guide", to: "/help", icon: CircleHelp }] },
];

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app">
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><GitBranch size={20} strokeWidth={2.25} /></div>
          <div><div className="brand-name">RDL</div><div className="brand-subtitle">Explorer</div></div>
          <span className="pilot-badge">Pilot</span>
          <button className="sidebar-close" type="button" aria-label="Close navigation" onClick={() => setSidebarOpen(false)}><X size={20} /></button>
        </div>

        <nav className="navigation">
          {navigation.map((section) => (
            <div className="nav-section" key={section.label}>
              <div className="nav-heading">{section.label}</div>
              <div className="nav-items">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink key={item.to} to={item.to} end={item.to === "/"} onClick={() => setSidebarOpen(false)} className={({ isActive }) => `nav-link ${isActive ? "nav-link-active" : ""}`}>
                      <Icon size={18} strokeWidth={1.9} /><span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
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
          <RdlScopeSelector />
        </header>

        <main className="main-content" tabIndex={0} style={{ height: "calc(100vh - var(--topbar-height))", minHeight: 0, overflowX: "hidden", overflowY: "auto", overscrollBehavior: "contain" }}><Outlet /></main>
      </div>
    </div>
  );
}
