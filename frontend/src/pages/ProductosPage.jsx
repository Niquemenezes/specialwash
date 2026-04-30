import React, { useContext, useEffect, useMemo, useState } from "react";
import { Context } from "../store/appContext";
import ProductoFormModal from "../components/ProductoFormModal.jsx";
import Paginacion from "../components/Paginacion.jsx";
import { confirmar } from "../utils/confirmar";
import EmptyState from "../components/EmptyState.jsx";
import { useNavigate } from "react-router-dom";

const POR_PAGINA = 50;

const isBajoStock = (p) =>
  p?.stock_minimo != null &&
  Number(p?.stock_actual ?? 0) < Number(p?.stock_minimo ?? 0) &&
  !p?.pedido_en_curso;

const PRINT_STYLE = `
  @media print {
    .no-print { display: none !important; }
    body { margin: 0; padding: 16px; }
    .table { font-size: 11px; }
    .table th, .table td { padding: 6px; }
  }
`;

export default function ProductosPage() {
  const { store, actions } = useContext(Context);
  const navigate = useNavigate();

  const [filtro, setFiltro] = useState("");
  const [soloBajoStock, setSoloBajoStock] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [pagina, setPagina] = useState(1);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const load = async () => {
      if (!store.user) actions.me?.().catch(() => {});
      try {
        if (active) await actions.getProductos();
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const productos = store.productos || [];

  const productosFiltrados = useMemo(() => {
    const term = filtro.trim().toLowerCase();
    return productos.filter((p) => {
      if (term) {
        const match =
          (p?.nombre || "").toLowerCase().includes(term) ||
          (p?.categoria || "").toLowerCase().includes(term) ||
          (p?.codigo_barras || "").toLowerCase().includes(term);
        if (!match) return false;
      }
      if (soloBajoStock && !isBajoStock(p)) return false;
      return true;
    });
  }, [productos, filtro, soloBajoStock]);

  useEffect(() => { setPagina(1); }, [filtro, soloBajoStock]);

  const productosPagina = useMemo(
    () => productosFiltrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA),
    [productosFiltrados, pagina]
  );

  const bajosDeStock = useMemo(() => productos.filter(isBajoStock), [productos]);
  const bajosEnPedido = useMemo(
    () => productos.filter((p) =>
      p?.stock_minimo != null &&
      Number(p?.stock_actual ?? 0) < Number(p?.stock_minimo ?? 0) &&
      !!p?.pedido_en_curso
    ),
    [productos]
  );

  const openCrear = () => { setEditing(null); setShowModal(true); };
  const openEditar = (p) => { setEditing(p); setShowModal(true); };

  const onSaved = async () => {
    setShowModal(false);
    setLoading(true);
    try { await actions.getProductos(); } finally { setLoading(false); }
  };

  const onDelete = async (id) => {
    const p = productos.find((x) => x.id === id);
    if (!await confirmar(`¿Eliminar el producto "${p?.nombre || id}"?`)) return;
    try {
      await actions.deleteProducto(id);
    } catch (err) {
      setDeleteError("No se pudo eliminar: " + (err?.message || "error"));
    }
  };

  return (
    <>
      <style>{PRINT_STYLE}</style>
      <div className="sw-page-bg">

        {/* ── HERO ── */}
        <div className="no-print sw-hero-section">
          <div className="container" style={{ maxWidth: "1150px" }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "1.5rem", flexWrap: "wrap" }}>
              <div>
                <p style={{ fontSize: "0.73rem", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--sw-accent)", opacity: 0.85, marginBottom: "0.4rem" }}>
                  Panel de gestión · SpecialWash
                </p>
                <h1 style={{ fontSize: "clamp(1.4rem, 3vw, 2rem)", fontWeight: 700, color: "var(--sw-text)", margin: 0, letterSpacing: "-0.01em" }}>
                  Productos
                </h1>
                <p style={{ fontSize: "0.85rem", color: "var(--sw-muted)", marginTop: "0.35rem", marginBottom: 0 }}>
                  Control de inventario y stock mínimo
                </p>
              </div>
              <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                <button onClick={() => window.print()}
                  style={{ background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)", color: "var(--sw-muted)", borderRadius: "9px", padding: "0.4rem 1rem", fontSize: "0.84rem", cursor: "pointer" }}>
                  🖨 Imprimir
                </button>
                <button onClick={openCrear}
                  style={{ background: "linear-gradient(135deg, var(--sw-accent-2), var(--sw-accent))", border: "none", color: "var(--sw-text-on-accent)", fontWeight: 700, borderRadius: "9px", padding: "0.4rem 1.15rem", fontSize: "0.84rem", cursor: "pointer" }}>
                  + Nuevo producto
                </button>
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginTop: "1.25rem" }}>
              {[
                { label: "Total productos", value: productos.length, color: "var(--sw-accent)" },
                { label: "Bajo stock", value: bajosDeStock.length, color: "var(--sw-danger)" },
                ...(bajosEnPedido.length > 0 ? [{ label: "En pedido", value: bajosEnPedido.length, color: "var(--sw-warning)" }] : []),
                ...(soloBajoStock ? [{ label: "Mostrando", value: productosFiltrados.length, color: "var(--sw-success)" }] : []),
              ].map((s) => (
                <div key={s.label} style={{ background: "var(--sw-surface-2)", border: `1px solid var(--sw-border)`, borderRadius: "9px", padding: "0.35rem 0.9rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ color: s.color, fontWeight: 700, fontSize: "1rem" }}>{s.value}</span>
                  <span style={{ color: "var(--sw-muted)", fontSize: "0.74rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="container py-4" style={{ maxWidth: "1150px", animation: "sw-fade-up 0.45s ease 0.05s both" }}>

          {/* Error al eliminar */}
          {deleteError && (
            <div className="no-print" style={{ background: "color-mix(in srgb, var(--sw-danger) 12%, var(--sw-surface))", border: "1px solid color-mix(in srgb, var(--sw-danger) 35%, transparent)", borderRadius: "10px", padding: "0.75rem 1rem", marginBottom: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--sw-danger)" }}>
              <span>⚠ {deleteError}</span>
              <button type="button" className="btn-close btn-sm" onClick={() => setDeleteError("")} />
            </div>
          )}

          {/* Filtros */}
          <div className="no-print sw-pcard" style={{ borderTopColor: "color-mix(in srgb, var(--sw-accent) 40%, transparent)" }}>
            <div style={{ padding: "1rem 1.25rem", display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
              <input
                className="sw-pinput form-control"
                style={{ flex: "1 1 260px" }}
                placeholder="Buscar por nombre, categoría o código…"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
              />
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.45rem 0.9rem", background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)", borderRadius: "10px", cursor: "pointer" }} onClick={() => setSoloBajoStock((v) => !v)}>
                <input id="solo-bajo" type="checkbox" checked={soloBajoStock} onChange={(e) => setSoloBajoStock(e.target.checked)} style={{ flexShrink: 0 }} />
                <label htmlFor="solo-bajo" style={{ color: "var(--sw-muted)", fontSize: "0.85rem", cursor: "pointer", margin: 0 }}>Solo bajo stock</label>
              </div>
            </div>
          </div>

          {/* Alerta bajo stock */}
          {bajosDeStock.length > 0 && (
            <div className="no-print" style={{ background: "color-mix(in srgb, var(--sw-warning) 10%, var(--sw-surface))", border: "1px solid color-mix(in srgb, var(--sw-warning) 30%, transparent)", borderRadius: "12px", padding: "0.9rem 1.1rem", marginBottom: "1.25rem", color: "var(--sw-text)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.6rem" }}>
                <span style={{ fontWeight: 600 }}>⚠ {bajosDeStock.length} producto(s) con stock por debajo del mínimo</span>
                <button onClick={() => navigate("/pedido-bajo-stock")}
                  style={{ background: "color-mix(in srgb, var(--sw-warning) 15%, transparent)", border: "1px solid color-mix(in srgb, var(--sw-warning) 40%, transparent)", color: "var(--sw-warning)", borderRadius: "8px", padding: "0.3rem 0.85rem", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}>
                  📄 Generar pedido ({bajosDeStock.length})
                </button>
              </div>
              <details style={{ marginTop: "0.5rem" }}>
                <summary style={{ cursor: "pointer", fontSize: "0.82rem", color: "var(--sw-muted)" }}>Ver detalle</summary>
                <ul style={{ marginTop: "0.4rem", paddingLeft: "1.2rem", fontSize: "0.82rem", color: "var(--sw-muted)" }}>
                  {bajosDeStock.slice(0, 8).map((p) => (
                    <li key={p.id}>{p.nombre}: {p.stock_actual} / mínimo {p.stock_minimo}</li>
                  ))}
                  {bajosDeStock.length > 8 && <li>… y {bajosDeStock.length - 8} más.</li>}
                </ul>
              </details>
            </div>
          )}

          {/* Tabla */}
          <div className="sw-pcard">
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                <thead>
                  <tr style={{ background: "var(--sw-surface-2)", borderBottom: "1px solid var(--sw-border)" }}>
                    {[
                      { label: "#", w: 48 },
                      { label: "Producto" },
                      { label: "Categoría" },
                      { label: "Código barras" },
                      { label: "Stock", align: "right", w: 100 },
                      { label: "Mínimo", align: "right", w: 100 },
                      { label: "Acciones", align: "right", w: 110, cls: "no-print" },
                    ].map((h) => (
                      <th key={h.label} className={h.cls || ""}
                        style={{ padding: "0.65rem 0.85rem", color: "var(--sw-muted)", fontWeight: 600, textTransform: "uppercase", fontSize: "0.68rem", letterSpacing: "0.07em", whiteSpace: "nowrap", textAlign: h.align || "left", width: h.w }}>
                        {h.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", padding: "2.5rem", color: "var(--sw-muted)" }}>
                        Cargando productos…
                      </td>
                    </tr>
                  )}
                  {!loading && productosFiltrados.length === 0 && (
                    <EmptyState
                      colSpan={7}
                      title={filtro || soloBajoStock ? "Sin resultados" : "Sin productos"}
                      subtitle={filtro || soloBajoStock ? "Ningún producto coincide con los filtros aplicados." : "No hay productos registrados. Añade el primero con Nueva entrada."}
                    />
                  )}
                  {!loading && productosPagina.map((p, i) => {
                    const bajo = isBajoStock(p);
                    const codigos = Array.from(new Set(
                      [p.codigo_barras, ...((p.codigos_barras || []).map((c) => c?.codigo_barras))].filter(Boolean)
                    ));
                    const codigosStr = codigos.length
                      ? codigos.slice(0, 2).join(", ") + (codigos.length > 2 ? ` (+${codigos.length - 2})` : "")
                      : "—";

                    return (
                      <tr key={p.id} style={{
                        borderBottom: "1px solid var(--sw-border)",
                        background: bajo ? "color-mix(in srgb, var(--sw-warning) 5%, transparent)" : i % 2 === 0 ? "transparent" : "var(--sw-surface-2)",
                        borderLeft: bajo ? "3px solid color-mix(in srgb, var(--sw-warning) 55%, transparent)" : "3px solid transparent",
                        transition: "background 0.15s",
                      }}>
                        <td style={{ padding: "0.65rem 0.85rem", color: "var(--sw-muted)", fontSize: "0.78rem" }}>#{p.id}</td>
                        <td style={{ padding: "0.65rem 0.85rem" }}>
                          <span style={{ fontWeight: 600, color: "var(--sw-text)" }}>{p.nombre}</span>
                          {bajo && (
                            <span style={{ display: "inline-block", marginLeft: "0.5rem", background: "color-mix(in srgb, var(--sw-warning) 15%, transparent)", color: "var(--sw-warning)", borderRadius: "5px", padding: "0.05rem 0.5rem", fontSize: "0.7rem", fontWeight: 600, verticalAlign: "middle" }}>
                              {p?.pedido_en_curso ? "Pedido en curso" : "Bajo stock"}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "0.65rem 0.85rem", color: "var(--sw-muted)" }}>{p.categoria || "—"}</td>
                        <td style={{ padding: "0.65rem 0.85rem", color: "var(--sw-muted)", fontSize: "0.8rem", fontFamily: "monospace" }}>{codigosStr}</td>
                        <td style={{ padding: "0.65rem 0.85rem", textAlign: "right", fontWeight: 700, color: bajo ? "var(--sw-warning)" : "var(--sw-text)" }}>{p.stock_actual ?? 0}</td>
                        <td style={{ padding: "0.65rem 0.85rem", textAlign: "right", color: "var(--sw-muted)" }}>{p.stock_minimo ?? "—"}</td>
                        <td className="no-print" style={{ padding: "0.65rem 0.85rem", textAlign: "right" }}>
                          <div className="sw-ent-row-actions">
                            <button
                              className="sw-ent-icon-btn"
                              onClick={() => openEditar(p)}
                              title="Editar"
                              aria-label={`Editar ${p.nombre}`}
                            >
                              ✏
                            </button>
                            <button
                              className="sw-ent-icon-btn sw-ent-icon-btn--danger"
                              onClick={() => onDelete(p.id)}
                              title="Eliminar"
                              aria-label={`Eliminar ${p.nombre}`}
                            >
                              🗑
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <Paginacion
            total={productosFiltrados.length}
            page={pagina}
            limit={POR_PAGINA}
            onChange={setPagina}
          />
        </div>
      </div>

      {showModal && (
        <ProductoFormModal
          show={showModal}
          onClose={() => setShowModal(false)}
          onSaved={onSaved}
          initial={editing}
        />
      )}
    </>
  );
}
