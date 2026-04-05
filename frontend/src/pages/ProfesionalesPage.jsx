import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Context } from "../store/appContext";

const money = (n) => `${Number(n || 0).toFixed(2)} EUR`;
const COBRO_METODOS = ["transferencia", "efectivo", "bizum", "tarjeta"];
const METODOS_PAGO = ["efectivo", "bizum", "tarjeta", "transferencia"];

const formatFecha = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("es-ES");
};

export default function ProfesionalesPage() {
  const { actions } = useContext(Context);
  const [tab, setTab] = useState("recaudacion"); // "recaudacion" o "entregas"
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [actionError, setActionError] = useState("");
  const [modalError, setModalError] = useState("");
  const [soloPendientes, setSoloPendientes] = useState(true);

  // RECAUDACIÓN (Cobros)
  const [clientes, setClientes] = useState([]);
  const [abonos, setAbonos] = useState({});
  const [cobroMeta, setCobroMeta] = useState({});

  // ENTREGAS (Pagos)
  const [pagos, setPagos] = useState([]);
  const [registrando, setRegistrando] = useState(false);
  const [registroModal, setRegistroModal] = useState(null);
  const [formData, setFormData] = useState({
    importe: "",
    metodo: "efectivo",
    referencia: "",
    observaciones: "",
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RECAUDACIÓN: Cargar clientes y sus deudas
  // ═══════════════════════════════════════════════════════════════════════════
  const cargarRecaudacion = useCallback(async (nextSoloPendientes = soloPendientes) => {
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
  }, [actions, soloPendientes]);

  // ═══════════════════════════════════════════════════════════════════════════
  // ENTREGAS: Cargar pagos pendientes
  // ═══════════════════════════════════════════════════════════════════════════
  const cargarEntregas = useCallback(async () => {
    setLoading(true);
    try {
      const data = await actions.getPagosProfesionalesPendientes();
      setPagos(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("cargar pagos pendientes:", e);
      setPagos([]);
    } finally {
      setLoading(false);
    }
  }, [actions]);

  useEffect(() => {
    if (tab === "recaudacion") {
      cargarRecaudacion(soloPendientes);
    } else {
      cargarEntregas();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, soloPendientes]);

  // ═══════════════════════════════════════════════════════════════════════════
  // RECAUDACIÓN: Lógica de cobros
  // ═══════════════════════════════════════════════════════════════════════════
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
      await cargarRecaudacion(soloPendientes);
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
      await cargarRecaudacion(soloPendientes);
    } catch (err) {
      setActionError(`No se pudo marcar pagado: ${err?.message || "error"}`);
    } finally {
      setSavingId(null);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ENTREGAS: Lógica de pagos de entrega
  // ═══════════════════════════════════════════════════════════════════════════
  const abrirRegistro = (pago) => {
    setRegistroModal(pago);
    setFormData({
      importe: String(pago.importe_total || 0),
      metodo: pago.cobro_metodo || "efectivo",
      referencia: pago.cobro_referencia || "",
      observaciones: pago.cobro_observaciones || "",
    });
  };

  const cerrarRegistro = () => {
    setRegistroModal(null);
    setModalError("");
    setFormData({
      importe: "",
      metodo: "efectivo",
      referencia: "",
      observaciones: "",
    });
  };

  const registrarPago = async () => {
    if (!registroModal) return;

    const importe = Number(formData.importe);
    if (!Number.isFinite(importe) || importe <= 0) {
      setModalError("Importe inválido");
      return;
    }
    setModalError("");

    setRegistrando(true);
    try {
      await actions.registrarPagoProfesional(registroModal.id, {
        importe,
        metodo: formData.metodo,
        referencia: formData.referencia,
        observaciones: formData.observaciones,
      });
      cerrarRegistro();
      await cargarEntregas();
    } catch (e) {
      setModalError(e?.message || "No se pudo registrar el pago");
    } finally {
      setRegistrando(false);
    }
  };

  const totalPendiente = useMemo(() => {
    return pagos.reduce((sum, p) => sum + (Number(p.importe_total || 0) || 0), 0);
  }, [pagos]);

  return (
    <div className="container-fluid py-4" style={{ maxWidth: "1400px" }}>
      {/* HEADER */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="mb-0 fw-bold">👥 Gestión de Clientes Profesionales</h2>
        <button
          className="btn btn-outline-dark"
          onClick={() => (tab === "recaudacion" ? cargarRecaudacion(soloPendientes) : cargarEntregas())}
          disabled={loading}
        >
          {loading ? "Actualizando..." : "Actualizar"}
        </button>
      </div>

      {/* TABS */}
      <ul className="nav nav-tabs mb-4" role="tablist">
        <li className="nav-item" role="presentation">
          <button
            className={`nav-link ${tab === "recaudacion" ? "active" : ""}`}
            id="tab-recaudacion"
            type="button"
            onClick={() => setTab("recaudacion")}
            role="tab"
            aria-controls="recaudacion-panel"
            aria-selected={tab === "recaudacion"}
          >
            💰 Recaudación de Facturas
          </button>
        </li>
        <li className="nav-item" role="presentation">
          <button
            className={`nav-link ${tab === "entregas" ? "active" : ""}`}
            id="tab-entregas"
            type="button"
            onClick={() => setTab("entregas")}
            role="tab"
            aria-controls="entregas-panel"
            aria-selected={tab === "entregas"}
          >
            🚗 Entregas Pendientes de Pago
          </button>
        </li>
      </ul>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: RECAUDACIÓN DE FACTURAS */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {tab === "recaudacion" && (
        <div id="recaudacion-panel" role="tabpanel" aria-labelledby="tab-recaudacion">
          {actionError && (
            <div className="alert alert-danger d-flex justify-content-between align-items-start py-2 mb-3">
              <span>{actionError}</span>
              <button className="btn-close ms-3" onClick={() => setActionError("")} />
            </div>
          )}
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
                    Facturado {money(cliente.total_facturado)} | Cobrado {money(cliente.total_pagado)} | Pendiente{" "}
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
                          <td>
                            <span className="badge bg-dark">{insp.matricula}</span>
                          </td>
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
                            <div className="d-flex gap-2 flex-wrap">
                              <select
                                className="form-select form-select-sm"
                                style={{ width: "130px" }}
                                value={cobroMeta[insp.id]?.metodo || "transferencia"}
                                onChange={(e) => onChangeCobroMeta(insp.id, "metodo", e.target.value)}
                              >
                                {COBRO_METODOS.map((m) => (
                                  <option key={m} value={m}>
                                    {m}
                                  </option>
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
                                className="btn btn-sm btn-outline-primary text-nowrap"
                                onClick={() => registrarAbono(insp.id)}
                                disabled={savingId === insp.id}
                              >
                                Abonar
                              </button>
                              <button
                                className="btn btn-sm btn-success text-nowrap"
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
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB 2: ENTREGAS PENDIENTES DE PAGO */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {tab === "entregas" && (
        <div id="entregas-panel" role="tabpanel" aria-labelledby="tab-entregas">
          {/* STATS */}
          <div className="row g-3 mb-4">
            <div className="col-md-6">
              <div className="card shadow-sm" style={{ borderRadius: "12px", border: "1px solid #e0e0e0" }}>
                <div className="card-body">
                  <p className="text-muted mb-2">📋 Entregas pendientes</p>
                  <h4 className="fw-bold sw-accent-text">{pagos.length}</h4>
                </div>
              </div>
            </div>
            <div className="col-md-6">
              <div className="card shadow-sm" style={{ borderRadius: "12px", border: "1px solid #e0e0e0" }}>
                <div className="card-body">
                  <p className="text-muted mb-2">💰 Total pendiente</p>
                  <h4 className="fw-bold sw-accent-text">{totalPendiente.toFixed(2)} €</h4>
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-5">
              <p className="text-muted">Cargando entregas pendientes...</p>
            </div>
          ) : pagos.length === 0 ? (
            <div className="alert alert-info">✅ No hay entregas pendientes de pago. ¡Todos al día!</div>
          ) : (
            <div className="card shadow-sm" style={{ borderRadius: "12px", border: "1px solid #e0e0e0" }}>
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="sw-table-header">
                    <tr>
                      <th>ID</th>
                      <th>Cliente</th>
                      <th>Coche</th>
                      <th>Matrícula</th>
                      <th>Fecha entrega</th>
                      <th>Importe</th>
                      <th>Método</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagos.map((pago) => (
                      <tr key={pago.id}>
                        <td>#{pago.id}</td>
                        <td>{pago.cliente_nombre || "-"}</td>
                        <td>{pago.coche_descripcion || "-"}</td>
                        <td>{pago.matricula || "-"}</td>
                        <td className="small">{formatFecha(pago.fecha_entrega)}</td>
                        <td className="fw-bold sw-accent-text">
                          {Number(pago.importe_total || 0).toFixed(2)} €
                        </td>
                        <td>
                          {pago.cobro_metodo ? (
                            <span className="badge bg-secondary">{pago.cobro_metodo}</span>
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </td>
                        <td>
                          <button
                            className="btn btn-outline-success btn-sm text-nowrap"
                            onClick={() => abrirRegistro(pago)}
                          >
                            💳 Registrar pago
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL REGISTRAR PAGO */}
      {registroModal && (
        <div className="modal d-block" style={{ backgroundColor: "var(--sw-overlay-bg)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header sw-modal-header-dark" style={{ borderBottom: "none" }}>
                <h5 className="modal-title fw-bold sw-accent-text">💳 Registrar pago</h5>
                <button type="button" className="btn-close btn-close-white" onClick={cerrarRegistro}></button>
              </div>
              <div className="modal-body">
                {modalError && (
                  <div className="alert alert-danger d-flex justify-content-between align-items-start py-2 mb-3">
                    <span>{modalError}</span>
                    <button className="btn-close ms-3" onClick={() => setModalError("")} />
                  </div>
                )}
                <div className="mb-3">
                  <label className="form-label fw-bold">Cliente</label>
                  <p>{registroModal.cliente_nombre || "-"}</p>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-bold">Coche</label>
                  <p>
                    {registroModal.coche_descripcion || "-"} · {registroModal.matricula || "-"}
                  </p>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-bold">Importe total</label>
                  <p className="sw-accent-text" style={{ fontSize: "1.2em" }}>
                    {Number(registroModal.importe_total || 0).toFixed(2)} €
                  </p>
                </div>

                <hr />

                <div className="mb-3">
                  <label className="form-label">Importe a registrar *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="form-control"
                    value={formData.importe}
                    onChange={(e) => setFormData({ ...formData, importe: e.target.value })}
                    placeholder="0.00"
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">Método de pago *</label>
                  <select
                    className="form-select"
                    value={formData.metodo}
                    onChange={(e) => setFormData({ ...formData, metodo: e.target.value })}
                  >
                    {METODOS_PAGO.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-3">
                  <label className="form-label">Referencia (operación/ticket)</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.referencia}
                    onChange={(e) => setFormData({ ...formData, referencia: e.target.value })}
                    placeholder="Ej. TXN123456 o K02"
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">Observaciones</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.observaciones}
                    onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                    placeholder="Nota interna"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={cerrarRegistro} disabled={registrando}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={registrarPago}
                  disabled={registrando || !formData.importe}
                >
                  {registrando ? "Registrando..." : "✅ Registrar pago"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
