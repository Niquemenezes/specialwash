import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Context } from "../store/appContext";

const formatFecha = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("es-ES");
};

const PagosProfesinalesPage = () => {
  const { actions } = useContext(Context);
  const [pagos, setPagos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [registrando, setRegistrando] = useState(false);
  const [registroModal, setRegistroModal] = useState(null);
  const [formData, setFormData] = useState({
    importe: "",
    metodo: "efectivo",
    referencia: "",
    observaciones: "",
  });

  const METODOS = ["efectivo", "bizum", "tarjeta", "transferencia"];

  const cargarPagos = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await actions.getPagosProfesionalesPendientes();
      setPagos(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || "No se pudieron cargar los pagos pendientes");
      setPagos([]);
    } finally {
      setLoading(false);
    }
  }, [actions]);

  useEffect(() => {
    cargarPagos();
  }, [cargarPagos]);

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
      alert("Importe inválido");
      return;
    }

    setRegistrando(true);
    try {
      await actions.registrarPagoProfesional(registroModal.id, {
        importe,
        metodo: formData.metodo,
        referencia: formData.referencia,
        observaciones: formData.observaciones,
      });
      alert("Pago registrado correctamente");
      cerrarRegistro();
      await cargarPagos();
    } catch (e) {
      alert(`Error: ${e?.message || "No se pudo registrar el pago"}`);
    } finally {
      setRegistrando(false);
    }
  };

  const totalPendiente = useMemo(() => {
    return pagos.reduce((sum, p) => sum + (Number(p.importe_total || 0) || 0), 0);
  }, [pagos]);

  return (
    <div className="container py-4" style={{ maxWidth: "1200px" }}>
      <div
        className="d-flex justify-content-between align-items-center p-3 mb-4 shadow-sm sw-header-dark"
        style={{
          borderRadius: "12px",
        }}
      >
        <h2 className="fw-bold m-0 sw-accent-text" style={{ fontSize: "clamp(1.2rem, 4vw, 1.75rem)" }}>
          💼 Pagos de Profesionales
        </h2>
        <p className="m-0 d-none d-md-block" style={{ fontSize: "0.85rem", color: "#aaa" }}>
          Gestiona pagos pendientes de coches entregados a profesionales
        </p>
      </div>

      {error && (
        <div className="alert alert-danger alert-dismissible fade show" role="alert">
          <strong>Error:</strong> {error}
          <button type="button" className="btn-close" onClick={() => setError("")}></button>
        </div>
      )}

      {/* STATS */}
      <div className="row g-3 mb-4">
        <div className="col-md-6">
          <div className="card shadow-sm" style={{ borderRadius: "12px", border: "1px solid #e0e0e0" }}>
            <div className="card-body">
              <p className="text-muted mb-2">📋 Pagos pendientes</p>
              <h4 className="fw-bold sw-accent-text">{pagos.length}</h4>
            </div>
          </div>
        </div>
        <div className="col-md-6">
          <div className="card shadow-sm" style={{ borderRadius: "12px", border: "1px solid #e0e0e0" }}>
            <div className="card-body">
              <p className="text-muted mb-2">💰 Total a cobrar</p>
              <h4 className="fw-bold sw-accent-text">{totalPendiente.toFixed(2)} €</h4>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <p className="text-muted">Cargando pagos pendientes...</p>
        </div>
      ) : pagos.length === 0 ? (
        <div className="alert alert-info">✅ No hay pagos pendientes. ¡Todos al día!</div>
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
                        className="btn btn-outline-success btn-sm"
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
                    {METODOS.map((m) => (
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
};

export default PagosProfesinalesPage;
