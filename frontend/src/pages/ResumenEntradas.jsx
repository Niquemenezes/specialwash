import React, { useContext, useEffect, useMemo, useState } from "react";
import { Context } from "../store/appContext";
import GoldSelect from "../component/GoldSelect.jsx";

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
  // 🔥🔥🔥 DISEÑO PREMIUM SPECIALWASH (NEGRO + DORADO + SOBRIO)
  // -------------------------------------------------------------------
  return (
    <>
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          .print-title {
            display: block !important;
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
        @media screen {
          .print-title {
            display: none;
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
          📊 Informe de Entradas
        </h2>

        <div className="d-flex gap-2">
          <button
            onClick={aplicar}
            className="btn"
            style={{background: "#d4af37", color: "black", fontWeight: "600", borderRadius: "8px"}}
              
          >
            🔍 Aplicar
          </button>

          <button
            onClick={limpiar}
            className="btn btn-outline-light"
            style={{ borderColor: "#d4af37", color: "#d4af37" }}
          >
            🧹 Limpiar
          </button>

          <button
            onClick={exportCSV}
            className="btn btn-success"
            style={{ borderRadius: "8px", fontWeight: "600" }}
          >
            📄 CSV
          </button>
        </div>
        <button
          onClick={imprimir}
          className="btn btn-secondary"
          style={{ borderRadius: "8px", fontWeight: "600" }}
        >
          🖨️ Imprimir
        </button>
      </div>

      {/* FILTROS */}
      <div
        className="card border-0 shadow-sm mb-4 no-print"
        style={{ borderRadius: "12px" }}
      >
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-3">
              <label className="form-label fw-semibold">Desde</label>
              <input
                type="date"
                className="form-control"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                style={{ borderRadius: "10px" }}
              />
            </div>

            <div className="col-md-3">
              <label className="form-label fw-semibold">Hasta</label>
              <input
                type="date"
                className="form-control"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                style={{ borderRadius: "10px" }}
              />
            </div>

            <div className="col-md-3">
              <label className="form-label fw-semibold">Proveedor</label>
              <GoldSelect
                value={proveedorId}
                onChange={(v) => setProveedorId(v)}
                placeholder="Todos"
                options={(store.proveedores || []).map((p) => ({
                  value: p.id,
                  label: p.nombre,
                }))}
              />
            </div>

            <div className="col-md-3">
              <label className="form-label fw-semibold">Producto</label>
              <GoldSelect
                value={productoId}
                onChange={(v) => setProductoId(v)}
                placeholder="Todos"
                options={(store.productos || []).map((p) => ({
                  value: p.id,
                  label: p.nombre,
                }))}
              />
            </div>

            <div className="col-md-6">
              <label className="form-label fw-semibold">
                Buscar (producto / proveedor / doc)
              </label>
              <input
                className="form-control"
                placeholder="Escribe para filtrar…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                style={{ borderRadius: "10px" }}
              />
            </div>
          </div>
        </div>
      </div>

        {/* RESUMEN NUMÉRICO */}
        <div className="row g-3 mb-3 no-print">
        {[
          { label: "Registros", value: filtradas.length },
          { label: "Cantidad total", value: tot.cant },
          { label: "Total sin IVA", value: tot.sin.toFixed(2) },
          { label: "Total con IVA", value: tot.con.toFixed(2) },
        ].map((item, i) => (
          <div className="col-md-3" key={i}>
            <div
              className="card border-0 shadow-sm"
              style={{ borderRadius: "12px" }}
            >
              <div className="card-body text-center">
                <div className="text-muted small">{item.label}</div>
                <div className="h4 mb-0">{item.value}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

        {/* TABLA */}
        <h2 className="print-title" style={{ marginBottom: "20px" }}>Resumen de Entradas</h2>
        <div>

        <div className="card border-0 shadow-sm" style={{ borderRadius: "12px" }}>
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
            <thead style={{ background: "#f8f8f8" }}>
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
                  <td colSpan={9} className="text-center py-4 text-muted">
                    ⏳ Cargando…
                  </td>
                </tr>
              )}

              {!loading && filtradas.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-4 text-muted">
                    Sin resultados.
                  </td>
                </tr>
              )}

              {!loading &&
                filtradas.map((r) => (
                  <tr key={r.id}>
                    <td>{fmtDateTime(r.fecha)}</td>
                    <td>{r.producto?.nombre || "-"}</td>
                    <td>{r.proveedor?.nombre || "-"}</td>
                    <td className="text-end">{r.cantidad}</td>
                    <td className="text-end">
                      {isFinite(r.precio_sin_iva)
                        ? r.precio_sin_iva.toFixed(2)
                        : "0.00"}
                    </td>
                    <td className="text-end">
                      {r.porcentaje_iva && isFinite(r.porcentaje_iva)
                        ? r.porcentaje_iva.toFixed(2)
                        : "-"}
                    </td>
                    <td className="text-end">
                      {isFinite(r.valor_iva) ? r.valor_iva.toFixed(2) : "0.00"}
                    </td>
                    <td className="text-end">
                      {isFinite(r.precio_con_iva)
                        ? r.precio_con_iva.toFixed(2)
                        : "0.00"}
                    </td>
                    <td>{r.numero_albaran || "-"}</td>
                  </tr>
                ))}
            </tbody>

            {!loading && filtradas.length > 0 && (
              <tfoot className="fw-bold">
                <tr>
                  <td colSpan={3}>Totales</td>
                  <td className="text-end">{tot.cant}</td>
                  <td className="text-end">{tot.sin.toFixed(2)}</td>
                  <td></td>
                  <td className="text-end">{tot.iva.toFixed(2)}</td>
                  <td className="text-end">{tot.con.toFixed(2)}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
            </div>
          </div>
      </div>

      {/* TARJETAS MOVIL */}
      <div className="d-md-none mt-3">
        {loading && (
          <div className="text-center py-3 text-muted">Cargando…</div>
        )}

        {!loading && filtradas.length === 0 && (
          <div className="text-center py-3 text-muted">Sin resultados.</div>
        )}

        {!loading &&
          filtradas.map((r) => (
            <div
              key={r.id}
              className="card mb-3 border-0 shadow-sm"
              style={{ borderRadius: "12px" }}
            >
              <div className="card-body">
                <div className="d-flex justify-content-between">
                  <strong>{r.producto?.nombre || "-"}</strong>
                  <span
                    className="badge"
                    style={{
                      background: "#d4af37",
                      color: "black",
                      fontWeight: "600",
                    }}
                  >
                    x{r.cantidad}
                  </span>
                </div>

                <div className="small text-muted mt-1">
                  {fmtDateTime(r.fecha)}
                </div>

                {r.proveedor?.nombre && (
                  <div className="small mt-1">
                    Proveedor: {r.proveedor.nombre}
                  </div>
                )}

                <div className="small mt-1">
                  Sin IVA: {r.precio_sin_iva.toFixed(2)} · IVA:{" "}
                  {r.valor_iva.toFixed(2)} (
                  {r.porcentaje_iva ? r.porcentaje_iva.toFixed(2) : "0"}
                  %)
                </div>

                <div className="small mt-1">
                  Con IVA: {r.precio_con_iva.toFixed(2)}
                </div>

                {r.numero_albaran && (
                  <div className="small mt-1">Doc: {r.numero_albaran}</div>
                )}
              </div>
            </div>
          ))}
      </div>
      </div>
    </>
  );
}
