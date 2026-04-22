import React, { useContext, useEffect, useMemo, useState } from "react";
import { Context } from "../store/appContext";
import GoldSelect from "../components/GoldSelect.jsx";
import Paginacion from "../components/Paginacion.jsx";
import EmptyState from "../components/EmptyState.jsx";

const POR_PAGINA = 50;

/* ── Iconos SVG ─────────────────────────────────────────────────── */
const ICONS = {
  historial: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l4 2"/></svg>),
  print:     (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>),
  filter:    (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>),
};

// Conversión segura a número
const toNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const fmtDateTime = (s) => {
  if (!s) return "-";
  const d = new Date(s);
  return isNaN(d.getTime())
    ? "-"
    : d.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
};

export default function HistorialSalidas() {
  const { store, actions } = useContext(Context);

  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [productoId, setProductoId] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [pagina, setPagina] = useState(1);

  useEffect(() => {
    actions.getProductos();

    const load = async () => {
      setLoading(true);
      try {
        await actions.getHistorialSalidas();
      } finally {
        setLoading(false);
      }
    };

    load();
    // eslint-disable-next-line
  }, []);

  const salidas = useMemo(
    () => store.historialSalidas || [],
    [store.historialSalidas]
  );

  // FILTROS
  const filtradas = useMemo(() => {
    let rows = salidas;

    if (productoId) {
      rows = rows.filter(
        (r) => String(r.producto_id) === String(productoId)
      );
    }

    if (desde) {
      const d = new Date(desde);
      rows = rows.filter((r) => new Date(r.fecha) >= d);
    }

    if (hasta) {
      const h = new Date(hasta);
      h.setHours(23, 59, 59, 999);
      rows = rows.filter((r) => new Date(r.fecha) <= h);
    }

    if (q.trim()) {
      const term = q.toLowerCase();
      rows = rows.filter((r) =>
        [
          r.producto_nombre,
          r.usuario_nombre,
          r.observaciones,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(term)
      );
    }

    return [...rows].sort(
      (a, b) => new Date(b.fecha) - new Date(a.fecha)
    );
  }, [salidas, desde, hasta, productoId, q]);

  // Reset página cuando cambian los filtros
  useEffect(() => { setPagina(1); }, [desde, hasta, productoId, q]);

  const paginadas = useMemo(
    () => filtradas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA),
    [filtradas, pagina]
  );

  // TOTALES (🔥 CLAVE)
  const tot = useMemo(
    () =>
      filtradas.reduce(
        (acc, r) => {
          acc.cant += toNumber(r.cantidad);
          acc.precio += toNumber(r.precio_total);
          return acc;
        },
        { cant: 0, precio: 0 }
      ),
    [filtradas]
  );

  const imprimir = () => window.print();

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          [class*="sw-sidebar"], .sw-sidebar-overlay { display: none !important; }
          body { margin: 0; padding: 16px; background: white !important; color: black !important; }
          body * { color: black !important; background: transparent !important; box-shadow: none !important; }
          .table { font-size: 11px; }
          .table th, .table td { padding: 6px; border-color: #ccc !important; }
        }
      `}</style>

      <div className="sw-ent-wrapper">
        {/* ── Hero ──────────────────────────────────────────────── */}
        <div className="sw-veh-hero no-print">
          <div className="sw-veh-hero-inner container">
            <div className="sw-veh-hero-body">
              <div className="sw-veh-hero-icon" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444" }}>
                <span style={{ width: 24, height: 24, display: "flex" }}>{ICONS.historial}</span>
              </div>
              <div style={{ flex: 1 }}>
                <p className="sw-home-eyebrow" style={{ marginBottom: "0.2rem" }}>Inventario · Salidas</p>
                <h1 className="sw-veh-hero-title">Historial de Salidas</h1>
                <p className="sw-veh-hero-sub">Trazabilidad de movimientos de stock por fecha y usuario</p>
              </div>
              <button className="sw-ent-submit-btn no-print" onClick={imprimir} style={{ padding: "0.6rem 1.4rem" }}>
                <span style={{ width: 16, height: 16, display: "inline-flex" }}>{ICONS.print}</span>
                Imprimir
              </button>
            </div>
          </div>
        </div>

        <div className="container sw-ent-content" style={{ maxWidth: 1100 }}>

          {/* ── Filtros ────────────────────────────────────────── */}
          <div className="sw-ent-card no-print">
            <div className="sw-ent-card-header">
              <div className="sw-ent-card-header-icon" style={{ background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.22)", color: "var(--sw-accent,#d4af37)" }}>
                <span style={{ width: 18, height: 18, display: "flex" }}>{ICONS.filter}</span>
              </div>
              <div>
                <p className="sw-ent-card-eyebrow">Filtros</p>
                <h2 className="sw-ent-card-title">Filtrar resultados</h2>
              </div>
            </div>
            <div className="sw-ent-card-body">
              <div className="sw-ent-grid">
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  <label className="sw-plbl">Desde</label>
                  <input type="date" className="form-control sw-pinput" value={desde} onChange={(e) => setDesde(e.target.value)} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  <label className="sw-plbl">Hasta</label>
                  <input type="date" className="form-control sw-pinput" value={hasta} onChange={(e) => setHasta(e.target.value)} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  <label className="sw-plbl">Producto</label>
                  <GoldSelect
                    value={productoId}
                    onChange={(v) => setProductoId(v)}
                    placeholder="Todos"
                    options={(store.productos || []).map((p) => ({ value: p.id, label: p.nombre }))}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", gridColumn: "span 2" }}>
                  <label className="sw-plbl">Buscar (producto / usuario / obs)</label>
                  <input className="form-control sw-pinput" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Escribe para filtrar…" />
                </div>
              </div>
            </div>
          </div>

          {/* ── Resumen ────────────────────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem" }} className="no-print">
            {[
              { label: "Registros", value: filtradas.length, color: "#ef4444" },
              { label: "Cantidad total", value: tot.cant, color: "var(--sw-accent,#d4af37)" },
              { label: "Gasto total", value: tot.precio.toFixed(2) + " €", color: "#22c55e" },
            ].map((item) => (
              <div key={item.label} style={{
                background: "var(--sw-surface)", border: "1px solid var(--sw-border)",
                borderRadius: 14, padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.25rem",
                animation: "sw-fade-up 0.4s ease both",
              }}>
                <span style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--sw-muted)" }}>{item.label}</span>
                <span style={{ fontSize: "1.4rem", fontWeight: 800, color: item.color }}>{item.value}</span>
              </div>
            ))}
          </div>

          {/* ── Tabla ──────────────────────────────────────────── */}
          <div className="sw-ent-table-card">
            <div className="sw-ent-table-header no-print">
              <p className="sw-home-eyebrow" style={{ marginBottom: 0 }}>Resultados</p>
              <h3 className="sw-ent-table-title">Movimientos de salida</h3>
            </div>
            <div className="table-responsive">
              <table className="table mb-0 sw-ent-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Producto</th>
                    <th className="text-end">Cantidad</th>
                    <th className="text-end">Precio unitario</th>
                    <th className="text-end">Precio total</th>
                    <th>Retirado por</th>
                    <th>Observaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", padding: "2rem", color: "var(--sw-muted)", fontSize: "0.875rem" }}>
                        Cargando…
                      </td>
                    </tr>
                  )}
                  {!loading && filtradas.length === 0 && (
                    <EmptyState
                      colSpan={7}
                      title="Sin resultados"
                      subtitle="No hay salidas que coincidan con los filtros aplicados."
                    />
                  )}
                  {!loading && paginadas.map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontSize: "0.8rem", color: "var(--sw-muted)", whiteSpace: "nowrap" }}>{fmtDateTime(r.fecha)}</td>
                      <td style={{ fontWeight: 600, fontSize: "0.85rem" }}>{r.producto_nombre || "-"}</td>
                      <td className="text-end" style={{ fontWeight: 700, color: "var(--sw-danger,#ef4444)" }}>{toNumber(r.cantidad)}</td>
                      <td className="text-end" style={{ fontSize: "0.82rem", color: "var(--sw-muted)" }}>
                        {toNumber(r.precio_unitario) ? toNumber(r.precio_unitario).toFixed(2) + " €" : "-"}
                      </td>
                      <td className="text-end" style={{ fontWeight: 600 }}>{toNumber(r.precio_total).toFixed(2)} €</td>
                      <td style={{ fontSize: "0.82rem", color: "var(--sw-muted)" }}>{r.usuario_nombre || "-"}</td>
                      <td style={{ fontSize: "0.78rem", color: "var(--sw-muted)" }}>{r.observaciones || "-"}</td>
                    </tr>
                  ))}
                </tbody>
                {!loading && filtradas.length > 0 && (
                  <tfoot>
                    <tr style={{ borderTop: "2px solid var(--sw-border)" }}>
                      <td colSpan={2} style={{ fontWeight: 700, padding: "0.75rem 0.9rem", fontSize: "0.82rem", color: "var(--sw-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Totales</td>
                      <td className="text-end" style={{ fontWeight: 800, color: "var(--sw-danger,#ef4444)", padding: "0.75rem 0.9rem" }}>{tot.cant}</td>
                      <td></td>
                      <td className="text-end" style={{ fontWeight: 800, color: "var(--sw-accent,#d4af37)", padding: "0.75rem 0.9rem" }}>{tot.precio.toFixed(2)} €</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
          <Paginacion
            total={filtradas.length}
            page={pagina}
            limit={POR_PAGINA}
            onChange={setPagina}
          />
        </div>
      </div>
    </>
  );
}

