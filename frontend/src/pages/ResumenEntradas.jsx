import React, { useContext, useEffect, useMemo, useState } from "react";
import { Context } from "../store/appContext";
import GoldSelect from "../components/GoldSelect.jsx";
import { confirmar } from "../utils/confirmar";

/* ── Iconos SVG ─────────────────────────────────────────────────── */
const ICONS = {
  report:  (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>),
  filter:  (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>),
  print:   (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>),
  csv:     (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>),
  search:  (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>),
  clear:   (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>),
  edit:    (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>),
  trash:   (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>),
};



const number = (v) =>

  v === null || v === undefined || v === "" ? 0 : Number(v) || 0;



const fmtDateTime = (s) => {

  const d = new Date(s);

  return isNaN(d.getTime())

    ? "-"

    : d.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });

};

const Feedback = ({ msg, type, onClose }) => {
  if (!msg) return null;

  const colors = {
    success: { border: "#22c55e", bg: "rgba(34,197,94,0.08)", text: "#86efac" },
    danger: { border: "#ef4444", bg: "rgba(239,68,68,0.08)", text: "#fca5a5" },
    warning: { border: "#f59e0b", bg: "rgba(245,158,11,0.08)", text: "#fcd34d" },
  };

  const c = colors[type] || colors.warning;

  return (
    <div
      className="no-print"
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: "0.75rem",
        padding: "0.85rem 1.1rem",
        borderRadius: 10,
        marginBottom: "1.25rem",
        background: c.bg,
        border: `1px solid ${c.border}30`,
        color: c.text,
        fontSize: "0.875rem",
        fontWeight: 500,
      }}
    >
      <span>{msg}</span>
      <button onClick={onClose} style={{ background: "none", border: "none", color: "inherit", opacity: 0.6, cursor: "pointer", padding: 0, lineHeight: 1, fontSize: "1rem" }}>
        ✕
      </button>
    </div>
  );
};

const Field = ({ label, required, children }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
    <label className="sw-plbl">
      {label}
      {required && <span style={{ color: "var(--sw-accent,#d4af37)", marginLeft: 2 }}>*</span>}
    </label>
    {children}
  </div>
);

export default function ResumenEntradas() {

  const { store, actions } = useContext(Context);



  const imprimir = () => window.print();



  const [desde, setDesde] = useState("");

  const [hasta, setHasta] = useState("");

  const [proveedorId, setProveedorId] = useState("");

  const [productoId, setProductoId] = useState("");

  const [q, setQ] = useState("");

  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [editando, setEditando] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);



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

  const handleEditar = (entrada) => {
    setEditando(entrada);
    setShowEditModal(true);
  };

  const handleEliminar = async (entrada) => {
    const nombre = entrada?.producto?.nombre || "esta entrada";
    if (!await confirmar(`¿Seguro que deseas eliminar ${nombre}? Esta acción descontará el stock registrado.`)) return;

    setLoading(true);
    setFeedback(null);
    try {
      await actions.eliminarEntrada(entrada.id);
      await actions.getEntradas({
        desde: desde || undefined,
        hasta: hasta || undefined,
        proveedor_id: proveedorId || undefined,
        producto_id: productoId || undefined,
        q: q.trim() || undefined,
      });
      await actions.getProductos();
      setFeedback({ type: "success", msg: "Movimiento de entrada eliminado correctamente." });
    } catch {
      setFeedback({ type: "danger", msg: "No se pudo eliminar el movimiento de entrada." });
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
          <Feedback msg={feedback?.msg} type={feedback?.type} onClose={() => setFeedback(null)} />

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
                    <th className="text-end no-print">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={10} style={{ textAlign: "center", padding: "2rem", color: "var(--sw-muted)", fontSize: "0.875rem" }}>
                        Cargando…
                      </td>
                    </tr>
                  )}
                  {!loading && filtradas.length === 0 && (
                    <tr>
                      <td colSpan={10} style={{ textAlign: "center", padding: "2rem", color: "var(--sw-muted)", fontSize: "0.875rem" }}>
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
                      <td className="text-end no-print" style={{ whiteSpace: "nowrap" }}>
                        <div style={{ display: "inline-flex", gap: "0.4rem" }}>
                          <button
                            type="button"
                            onClick={() => handleEditar(r)}
                            title="Editar movimiento"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: 34,
                              height: 34,
                              borderRadius: 10,
                              border: "1px solid var(--sw-border)",
                              background: "var(--sw-surface-2)",
                              color: "var(--sw-accent,#d4af37)",
                              cursor: "pointer",
                            }}
                          >
                            <span style={{ width: 14, height: 14, display: "flex" }}>{ICONS.edit}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEliminar(r)}
                            title="Eliminar movimiento"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: 34,
                              height: 34,
                              borderRadius: 10,
                              border: "1px solid rgba(239,68,68,0.35)",
                              background: "rgba(239,68,68,0.08)",
                              color: "#ef4444",
                              cursor: "pointer",
                            }}
                          >
                            <span style={{ width: 14, height: 14, display: "flex" }}>{ICONS.trash}</span>
                          </button>
                        </div>
                      </td>
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
                      <td className="no-print"></td>
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
                <div className="no-print" style={{ display: "flex", gap: "0.5rem", marginTop: "0.8rem" }}>
                  <button
                    type="button"
                    onClick={() => handleEditar(r)}
                    style={{
                      flex: 1,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.35rem",
                      borderRadius: 10,
                      border: "1px solid var(--sw-border)",
                      background: "var(--sw-surface-2)",
                      color: "var(--sw-accent,#d4af37)",
                      padding: "0.55rem 0.75rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ width: 14, height: 14, display: "flex" }}>{ICONS.edit}</span>
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEliminar(r)}
                    style={{
                      flex: 1,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.35rem",
                      borderRadius: 10,
                      border: "1px solid rgba(239,68,68,0.35)",
                      background: "rgba(239,68,68,0.08)",
                      color: "#ef4444",
                      padding: "0.55rem 0.75rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ width: 14, height: 14, display: "flex" }}>{ICONS.trash}</span>
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>

      {editando && (
        <EditarEntradaModal
          show={showEditModal}
          entrada={editando}
          productos={store.productos || []}
          proveedores={store.proveedores || []}
          onClose={() => {
            setShowEditModal(false);
            setEditando(null);
          }}
          onSaved={async () => {
            setShowEditModal(false);
            setEditando(null);
            setLoading(true);
            try {
              await actions.getEntradas({
                desde: desde || undefined,
                hasta: hasta || undefined,
                proveedor_id: proveedorId || undefined,
                producto_id: productoId || undefined,
                q: q.trim() || undefined,
              });
              await actions.getProductos();
              setFeedback({ type: "success", msg: "Movimiento de entrada actualizado correctamente." });
            } finally {
              setLoading(false);
            }
          }}
        />
      )}
    </>
  );
}

const EditarEntradaModal = ({ show, entrada, productos, proveedores, onClose, onSaved }) => {
  const { actions } = useContext(Context);

  const precioUnitarioInicial = entrada.cantidad > 0 && entrada.precio_sin_iva > 0
    ? +(entrada.precio_sin_iva / entrada.cantidad).toFixed(4)
    : "";

  const [form, setForm] = useState({
    producto_id: entrada.producto?.id || entrada.producto_id || "",
    proveedor_id: entrada.proveedor?.id || entrada.proveedor_id || "",
    cantidad: entrada.cantidad || "",
    numero_documento: entrada.numero_albaran || entrada.numero_documento || "",
    precio_unitario: precioUnitarioInicial,
    descuento_porcentaje: "0",
    iva_porcentaje: entrada.porcentaje_iva || "21",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.producto_id || !form.cantidad || !form.precio_unitario) {
      setErr("Producto, cantidad y precio unitario son obligatorios.");
      return;
    }

    setSaving(true);
    setErr("");
    try {
      await actions.actualizarEntrada(entrada.id, {
        producto_id: Number(form.producto_id),
        proveedor_id: form.proveedor_id ? Number(form.proveedor_id) : null,
        cantidad: Number(form.cantidad),
        numero_albaran: form.numero_documento || null,
        precio_unitario: Number(form.precio_unitario) || 0,
        porcentaje_iva: Number(form.iva_porcentaje) || 0,
        descuento_porcentaje: Number(form.descuento_porcentaje) || 0,
      });
      await onSaved();
    } catch {
      setErr("Error al actualizar la entrada.");
    } finally {
      setSaving(false);
    }
  };

  if (!show) return null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--sw-overlay-bg-strong,rgba(0,0,0,0.7))", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "1rem" }}>
      <div style={{ background: "var(--sw-surface)", border: "1px solid var(--sw-border)", borderRadius: 16, width: "100%", maxWidth: 700, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--sw-border)", background: "var(--sw-surface-2)", borderRadius: "16px 16px 0 0" }}>
          <div>
            <p style={{ margin: 0, fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--sw-accent,#d4af37)", opacity: 0.85 }}>Entrada de stock</p>
            <h5 style={{ margin: 0, fontWeight: 700, color: "var(--sw-text)", fontSize: "1rem" }}>Editar movimiento</h5>
          </div>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", color: "var(--sw-muted)", fontSize: "1.1rem", cursor: "pointer", padding: "0.25rem", borderRadius: 6, lineHeight: 1 }}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            {err && <Feedback msg={err} type="danger" onClose={() => setErr("")} />}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
              <Field label="Producto" required>
                <GoldSelect
                  value={form.producto_id}
                  onChange={(v) => setForm((prev) => ({ ...prev, producto_id: v }))}
                  placeholder="— Seleccione —"
                  options={productos.map((p) => ({ value: p.id, label: p.nombre }))}
                />
              </Field>

              <Field label="Proveedor">
                <GoldSelect
                  value={form.proveedor_id || ""}
                  onChange={(v) => setForm((prev) => ({ ...prev, proveedor_id: v }))}
                  placeholder="—"
                  options={proveedores.map((p) => ({ value: p.id, label: p.nombre }))}
                />
              </Field>

              <Field label="Nº Albarán / Factura">
                <input className="form-control sw-pinput" name="numero_documento" value={form.numero_documento} onChange={handleChange} />
              </Field>

              <Field label="Cantidad" required>
                <input type="number" min="1" className="form-control sw-pinput" name="cantidad" value={form.cantidad} onChange={handleChange} required />
              </Field>

              <Field label="Precio unitario (€ sin IVA)" required>
                <input type="number" min="0" step="0.01" className="form-control sw-pinput" name="precio_unitario" value={form.precio_unitario} onChange={handleChange} required />
              </Field>

              <Field label="% Descuento">
                <input type="number" min="0" max="100" step="0.01" className="form-control sw-pinput" name="descuento_porcentaje" value={form.descuento_porcentaje} onChange={handleChange} />
              </Field>

              <Field label="% IVA" required>
                <input type="number" min="0" step="0.01" className="form-control sw-pinput" name="iva_porcentaje" value={form.iva_porcentaje} onChange={handleChange} required />
              </Field>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", padding: "1rem 1.5rem", borderTop: "1px solid var(--sw-border)", background: "var(--sw-surface-2)", borderRadius: "0 0 16px 16px" }}>
            <button type="button" onClick={onClose} style={{ padding: "0.5rem 1.2rem", borderRadius: 8, border: "1px solid var(--sw-border)", background: "transparent", color: "var(--sw-muted)", fontSize: "0.85rem", cursor: "pointer" }}>
              Cancelar
            </button>
            <button type="submit" className="sw-ent-submit-btn" disabled={saving} style={{ padding: "0.5rem 1.5rem" }}>
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
