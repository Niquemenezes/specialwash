import React, { useContext, useEffect, useMemo, useState } from "react";
import { Context } from "../store/appContext";

const DEFAULT_FORM = {
  fecha: new Date().toISOString().split("T")[0],
  tipo_movimiento: "gasto",
  concepto: "",
  categoria: "general",
  importe: "",
  proveedor: "",
  observaciones: "",
};

const money = (n) => `${Number(n || 0).toFixed(2)} EUR`;

const fmtDate = (raw) => {
  if (!raw) return "-";
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return String(raw).slice(0, 10);
  return dt.toISOString().slice(0, 10);
};

export default function GastosEmpresaPage() {
  const { actions } = useContext(Context);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mostrarManuales, setMostrarManuales] = useState(true);
  const [mostrarAutomaticos, setMostrarAutomaticos] = useState(true);

  const [mesSeleccionado, setMesSeleccionado] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [categoria, setCategoria] = useState("");
  const [q, setQ] = useState("");

  const [gastos, setGastos] = useState([]);
  const [ingresosAutomaticos, setIngresosAutomaticos] = useState(0);
  const [gastosAutoEntradas, setGastosAutoEntradas] = useState([]);
  const [gastosAutoMaquinaria, setGastosAutoMaquinaria] = useState([]);

  const [form, setForm] = useState(DEFAULT_FORM);

  useEffect(() => {
    const [year, month] = mesSeleccionado.split("-").map(Number);
    const first = new Date(year, month - 1, 1);
    const last = new Date(year, month, 0);
    setDesde(first.toISOString().split("T")[0]);
    setHasta(last.toISOString().split("T")[0]);
  }, [mesSeleccionado]);

  const cargarDatos = async (nextDesde = desde, nextHasta = hasta, nextCategoria = categoria, nextQ = q) => {
    if (!nextDesde || !nextHasta) return;

    setLoading(true);
    try {
      const [gastosResp, reporteClientes, entradasResp, maquinariaResp] = await Promise.all([
        actions.getGastosEmpresa({ desde: nextDesde, hasta: nextHasta, categoria: nextCategoria, q: nextQ }),
        actions.getReporteClientes(nextDesde, nextHasta),
        actions.getEntradas({ desde: nextDesde, hasta: nextHasta }),
        actions.getMaquinaria(),
      ]);

      const items = Array.isArray(gastosResp?.items) ? gastosResp.items : [];
      setGastos(items);

      const totalIngresos = (reporteClientes?.clientes || []).reduce(
        (acc, c) => acc + Number(c?.total_cliente || 0),
        0
      );
      setIngresosAutomaticos(Number(totalIngresos || 0));

      const entradas = Array.isArray(entradasResp) ? entradasResp : [];
      const autosEntradas = entradas
        .filter((e) => Number(e?.precio_con_iva || 0) > 0)
        .map((e) => ({
          id: `auto-ent-${e.id}`,
          tipo: "gasto_auto_producto",
          fecha: e.fecha || e.created_at,
          concepto: `Compra producto: ${e.producto_nombre || `#${e.producto_id}`}`,
          categoria: "compra_producto_auto",
          proveedor: e.proveedor_nombre || "-",
          observaciones: e.numero_albaran || e.numero_documento || "",
          importe: Number(e.precio_con_iva || 0),
          origen: "entrada",
        }));
      setGastosAutoEntradas(autosEntradas);

      const maquinaria = Array.isArray(maquinariaResp) ? maquinariaResp : [];
      const dDesde = new Date(`${nextDesde}T00:00:00`);
      const dHasta = new Date(`${nextHasta}T23:59:59`);
      const autosMaquinaria = maquinaria
        .filter((m) => {
          const rawFecha = m.fecha_compra || m.created_at;
          if (!rawFecha) return false;
          const dt = new Date(rawFecha);
          if (Number.isNaN(dt.getTime())) return false;
          return dt >= dDesde && dt <= dHasta;
        })
        .map((m) => {
          const cantidad = Number(m.cantidad || 1);
          const baseConIva = Number(m.precio_con_iva || 0) > 0
            ? Number(m.precio_con_iva || 0)
            : Number(m.precio_sin_iva || 0) * (1 + Number(m.iva || 0) / 100);
          const total = Number(baseConIva || 0) * (cantidad > 0 ? cantidad : 1);
          return {
            id: `auto-maq-${m.id}`,
            tipo: "gasto_auto_maquinaria",
            fecha: m.fecha_compra || m.created_at,
            concepto: `Compra maquinaria: ${m.nombre || `#${m.id}`}`,
            categoria: "compra_maquinaria_auto",
            proveedor: m.marca || "-",
            observaciones: m.modelo || "",
            importe: total,
            origen: "maquinaria",
          };
        })
        .filter((m) => Number(m.importe || 0) > 0);
      setGastosAutoMaquinaria(autosMaquinaria);
    } catch (err) {
      console.error("cargarDatos finanzas:", err);
      setGastos([]);
      setIngresosAutomaticos(0);
      setGastosAutoEntradas([]);
      setGastosAutoMaquinaria([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (desde && hasta) {
      cargarDatos(desde, hasta, categoria, q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desde, hasta]);

  const totales = useMemo(() => {
    const manualIngresos = gastos
      .filter((g) => String(g.categoria || "").toLowerCase() === "ingreso_manual")
      .reduce((acc, g) => acc + Number(g.importe || 0), 0);

    const totalGastosManuales = gastos
      .filter((g) => String(g.categoria || "").toLowerCase() !== "ingreso_manual")
      .reduce((acc, g) => acc + Number(g.importe || 0), 0);

    const totalGastosEntradasAuto = gastosAutoEntradas.reduce((acc, g) => acc + Number(g.importe || 0), 0);
    const totalGastosMaquinariaAuto = gastosAutoMaquinaria.reduce((acc, g) => acc + Number(g.importe || 0), 0);
    const totalGastos = totalGastosManuales + totalGastosEntradasAuto + totalGastosMaquinariaAuto;

    const ingresosTotales = Number(ingresosAutomaticos || 0) + manualIngresos;
    const balance = ingresosTotales - totalGastos;

    return {
      manualIngresos,
      totalGastosManuales,
      totalGastosEntradasAuto,
      totalGastosMaquinariaAuto,
      totalGastos,
      ingresosTotales,
      balance,
    };
  }, [gastos, gastosAutoEntradas, gastosAutoMaquinaria, ingresosAutomaticos]);

  const movimientosTabla = useMemo(() => {
    const manual = (gastos || []).map((g) => ({ ...g, origen: "manual" }));
    const merged = [...manual, ...gastosAutoEntradas, ...gastosAutoMaquinaria];
    return merged.sort((a, b) => {
      const da = new Date(a.fecha || a.created_at || 0).getTime();
      const db = new Date(b.fecha || b.created_at || 0).getTime();
      return db - da;
    });
  }, [gastos, gastosAutoEntradas, gastosAutoMaquinaria]);

  const movimientosFiltrados = useMemo(() => {
    return movimientosTabla.filter((m) => {
      const origen = String(m.origen || "");
      const isManual = origen === "manual";
      if (isManual && !mostrarManuales) return false;
      if (!isManual && !mostrarAutomaticos) return false;
      return true;
    });
  }, [movimientosTabla, mostrarManuales, mostrarAutomaticos]);

  const exportarCSV = () => {
    const rows = movimientosFiltrados.map((g) => {
      const tipo = String(g.categoria || "").toLowerCase() === "ingreso_manual" ? "Ingreso manual" : "Gasto";
      const origen = String(g.origen || "") || "manual";
      const importeSigned = String(g.categoria || "").toLowerCase() === "ingreso_manual"
        ? Number(g.importe || 0)
        : -Number(g.importe || 0);

      return [
        fmtDate(g.fecha || g.created_at),
        tipo,
        origen,
        g.concepto || "",
        g.categoria || "",
        g.proveedor || "",
        g.observaciones || "",
        String(importeSigned.toFixed(2)),
      ];
    });

    const header = ["Fecha", "Tipo", "Origen", "Concepto", "Categoria", "Proveedor", "Observaciones", "Importe"];
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"))
      .join("\n");

    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finanzas_${desde || "desde"}_${hasta || "hasta"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportarPDF = () => {
    window.print();
  };

  const onChangeForm = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const limpiarForm = () => {
    setForm({ ...DEFAULT_FORM, fecha: new Date().toISOString().split("T")[0] });
  };

  const crearGasto = async (e) => {
    e.preventDefault();

    if (!form.concepto.trim()) {
      alert("El concepto es obligatorio");
      return;
    }

    const importe = Number(form.importe);
    if (!Number.isFinite(importe) || importe < 0) {
      alert("El importe debe ser un numero valido mayor o igual a 0");
      return;
    }

    setSaving(true);
    try {
      await actions.createGastoEmpresa({
        fecha: form.fecha,
        concepto: form.concepto,
        categoria: form.tipo_movimiento === "ingreso" ? "ingreso_manual" : form.categoria,
        importe,
        proveedor: form.proveedor,
        observaciones: form.observaciones,
      });
      limpiarForm();
      await cargarDatos();
    } catch (err) {
      alert(`No se pudo guardar el gasto: ${err?.message || "error"}`);
    } finally {
      setSaving(false);
    }
  };

  const eliminarGasto = async (id) => {
    if (!window.confirm("Deseas eliminar este gasto?")) return;
    try {
      await actions.deleteGastoEmpresa(id);
      await cargarDatos();
    } catch (err) {
      alert(`No se pudo eliminar: ${err?.message || "error"}`);
    }
  };

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="mb-0">Finanzas Empresa</h2>
        <div className="d-flex gap-2">
          <button
            className="btn btn-outline-secondary"
            onClick={exportarCSV}
            disabled={loading || !movimientosFiltrados.length}
          >
            Exportar Excel (CSV)
          </button>
          <button
            className="btn btn-outline-secondary"
            onClick={exportarPDF}
            disabled={loading || !movimientosFiltrados.length}
          >
            Exportar PDF
          </button>
          <button
            className="btn btn-outline-dark"
            onClick={() => cargarDatos()}
            disabled={loading}
          >
            {loading ? "Actualizando..." : "Actualizar"}
          </button>
        </div>
      </div>

      <div className="d-flex gap-3 mb-3">
        <div className="form-check">
          <input
            id="mov-manual"
            type="checkbox"
            className="form-check-input"
            checked={mostrarManuales}
            onChange={(e) => setMostrarManuales(e.target.checked)}
          />
          <label className="form-check-label" htmlFor="mov-manual">
            Mostrar manuales
          </label>
        </div>
        <div className="form-check">
          <input
            id="mov-auto"
            type="checkbox"
            className="form-check-input"
            checked={mostrarAutomaticos}
            onChange={(e) => setMostrarAutomaticos(e.target.checked)}
          />
          <label className="form-check-label" htmlFor="mov-auto">
            Mostrar automáticos (productos y maquinaria)
          </label>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <label className="form-label fw-semibold">Mes</label>
          <input
            type="month"
            className="form-control"
            value={mesSeleccionado}
            onChange={(e) => setMesSeleccionado(e.target.value)}
          />
        </div>
        <div className="col-md-2">
          <label className="form-label fw-semibold">Desde</label>
          <input
            type="date"
            className="form-control"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
          />
        </div>
        <div className="col-md-2">
          <label className="form-label fw-semibold">Hasta</label>
          <input
            type="date"
            className="form-control"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
          />
        </div>
        <div className="col-md-2">
          <label className="form-label fw-semibold">Categoria</label>
          <input
            type="text"
            className="form-control"
            placeholder="general, nomina..."
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
          />
        </div>
        <div className="col-md-3">
          <label className="form-label fw-semibold">Buscar</label>
          <div className="d-flex gap-2">
            <input
              type="text"
              className="form-control"
              placeholder="concepto, proveedor..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button
              className="btn btn-dark"
              type="button"
              onClick={() => cargarDatos(desde, hasta, categoria, q)}
            >
              Filtrar
            </button>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <div className="card border-success h-100">
            <div className="card-body">
              <div className="text-muted small">Facturacion del periodo (auto)</div>
              <div className="fs-4 fw-bold text-success">{money(ingresosAutomaticos)}</div>
              <div className="small text-muted">Calculado desde servicios facturados</div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card border-info h-100">
            <div className="card-body">
              <div className="text-muted small">Ingresos manuales (sin factura)</div>
              <div className="fs-4 fw-bold text-info">{money(totales.manualIngresos)}</div>
              <div className="small text-muted">Registros manuales de caja/cobros</div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className={`card h-100 ${totales.balance >= 0 ? "border-primary" : "border-warning"}`}>
            <div className="card-body">
              <div className="text-muted small">Resultado (ganancia / perdida)</div>
              <div className={`fs-4 fw-bold ${totales.balance >= 0 ? "text-primary" : "text-warning"}`}>
                {money(totales.balance)}
              </div>
              <div className="small text-muted">
                Ingresos totales {money(totales.ingresosTotales)} - Gastos {money(totales.totalGastos)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-6">
          <div className="card border-danger h-100">
            <div className="card-body">
              <div className="text-muted small">Gastos del periodo (total)</div>
              <div className="fs-5 fw-bold text-danger">{money(totales.totalGastos)}</div>
              <div className="small text-muted">
                Manuales {money(totales.totalGastosManuales)} | Productos auto {money(totales.totalGastosEntradasAuto)} | Maquinaria auto {money(totales.totalGastosMaquinariaAuto)}
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-6">
          <div className="card border-success h-100">
            <div className="card-body">
              <div className="text-muted small">Ingresos totales del periodo</div>
              <div className="fs-5 fw-bold text-success">{money(totales.ingresosTotales)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-header fw-semibold">Registrar movimiento manual</div>
        <div className="card-body">
          <form className="row g-3" onSubmit={crearGasto}>
            <div className="col-md-2">
              <label className="form-label">Fecha</label>
              <input type="date" name="fecha" className="form-control" value={form.fecha} onChange={onChangeForm} required />
            </div>
            <div className="col-md-2">
              <label className="form-label">Tipo</label>
              <select
                name="tipo_movimiento"
                className="form-select"
                value={form.tipo_movimiento}
                onChange={onChangeForm}
              >
                <option value="gasto">Gasto / Pago</option>
                <option value="ingreso">Ingreso manual</option>
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label">Concepto</label>
              <input type="text" name="concepto" className="form-control" value={form.concepto} onChange={onChangeForm} required />
            </div>
            <div className="col-md-2">
              <label className="form-label">Categoria</label>
              <input
                type="text"
                name="categoria"
                className="form-control"
                value={form.categoria}
                onChange={onChangeForm}
                disabled={form.tipo_movimiento === "ingreso"}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label">Importe</label>
              <input type="number" min="0" step="0.01" name="importe" className="form-control" value={form.importe} onChange={onChangeForm} required />
            </div>
            <div className="col-md-3">
              <label className="form-label">Proveedor / Destino</label>
              <input type="text" name="proveedor" className="form-control" value={form.proveedor} onChange={onChangeForm} />
            </div>
            <div className="col-12">
              <label className="form-label">Observaciones</label>
              <textarea name="observaciones" className="form-control" rows="2" value={form.observaciones} onChange={onChangeForm} />
            </div>
            <div className="col-12 d-flex gap-2">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Guardando..." : "Guardar gasto"}
              </button>
              <button type="button" className="btn btn-outline-secondary" onClick={limpiarForm}>
                Limpiar
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <span className="fw-semibold">Movimientos (manuales + automaticos)</span>
          <span className="badge bg-dark">{movimientosFiltrados.length} items</span>
        </div>
        <div className="table-responsive">
          <table className="table table-sm table-striped mb-0">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Origen</th>
                <th>Concepto</th>
                <th>Categoria</th>
                <th>Proveedor</th>
                <th>Observaciones</th>
                <th className="text-end">Importe</th>
                <th className="text-end">Accion</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={9} className="text-center py-3">Cargando...</td>
                </tr>
              )}
              {!loading && movimientosFiltrados.map((g) => (
                <tr key={g.id}>
                  <td>{fmtDate(g.fecha || g.created_at)}</td>
                  <td>
                    {String(g.categoria || "").toLowerCase() === "ingreso_manual" ? (
                      <span className="badge bg-success">Ingreso manual</span>
                    ) : String(g.origen || "") === "entrada" ? (
                      <span className="badge bg-danger">Gasto auto</span>
                    ) : String(g.origen || "") === "maquinaria" ? (
                      <span className="badge bg-danger">Gasto auto</span>
                    ) : (
                      <span className="badge bg-danger">Gasto</span>
                    )}
                  </td>
                  <td>
                    {String(g.origen || "") === "entrada" && <span className="badge bg-secondary">Productos</span>}
                    {String(g.origen || "") === "maquinaria" && <span className="badge bg-secondary">Maquinaria</span>}
                    {String(g.origen || "") === "manual" && <span className="badge bg-dark">Manual</span>}
                  </td>
                  <td>{g.concepto}</td>
                  <td style={{ textTransform: "capitalize" }}>{g.categoria || "-"}</td>
                  <td>{g.proveedor || "-"}</td>
                  <td>{g.observaciones || "-"}</td>
                  <td className="text-end fw-semibold">
                    {String(g.categoria || "").toLowerCase() === "ingreso_manual" ? "+" : "-"}
                    {money(g.importe)}
                  </td>
                  <td className="text-end">
                    {String(g.origen || "") === "manual" ? (
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => eliminarGasto(g.id)}
                      >
                        Eliminar
                      </button>
                    ) : (
                      <span className="text-muted small">Automatico</span>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && !movimientosFiltrados.length && (
                <tr>
                  <td colSpan={9} className="text-center py-4 text-muted">
                    No hay movimientos para los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
