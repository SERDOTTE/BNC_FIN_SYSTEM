type StatCardProps = {
  title: string;
  value: string;
  caption: string;
  tone: "positive" | "warning" | "danger";
};

export function StatCard({ title, value, caption, tone }: StatCardProps) {
  return (
    <article className="stat-card">
      <span className={`chip ${tone}`}>{title}</span>
      <strong>{value}</strong>
      <span className="subtle">{caption}</span>
    </article>
  );
}