import {
  ArrowRight,
  Boxes,
  FileText,
  GitBranch,
  Search,
  Tags,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState, type FormEvent } from "react";
import { useRdlScope } from "../rdl/RdlScopeContext";

const cards = [
  {
    title: "Tag Classes",
    description:
      "Browse the tag class hierarchy, definitions and associated properties.",
    icon: Tags,
    to: "/classes/tag",
    metric: "Explore classes",
  },
  {
    title: "Equipment Classes",
    description:
      "Navigate equipment classifications and their CFIHOS information requirements.",
    icon: Boxes,
    to: "/classes/equipment",
    metric: "Explore equipment",
  },
  {
    title: "Document Types",
    description:
      "Discover document types, disciplines and information requirements.",
    icon: FileText,
    to: "/documents",
    metric: "Browse documents",
  },
  {
    title: "Data Model",
    description:
      "Understand how CFIHOS entities relate across the information model.",
    icon: GitBranch,
    to: "/model",
    metric: "View relationships",
  },
];

export function HomePage() {
  const navigate = useNavigate();
  const { scope } = useRdlScope();
  const [query, setQuery] = useState("");
  function submitSearch(event: FormEvent) { event.preventDefault(); const value=query.trim(); if(value) navigate(`/search?q=${encodeURIComponent(value)}&source=${encodeURIComponent(scope)}`); }
  return (
    <div className="home-page">
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">CFIHOS · CCUS · Water / Desalination</div>

          <h1>
            Explore reference data.
            <br />
            Understand the source.
          </h1>

          <p>
            Search and navigate classes, properties, documents and reference data across multiple RDL packages while retaining source and release provenance.
          </p>
        </div>

        <form className="hero-search" onSubmit={submitSearch}>
          <Search size={21} />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="What are you looking for?" aria-label="Search loaded RDLs" />
          <button type="submit" disabled={!query.trim()}>Search</button>
        </form>
      </section>

      <section className="section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Explore</div>
            <h2>Browse the reference model</h2>
          </div>

          <p>
            Use the established CFIHOS deep views or the RDL Catalogue and global search for source-aware navigation across all loaded libraries.
          </p>
        </div>

        <div className="feature-grid">
          {cards.map((card) => {
            const Icon = card.icon;

            return (
              <Link className="feature-card" to={card.to} key={card.title}>
                <div className="feature-card-top">
                  <div className="feature-icon">
                    <Icon size={22} strokeWidth={1.8} />
                  </div>

                  <ArrowRight
                    className="feature-arrow"
                    size={19}
                    strokeWidth={1.8}
                  />
                </div>

                <div>
                  <h3>{card.title}</h3>
                  <p>{card.description}</p>
                </div>

                <div className="feature-metric">{card.metric}</div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="section getting-started">
        <div>
          <div className="eyebrow">Getting started</div>
          <h2>Multiple RDLs. Preserved provenance.</h2>
        </div>

        <div className="getting-started-copy">
          <p>
            Use Global Search to find typed entities across CFIHOS, CCUS and Water / Desalination. Every multi-RDL result retains its source, release and package identity.
          </p>

          <Link to="/rdls">
            Browse RDL catalogue
            <ArrowRight size={17} />
          </Link>
        </div>
      </section>
    </div>
  );
}