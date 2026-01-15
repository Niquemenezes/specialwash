import React, { useContext, useEffect, useMemo, useState } from "react";
import { Context } from "../store/appContext";

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

      <div className="container py-4" style={{ maxWidth: "1100px" }}>
        {/* CABECERA */}
        <div
          className="d-flex justify-content-between align-items-center p-3 mb-4 shadow-sm no-print"
          style={{ background: "#0f0f0f", borderRadius: "12px", color: "white" }}
        >
        <h2 className="fw-bold mb-0" style={{ color: "#d4af37" }}>
          📦 Historial de Salidas
        </h2>

        <button
          onClick={imprimir}
          className="btn"
          style={{
            background: "#d4af37",
            color: "black",
            fontWeight: "600",
            borderRadius: "8px",
          }}
        >
          🖨️ Imprimir
        </button>
      </div>

      {/* FILTROS */}
      <div className="card border-0 shadow-sm mb-4 no-print">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-3">
              <label className="form-label fw-semibold">Desde</label>
              <input
                type="date"
                className="form-control"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
              />
            </div>

            <div className="col-md-3">
              <label className="form-label fw-semibold">Hasta</label>
              <input
                type="date"
                className="form-control"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
              />
            </div>

            <div className="col-md-3">
              <label className="form-label fw-semibold">Producto</label>
              <select
                className="form-select"
                value={productoId}
                onChange={(e) => setProductoId(e.target.value)}
              >
                <option value="">Todos</option>
                {(store.productos || []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-6">
              <label className="form-label fw-semibold">
                Buscar (producto / usuario / obs)
              </label>
              <input
                className="form-control"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Escribe para filtrar…"
              />
            </div>
          </div>
        </div>
      </div>

      {/* RESUMEN */}
      <div className="row g-3 mb-3 no-print">
        <div className="col-md-3">
          <div className="card border-0 shadow-sm text-center">
            <div className="card-body">
              <div className="text-muted small">Registros</div>
              <div className="h4">{filtradas.length}</div>
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card border-0 shadow-sm text-center">
            <div className="card-body">
              <div className="text-muted small">Cantidad total</div>
              <div className="h4">{tot.cant}</div>
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card border-0 shadow-sm text-center">
            <div className="card-body">
              <div className="text-muted small">Gasto total</div>
              <div className="h4">{tot.precio.toFixed(2)} €</div>
            </div>
          </div>
        </div>
      </div>

      {/* TABLA */}
      <div className="card border-0 shadow-sm">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
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
                  <td colSpan={7} className="text-center py-4">
                    Cargando…
                  </td>
                </tr>
              )}

              {!loading && filtradas.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-4 text-muted">
                    Sin resultados.
                  </td>
                </tr>
              )}

              {!loading &&
                filtradas.map((r) => (
                  <tr key={r.id}>
                    <td>{fmtDateTime(r.fecha)}</td>
                    <td>{r.producto_nombre || "-"}</td>
                    <td className="text-end">{toNumber(r.cantidad)}</td>
                    <td className="text-end">
                      {toNumber(r.precio_unitario)
                        ? toNumber(r.precio_unitario).toFixed(2)
                        : "-"}
                    </td>
                    <td className="text-end">
                      {toNumber(r.precio_total).toFixed(2)}
                    </td>
                    <td>{r.usuario_nombre || "-"}</td>
                    <td>{r.observaciones || "-"}</td>
                  </tr>
                ))}
            </tbody>

            {!loading && filtradas.length > 0 && (
              <tfoot className="fw-bold">
                <tr>
                  <td colSpan={2}>Totales</td>
                  <td className="text-end">{tot.cant}</td>
                  <td></td>
                  <td className="text-end">{tot.precio.toFixed(2)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
      </div>
    </>
  );
}
