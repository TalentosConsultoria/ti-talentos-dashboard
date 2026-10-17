export default function Carregando() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Carregando inventário</span>
      <div className="esqueleto" style={{ width: 220, height: 28, marginBottom: 12 }} />
      <div className="esqueleto" style={{ width: 340, height: 16, marginBottom: 24 }} />
      <div className="esqueleto" style={{ height: 104, marginBottom: 24 }} />
      <div className="esqueleto" style={{ height: 36, marginBottom: 16 }} />
      <div style={{ display: "grid", gap: 2 }}>
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="esqueleto" style={{ height: 42, opacity: 1 - i * 0.08 }} />
        ))}
      </div>
    </div>
  );
}
