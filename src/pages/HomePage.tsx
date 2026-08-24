import {
  ArrowRight,
  Boxes,
  FileText,
  GitBranch,
  Search,
  Tags,
} from "lucide-react";
import { Link } from "react-router-dom";

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
  return (
    <div className="home-page">
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">CFIHOS 2.0</div>

          <h1>
            Explore CFIHOS.
            <br />
            Understand the data.
          </h1>

          <p>
            Navigate classes, properties, documents and relationships across
            the CFIHOS reference data model from one connected workspace.
          </p>
        </div>

        <div className="hero-search">
          <Search size={21} />
          <input
            type="search"
            placeholder="What are you looking for?"
            aria-label="Search the CFIHOS model"
          />
          <span>Search</span>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Explore</div>
            <h2>Browse the standard</h2>
          </div>

          <p>
            Start with a CFIHOS information area and follow the relationships
            between entities.
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
          <h2>One model. Connected information.</h2>
        </div>

        <div className="getting-started-copy">
          <p>
            Use the navigation to explore CFIHOS by class, document,
            discipline or reference data. Later we'll connect global search
            directly to the underlying CFIHOS workbook.
          </p>

          <Link to="/classes/tag">
            Start exploring
            <ArrowRight size={17} />
          </Link>
        </div>
      </section>
    </div>
  );
}