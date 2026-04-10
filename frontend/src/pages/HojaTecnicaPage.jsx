import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Context } from "../store/appContext";
import "../styles/inspeccion-responsive.css";

const safeDate = (value) => {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleString("es-ES");
};

const EMPTY_FORM = {
  motivo_intervencion: "",
  diagnostico_inicial: "",
  trabajos_realizados: "",
  productos_aplicados: "",
  resultado_final: "",
  recomendaciones: "",
  entrega_observaciones: "",
};

const SECTION_LABELS = {
  motivo_intervencion: "Servicio solicitado / objetivo",
  diagnostico_inicial: "Estado inicial / diagnóstico",
  trabajos_realizados: "Trabajos realizados",
  productos_aplicados: "Productos y materiales utilizados",
  resultado_final: "Resultado y comprobaciones finales",
  recomendaciones: "Recomendaciones para el cliente",
};

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseServicios = (value) => {
  try {
    const data = JSON.parse(value || "[]");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

const composeActaTexto = (form) => {
  const bloques = [
    [SECTION_LABELS.motivo_intervencion, form.motivo_intervencion],
    [SECTION_LABELS.diagnostico_inicial, form.diagnostico_inicial],
    [SECTION_LABELS.trabajos_realizados, form.trabajos_realizados],
    [SECTION_LABELS.productos_aplicados, form.productos_aplicados],
    [SECTION_LABELS.resultado_final, form.resultado_final],
    [SECTION_LABELS.recomendaciones, form.recomendaciones],
  ].filter(([, contenido]) => String(contenido || "").trim());

  return bloques
    .map(([titulo, contenido]) => `${titulo}:\n${String(contenido || "").trim()}`)
    .join("\n\n")
    .trim();
};

const parseActaTexto = (texto = "") => {
  const raw = String(texto || "").trim();
  const result = { ...EMPTY_FORM };
  if (!raw) return result;

  const labels = Object.values(SECTION_LABELS);
  let found = false;

  Object.entries(SECTION_LABELS).forEach(([key, label]) => {
    const otherLabels = labels.filter((item) => item !== label).map(escapeRegex).join("|");
    const regex = new RegExp(
      `${escapeRegex(label)}\\s*:\\s*\\n?([\\s\\S]*?)(?=\\n(?:${otherLabels})\\s*:|$)`,
      "i"
    );
    const match = raw.match(regex);
    if (match) {
      result[key] = match[1].trim();
      found = true;
    }
  });

  if (!found) {
    result.trabajos_realizados = raw;
  }

  return result;
};

const hydrateForm = (insp) => {
  const structured = parseActaTexto(insp?.trabajos_realizados || "");
  const servicios = parseServicios(insp?.servicios_aplicados || "[]");

  if (!structured.motivo_intervencion && servicios.length) {
    structured.motivo_intervencion = servicios.map((item) => item?.nombre).filter(Boolean).join(", ");
  }

  if (!structured.diagnostico_inicial && insp?.averias_notas) {
    structured.diagnostico_inicial = String(insp.averias_notas || "").trim();
  }

  return {
    ...EMPTY_FORM,
    ...structured,
    entrega_observaciones: insp?.entrega_observaciones || "",
  };
};

const FIELD_LAYOUT = [
  {
    key: "motivo_intervencion",
    label: "Servicio solicitado / objetivo",
    rows: 2,
    col: "col-12 col-lg-6",
    placeholder: "Ej.: corrección de pintura, limpieza integral, restauración interior...",
  },
  {
    key: "diagnostico_inicial",
    label: "Estado inicial / diagnóstico",
    rows: 3,
    col: "col-12 col-lg-6",
    placeholder: "Describe el estado del vehículo al recibirlo o los defectos detectados.",
  },
  {
    key: "trabajos_realizados",
    label: "Trabajos realizados *",
    rows: 5,
    col: "col-12",
    placeholder: "Detalla paso a paso el trabajo realizado en el vehículo.",
  },
  {
    key: "productos_aplicados",
    label: "Productos y materiales utilizados",
    rows: 3,
    col: "col-12 col-lg-6",
    placeholder: "Ej.: pulimento, sellante, limpiador textil, protector cerámico...",
  },
  {
    key: "resultado_final",
    label: "Resultado y comprobaciones finales",
    rows: 3,
    col: "col-12 col-lg-6",
    placeholder: "Indica cómo queda el vehículo tras la intervención y qué se comprobó.",
  },
  {
    key: "recomendaciones",
    label: "Recomendaciones para el cliente",
    rows: 3,
    col: "col-12",
    placeholder: "Cuidados posteriores, plazos recomendados, mantenimiento o advertencias.",
  },
];

export default function HojaTecnicaPage() {
  const { inspeccion_id } = useParams();
  const { actions } = useContext(Context);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [inspeccion, setInspeccion] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [usando_ia, setUsandoIa] = useState(false);

  const servicios = useMemo(
    () => parseServicios(inspeccion?.servicios_aplicados || "[]"),
    [inspeccion?.servicios_aplicados]
  );

  const cargar = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const insp = await actions.getInspeccion(inspeccion_id);
      setInspeccion(insp);
      setForm(hydrateForm(insp));
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const guardarActa = async (abrirFirma = false) => {
    const contenidoActa = composeActaTexto(form);
    if (!contenidoActa.trim()) {
      setFeedback({
        type: "error",
        msg: "Debes completar al menos los trabajos realizados de la hoja técnica.",
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
          body: JSON.stringify({
            trabajos_realizados: contenidoActa,
            entrega_observaciones: form.entrega_observaciones,
          }),
        }
      );

      if (!response.ok) throw new Error("Error al guardar acta");

      setFeedback({
        type: "success",
        msg: abrirFirma
          ? "Hoja técnica guardada. Abriendo la firma de entrega..."
          : "Hoja técnica guardada. Puedes dejarla preparada y volver cuando quieras.",
      });

      if (abrirFirma) {
        setTimeout(() => {
          navigate(`/acta-entrega/${inspeccion_id}`);
        }, 600);
      } else {
        await cargar();
      }
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

  const generarConIA = async () => {
    setUsandoIa(true);
    setFeedback(null);
    try {
      const borradorActual = composeActaTexto(form) || form.trabajos_realizados;
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL || "http://localhost:5001/api"}/inspeccion-recepcion/${inspeccion_id}/sugerir-acta`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionStorage.getItem("token") || localStorage.getItem("token")}`,
          },
          body: JSON.stringify({
            borrador: borradorActual,
            averias_notas: inspeccion?.averias_notas || "",
          }),
        }
      );

      if (!response.ok) throw new Error("Error al generar con IA");

      const data = await response.json();
      setForm((prev) => ({
        ...prev,
        ...parseActaTexto(data.acta || borradorActual),
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
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div>
          <button
            className="btn btn-sm btn-outline-secondary me-2"
            onClick={() => navigate(`/vehiculo-detalle/${inspeccion_id}`)}
          >
            ← Atrás
          </button>
          <h2 className="d-inline">Informe de Intervención Técnica</h2>
          <div className="text-muted small mt-2">
            Completa la hoja, guárdala y, cuando quieras, pasa a firma y entrega.
          </div>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-12 col-md-6 col-xl-3">
          <div className="card h-100">
            <div className="card-body">
              <h6 className="card-title mb-1">Cliente</h6>
              <strong>{inspeccion.cliente_nombre || "-"}</strong>
              <div className="text-muted small">{inspeccion.cliente_telefono || "Sin teléfono"}</div>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-6 col-xl-3">
          <div className="card h-100">
            <div className="card-body">
              <h6 className="card-title mb-1">Vehículo</h6>
              <strong>{inspeccion.matricula || "-"}</strong>
              <div className="text-muted small">{inspeccion.coche_descripcion || "-"}</div>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-6 col-xl-3">
          <div className="card h-100">
            <div className="card-body">
              <h6 className="card-title mb-1">Recepción</h6>
              <div className="text-muted small">{safeDate(inspeccion.fecha_inspeccion)}</div>
              <div className="text-muted small">{inspeccion.kilometros || "-"} km</div>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-6 col-xl-3">
          <div className="card h-100 border-warning-subtle">
            <div className="card-body">
              <h6 className="card-title mb-1">Observaciones de entrada</h6>
              <div className="text-muted small" style={{ whiteSpace: "pre-wrap" }}>
                {inspeccion.averias_notas || "Sin observaciones registradas en recepción."}
              </div>
            </div>
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className={`alert alert-${feedback.type === "error" ? "danger" : "success"} alert-dismissible mb-3`}
          role="alert"
        >
          {feedback.msg}
          <button type="button" className="btn-close" onClick={() => setFeedback(null)}></button>
        </div>
      )}

      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center flex-wrap gap-2">
          <h6 className="mb-0">Informe de Intervención Técnica</h6>
          <span className="badge text-bg-light">Puedes guardarla sin entregar</span>
        </div>
        <div className="card-body">
          <div className="alert alert-light border mb-4">
            <strong>Hoja clásica de preparación:</strong> primero rellena los trabajos y observaciones, y después, si quieres, completa los campos adicionales.
          </div>

          <div className="mb-4">
            <label className="form-label">
              <strong>Trabajos Realizados *</strong>
            </label>
            <textarea
              className="form-control"
              name="trabajos_realizados"
              rows="5"
              placeholder="Describe detalladamente los trabajos realizados al vehículo..."
              value={form.trabajos_realizados}
              onChange={handleChange}
              disabled={saving}
            />
            <div className="d-flex gap-2 mt-2 flex-wrap">
              <button
                className="btn btn-sm btn-outline-info"
                onClick={generarConIA}
                disabled={saving || usando_ia}
              >
                {usando_ia ? "Generando..." : "✨ Generar con IA"}
              </button>
              <button
                className="btn btn-sm btn-outline-primary"
                onClick={() => navigate(`/acta-entrega/${inspeccion_id}`)}
                disabled={saving}
              >
                📝 Ver firma / entrega
              </button>
            </div>
          </div>

          <hr />

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

          <hr />

          <div className="mb-3">
            <label className="form-label fw-semibold">Campos adicionales de la intervención</label>
            <div className="text-muted small mb-2">
              Estos apartados ayudan a dejar el informe más completo, como en la versión antigua.
            </div>
          </div>

          <div className="row g-3">
            {FIELD_LAYOUT.filter((field) => field.key !== "trabajos_realizados").map((field) => (
              <div className={field.col} key={field.key}>
                <label className="form-label fw-semibold">{field.label}</label>
                <textarea
                  className="form-control"
                  name={field.key}
                  rows={field.rows}
                  placeholder={field.placeholder}
                  value={form[field.key]}
                  onChange={handleChange}
                  disabled={saving}
                />
              </div>
            ))}
          </div>

          {servicios.length > 0 && (
            <>
              <hr />
              <div>
                <label className="form-label">
                  <strong>Servicios del Catálogo</strong>
                </label>
                <ul className="list-group">
                  {servicios.map((s, i) => (
                    <li key={`${s?.nombre || "servicio"}-${i}`} className="list-group-item d-flex justify-content-between flex-wrap gap-2">
                      <span>
                        <strong>{s?.nombre || "Servicio"}</strong>
                        {s?.tipo_tarea && <span className="badge bg-secondary ms-2">{s.tipo_tarea}</span>}
                      </span>
                      {Number(s?.precio) > 0 && (
                        <span className="text-muted">€ {Number(s.precio).toFixed(2)}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mt-4 pb-5">
        <div className="row g-2">
          <div className="col-12 col-md-4">
            <button
              className="btn btn-outline-secondary w-100"
              onClick={() => navigate(`/vehiculo-detalle/${inspeccion_id}`)}
            >
              ← Atrás
            </button>
          </div>
          <div className="col-12 col-md-4">
            <button
              className="btn btn-primary w-100"
              onClick={() => guardarActa(false)}
              disabled={saving}
            >
              {saving ? "Guardando..." : "💾 Guardar hoja técnica"}
            </button>
          </div>
          <div className="col-12 col-md-4">
            <button
              className="btn btn-success w-100"
              onClick={() => guardarActa(true)}
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
