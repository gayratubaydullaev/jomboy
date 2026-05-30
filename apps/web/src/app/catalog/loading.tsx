export default function CatalogLoading() {
  return (
    <div className="container py-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-64 rounded-lg bg-muted animate-pulse" />
      ))}
    </div>
  );
}
