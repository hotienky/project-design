export function SectionPage({
  title,
  description,
  actions,
  wide,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <main className={`mx-auto grid w-full gap-4 p-6 ${wide ? "max-w-5xl" : "max-w-3xl"}`}>
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-heading text-lg font-semibold">{title}</h1>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
        {children}
      </main>
    </div>
  );
}
