// src/front/js/pages/PedidoBajoStock.jsx
import React, { useContext, useMemo } from "react";
import { Context } from "../store/appContext";
import { useNavigate } from "react-router-dom";
import logo from "../img/logospecialwash.jpg";

export default function PedidoBajoStock() {
  const { store } = useContext(Context);
  const navigate = useNavigate();

  // --- Productos con stock inferior al mínimo ---
  const bajosDeStock = useMemo(
    () =>
      (store.productos || []).filter(
        (p) =>
          p?.stock_minimo != null &&
          Number(p.stock_actual ?? 0) < Number(p.stock_minimo ?? 0)
      ),
    [store.productos]
  );

  const fecha = new Date().toLocaleDateString("es-ES", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const imprimir = () => {
    try {
      const el = document.querySelector(".pedido-sheet");
      if (!el) return window.print();

      const w = window.open("", "_blank", "noopener,noreferrer");
      if (!w) return window.print();

      const style = Array.from(document.querySelectorAll("link[rel=stylesheet], style"))
        .map((n) => n.outerHTML)
        .join("\n");

      w.document.write(`<!doctype html><html><head><meta charset="utf-8">${style}</head><body>`);
      w.document.write(el.outerHTML);
      w.document.write("</body></html>");
      w.document.close();
      w.focus();
      setTimeout(() => {
        w.print();
        w.close();
      }, 250);
    } catch (err) {
      console.warn("printTable error:", err);
      window.print();
    }
  };

  return (
    <div className="container py-4">
      {/* ------------------------ ESTILOS ------------------------ */}
      <style>{`
        :root {
          --sw-black: #111111;
          --sw-gold: #d4af37;
          --sw-gray: #f6f6f6;
        }

        .pedido-sheet {
          background: #fff;
          padding: 24px;
          border-radius: 16px;
          box-shadow: 0 10px 30px rgba(0,0,0,.08);
        }

        /* --------- CABECERA --------- */
        .pedido-header {
          border: 2px solid var(--sw-black);
          border-radius: 14px;
          padding: 18px;
          display: grid;
          grid-template-columns: 120px 1fr;
          gap: 16px;
          align-items: center;
          margin-bottom: 24px;
        }

        .pedido-brand {
          padding: 8px;
          border: 2px solid var(--sw-gold);
          border-radius: 12px;
          background: #fff;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .pedido-brand img {
          max-height: 90px;
          object-fit: contain;
        }

        .pedido-meta h1 {
          margin: 0;
          font-size: 26px;
          font-weight: 800;
          letter-spacing: .4px;
          color: var(--sw-black);
        }

        .badge-gold {
          background: var(--sw-gold);
          color: #000;
          font-weight: 700;
          padding: 4px 12px;
          border-radius: 999px;
          font-size: 12px;
          margin-left: 8px;
        }

        /* --------- TABLA --------- */
        .pedido-table-wrapper {
          border: 2px solid var(--sw-black);
          border-radius: 14px;
          overflow: hidden;
        }

        .pedido-table thead th {
          background: var(--sw-black);
          color: #fff;
          border-bottom: 2px solid var(--sw-gold);
          font-weight: 800;
        }

        .pedido-table tbody tr:nth-child(even) {
          background: #fafafa;
        }

        tfoot td {
          font-weight: 700;
          border-top: 2px solid var(--sw-black);
        }

        /* --------- ACCIONES --------- */
        .title-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 18px;
        }

        /* --------- PRINT --------- */
        @media print {
          @page { margin: 12mm; }

          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background: #fff !important;
          }

          header, footer,
          nav, .navbar, .sidebar,
          .actions-no-print {
            display: none !important;
            visibility: hidden !important;
          }

          .pedido-sheet {
            box-shadow: none !important;
            padding: 0 !important;
          }

          .pedido-header { margin-bottom: 12px; }
          .container { max-width: 100% !important; }
        }
      `}</style>

      {/* ------------------ CONTENIDO ------------------ */}
      <div className="pedido-sheet">

        {/* Barra acciones (NO se imprime) */}
        <div className="title-row actions-no-print">
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() =>
              window.history.length > 1 ? navigate(-1) : navigate("/productos")
            }
          >
            ← Volver
          </button>
          <button type="button" className="btn btn-dark" onClick={imprimir}>
            🖨️ Imprimir
          </button>
        </div>

        {/* -------- CABECERA -------- */}
        <div className="pedido-header">
          <div className="pedido-brand">
            <img src={logo} alt="SpecialWash" />
          </div>

          <div className="pedido-meta">
            <h1>
              Pedido de Reposición
              <span className="badge-gold">SpecialWash</span>
            </h1>

            <small><strong>Fecha:</strong> {fecha}</small><br />
            <small>
              <strong>Documento:</strong> PR-{new Date().getFullYear()}-
              {String(bajosDeStock.length).padStart(3, "0")}
            </small>
          </div>
        </div>

        {/* -------- TABLA -------- */}
        <div className="pedido-table-wrapper">
          <div className="table-responsive">
            <table className="table pedido-table mb-0">
              <thead>
                <tr>
                  <th style={{ width: 80 }}>ID</th>
                  <th>Producto</th>
                  <th style={{ width: 200 }}>Categoría</th>
                  <th className="text-end" style={{ width: 120 }}>Stock</th>
                  <th className="text-end" style={{ width: 120 }}>Mínimo</th>
                  <th className="text-end" style={{ width: 150 }}>Sugerido</th>
                </tr>
              </thead>

              <tbody>
                {bajosDeStock.map((p) => {
                  const stock = Number(p.stock_actual ?? 0);
                  const min = Number(p.stock_minimo ?? 0);
                  const sugerido = Math.max(0, min * 2 - stock);

                  return (
                    <tr key={p.id}>
                      <td>#{p.id}</td>
                      <td>
                        <strong>{p.nombre}</strong><br />
                        <small className="text-muted">{p.detalle || ""}</small>
                      </td>
                      <td>{p.categoria || "—"}</td>
                      <td className="text-end">{stock}</td>
                      <td className="text-end">{min}</td>
                      <td className="text-end fw-bold">{sugerido}</td>
                    </tr>
                  );
                })}

                {bajosDeStock.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-4">
                      ✅ Todos los productos están por encima del mínimo
                    </td>
                  </tr>
                )}
              </tbody>

              {bajosDeStock.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={6}>
                      Total de productos a revisar: {bajosDeStock.length}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}