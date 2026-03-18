// src/front/js/pages/ProductosPage.jsx
import React, { useContext, useEffect, useMemo, useState } from "react";
import { Context } from "../store/appContext";
import ProductoFormModal from "../component/ProductoFormModal.jsx";
import { useNavigate } from "react-router-dom";

export default function ProductosPage() {
  const { store, actions } = useContext(Context);

  const [filtro, setFiltro] = useState("");
  const [soloBajoStock, setSoloBajoStock] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  // ================================
  // CARGA INICIAL
  // ================================
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const token =
          sessionStorage.getItem("token") ||
          localStorage.getItem("token");

        if (!token) {
          if (window.location.pathname !== "/login") {
            window.location.href = "/login";
          }
          return;
        }

        try {
          await actions.me?.();
        } catch {}

        await actions.getProductos();
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const productos = useMemo(() => store.productos || [], [store.productos]);

  // ================================
  // FILTROS Y BÚSQUEDA
  // ================================
  const productosFiltrados = useMemo(() => {
    const term = filtro.trim().toLowerCase();
    let list = productos;

    if (term) {
      list = list.filter(
        (p) =>
          (p?.nombre || "").toLowerCase().includes(term) ||
          (p?.categoria || "").toLowerCase().includes(term) ||
          (p?.codigo_barras || "").toLowerCase().includes(term)
      );
    }

    if (soloBajoStock) {
      list = list.filter(
        (p) =>
          p?.stock_minimo != null &&
          Number(p?.stock_actual ?? 0) < Number(p?.stock_minimo ?? 0) &&
          !p?.pedido_en_curso
      );
    }

    return list;
  }, [productos, filtro, soloBajoStock]);

  const bajosDeStock = useMemo(
    () =>
      (productos || []).filter(
        (p) =>
          p?.stock_minimo != null &&
          Number(p?.stock_actual ?? 0) < Number(p?.stock_minimo ?? 0) &&
          !p?.pedido_en_curso
      ),
    [productos]
  );

  const bajosDeStockEnPedido = useMemo(
    () =>
      (productos || []).filter(
        (p) =>
          p?.stock_minimo != null &&
          Number(p?.stock_actual ?? 0) < Number(p?.stock_minimo ?? 0) &&
          !!p?.pedido_en_curso
      ),
    [productos]
  );

  // ================================
  // ACCIONES
  // ================================
  const openCrear = () => {
    setEditing(null);
    setShowModal(true);
  };

  const openEditar = (p) => {
    setEditing(p);
    setShowModal(true);
  };

  const onSaved = async () => {
    setShowModal(false);
    setLoading(true);
    try {
      await actions.getProductos();
    } finally {
      setLoading(false);
    }
  };

  const onDelete = async (id) => {
    const p = productos.find((x) => x.id === id);
    if (!window.confirm(`¿Eliminar el producto "${p?.nombre || id}"?`)) return;

    try {
      await actions.deleteProducto(id);
    } catch (err) {
      alert("No se pudo eliminar: " + (err?.message || "error"));
    }
  };

  // ================================
  // FUNCIONES DE IMPRESIÓN
  // ================================
  const imprimir = () => window.print();

  // ================================
  // RENDER
  // ================================
  return (
    <>
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            margin: 0;
            padding: 16px;
          }
          .table {
            font-size: 11px;
          }
          .table th,
          .table td {
            padding: 6px;
          }
        }
      `}</style>

      <div className="container py-4" style={{ maxWidth: "1150px" }}>
      
        {/* ============================
            ENCABEZADO PREMIUM
        ============================ */}
       <div
  className="d-flex flex-wrap align-items-center p-3 mb-4 shadow-sm no-print"
  style={{
    background: "#0f0f0f",
    color: "#fff",
    borderRadius: "12px",
    gap: "12px",
  }}
>
  {/* TÍTULO */}
  <h2 className="fw-bold mb-0 me-auto" style={{ color: "#d4af37" }}>
    📦 Productos
  </h2>

  {/* FILTROS */}
  <div className="d-flex flex-wrap align-items-center gap-3">
    {/* Solo bajo stock */}
    <div className="form-check text-white">
      <input
        id="solo-bajo"
        className="form-check-input"
        type="checkbox"
        checked={soloBajoStock}
        onChange={(e) => setSoloBajoStock(e.target.checked)}
      />
      <label className="form-check-label" htmlFor="solo-bajo">
        Solo bajo stock
      </label>
    </div>

    {/* Búsqueda */}
    <input
      className="form-control"
      style={{ minWidth: "260px", borderRadius: "10px" }}
      placeholder="Buscar por nombre, categoría o código…"
      value={filtro}
      onChange={(e) => setFiltro(e.target.value)}
    />
  </div>

  {/* BOTONES AL FINAL */}
  <div className="d-flex flex-wrap align-items-center gap-2 ms-auto">
  

    {/* Crear */}
    <button
      className="btn"
      onClick={openCrear}
      style={{
        background: "#d4af37",
        color: "black",
        fontWeight: "600",
        borderRadius: "10px",
      }}
    >
      + Nuevo producto
    </button>
      {/* Imprimir */}
    <button
      className="btn"
      onClick={imprimir}
      style={{
        background: "#d4af37",
        color: "black",
        fontWeight: "600",
        borderRadius: "10px",
      }}
    >
      🖨️ Imprimir
    </button>

   
  </div>
</div>

        {/* ============================
            BADGES RESUMEN
        ============================ */}
        <div className="d-flex flex-wrap gap-2 mb-3 no-print">
        <span className="badge bg-secondary">Total: {productos.length}</span>
        <span className="badge bg-danger">
            Bajo stock (pendientes): {bajosDeStock.length}
        </span>
          {bajosDeStockEnPedido.length > 0 && (
            <span className="badge bg-warning text-dark">
              En pedido: {bajosDeStockEnPedido.length}
            </span>
          )}
        {soloBajoStock && (
          <span className="badge bg-info">
            Mostrando solo {productosFiltrados.length}
          </span>
        )}
      </div>

        {/* Botón generar pedido */}
        {bajosDeStock.length > 0 && (
          <button
            className="btn btn-outline-dark mb-3 no-print"
          style={{ borderColor: "#d4af37" }}
          onClick={() => navigate("/pedido-bajo-stock")}
        >
          📄 Generar pedido ({bajosDeStock.length})
        </button>
      )}

        {/* Alerta bajo stock */}
        {bajosDeStock.length > 0 && (
          <div
            className="alert alert-warning shadow-sm no-print"
          style={{ borderRadius: "10px" }}
        >
          <strong>{bajosDeStock.length}</strong> producto(s) con stock por
          debajo del mínimo.
          <details className="mt-2">
            <summary>Ver detalle</summary>
            <ul>
              {bajosDeStock.slice(0, 8).map((p) => (
                <li key={p.id}>
                  {p.nombre}: {p.stock_actual} / mínimo {p.stock_minimo}
                </li>
              ))}
              {bajosDeStock.length > 8 && (
                <li>… y {bajosDeStock.length - 8} más.</li>
              )}
            </ul>
          </details>
        </div>
      )}

      {/* ============================
          TABLA DE PRODUCTOS
      ============================ */}
      <div className="card shadow-sm" style={{ borderRadius: "12px" }}>
        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead style={{ background: "#f5f5f5" }}>
              <tr>
                <th style={{ width: 48 }}>#</th>
                <th>Producto</th>
                <th>Categoría</th>
                <th>Código barras</th>
                <th className="text-end" style={{ width: 140 }}>
                  Stock
                </th>
                <th className="text-end" style={{ width: 140 }}>
                  Mínimo
                </th>
                <th className="text-end no-print" style={{ width: 170 }}>
                  Acciones
                </th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="text-center py-4">
                    Cargando…
                  </td>
                </tr>
              )}

              {!loading && productosFiltrados.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-muted text-center py-4">
                    No hay productos
                    {filtro || soloBajoStock
                      ? " que coincidan con los filtros."
                      : " registrados todavía."}
                  </td>
                </tr>
              )}

              {!loading &&
                productosFiltrados.map((p) => {
                  const bajo =
                    p.stock_minimo != null &&
                    Number(p.stock_actual ?? 0) < Number(p.stock_minimo);

                  return (
                    <tr
                      key={p.id}
                      className={bajo ? "table-warning" : ""}
                      style={{ transition: "0.2s" }}
                    >
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
                      <td>
                        {(() => {
                          const codigos = Array.from(
                            new Set(
                              [
                                p.codigo_barras,
                                ...((p.codigos_barras || []).map((c) => c?.codigo_barras)),
                              ].filter(Boolean)
                            )
                          );
                          if (!codigos.length) return "—";
                          return codigos.slice(0, 2).join(", ") + (codigos.length > 2 ? ` (+${codigos.length - 2})` : "");
                        })()}
                      </td>
                      <td className="text-end">{p.stock_actual ?? 0}</td>
                      <td className="text-end">{p.stock_minimo ?? "—"}</td>

                      <td className="text-end no-print">
                        <button
                          className="btn btn-sm btn-outline-primary me-1"
                          onClick={() => openEditar(p)}
                          title="Editar"
                        >
                          ✏️
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => onDelete(p.id)}
                          title="Eliminar"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

        {/* Modal crear/editar */}
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