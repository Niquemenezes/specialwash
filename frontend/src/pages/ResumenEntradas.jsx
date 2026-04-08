import React, { useContext, useEffect, useMemo, useState } from "react";
import { Context } from "../store/appContext";
import GoldSelect from "../component/GoldSelect.jsx";

/* ── Iconos SVG ─────────────────────────────────────────────────── */
const ICONS = {
  report:  (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>),
  filter:  (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>),
  print:   (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>),
  csv:     (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>),
  search:  (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>),
  clear:   (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>),
};



const number = (v) =>

  v === null || v === undefined || v === "" ? 0 : Number(v) || 0;



const fmtDateTime = (s) => {

  const d = new Date(s);

  return isNaN(d.getTime())

    ? "-"

    : d.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });

};



export default function ResumenEntradas() {

  const { store, actions } = useContext(Context);



  const imprimir = () => window.print();



  const [desde, setDesde] = useState("");

  const [hasta, setHasta] = useState("");

  const [proveedorId, setProveedorId] = useState("");

  const [productoId, setProductoId] = useState("");

  const [q, setQ] = useState("");

  const [loading, setLoading] = useState(false);



  useEffect(() => {

    actions.getProveedores();

    actions.getProductos();



    const load = async () => {

      setLoading(true);

      try {

        await actions.getEntradas();

      } finally {

        setLoading(false);

      }

    };



    load();

    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, []);



  // Auto-filtrar cuando cambien los valores (con debounce para búsqueda)

  useEffect(() => {

    const timeoutId = setTimeout(() => {

      if (desde || hasta || proveedorId || productoId || q.trim()) {

        aplicar();

      }

    }, q.trim() ? 500 : 0); // 500ms debounce para búsqueda de texto



    return () => clearTimeout(timeoutId);

    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, [desde, hasta, proveedorId, productoId, q]);



  // Aplicar filtros

  const aplicar = async () => {

    setLoading(true);

    try {

      await actions.getEntradas({

        desde: desde || undefined,

        hasta: hasta || undefined,

        proveedor_id: proveedorId || undefined,

        producto_id: productoId || undefined,

        q: q.trim() || undefined,

      });

    } finally {

      setLoading(false);

    }

  };



  const limpiar = async () => {

    setDesde("");

    setHasta("");

    setProveedorId("");

    setProductoId("");

    setQ("");

    setLoading(true);

    try {

      await actions.getEntradas();

    } finally {

      setLoading(false);

    }

  };



  // Normalización de entradas

  const entradas = useMemo(() => {

    return (store.entradas || []).map((e) => {

      const cantidad = number(e.cantidad);



      // Obtener precio sin IVA (puede venir del backend)

      const precioSinIva = number(e.precio_sin_iva);

      const porcentajeIva = number(e.porcentaje_iva ?? 21);

      const valorIva =

        number(e.valor_iva) ||

        (precioSinIva > 0 ? (precioSinIva * porcentajeIva) / 100 : 0);

      const precioConIva = number(e.precio_con_iva) || precioSinIva + valorIva;



      return {

        id: e.id,

        fecha: e.fecha || e.created_at,

        cantidad,

        numero_albaran: e.numero_documento || e.numero_albaran || "",

        precio_sin_iva: precioSinIva,

        porcentaje_iva: porcentajeIva,

        valor_iva: valorIva,

        precio_con_iva: precioConIva,

        // Mapear producto y proveedor correctamente

        producto: e.producto

          ? {

              id: e.producto.id,

              nombre: e.producto.nombre,

            }

          : {

              id: e.producto_id,

              nombre: e.producto_nombre || "",

            },

        proveedor: e.proveedor

          ? {

              id: e.proveedor.id,

              nombre: e.proveedor.nombre,

            }

          : {

              id: e.proveedor_id,

              nombre: e.proveedor_nombre || "",

            },

      };

    });

  }, [store.entradas]);



  // Filtro en cliente (ya no es necesario, todo se hace en backend)

  const filtradas = useMemo(() => {

    return [...entradas].sort(

      (a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0)

    );

  }, [entradas])



  // Totales

  const tot = useMemo(

    () =>

      filtradas.reduce(

        (acc, r) => {

          acc.cant += r.cantidad;

          acc.sin += r.precio_sin_iva;

          acc.con += r.precio_con_iva;

          acc.iva += r.valor_iva;

          return acc;

        },

        { cant: 0, sin: 0, con: 0, iva: 0 }

      ),

    [filtradas]

  );



  // Export CSV

  const exportCSV = () => {

    const headers = [

      "Fecha",

      "Producto",

      "Proveedor",

      "Cantidad",

      "Precio_sin_IVA",

      "%IVA",

      "Valor_IVA",

      "Precio_con_IVA",

      "Documento",

    ];

    const lines = filtradas.map((r) =>

      [

        fmtDateTime(r.fecha),

        (r.producto?.nombre || "").replace(/,/g, " "),

        (r.proveedor?.nombre || "").replace(/,/g, " "),

        r.cantidad,

        r.precio_sin_iva.toFixed(2),

        r.porcentaje_iva ? r.porcentaje_iva.toFixed(2) : "",

        r.valor_iva.toFixed(2),

        r.precio_con_iva.toFixed(2),

        r.numero_albaran || "",

      ].join(",")

    );



    const csv = [headers.join(","), ...lines].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });



    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");

    a.href = url;

    a.download = `informe_entradas_${Date.now()}.csv`;

    a.click();

    URL.revokeObjectURL(url);

  };



  // -------------------------------------------------------------------
  // RETURN — diseño premium
  // -------------------------------------------------------------------
  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-title { display: block !important; }
          body { margin: 0; padding: 16px; }
          .table { font-size: 11px; }
          .table th, .table td { padding: 6px; }
        }
        @media screen { .print-title { display: none; } }
      `}</style>

      <div className="sw-ent-wrapper">
        {/* ── Hero ──────────────────────────────────────────────── */}
        <div className="sw-veh-hero no-print">
          <div className="sw-veh-hero-inner container">
            <div className="sw-veh-hero-body">
              <div className="sw-veh-hero-icon">
                <span style={{ width: 24, height: 24, display: "flex" }}>{ICONS.report}</span>
              </div>
              <div style={{ flex: 1 }}>
                <p className="sw-home-eyebrow" style={{ marginBottom: "0.2rem" }}>Inventario · Entradas</p>
                <h1 className="sw-veh-hero-title">Informe de Entradas</h1>
                <p className="sw-veh-hero-sub">Historial de compras y reabastecimiento por período, proveedor y producto</p>
              </div>
              <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                <button className="sw-ent-submit-btn" onClick={aplicar} style={{ padding: "0.6rem 1.25rem" }}>
                  <span style={{ width: 16, height: 16, display: "inline-flex" }}>{ICONS.search}</span>
                  Aplicar
                </button>
                <button onClick={limpiar} style={{
                  display: "inline-flex", alignItems: "center", gap: "0.5rem",
                  padding: "0.6rem 1.1rem", borderRadius: 999, border: "1px solid var(--sw-border)",
                  background: "transparent", color: "var(--sw-muted)", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer",
                }}>
                  <span style={{ width: 16, height: 16, display: "inline-flex" }}>{ICONS.clear}</span>
                  Limpiar
                </button>
                <button onClick={exportCSV} style={{
                  display: "inline-flex", alignItems: "center", gap: "0.5rem",
                  padding: "0.6rem 1.1rem", borderRadius: 999, border: "1px solid rgba(34,197,94,0.4)",
                  background: "rgba(34,197,94,0.08)", color: "#22c55e", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer",
                }}>
                  <span style={{ width: 16, height: 16, display: "inline-flex" }}>{ICONS.csv}</span>
                  CSV
                </button>
                <button onClick={imprimir} style={{
                  display: "inline-flex", alignItems: "center", gap: "0.5rem",
                  padding: "0.6rem 1.1rem", borderRadius: 999, border: "1px solid var(--sw-border)",
                  background: "transparent", color: "var(--sw-muted)", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer",
                }}>
                  <span style={{ width: 16, height: 16, display: "inline-flex" }}>{ICONS.print}</span>
                  Imprimir
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="container sw-ent-content" style={{ maxWidth: 1140 }}>

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
                  <label className="sw-plbl">Proveedor</label>
                  <GoldSelect value={proveedorId} onChange={(v) => setProveedorId(v)} placeholder="Todos"
                    options={(store.proveedores || []).map((p) => ({ value: p.id, label: p.nombre }))} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  <label className="sw-plbl">Producto</label>
                  <GoldSelect value={productoId} onChange={(v) => setProductoId(v)} placeholder="Todos"
                    options={(store.productos || []).map((p) => ({ value: p.id, label: p.nombre }))} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", gridColumn: "span 2" }}>
                  <label className="sw-plbl">Buscar (producto / proveedor / doc)</label>
                  <input className="form-control sw-pinput" placeholder="Escribe para filtrar…" value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          {/* ── Tarjetas resumen ──────────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem" }} className="no-print">
            {[
              { label: "Registros",      value: filtradas.length,           color: "var(--sw-accent,#d4af37)" },
              { label: "Cantidad total", value: tot.cant,                   color: "#38bdf8" },
              { label: "Total sin IVA",  value: tot.sin.toFixed(2) + " €",  color: "var(--sw-muted)" },
              { label: "Total con IVA",  value: tot.con.toFixed(2) + " €",  color: "#22c55e" },
            ].map((item) => (
              <div key={item.label} style={{
                background: "var(--sw-surface)", border: "1px solid var(--sw-border)",
                borderRadius: 14, padding: "1rem 1.25rem",
                display: "flex", flexDirection: "column", gap: "0.25rem",
                animation: "sw-fade-up 0.4s ease both",
              }}>
                <span style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--sw-muted)" }}>{item.label}</span>
                <span style={{ fontSize: "1.35rem", fontWeight: 800, color: item.color }}>{item.value}</span>
              </div>
            ))}
          </div>

          {/* ── Tabla ─────────────────────────────────────────── */}
          <h2 className="print-title" style={{ marginBottom: "20px" }}>Resumen de Entradas</h2>

          <div className="sw-ent-table-card">
            <div className="sw-ent-table-header no-print">
              <p className="sw-home-eyebrow" style={{ marginBottom: 0 }}>Resultados</p>
              <h3 className="sw-ent-table-title">Movimientos de entrada</h3>
            </div>
            <div className="table-responsive">
              <table className="table mb-0 sw-ent-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Producto</th>
                    <th>Proveedor</th>
                    <th className="text-end">Cantidad</th>
                    <th className="text-end">Sin IVA</th>
                    <th className="text-end">% IVA</th>
                    <th className="text-end">IVA</th>
                    <th className="text-end">Con IVA</th>
                    <th>Doc.</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={9} style={{ textAlign: "center", padding: "2rem", color: "var(--sw-muted)", fontSize: "0.875rem" }}>
                        Cargando…
                      </td>
                    </tr>
                  )}
                  {!loading && filtradas.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ textAlign: "center", padding: "2rem", color: "var(--sw-muted)", fontSize: "0.875rem" }}>
                        Sin resultados.
                      </td>
                    </tr>
                  )}
                  {!loading && filtradas.map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontSize: "0.8rem", color: "var(--sw-muted)", whiteSpace: "nowrap" }}>{fmtDateTime(r.fecha)}</td>
                      <td style={{ fontWeight: 600, fontSize: "0.85rem" }}>{r.producto?.nombre || "-"}</td>
                      <td style={{ fontSize: "0.82rem", color: "var(--sw-muted)" }}>{r.proveedor?.nombre || "-"}</td>
                      <td className="text-end" style={{ fontWeight: 700, color: "var(--sw-accent,#d4af37)" }}>{r.cantidad}</td>
                      <td className="text-end" style={{ fontSize: "0.82rem" }}>{isFinite(r.precio_sin_iva) ? r.precio_sin_iva.toFixed(2) : "0.00"} €</td>
                      <td className="text-end" style={{ fontSize: "0.78rem", color: "var(--sw-muted)" }}>
                        {r.porcentaje_iva && isFinite(r.porcentaje_iva) ? r.porcentaje_iva.toFixed(2) + " %" : "-"}
                      </td>
                      <td className="text-end" style={{ fontSize: "0.82rem" }}>{isFinite(r.valor_iva) ? r.valor_iva.toFixed(2) : "0.00"} €</td>
                      <td className="text-end" style={{ fontWeight: 600, color: "#22c55e" }}>{isFinite(r.precio_con_iva) ? r.precio_con_iva.toFixed(2) : "0.00"} €</td>
                      <td style={{ fontSize: "0.78rem", color: "var(--sw-muted)" }}>{r.numero_albaran || "-"}</td>
                    </tr>
                  ))}
                </tbody>
                {!loading && filtradas.length > 0 && (
                  <tfoot>
                    <tr style={{ borderTop: "2px solid var(--sw-border)" }}>
                      <td colSpan={3} style={{ fontWeight: 700, padding: "0.75rem 0.9rem", fontSize: "0.82rem", color: "var(--sw-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Totales</td>
                      <td className="text-end" style={{ fontWeight: 800, color: "var(--sw-accent,#d4af37)", padding: "0.75rem 0.9rem" }}>{tot.cant}</td>
                      <td className="text-end" style={{ fontWeight: 700, padding: "0.75rem 0.9rem" }}>{tot.sin.toFixed(2)} €</td>
                      <td></td>
                      <td className="text-end" style={{ fontWeight: 700, padding: "0.75rem 0.9rem" }}>{tot.iva.toFixed(2)} €</td>
                      <td className="text-end" style={{ fontWeight: 800, color: "#22c55e", padding: "0.75rem 0.9rem" }}>{tot.con.toFixed(2)} €</td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* ── Tarjetas móvil ────────────────────────────────── */}
          <div className="d-md-none no-print">
            {loading && <div style={{ textAlign: "center", padding: "2rem", color: "var(--sw-muted)" }}>Cargando…</div>}
            {!loading && filtradas.length === 0 && <div style={{ textAlign: "center", padding: "2rem", color: "var(--sw-muted)" }}>Sin resultados.</div>}
            {!loading && filtradas.map((r) => (
              <div key={r.id} style={{
                background: "var(--sw-surface)", border: "1px solid var(--sw-border)",
                borderRadius: 14, padding: "1rem 1.25rem", marginBottom: "0.75rem",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
                  <strong style={{ fontSize: "0.9rem" }}>{r.producto?.nombre || "-"}</strong>
                  <span style={{ background: "var(--sw-accent,#d4af37)", color: "#08090d", fontWeight: 700, fontSize: "0.75rem", padding: "0.2rem 0.6rem", borderRadius: 999 }}>
                    x{r.cantidad}
                  </span>
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--sw-muted)", marginBottom: "0.25rem" }}>{fmtDateTime(r.fecha)}</div>
                {r.proveedor?.nombre && <div style={{ fontSize: "0.78rem", marginBottom: "0.2rem" }}>Proveedor: {r.proveedor.nombre}</div>}
                <div style={{ fontSize: "0.78rem", color: "var(--sw-muted)" }}>
                  Sin IVA: {r.precio_sin_iva.toFixed(2)} € · IVA: {r.valor_iva.toFixed(2)} € ({r.porcentaje_iva ? r.porcentaje_iva.toFixed(0) : "0"}%)
                </div>
                <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#22c55e", marginTop: "0.25rem" }}>
                  Con IVA: {r.precio_con_iva.toFixed(2)} €
                </div>
                {r.numero_albaran && <div style={{ fontSize: "0.75rem", color: "var(--sw-muted)", marginTop: "0.2rem" }}>Doc: {r.numero_albaran}</div>}
              </div>
            ))}
          </div>

        </div>
      </div>
    </>
  );
}
