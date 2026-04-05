import React, { useContext, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Context } from "../store/appContext";
import logo from "../img/logo-specialwash-icon-black.png";

function parseIdsParam(raw) {
  if (!raw) return null;
  const ids = String(raw)
    .split(",")
    .map((v) => String(v.trim()))
    .filter((v) => v.length > 0);
  return ids.length ? new Set(ids) : null;
}

export default function PedidoBajoStockPrint() {
  const { store, actions } = useContext(Context);
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const proveedorId = params.get("proveedor_id") || "";
  const selectedSet = useMemo(() => parseIdsParam(params.get("ids")), [params]);
  const autoPrint = params.get("auto") === "1";

  const cachedPayload = useMemo(() => {
    try {
      const raw = sessionStorage.getItem("pedido_bajo_stock_print_payload");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const maxAgeMs = 1000 * 60 * 20;
      if (!parsed?.createdAt || Date.now() - parsed.createdAt > maxAgeMs) return null;
      return parsed;
    } catch (_) {
      return null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await Promise.all([
          actions.getProductos?.(),
          actions.getProveedores?.(),
        ]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const proveedor = useMemo(
    () => (store.proveedores || []).find((p) => String(p.id) === String(proveedorId)) || null,
    [store.proveedores, proveedorId]
  );

  const items = useMemo(() => {
    const all = store.productos || [];
    const cachedItems = Array.isArray(cachedPayload?.items) ? cachedPayload.items : [];

    let base;
    if (selectedSet) {
      // IDs explícitos: mostrar EXACTAMENTE esos productos, sin filtros adicionales
      base = all.filter((p) => selectedSet.has(String(p.id)));
      if (!base.length && cachedItems.length) {
        base = cachedItems.filter((p) => selectedSet.has(String(p.id)));
      }
    } else {
      // Sin selección: mostrar todos los de bajo stock (incluye en curso)
      base = all.filter((p) => {
        const bajo = p?.stock_minimo != null && Number(p.stock_actual ?? 0) < Number(p.stock_minimo ?? 0);
        if (!bajo) return false;
        if (proveedorId && String(p.proveedor_habitual_id || "") !== String(proveedorId)) return false;
        return true;
      });
      if (!base.length && cachedItems.length) {
        base = cachedItems;
      }
    }

    return base.map((p) => {
      const stock = Number(p.stock_actual ?? 0);
      const min = Number(p.stock_minimo ?? 0);
      const sugerido = Number(p.pedido_cantidad ?? Math.max(0, min * 2 - stock));
      return { ...p, stock, min, sugerido };
    });
  }, [store.productos, proveedorId, selectedSet, cachedPayload]);

  const fechaImpresion = useMemo(() => new Date(), []);

  const fecha = fechaImpresion.toLocaleDateString("es-ES", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const hora = fechaImpresion.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });

  useEffect(() => {
    if (!autoPrint || loading) return;
    const t = setTimeout(() => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => window.print());
      });
    }, 900);
    return () => clearTimeout(t);
  }, [autoPrint, loading]);

  return (
    <div className="container py-4 pedido-print-root">
      <style>{`
        .print-sheet {
          background: #fff;
          color: #111;
          padding: 24px;
          border-radius: 14px;
          border: 1px solid #ddd;
        }

        .print-sheet h1,
        .print-sheet h2,
        .print-sheet h3,
        .print-sheet h4,
        .print-sheet h5,
        .print-sheet h6,
        .print-sheet p,
        .print-sheet td,
        .print-sheet th,
        .print-sheet div,
        .print-sheet span,
        .print-sheet small {
          color: #111 !important;
        }

        .print-header {
          border: 2px solid #111;
          border-radius: 12px;
          padding: 16px;
          display: grid;
          grid-template-columns: 110px 1fr;
          gap: 16px;
          margin-bottom: 16px;
          align-items: center;
        }

        .print-logo img {
          max-height: 80px;
          object-fit: contain;
          width: 100%;
        }

        .print-actions {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }

        @media print {
          /* Sobrescribe reglas globales que ocultan todo el body al imprimir */
          .pedido-print-root,
          .pedido-print-root * {
            visibility: visible !important;
          }

          @page { margin: 12mm; }
          .print-actions,
          nav,
          header,
          footer {
            display: none !important;
          }

          .pedido-print-root {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
          }

          .print-sheet {
            border: none;
            padding: 0;
            box-shadow: none !important;
          }

          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background: #fff !important;
          }
        }
      `}</style>

      <div className="print-actions">
        <button className="btn btn-outline-secondary" onClick={() => navigate(-1)}>
          ← Volver
        </button>
        <button className="btn btn-dark" onClick={() => window.print()}>
          🖨️ Imprimir
        </button>
      </div>

      <div className="print-sheet">
        <div className="print-header">
          <div className="print-logo">
            <img src={logo} alt="SpecialWash" />
          </div>
          <div>
            <h2 className="mb-1">Pedido de Reposición</h2>
            <div><strong>Fecha:</strong> {fecha}</div>
            <div><strong>Hora:</strong> {hora}</div>
            <div><strong>Proveedor:</strong> {proveedor?.nombre || "Todos"}</div>
            <div><strong>Documento:</strong> PR-{fechaImpresion.getFullYear()}-{String(items.length).padStart(3, "0")}</div>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table table-sm table-bordered align-middle mb-0">
            <thead>
              <tr>
                <th style={{ width: 70 }}>ID</th>
                <th>Producto</th>
                <th style={{ width: 180 }}>Proveedor</th>
                <th style={{ width: 150 }}>Categoría</th>
                <th style={{ width: 90 }} className="text-end">Stock</th>
                <th style={{ width: 90 }} className="text-end">Mínimo</th>
                <th style={{ width: 100 }} className="text-end">Pedir</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="text-center py-4">Cargando productos...</td>
                </tr>
              )}
              {!loading && items.map((p) => (
                <tr key={p.id}>
                  <td>#{p.id}</td>
                  <td>{p.nombre}</td>
                  <td>{p.proveedor_habitual_nombre || "—"}</td>
                  <td>{p.categoria || "—"}</td>
                  <td className="text-end">{p.stock}</td>
                  <td className="text-end">{p.min}</td>
                  <td className="text-end fw-bold">{p.sugerido}</td>
                </tr>
              ))}
              {!loading && !items.length && (
                <tr>
                  <td colSpan={7} className="text-center py-4">No hay productos para imprimir. Vuelve, selecciona productos y pulsa "Vista impresión".</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
