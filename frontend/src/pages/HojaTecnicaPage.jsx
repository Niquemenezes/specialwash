import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Context } from "../store/appContext";
import { buildApiUrl } from "../utils/apiBase";
import "../styles/inspeccion-responsive.css";

const safeDate = (value) => {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleString("es-ES");
};

const EMPTY_FORM = {
  diagnostico_inicial: "",
  motivo_intervencion: "",
  trabajos_realizados: "",
  productos_aplicados: "",
  resultado_final: "",
  observaciones_tecnicas_adicionales: "",
  recomendaciones: "",
};

// Labels que usa el parser de texto estructurado (compatibilidad con actas antiguas)
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
  if (Array.isArray(value)) return value;
  try {
    const data = JSON.parse(value || "[]");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

const hasStructuredActaSections = (texto = "") => {
  const raw = String(texto || "").trim();
  if (!raw) return false;
  return Object.values(SECTION_LABELS).some((label) =>
    new RegExp(`(^|\\n)${escapeRegex(label)}\\s*:`, "i").test(raw)
  );
};

const formatTipoLabel = (tipo) => {
  const value = String(tipo || "").trim().toLowerCase();
  if (value === "detailing") return "Detailing";
  if (value === "pintura") return "Pintura";
  if (value === "tapicero") return "Tapiceria";
  if (value === "calidad") return "Calidad";
  if (value === "otro") return "General";
  return "";
};

const buildServiciosContratadosTexto = (servicios = []) =>
  servicios
    .map((item) => {
      const nombre = String(item?.nombre || "").trim();
      const tipo = formatTipoLabel(item?.tipo_tarea);
      if (!nombre) return null;
      return tipo ? `- ${nombre} · Area: ${tipo}` : `- ${nombre}`;
    })
    .filter(Boolean)
    .join("\n");

const buildMotivoIntervencionTexto = (servicios = []) => {
  const nombres = servicios
    .map((item) => String(item?.nombre || "").trim())
    .filter(Boolean);

  if (!nombres.length) return "";
  if (nombres.length === 1) {
    return `Se emite la presente hoja de intervencion tecnica con el fin de documentar la actuacion prevista sobre el vehiculo, correspondiente al servicio contratado: ${nombres[0]}.`;
  }
  return `Se emite la presente hoja de intervencion tecnica con el fin de documentar la actuacion prevista sobre el vehiculo, correspondiente a los siguientes servicios contratados: ${nombres.join(", ")}.`;
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
  const rawActa = String(insp?.trabajos_realizados || "").trim();
  const structured = hasStructuredActaSections(rawActa)
    ? parseActaTexto(rawActa)
    : { ...EMPTY_FORM };
  const servicios = parseServicios(insp?.servicios_aplicados || "[]");
  const serviciosContratados = buildServiciosContratadosTexto(servicios);

  // Auto-rellenar motivo desde servicios contratados si está vacío
  if (!structured.motivo_intervencion && servicios.length) {
    structured.motivo_intervencion = buildMotivoIntervencionTexto(servicios);
  }

  // Auto-rellenar diagnóstico inicial desde observaciones de recepción si está vacío
  if (!structured.diagnostico_inicial && insp?.averias_notas) {
    structured.diagnostico_inicial = String(insp.averias_notas || "").trim();
  }

  // Para la hoja técnica base, solo proponemos los servicios contratados.
  // Si ya existe una hoja técnica estructurada guardada, la respetamos.
  if (!structured.trabajos_realizados && serviciosContratados) {
    structured.trabajos_realizados =
      `Conforme a la orden de trabajo registrada y a la contratacion validada, el alcance tecnico de la intervencion prevista para este vehiculo comprende los siguientes conceptos de actuacion:\n\n${serviciosContratados}`;
  }

  return {
    ...EMPTY_FORM,
    ...structured,
    observaciones_tecnicas_adicionales: insp?.observaciones_tecnicas_adicionales || "",
  };
};

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
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const guardarActa = async (abrirFirma = false) => {
    const contenidoActa = composeActaTexto(form);
    if (!contenidoActa.trim()) {
      setFeedback({
        type: "error",
        msg: "Debes completar al menos los trabajos realizados.",
      });
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      const response = await fetch(
        buildApiUrl(`/api/inspeccion-recepcion/${inspeccion_id}/acta`),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionStorage.getItem("token") || localStorage.getItem("token")}`,
          },
          body: JSON.stringify({
            trabajos_realizados: contenidoActa,
            entrega_observaciones: "",
            observaciones_tecnicas_adicionales: form.observaciones_tecnicas_adicionales || "",
          }),
        }
      );

      if (!response.ok) throw new Error("Error al guardar hoja técnica");

      setFeedback({
        type: "success",
        msg: abrirFirma
          ? "Hoja técnica guardada. Abriendo la firma de entrega..."
          : "Hoja técnica guardada correctamente.",
      });

      if (abrirFirma) {
        setTimeout(() => navigate(`/acta-entrega/${inspeccion_id}`), 600);
      } else {
        await cargar();
      }
    } catch (err) {
      console.error("Error guardar acta", err);
      setFeedback({ type: "error", msg: "Error al guardar: " + err.message });
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
        buildApiUrl(`/api/inspeccion-recepcion/${inspeccion_id}/sugerir-acta`),
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

      if (!response.ok) {
        let errMsg = `HTTP ${response.status}`;
        try { const d = await response.json(); errMsg += ": " + (d.msg || JSON.stringify(d)); } catch {}
        throw new Error(errMsg);
      }

      const data = await response.json();
      const parsed = parseActaTexto(data.acta || borradorActual);
      setForm((prev) => ({
        ...prev,
        ...parsed,
        // Preservar el campo técnico adicional (la IA no lo gestiona)
        observaciones_tecnicas_adicionales: prev.observaciones_tecnicas_adicionales,
      }));

      setFeedback({ type: "success", msg: "Borrador generado con IA. Revisa y ajusta antes de guardar." });
    } catch (err) {
      console.error("Error IA", err);
      setFeedback({ type: "error", msg: "Error al generar con IA: " + err.message });
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
    <div className="container-fluid mt-4 pb-5">

      {/* Cabecera */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div>
          <button
            className="btn btn-sm btn-outline-secondary me-2"
            onClick={() => navigate(`/vehiculo-detalle/${inspeccion_id}`)}
          >
            ← Atrás
          </button>
          <span className="fw-bold fs-5">Hoja de Intervención Técnica</span>
        </div>
        <button
          className="btn btn-sm btn-outline-primary"
          onClick={() => navigate(`/acta-entrega/${inspeccion_id}`)}
        >
          📝 Ir a firma / entrega
        </button>
      </div>

      {/* Tarjetas de datos del vehículo */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card h-100">
            <div className="card-body">
              <div className="text-muted small mb-1">Cliente</div>
              <strong>{inspeccion.cliente_nombre || "-"}</strong>
              <div className="text-muted small">{inspeccion.cliente_telefono || "Sin teléfono"}</div>
            </div>
          </div>
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card h-100">
            <div className="card-body">
              <div className="text-muted small mb-1">Vehículo</div>
              <strong>{inspeccion.matricula || "-"}</strong>
              <div className="text-muted small">{inspeccion.coche_descripcion || "-"}</div>
            </div>
          </div>
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card h-100">
            <div className="card-body">
              <div className="text-muted small mb-1">Recepción</div>
              <div className="small">{safeDate(inspeccion.fecha_inspeccion)}</div>
              <div className="text-muted small">{inspeccion.kilometros || "-"} km</div>
            </div>
          </div>
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card h-100 border-warning-subtle">
            <div className="card-body">
              <div className="text-muted small mb-1">Observaciones de recepción</div>
              <div className="small" style={{ whiteSpace: "pre-wrap" }}>
                {inspeccion.averias_notas || "Sin observaciones en recepción."}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Servicios contratados */}
      {servicios.length > 0 && (
        <div className="card mb-4 border-primary-subtle">
          <div className="card-header bg-primary-subtle py-2">
            <strong className="small">Servicios contratados por el cliente</strong>
            <span className="text-muted small ms-2">(referencia para la hoja técnica)</span>
          </div>
          <div className="card-body py-2">
            <div className="d-flex flex-wrap gap-2">
              {servicios.map((s, i) => (
                <span
                  key={`${s?.nombre || "s"}-${i}`}
                  className="badge text-bg-light border fw-normal fs-6 px-3 py-2"
                >
                  {s?.nombre || "Servicio"}
                  {s?.tipo_tarea && (
                    <span className="text-muted ms-1">· {s.tipo_tarea}</span>
                  )}
                  {Number(s?.precio) > 0 && (
                    <span className="text-muted ms-1">· {Number(s.precio).toFixed(2)} €</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {feedback && (
        <div
          className={`alert alert-${feedback.type === "error" ? "danger" : "success"} alert-dismissible mb-3`}
          role="alert"
        >
          {feedback.msg}
          <button type="button" className="btn-close" onClick={() => setFeedback(null)} />
        </div>
      )}

      {/* Formulario principal */}
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center flex-wrap gap-2">
          <strong>Informe de intervención</strong>
          <button
            className="btn btn-sm btn-outline-info"
            onClick={generarConIA}
            disabled={saving || usando_ia}
          >
            {usando_ia ? (
              <><span className="spinner-border spinner-border-sm me-1" />Generando...</>
            ) : (
              "✨ Completar con IA"
            )}
          </button>
        </div>

        <div className="card-body">

          {/* SECCIÓN 1: Estado inicial / diagnóstico */}
          <div className="mb-4">
            <label className="form-label fw-semibold">
              Estado inicial del vehículo
              <span className="text-muted fw-normal ms-2 small">
                — se ha rellenado automáticamente con las observaciones de recepción
              </span>
            </label>
            <textarea
              className="form-control"
              name="diagnostico_inicial"
              rows={3}
              placeholder="Estado del vehículo al recibirlo, defectos detectados en recepción..."
              value={form.diagnostico_inicial}
              onChange={handleChange}
              disabled={saving}
            />
          </div>

          {/* SECCIÓN 2: Servicio solicitado */}
          <div className="mb-4">
            <label className="form-label fw-semibold">
              Servicio solicitado / objetivo
              <span className="text-muted fw-normal ms-2 small">
                — se ha rellenado desde los servicios contratados
              </span>
            </label>
            <textarea
              className="form-control"
              name="motivo_intervencion"
              rows={2}
              placeholder="Servicio pactado con el cliente, objetivo de la intervención..."
              value={form.motivo_intervencion}
              onChange={handleChange}
              disabled={saving}
            />
          </div>

          <hr />

          {/* SECCIÓN 3: Trabajos realizados — campo principal */}
          <div className="mb-4">
            <label className="form-label fw-semibold">
              Trabajos realizados <span className="text-danger">*</span>
            </label>
            <textarea
              className="form-control"
              name="trabajos_realizados"
              rows={5}
              placeholder="Detalla paso a paso el trabajo realizado en el vehículo. Este campo es obligatorio."
              value={form.trabajos_realizados}
              onChange={handleChange}
              disabled={saving}
            />
          </div>

          <div className="row g-3 mb-4">
            <div className="col-12 col-lg-6">
              <label className="form-label fw-semibold">Productos y materiales utilizados</label>
              <textarea
                className="form-control"
                name="productos_aplicados"
                rows={3}
                placeholder="Pulimento, sellante, limpiador textil, protector cerámico..."
                value={form.productos_aplicados}
                onChange={handleChange}
                disabled={saving}
              />
            </div>
            <div className="col-12 col-lg-6">
              <label className="form-label fw-semibold">Resultado y comprobaciones finales</label>
              <textarea
                className="form-control"
                name="resultado_final"
                rows={3}
                placeholder="Cómo queda el vehículo tras la intervención, qué se comprobó..."
                value={form.resultado_final}
                onChange={handleChange}
                disabled={saving}
              />
            </div>
          </div>

          <hr />

          {/* SECCIÓN 4: Observaciones técnicas adicionales (no contratadas) */}
          <div className="mb-4">
            <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
              <label className="form-label fw-semibold mb-0">
                Observaciones técnicas adicionales
              </label>
              <span className="badge text-bg-warning text-dark small fw-normal">
                No contratadas por el cliente
              </span>
            </div>
            <div className="text-muted small mb-2">
              Aquí anota todo lo que hayas visto en el vehículo pero el cliente <strong>no ha contratado</strong>.
              El cliente quedará informado y podrá considerarlo para una próxima visita.
            </div>
            <textarea
              className="form-control"
              name="observaciones_tecnicas_adicionales"
              rows={3}
              placeholder="Ej: Se observa desgaste en los faros delanteros. Se detectan marcas en el espejo derecho. Pintura oxidada en el umbral trasero izquierdo..."
              value={form.observaciones_tecnicas_adicionales}
              onChange={handleChange}
              disabled={saving}
            />
          </div>

          {/* SECCIÓN 5: Recomendaciones para el cliente */}
          <div className="mb-2">
            <label className="form-label fw-semibold">Recomendaciones para el cliente</label>
            <div className="text-muted small mb-2">
              Cuidados posteriores, plazos recomendados, mantenimiento preventivo o advertencias.
            </div>
            <textarea
              className="form-control"
              name="recomendaciones"
              rows={3}
              placeholder="Ej: No lavar con agua a presión en las próximas 48h. Aplicar sellante cada 6 meses..."
              value={form.recomendaciones}
              onChange={handleChange}
              disabled={saving}
            />
          </div>

        </div>
      </div>

      {/* Botones de acción */}
      <div className="mt-4 pb-4">
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
              {saving ? "Guardando..." : "Guardar y pasar a entrega →"}
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
