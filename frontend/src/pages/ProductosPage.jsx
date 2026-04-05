import React, { useContext, useEffect, useMemo, useState } from "react";
import { Context } from "../store/appContext";
import ProductoFormModal from "../component/ProductoFormModal.jsx";
import { useNavigate } from "react-router-dom";

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
    if (!window.confirm(`¿Eliminar el producto "${p?.nombre || id}"?`)) return;
    try {
      await actions.deleteProducto(id);
    } catch (err) {
      setDeleteError("No se pudo eliminar: " + (err?.message || "error"));
    }
  };

  return (
    <>
      <style>{PRINT_STYLE}</style>
      <div className="container py-4 sw-page-shell sw-view-stack" style={{ maxWidth: "1150px" }}>

        {/* Encabezado */}
        <div className="d-flex flex-wrap align-items-center p-3 mb-4 shadow-sm no-print sw-view-header"
          style={{ background: "#0f0f0f", color: "#fff", borderRadius: "12px", gap: "12px" }}>
          <h2 className="fw-bold mb-0 me-auto" style={{ color: "#d4af37" }}>📦 Productos</h2>
          <div className="d-flex flex-wrap align-items-center gap-3">
            <div className="form-check text-white mb-0">
              <input
                id="solo-bajo"
                className="form-check-input"
                type="checkbox"
                checked={soloBajoStock}
                onChange={(e) => setSoloBajoStock(e.target.checked)}
              />
              <label className="form-check-label" htmlFor="solo-bajo">Solo bajo stock</label>
            </div>
            <input
              className="form-control"
              style={{ minWidth: "260px", borderRadius: "10px" }}
              placeholder="Buscar por nombre, categoría o código…"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
            />
          </div>
          <div className="d-flex flex-wrap align-items-center gap-2 ms-auto">
            <button className="btn sw-btn-gold" onClick={openCrear}>+ Nuevo producto</button>
            <button className="btn sw-btn-gold" onClick={() => window.print()}>🖨️ Imprimir</button>
          </div>
        </div>

        {deleteError && (
          <div className="alert alert-danger d-flex justify-content-between align-items-start py-2 mb-3 no-print">
            <span>{deleteError}</span>
            <button className="btn-close ms-3" onClick={() => setDeleteError("")} />
          </div>
        )}

        {/* Badges resumen */}
        <div className="d-flex flex-wrap gap-2 mb-3 no-print">
          <span className="badge bg-secondary">Total: {productos.length}</span>
          <span className="badge bg-danger">Bajo stock (pendientes): {bajosDeStock.length}</span>
          {bajosEnPedido.length > 0 && (
            <span className="badge bg-warning text-dark">En pedido: {bajosEnPedido.length}</span>
          )}
          {soloBajoStock && (
            <span className="badge bg-info">Mostrando solo {productosFiltrados.length}</span>
          )}
        </div>

        {/* Alerta + botón pedido */}
        {bajosDeStock.length > 0 && (
          <>
            <button
              className="btn btn-outline-dark mb-3 no-print"
              style={{ borderColor: "#d4af37" }}
              onClick={() => navigate("/pedido-bajo-stock")}
            >
              📄 Generar pedido ({bajosDeStock.length})
            </button>
            <div className="alert alert-warning shadow-sm no-print" style={{ borderRadius: "10px" }}>
              <strong>{bajosDeStock.length}</strong> producto(s) con stock por debajo del mínimo.
              <details className="mt-2">
                <summary>Ver detalle</summary>
                <ul>
                  {bajosDeStock.slice(0, 8).map((p) => (
                    <li key={p.id}>{p.nombre}: {p.stock_actual} / mínimo {p.stock_minimo}</li>
                  ))}
                  {bajosDeStock.length > 8 && <li>… y {bajosDeStock.length - 8} más.</li>}
                </ul>
              </details>
            </div>
          </>
        )}

        {/* Tabla */}
        <div className="card shadow-sm" style={{ borderRadius: "12px" }}>
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead style={{ background: "var(--sw-surface-2)" }}>
                <tr>
                  <th style={{ width: 48 }}>#</th>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th>Código barras</th>
                  <th className="text-end" style={{ width: 140 }}>Stock</th>
                  <th className="text-end" style={{ width: 140 }}>Mínimo</th>
                  <th className="text-end no-print" style={{ width: 170 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={7} className="text-center py-4">Cargando…</td></tr>
                )}
                {!loading && productosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-muted text-center py-4">
                      No hay productos{filtro || soloBajoStock ? " que coincidan con los filtros." : " registrados todavía."}
                    </td>
                  </tr>
                )}
                {!loading && productosFiltrados.map((p) => {
                  const bajo = isBajoStock(p);
                  const codigos = Array.from(new Set(
                    [p.codigo_barras, ...((p.codigos_barras || []).map((c) => c?.codigo_barras))].filter(Boolean)
                  ));
                  const codigosStr = codigos.length
                    ? codigos.slice(0, 2).join(", ") + (codigos.length > 2 ? ` (+${codigos.length - 2})` : "")
                    : "—";

                  return (
                    <tr key={p.id} className={bajo ? "table-warning" : ""}>
                      <td className="text-muted">#{p.id}</td>
                      <td>
                        <div className="fw-semibold">{p.nombre}</div>
                        {bajo && (
                          <span className="badge bg-warning text-dark mt-1">
                            {p?.pedido_en_curso ? "Bajo stock (pedido en curso)" : "Bajo stock"}
                          </span>
                        )}
                      </td>
                      <td>{p.categoria || "—"}</td>
                      <td>{codigosStr}</td>
                      <td className="text-end">{p.stock_actual ?? 0}</td>
                      <td className="text-end">{p.stock_minimo ?? "—"}</td>
                      <td className="text-end no-print">
                        <button className="btn btn-sm btn-outline-primary me-1" onClick={() => openEditar(p)} title="Editar">✏️</button>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => onDelete(p.id)} title="Eliminar">🗑️</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
      </div>
    </>
  );
}
