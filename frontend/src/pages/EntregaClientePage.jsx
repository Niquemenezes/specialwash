import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Context } from "../store/appContext";
import SignaturePad from "../component/SignaturePad";
import "../styles/inspeccion-responsive.css";

const safeDate = (value) => {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleString("es-ES");
};

export default function EntregaClientePage() {
  const { inspeccion_id } = useParams();
  const { actions } = useContext(Context);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [inspeccion, setInspeccion] = useState(null);
  const [firma, setFirma] = useState(null);
  const [cobroForm, setCobroForm] = useState({
    registrar_cobro: false,
    cobro_accion: "abono",
    cobro_importe: "",
    cobro_metodo: "efectivo",
    cobro_referencia: "",
    cobro_observaciones: "",
  });

  // LOAD
  const cargar = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const insp = await actions.getInspeccion(inspeccion_id);
      setInspeccion(insp);
    } catch (err) {
      console.error("Error cargando inspección", err);
      setFeedback({ type: "error", msg: "Error al cargar inspección" });
    } finally {
      setLoading(false);
    }
  }, [inspeccion_id, actions]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // CALCULAR IMPORTE TOTAL
  const importeTotal = useMemo(() => {
    if (!inspeccion?.servicios_aplicados) return 0;
    try {
      const servicios = JSON.parse(inspeccion.servicios_aplicados);
      return servicios.reduce((acc, s) => acc + (parseFloat(s.precio) || 0), 0);
    } catch {
      return 0;
    }
  }, [inspeccion]);

  const esConcesionario = inspeccion?.es_concesionario || false;

  // REGISTRAR ENTREGA
  const registrarEntrega = async () => {
    if (!esConcesionario && !firma) {
      setFeedback({
        type: "error",
        msg: "La firma del cliente es requerida para particulares",
      });
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      const payload = {
        trabajos_realizados: inspeccion.trabajos_realizados || "",
        entrega_observaciones: inspeccion.entrega_observaciones || "",
        firma_cliente_entrega: esConcesionario ? null : firma,
        consentimiento_datos_entrega: !esConcesionario,
        conformidad_revision_entrega: true,
      };

      // Si es particular y debe registrar cobro
      if (!esConcesionario && cobroForm.registrar_cobro) {
        payload.registrar_cobro = true;
        payload.cobro_accion = cobroForm.cobro_accion;
        payload.cobro_importe = parseFloat(cobroForm.cobro_importe) || 0;
        payload.cobro_metodo = cobroForm.cobro_metodo;
        payload.cobro_referencia = cobroForm.cobro_referencia;
        payload.cobro_observaciones = cobroForm.cobro_observaciones;
      }

      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL || "http://localhost:5001/api"}/inspeccion-recepcion/${inspeccion_id}/entrega`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionStorage.getItem("token") || localStorage.getItem("token")}`,
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.msg || "Error al registrar entrega");
      }

      setFeedback({
        type: "success",
        msg: "✓ Coche entregado correctamente",
      });

      setTimeout(() => {
        navigate("/vehiculos");
      }, 1500);
    } catch (err) {
      console.error("Error registrar entrega", err);
      setFeedback({
        type: "error",
        msg: "Error: " + err.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCobroChange = (e) => {
    const { name, value, type, checked } = e.target;
    setCobroForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  if (loading) {
    return (
      <div className="container mt-5 text-center">
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
      </div>
    );
  }

  if (!inspeccion) {
    return (
      <div className="container mt-5">
        <div className="alert alert-danger">Inspección no encontrada</div>
        <button className="btn btn-secondary" onClick={() => navigate("/vehiculos")}>
          Volver a Vehículos
        </button>
      </div>
    );
  }

  return (
    <div className="container-fluid mt-4">
      {/* HEADER */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <button
            className="btn btn-sm btn-outline-secondary me-2"
            onClick={() => navigate(`/vehiculo-detalle/${inspeccion_id}`)}
          >
            ← Atrás
          </button>
          <h2 className="d-inline">Entrega al Cliente</h2>
        </div>
      </div>

      {/* FEEDBACK */}
      {feedback && (
        <div
          className={`alert alert-${feedback.type === "error" ? "danger" : "success"} alert-dismissible mb-3`}
          role="alert"
        >
          {feedback.msg}
          <button type="button" className="btn-close" onClick={() => setFeedback(null)}></button>
        </div>
      )}

      {/* RESUMEN DEL COCHE */}
      <div className="row mb-4">
        <div className="col-md-3">
          <div className="card">
            <div className="card-body text-center">
              <h6 className="card-title">Matrícula</h6>
              <p className="mb-0 fs-5">
                <strong>{inspeccion.matricula}</strong>
              </p>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card">
            <div className="card-body text-center">
              <h6 className="card-title">Cliente</h6>
              <p className="mb-0">
                <strong>{inspeccion.cliente_nombre}</strong>
              </p>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card">
            <div className="card-body text-center">
              <h6 className="card-title">Tipo</h6>
              <p className="mb-0">
                <strong>{esConcesionario ? "Profesional" : "Particular"}</strong>
              </p>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card">
            <div className="card-body text-center">
              <h6 className="card-title">Importe Total</h6>
              <p className="mb-0 fs-5">
                <strong>€ {importeTotal.toFixed(2)}</strong>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* INFORME TÉCNICO (READ-ONLY) */}
      <div className="card mb-4">
        <div className="card-header">
          <h6 className="mb-0">Informe de Intervención Técnica</h6>
        </div>
        <div className="card-body">
          <div className="mb-3">
            <label className="form-label">
              <strong>Trabajos Realizados</strong>
            </label>
            <div className="p-3 bg-light rounded border">
              <p className="mb-0" style={{ whiteSpace: "pre-wrap" }}>
                {inspeccion.trabajos_realizados || "No especificado"}
              </p>
            </div>
          </div>

          {inspeccion.entrega_observaciones && (
            <div>
              <label className="form-label">
                <strong>Observaciones Técnicas</strong>
              </label>
              <div className="p-3 bg-light rounded border">
                <p className="mb-0" style={{ whiteSpace: "pre-wrap" }}>
                  {inspeccion.entrega_observaciones}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* PARA PARTICULARES: FIRMA + COBRO */}
      {!esConcesionario && (
        <>
          {/* FIRMA */}
          <div className="card mb-4">
            <div className="card-header">
              <h6 className="mb-0">✍️ Firma del Cliente *</h6>
            </div>
            <div className="card-body">
              <SignaturePad onSave={setFirma} />
              {firma && (
                <p className="text-success mt-2">✓ Firma capturada</p>
              )}
            </div>
          </div>

          {/* REGISTRO DE COBRO */}
          <div className="card mb-4">
            <div className="card-header">
              <h6 className="mb-0">💳 Cobro (Opcional)</h6>
            </div>
            <div className="card-body">
              <div className="form-check mb-3">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="registrar_cobro"
                  name="registrar_cobro"
                  checked={cobroForm.registrar_cobro}
                  onChange={handleCobroChange}
                  disabled={saving}
                />
                <label className="form-check-label" htmlFor="registrar_cobro">
                  Registrar cobro en esta entrega
                </label>
              </div>

              {cobroForm.registrar_cobro && (
                <>
                  <div className="row mb-3">
                    <div className="col-md-6">
                      <label className="form-label">Importe a cobrar</label>
                      <div className="input-group">
                        <input
                          type="number"
                          className="form-control"
                          name="cobro_importe"
                          step="0.01"
                          min="0"
                          max={importeTotal}
                          value={cobroForm.cobro_importe}
                          onChange={handleCobroChange}
                          placeholder={`Máx: ${importeTotal.toFixed(2)}`}
                          disabled={saving}
                        />
                        <span className="input-group-text">€</span>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Método de pago</label>
                      <select
                        className="form-select"
                        name="cobro_metodo"
                        value={cobroForm.cobro_metodo}
                        onChange={handleCobroChange}
                        disabled={saving}
                      >
                        <option value="efectivo">Efectivo</option>
                        <option value="tarjeta">Tarjeta</option>
                        <option value="bizum">Bizum</option>
                        <option value="transferencia">Transferencia</option>
                      </select>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Referencia (Opcional)</label>
                    <input
                      type="text"
                      className="form-control"
                      name="cobro_referencia"
                      value={cobroForm.cobro_referencia}
                      onChange={handleCobroChange}
                      placeholder="Ej: Comprobante, número de operación..."
                      disabled={saving}
                    />
                  </div>

                  <div className="mb-0">
                    <label className="form-label">Observaciones (Opcional)</label>
                    <textarea
                      className="form-control"
                      name="cobro_observaciones"
                      rows="2"
                      value={cobroForm.cobro_observaciones}
                      onChange={handleCobroChange}
                      placeholder="Notas sobre el cobro..."
                      disabled={saving}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* PARA PROFESIONALES: SOLO BOTÓN */}
      {esConcesionario && (
        <div className="alert alert-info mb-4">
          <strong>Coche Profesional/Concesionario</strong>
          <p className="mb-0">
            No se requiere firma del cliente. El cobro se registrará posteriormente.
          </p>
        </div>
      )}

      {/* NAVEGACIÓN */}
      <div className="mt-4 pb-5">
        <div className="row">
          <div className="col-6">
            <button
              className="btn btn-outline-secondary w-100"
              onClick={() => navigate(`/vehiculo-detalle/${inspeccion_id}`)}
            >
              ← Atrás
            </button>
          </div>
          <div className="col-6">
            <button
              className="btn btn-success btn-lg w-100"
              onClick={registrarEntrega}
              disabled={saving || (!esConcesionario && !firma)}
            >
              {saving ? "Registrando..." : "✓ Registrar Entrega"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
