type PlaceholderPageProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function PlaceholderPage({
  eyebrow,
  title,
  description,
}: PlaceholderPageProps) {
  return (
    <div className="placeholder-page">
      <div className="eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      <p>{description}</p>

      <div className="placeholder-panel">
        <div className="placeholder-pulse" />
        <div>
          <strong>Coming in the next development step</strong>
          <span>
            This area will be connected to your existing CFIHOS data and
            functionality.
          </span>
        </div>
      </div>
    </div>
  );
}