type SectionCardProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
};

export function SectionCard({ title, description, children }: SectionCardProps) {
  return (
    <section className="table-card">
      <div className="section-title">
        <div>
          <h3>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
      </div>
      <div>{children}</div>
    </section>
  );
}