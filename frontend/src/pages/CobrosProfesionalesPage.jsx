import React, { useContext, useEffect, useMemo, useState } from "react";
import { Context } from "../store/appContext";

const money = (n) => `${Number(n || 0).toFixed(2)} EUR`;
const COBRO_METODOS = ["transferencia", "efectivo", "bizum", "tarjeta"];

export default function CobrosProfesionalesPage() {
  const { actions } = useContext(Context);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [actionError, setActionError] = useState("");
  const [soloPendientes, setSoloPendientes] = useState(true);
  const [clientes, setClientes] = useState([]);
  const [abonos, setAbonos] = useState({});
  const [cobroMeta, setCobroMeta] = useState({});

  const cargar = async (nextSoloPendientes = soloPendientes) => {
    setLoading(true);
    try {
      const data = await actions.getCobrosProfesionales({ soloPendientes: nextSoloPendientes });
      setClientes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("cargar cobros profesionales:", err);
      setClientes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar(soloPendientes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soloPendientes]);

  const resumen = useMemo(() => {
    return (clientes || []).reduce(
      (acc, c) => {
        acc.facturado += Number(c.total_facturado || 0);
        acc.pagado += Number(c.total_pagado || 0);
        acc.pendiente += Number(c.total_pendiente || 0);
        return acc;
      },
      { facturado: 0, pagado: 0, pendiente: 0 }
    );
  }, [clientes]);

  const onChangeAbono = (inspeccionId, value) => {
    setAbonos((prev) => ({ ...prev, [inspeccionId]: value }));
  };

  const onChangeCobroMeta = (inspeccionId, field, value) => {
    setCobroMeta((prev) => ({
      ...prev,
      [inspeccionId]: {
        metodo: prev[inspeccionId]?.metodo || "transferencia",
        referencia: prev[inspeccionId]?.referencia || "",
        [field]: value,
      },
    }));
  };

  const registrarAbono = async (inspeccionId) => {
    const importe = Number(abonos[inspeccionId]);
    if (!Number.isFinite(importe) || importe < 0) {
      setActionError("El importe debe ser válido y mayor o igual a 0");
      return;
    }
    setActionError("");

    setSavingId(inspeccionId);
    try {
      const metodo = cobroMeta[inspeccionId]?.metodo || "transferencia";
      const referencia = (cobroMeta[inspeccionId]?.referencia || "").trim();
      await actions.registrarCobroInspeccion(inspeccionId, {
        accion: "abono",
        importe,
        metodo,
        referencia,
      });
      setAbonos((prev) => ({ ...prev, [inspeccionId]: "" }));
      await cargar(soloPendientes);
    } catch (err) {
      setActionError(`No se pudo registrar el abono: ${err?.message || "error"}`);
    } finally {
      setSavingId(null);
    }
  };

  const marcarPagado = async (inspeccionId) => {
    if (!window.confirm("Marcar esta inspección como pagada al 100%?")) return;

    setSavingId(inspeccionId);
    try {
      const metodo = cobroMeta[inspeccionId]?.metodo || "transferencia";
      const referencia = (cobroMeta[inspeccionId]?.referencia || "").trim();
      await actions.registrarCobroInspeccion(inspeccionId, {
        accion: "marcar_pagado_total",
        metodo,
        referencia,
      });
      await cargar(soloPendientes);
    } catch (err) {
      setActionError(`No se pudo marcar pagado: ${err?.message || "error"}`);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="container mt-4">
      {actionError && (
        <div className="alert alert-danger d-flex justify-content-between align-items-start py-2 mb-3">
          <span>{actionError}</span>
          <button className="btn-close ms-3" onClick={() => setActionError("")} />
        </div>
      )}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="mb-0">Cobros Profesionales</h2>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-dark" onClick={() => cargar(soloPendientes)} disabled={loading}>
            {loading ? "Actualizando..." : "Actualizar"}
          </button>
        </div>
      </div>

      <div className="d-flex align-items-center gap-3 mb-3">
        <div className="form-check">
          <input
            id="soloPendientes"
            type="checkbox"
            className="form-check-input"
            checked={soloPendientes}
            onChange={(e) => setSoloPendientes(e.target.checked)}
          />
          <label htmlFor="soloPendientes" className="form-check-label">
            Mostrar solo pendientes
          </label>
        </div>
        <span className="badge bg-secondary">Clientes: {clientes.length}</span>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <div className="card border-primary h-100">
            <div className="card-body">
              <div className="small text-muted">Facturado</div>
              <div className="fs-4 fw-bold text-primary">{money(resumen.facturado)}</div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card border-success h-100">
            <div className="card-body">
              <div className="small text-muted">Cobrado</div>
              <div className="fs-4 fw-bold text-success">{money(resumen.pagado)}</div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card border-danger h-100">
            <div className="card-body">
              <div className="small text-muted">Pendiente</div>
              <div className="fs-4 fw-bold text-danger">{money(resumen.pendiente)}</div>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="alert alert-info">Cargando cobros profesionales...</div>
      ) : !clientes.length ? (
        <div className="alert alert-success mb-0">No hay deuda pendiente de clientes profesionales.</div>
      ) : (
        clientes.map((cliente) => (
          <div key={`${cliente.cliente_id || cliente.cliente_nombre}`} className="card mb-3">
            <div className="card-header d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2">
              <div>
                <strong>{cliente.cliente_nombre}</strong>
              </div>
              <div className="small text-muted">
                Facturado {money(cliente.total_facturado)} | Cobrado {money(cliente.total_pagado)} | Pendiente {" "}
                <span className="fw-bold text-danger">{money(cliente.total_pendiente)}</span>
              </div>
            </div>
            <div className="table-responsive">
              <table className="table table-sm mb-0 align-middle">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Fecha entrega</th>
                    <th>Matrícula</th>
                    <th>Total</th>
                    <th>Pagado</th>
                    <th>Pendiente</th>
                    <th>Estado</th>
                    <th>Registrar pago</th>
                  </tr>
                </thead>
                <tbody>
                  {(cliente.inspecciones || []).map((insp) => (
                    <tr key={insp.id}>
                      <td>#{insp.id}</td>
                      <td>{insp.fecha_entrega ? new Date(insp.fecha_entrega).toLocaleDateString("es-ES") : "-"}</td>
                      <td><span className="badge bg-dark">{insp.matricula}</span></td>
                      <td>{money(insp.cobro?.importe_total)}</td>
                      <td>{money(insp.cobro?.importe_pagado)}</td>
                      <td className="fw-semibold text-danger">{money(insp.cobro?.importe_pendiente)}</td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            backgroundColor: insp.cobro?.color || "#6c757d",
                            color: "#fff",
                          }}
                        >
                          {insp.cobro?.label || "Sin datos"}
                        </span>
                      </td>
                      <td>
                        <div className="d-flex gap-2">
                          <select
                            className="form-select form-select-sm"
                            style={{ width: "130px" }}
                            value={cobroMeta[insp.id]?.metodo || "transferencia"}
                            onChange={(e) => onChangeCobroMeta(insp.id, "metodo", e.target.value)}
                          >
                            {COBRO_METODOS.map((m) => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="form-control form-control-sm"
                            style={{ width: "120px" }}
                            placeholder="Abono"
                            value={abonos[insp.id] ?? ""}
                            onChange={(e) => onChangeAbono(insp.id, e.target.value)}
                          />
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            style={{ width: "140px" }}
                            placeholder="Referencia"
                            value={cobroMeta[insp.id]?.referencia || ""}
                            onChange={(e) => onChangeCobroMeta(insp.id, "referencia", e.target.value)}
                          />
                          <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => registrarAbono(insp.id)}
                            disabled={savingId === insp.id}
                          >
                            Abonar
                          </button>
                          <button
                            className="btn btn-sm btn-success"
                            onClick={() => marcarPagado(insp.id)}
                            disabled={savingId === insp.id}
                          >
                            Pagado
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
