import React, { useCallback, useContext, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Context } from "../store/appContext";
import "../styles/inspeccion-responsive.css";

const safeDate = (value) => {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleString("es-ES");
};

export default function HojaTecnicaPage() {
  const { inspeccion_id } = useParams();
  const { actions } = useContext(Context);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [inspeccion, setInspeccion] = useState(null);
  const [form, setForm] = useState({
    trabajos_realizados: "",
    entrega_observaciones: "",
  });
  const [usando_ia, setUsandoIa] = useState(false);

  // LOAD
  const cargar = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const insp = await actions.getInspeccion(inspeccion_id);
      setInspeccion(insp);

      setForm({
        trabajos_realizados: insp?.trabajos_realizados || "",
        entrega_observaciones: insp?.entrega_observaciones || "",
      });
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

  // GUARDAR ACTA
  const guardarActa = async () => {
    if (!form.trabajos_realizados.trim()) {
      setFeedback({
        type: "error",
        msg: "Debes describir los trabajos realizados",
      });
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL || "http://localhost:5001/api"}/inspeccion-recepcion/${inspeccion_id}/acta`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionStorage.getItem("token") || localStorage.getItem("token")}`,
          },
          body: JSON.stringify(form),
        }
      );

      if (!response.ok) throw new Error("Error al guardar acta");

      setFeedback({
        type: "success",
        msg: "Acta técnica guardada. Procede a entregar.",
      });

      setTimeout(() => {
        navigate(`/entrega-cliente/${inspeccion_id}`);
      }, 800);
    } catch (err) {
      console.error("Error guardar acta", err);
      setFeedback({
        type: "error",
        msg: "Error al guardar: " + err.message,
      });
    } finally {
      setSaving(false);
    }
  };

  // GENERAR CON IA (PLACEHOLDER - necesita implementación en backend)
  const generarConIA = async () => {
    setUsandoIa(true);
    setFeedback(null);
    try {
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL || "http://localhost:5001/api"}/inspeccion-recepcion/${inspeccion_id}/sugerir-acta`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionStorage.getItem("token") || localStorage.getItem("token")}`,
          },
          body: JSON.stringify({
            borrador: form.trabajos_realizados,
            averias_notas: inspeccion?.averias_notas || "",
          }),
        }
      );

      if (!response.ok) throw new Error("Error al generar con IA");

      const data = await response.json();
      setForm((prev) => ({
        ...prev,
        trabajos_realizados: data.acta || prev.trabajos_realizados,
      }));

      setFeedback({
        type: "success",
        msg: "Borrador generado con IA",
      });
    } catch (err) {
      console.error("Error IA", err);
      setFeedback({
        type: "error",
        msg: "Error al generar con IA: " + err.message,
      });
    } finally {
      setUsandoIa(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
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
          <h2 className="d-inline">Informe de Intervención Técnica</h2>
        </div>
      </div>

      {/* INFO COCHE */}
      <div className="row mb-4">
        <div className="col-md-4">
          <div className="card">
            <div className="card-body">
              <h6 className="card-title">Cliente</h6>
              <p className="mb-0">
                <strong>{inspeccion.cliente_nombre}</strong>
              </p>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card">
            <div className="card-body">
              <h6 className="card-title">Coche</h6>
              <p className="mb-0">
                <strong>{inspeccion.matricula}</strong>
              </p>
              <p className="text-muted small mb-0">{inspeccion.coche_descripcion}</p>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card">
            <div className="card-body">
              <h6 className="card-title">Recepción</h6>
              <p className="text-muted small mb-0">{safeDate(inspeccion.fecha_inspeccion)}</p>
            </div>
          </div>
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

      {/* FORMULARIO */}
      <div className="card">
        <div className="card-header">
          <h6 className="mb-0">Informe de Intervención Técnica</h6>
        </div>
        <div className="card-body">
          {/* TRABAJOS REALIZADOS */}
          <div className="mb-4">
            <label className="form-label">
              <strong>Trabajos Realizados *</strong>
            </label>
            <div className="d-flex gap-2 mb-2">
              <textarea
                className="form-control"
                name="trabajos_realizados"
                rows="5"
                placeholder="Describe detalladamente los trabajos realizados al vehículo..."
                value={form.trabajos_realizados}
                onChange={handleChange}
                disabled={saving}
              />
            </div>
            <button
              className="btn btn-sm btn-outline-info"
              onClick={generarConIA}
              disabled={saving || usando_ia}
            >
              {usando_ia ? "Generando..." : "✨ Generar con IA"}
            </button>
          </div>

          <hr />

          {/* OBSERVACIONES */}
          <div className="mb-4">
            <label className="form-label">
              <strong>Observaciones Técnicas (Opcional)</strong>
            </label>
            <textarea
              className="form-control"
              name="entrega_observaciones"
              rows="3"
              placeholder="Cualquier observación adicional para el cliente..."
              value={form.entrega_observaciones}
              onChange={handleChange}
              disabled={saving}
            />
          </div>

          {/* SERVICIOS APLICADOS (READ-ONLY) */}
          {inspeccion.servicios_aplicados && (
            <>
              <hr />
              <div>
                <label className="form-label">
                  <strong>Servicios del Catálogo</strong>
                </label>
                <ul className="list-group">
                  {(() => {
                    try {
                      const servicios = JSON.parse(inspeccion.servicios_aplicados || "[]");
                      return servicios.map((s, i) => (
                        <li key={i} className="list-group-item">
                          <strong>{s.nombre}</strong>
                          {s.tipo_tarea && (
                            <span className="badge bg-secondary ms-2">{s.tipo_tarea}</span>
                          )}
                          {s.precio > 0 && (
                            <span className="text-muted ms-2">€ {s.precio.toFixed(2)}</span>
                          )}
                        </li>
                      ));
                    } catch {
                      return <li className="list-group-item text-muted">No hay servicios</li>;
                    }
                  })()}
                </ul>
              </div>
            </>
          )}
        </div>
      </div>

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
              className="btn btn-primary w-100"
              onClick={guardarActa}
              disabled={saving}
            >
              {saving ? "Guardando..." : "Guardar y Entregar →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
