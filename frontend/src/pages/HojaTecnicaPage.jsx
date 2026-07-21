import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Context } from "../store/appContext";
import { buildApiUrl } from "../utils/apiBase";
import "../styles/inspeccion-responsive.css";

const TECH_SCHEMA = "swstudio_tecnica_v1";

const EMPTY_MEDICIONES_TECNICAS = {
  barniz: [],
  brillo: [],
  microscopia: [],
};

const createMedicionBase = (unidad = "") => ({
  zona: "",
  localizacion: "",
  lecturas: [],
  unidad,
  incluir_en_informe: true,
});

const createMicroscopiaBase = () => ({
  zona: "",
  localizacion: "",
  nota: "",
  media_refs: [],
  incluir_en_informe: true,
});

const PARTES_COCHE_SUGERIDAS = [
  "Paragolpes delantero izquierdo",
  "Paragolpes delantero derecho",
  "Paragolpes trasero izquierdo",
  "Paragolpes trasero derecho",
  "Capó",
  "Techo",
  "Portón trasero",
  "Aleta delantera izquierda",
  "Aleta delantera derecha",
  "Aleta trasera izquierda",
  "Aleta trasera derecha",
  "Puerta delantera izquierda",
  "Puerta delantera derecha",
  "Puerta trasera izquierda",
  "Puerta trasera derecha",
  "Retrovisor izquierdo",
  "Retrovisor derecho",
  "Pilar A izquierdo",
  "Pilar A derecho",
  "Pilar B izquierdo",
  "Pilar B derecho",
  "Pilar C izquierdo",
  "Pilar C derecho",
  "Talonera izquierda",
  "Talonera derecha",
];

const MAPA_PARTES_COCHE = [
  { label: "Paragolpes delantero izquierdo", x: 22, y: 16 },
  { label: "Paragolpes delantero derecho", x: 78, y: 16 },
  { label: "Capó", x: 50, y: 22 },
  { label: "Aleta delantera izquierda", x: 24, y: 28 },
  { label: "Aleta delantera derecha", x: 76, y: 28 },
  { label: "Retrovisor izquierdo", x: 16, y: 39 },
  { label: "Retrovisor derecho", x: 84, y: 39 },
  { label: "Puerta delantera izquierda", x: 28, y: 43 },
  { label: "Puerta delantera derecha", x: 72, y: 43 },
  { label: "Puerta trasera izquierda", x: 30, y: 57 },
  { label: "Puerta trasera derecha", x: 70, y: 57 },
  { label: "Talonera izquierda", x: 24, y: 66 },
  { label: "Talonera derecha", x: 76, y: 66 },
  { label: "Aleta trasera izquierda", x: 24, y: 74 },
  { label: "Aleta trasera derecha", x: 76, y: 74 },
  { label: "Portón trasero", x: 50, y: 82 },
  { label: "Paragolpes trasero izquierdo", x: 22, y: 88 },
  { label: "Paragolpes trasero derecho", x: 78, y: 88 },
  { label: "Techo", x: 50, y: 50 },
];

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
  mediciones_tecnicas_recepcion: { ...EMPTY_MEDICIONES_TECNICAS },
  mediciones_tecnicas: { ...EMPTY_MEDICIONES_TECNICAS },
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

const safeNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const parseLecturasText = (value) => {
  const parts = String(value || "")
    .split(/(?:[\n,;]+|\.(?=\s|$))/)
    .map((item) => item.trim().replace(",", "."))
    .filter(Boolean);
  return parts
    .map((item) => safeNumber(item))
    .filter((item) => item !== null);
};

const lecturasToText = (lecturas = []) => {
  if (!Array.isArray(lecturas) || lecturas.length === 0) return "";
  return lecturas.join(", ");
};

const calcMedia = (lecturas = []) => {
  const nums = Array.isArray(lecturas)
    ? lecturas.map((v) => safeNumber(v)).filter((v) => v !== null)
    : [];
  if (nums.length === 0) return null;
  const sum = nums.reduce((acc, val) => acc + val, 0);
  return sum / nums.length;
};

const normalizeMedicionesTecnicas = (input) => {
  const source = input && typeof input === "object" ? input : {};

  const barniz = Array.isArray(source.barniz)
    ? source.barniz.map((item) => ({
      ...createMedicionBase("um"),
      ...item,
      lecturas: Array.isArray(item?.lecturas)
        ? item.lecturas.map((v) => safeNumber(v)).filter((v) => v !== null)
        : [],
      incluir_en_informe: item?.incluir_en_informe !== false,
    }))
    : [];

  const brillo = Array.isArray(source.brillo)
    ? source.brillo.map((item) => ({
      ...createMedicionBase("GU"),
      ...item,
      lecturas: Array.isArray(item?.lecturas)
        ? item.lecturas.map((v) => safeNumber(v)).filter((v) => v !== null)
        : [],
      incluir_en_informe: item?.incluir_en_informe !== false,
    }))
    : [];

  const microscopia = Array.isArray(source.microscopia)
    ? source.microscopia.map((item) => ({
      ...createMicroscopiaBase(),
      ...item,
      media_refs: Array.isArray(item?.media_refs)
        ? item.media_refs.map((v) => String(v || "")).filter(Boolean)
        : [],
      incluir_en_informe: item?.incluir_en_informe !== false,
    }))
    : [];

  return { barniz, brillo, microscopia };
};

const parseObservacionesTecnicas = (rawValue) => {
  const raw = String(rawValue || "").trim();
  if (!raw) {
    return {
      textoLibre: "",
      medicionesRecepcion: { ...EMPTY_MEDICIONES_TECNICAS },
      medicionesEntrega: { ...EMPTY_MEDICIONES_TECNICAS },
    };
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.schema === TECH_SCHEMA) {
      const root = parsed.mediciones_tecnicas || {};
      const hasStages = root && typeof root === "object" && (root.recepcion || root.entrega);
      return {
        textoLibre: String(parsed.texto_libre || ""),
        medicionesRecepcion: hasStages
          ? normalizeMedicionesTecnicas(root.recepcion || {})
          : { ...EMPTY_MEDICIONES_TECNICAS },
        medicionesEntrega: hasStages
          ? normalizeMedicionesTecnicas(root.entrega || {})
          : normalizeMedicionesTecnicas(root),
      };
    }
  } catch {
    // Compatibilidad con registros históricos en texto plano.
  }

  return {
    textoLibre: raw,
    medicionesRecepcion: { ...EMPTY_MEDICIONES_TECNICAS },
    medicionesEntrega: { ...EMPTY_MEDICIONES_TECNICAS },
  };
};

const hasMedicionesData = (mediciones) => {
  const m = normalizeMedicionesTecnicas(mediciones);
  return m.barniz.length > 0 || m.brillo.length > 0 || m.microscopia.length > 0;
};

const serializeObservacionesTecnicas = (textoLibre, medicionesRecepcion, medicionesEntrega) => {
  const text = String(textoLibre || "").trim();
  const normalizedRecepcion = normalizeMedicionesTecnicas(medicionesRecepcion);
  const normalizedEntrega = normalizeMedicionesTecnicas(medicionesEntrega);
  if (!text && !hasMedicionesData(normalizedRecepcion) && !hasMedicionesData(normalizedEntrega)) return "";

  const payload = {
    schema: TECH_SCHEMA,
    texto_libre: text,
    mediciones_tecnicas: {
      recepcion: normalizedRecepcion,
      entrega: normalizedEntrega,
    },
  };
  return JSON.stringify(payload);
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
  const tecnicas = parseObservacionesTecnicas(insp?.observaciones_tecnicas_adicionales);

  // Auto-rellenar motivo desde servicios contratados si está vacío
  if (!structured.motivo_intervencion && servicios.length) {
    structured.motivo_intervencion = servicios
      .map((item) => item?.nombre)
      .filter(Boolean)
      .join(", ");
  }

  // Auto-rellenar diagnóstico inicial desde observaciones de recepción si está vacío
  if (!structured.diagnostico_inicial && insp?.averias_notas) {
    structured.diagnostico_inicial = String(insp.averias_notas || "").trim();
  }

  // Auto-rellenar trabajos realizados desde servicios contratados si está vacío
  if (!structured.trabajos_realizados && servicios.length) {
    structured.trabajos_realizados = servicios
      .map((item) => {
        const nombre = item?.nombre || "";
        const tipo = item?.tipo_tarea ? ` (${item.tipo_tarea})` : "";
        return nombre ? `- ${nombre}${tipo}` : null;
      })
      .filter(Boolean)
      .join("\n");
  }

  return {
    ...EMPTY_FORM,
    ...structured,
    observaciones_tecnicas_adicionales: tecnicas.textoLibre,
    mediciones_tecnicas_recepcion: tecnicas.medicionesRecepcion,
    mediciones_tecnicas: tecnicas.medicionesEntrega,
  };
};

export default function HojaTecnicaPage() {
  const { inspeccion_id } = useParams();
  const location = useLocation();
  const { actions } = useContext(Context);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [inspeccion, setInspeccion] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [usando_ia, setUsandoIa] = useState(false);
  const [iaGeneradaAuto, setIaGeneradaAuto] = useState(false);
  const [targetMapa, setTargetMapa] = useState(null);
  const [localizacionManualMapa, setLocalizacionManualMapa] = useState("");

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const iaPreparar = searchParams.get("ia") === "true" || searchParams.get("ai") === "true";

  const servicios = useMemo(
    () => parseServicios(inspeccion?.servicios_aplicados || "[]"),
    [inspeccion?.servicios_aplicados]
  );

  const mediaToken =
    sessionStorage.getItem("token") || localStorage.getItem("token") || "";

  const fotosInspeccion = useMemo(() => {
    const fotos = Array.isArray(inspeccion?.fotos_cloudinary) ? inspeccion.fotos_cloudinary : [];
    return fotos.map((foto, index) => {
      const filename = String(foto?.filename || "").trim();
      const id = filename || String(foto?.public_id || "").trim() || `foto-${index}`;
      const rawUrl = String(foto?.url || "").trim();
      const absoluteUrl = rawUrl
        ? (rawUrl.startsWith("http")
          ? rawUrl
          : buildApiUrl(rawUrl))
        : "";
      const urlConToken = absoluteUrl
        ? `${absoluteUrl}${absoluteUrl.includes("?") ? "&" : "?"}token=${encodeURIComponent(mediaToken)}`
        : "";

      return {
        id,
        filename,
        tipo: foto?.tipo || "general",
        original_name: foto?.original_name || filename || `Foto ${index + 1}`,
        url: mediaToken ? urlConToken : absoluteUrl,
      };
    });
  }, [inspeccion?.fotos_cloudinary, mediaToken]);

  const fotosMicroscopio = useMemo(() => {
    const marcadas = fotosInspeccion.filter((foto) => String(foto?.tipo || "").toLowerCase() === "microscopio");
    return marcadas.length > 0 ? marcadas : fotosInspeccion;
  }, [fotosInspeccion]);

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

  const addMedicion = (tipo) => {
    setForm((prev) => ({
      ...prev,
      mediciones_tecnicas: {
        ...prev.mediciones_tecnicas,
        [tipo]: [
          ...(prev.mediciones_tecnicas?.[tipo] || []),
          tipo === "microscopia" ? createMicroscopiaBase() : createMedicionBase(tipo === "barniz" ? "um" : "GU"),
        ],
      },
    }));
  };

  const removeMedicion = (tipo, index) => {
    setForm((prev) => ({
      ...prev,
      mediciones_tecnicas: {
        ...prev.mediciones_tecnicas,
        [tipo]: (prev.mediciones_tecnicas?.[tipo] || []).filter((_, idx) => idx !== index),
      },
    }));
  };

  const updateMedicionField = (tipo, index, field, value) => {
    setForm((prev) => ({
      ...prev,
      mediciones_tecnicas: {
        ...prev.mediciones_tecnicas,
        [tipo]: (prev.mediciones_tecnicas?.[tipo] || []).map((item, idx) => {
          if (idx !== index) return item;
          return { ...item, [field]: value };
        }),
      },
    }));
  };

  const updateLecturas = (tipo, index, value) => {
    const lecturas = parseLecturasText(value);
    updateMedicionField(tipo, index, "lecturas", lecturas);
  };

  const toggleMicroscopiaFoto = (index, fotoId) => {
    setForm((prev) => ({
      ...prev,
      mediciones_tecnicas: {
        ...prev.mediciones_tecnicas,
        microscopia: (prev.mediciones_tecnicas?.microscopia || []).map((item, idx) => {
          if (idx !== index) return item;
          const current = Array.isArray(item.media_refs) ? item.media_refs : [];
          const exists = current.includes(fotoId);
          return {
            ...item,
            media_refs: exists ? current.filter((id) => id !== fotoId) : [...current, fotoId],
          };
        }),
      },
    }));
  };

  const seleccionarTargetMapa = (tipo, index) => {
    setTargetMapa({ tipo, index });
    setFeedback({ type: "success", msg: "Ahora haz clic en la zona del coche para asignar la localización." });
  };

  const aplicarZonaMapa = (pieza) => {
    if (!targetMapa || targetMapa.index < 0) {
      setFeedback({ type: "error", msg: "Selecciona primero una medición y luego pulsa 'Usar dibujo'." });
      return;
    }
    updateMedicionField(targetMapa.tipo, targetMapa.index, "localizacion", pieza);
    setFeedback({ type: "success", msg: `Zona asignada: ${pieza}` });
  };

  const aplicarLocalizacionManualMapa = () => {
    const manual = String(localizacionManualMapa || "").trim();
    if (!targetMapa || targetMapa.index < 0) {
      setFeedback({ type: "error", msg: "Selecciona primero una medición y luego pulsa 'Usar dibujo'." });
      return;
    }
    if (!manual) {
      setFeedback({ type: "error", msg: "Escribe una localización manual antes de aplicar." });
      return;
    }
    updateMedicionField(targetMapa.tipo, targetMapa.index, "localizacion", manual);
    setFeedback({ type: "success", msg: `Localización manual asignada: ${manual}` });
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
            observaciones_tecnicas_adicionales: serializeObservacionesTecnicas(
              form.observaciones_tecnicas_adicionales,
              form.mediciones_tecnicas_recepcion,
              form.mediciones_tecnicas
            ),
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

  const generarConIA = useCallback(async () => {
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
        // Preservar bloque técnico, la IA no lo gestiona.
        observaciones_tecnicas_adicionales: prev.observaciones_tecnicas_adicionales,
        mediciones_tecnicas: prev.mediciones_tecnicas,
      }));

      setFeedback({ type: "success", msg: "Borrador generado con IA. Revisa y ajusta antes de guardar." });
      setIaGeneradaAuto(true);
    } catch (err) {
      console.error("Error IA", err);
      setFeedback({ type: "error", msg: "Error al generar con IA: " + err.message });
    } finally {
      setUsandoIa(false);
    }
  }, [form, inspeccion, inspeccion_id]);

  useEffect(() => {
    if (!loading && inspeccion && iaPreparar && !iaGeneradaAuto) {
      generarConIA();
    }
  }, [loading, inspeccion, iaPreparar, iaGeneradaAuto, generarConIA]);

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

          <div className="mb-4">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
              <label className="form-label fw-semibold mb-0">Mediciones técnicas</label>
              <span className="text-muted small">Múltiples lecturas por zona/localización con media automática</span>
            </div>

            <datalist id="sw-partes-coche-lista">
              {PARTES_COCHE_SUGERIDAS.map((pieza) => (
                <option key={pieza} value={pieza} />
              ))}
            </datalist>

            <div className="card mb-3">
              <div className="card-header d-flex justify-content-between align-items-center flex-wrap gap-2">
                <strong>Dibujo del coche para marcar zona</strong>
                <span className="small text-muted">
                  {targetMapa
                    ? `Objetivo activo: ${targetMapa.tipo} #${targetMapa.index + 1}`
                    : "Selecciona una medición con 'Usar dibujo'"}
                </span>
              </div>
              <div className="card-body">
                <div
                  className="position-relative mx-auto"
                  style={{ maxWidth: 520, width: "100%", aspectRatio: "5 / 9", border: "1px solid #d9e1ea", borderRadius: 14, background: "linear-gradient(180deg,#f9fcff,#eef4fb)" }}
                >
                  <svg viewBox="0 0 100 180" className="w-100 h-100" aria-hidden="true">
                    <rect x="20" y="8" width="60" height="164" rx="20" ry="20" fill="#dde7f3" stroke="#8ca0b8" strokeWidth="1.2" />
                    <rect x="30" y="26" width="40" height="24" rx="8" fill="#f7fbff" stroke="#a7b7ca" strokeWidth="1" />
                    <rect x="28" y="58" width="44" height="58" rx="10" fill="#f7fbff" stroke="#a7b7ca" strokeWidth="1" />
                    <rect x="30" y="124" width="40" height="24" rx="8" fill="#f7fbff" stroke="#a7b7ca" strokeWidth="1" />
                  </svg>

                  {MAPA_PARTES_COCHE.map((part) => (
                    <button
                      key={part.label}
                      type="button"
                      className="btn btn-sm btn-light border position-absolute"
                      onClick={() => aplicarZonaMapa(part.label)}
                      style={{
                        left: `${part.x}%`,
                        top: `${part.y}%`,
                        transform: "translate(-50%, -50%)",
                        fontSize: 10,
                        lineHeight: 1.1,
                        padding: "2px 5px",
                        whiteSpace: "nowrap",
                      }}
                      title={part.label}
                    >
                      •
                    </button>
                  ))}
                </div>
                <div className="small text-muted mt-2">
                  Pulsa una medición en "Usar dibujo" y luego marca la zona en el esquema.
                </div>
                <div className="row g-2 mt-2">
                  <div className="col-12 col-md-8">
                    <input
                      className="form-control"
                      list="sw-partes-coche-lista"
                      placeholder="O escribe localización manual (ej: paragolpes delantero derecho)"
                      value={localizacionManualMapa}
                      onChange={(e) => setLocalizacionManualMapa(e.target.value)}
                      disabled={saving}
                    />
                  </div>
                  <div className="col-12 col-md-4">
                    <button
                      type="button"
                      className="btn btn-outline-secondary w-100"
                      onClick={aplicarLocalizacionManualMapa}
                      disabled={saving}
                    >
                      Aplicar manual
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="card mb-3">
              <div className="card-header d-flex justify-content-between align-items-center">
                <strong>Grosor de barniz (um)</strong>
                <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => addMedicion("barniz")} disabled={saving}>
                  + Añadir medición
                </button>
              </div>
              <div className="card-body">
                {(form.mediciones_tecnicas?.barniz || []).length === 0 && (
                  <div className="text-muted small">Sin mediciones de barniz registradas.</div>
                )}
                {(form.mediciones_tecnicas?.barniz || []).map((item, idx) => {
                  const media = calcMedia(item.lecturas);
                  return (
                    <div key={`barniz-${idx}`} className="border rounded p-3 mb-3">
                      <div className="row g-2">
                        <div className="col-12 col-md-4">
                          <label className="form-label small">Zona</label>
                          <input className="form-control" value={item.zona || ""} onChange={(e) => updateMedicionField("barniz", idx, "zona", e.target.value)} disabled={saving} />
                        </div>
                        <div className="col-12 col-md-4">
                          <label className="form-label small">Localización</label>
                          <input
                            className="form-control"
                            list="sw-partes-coche-lista"
                            placeholder="Ej: Paragolpes delantero derecho"
                            value={item.localizacion || ""}
                            onChange={(e) => updateMedicionField("barniz", idx, "localizacion", e.target.value)}
                            disabled={saving}
                          />
                        </div>
                        <div className="col-12 col-md-4 d-flex align-items-end justify-content-between gap-2">
                          <div className="small text-muted">Media: <strong>{media !== null ? media.toFixed(2) : "-"} um</strong></div>
                          <div className="d-flex gap-2">
                            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => seleccionarTargetMapa("barniz", idx)} disabled={saving}>Usar dibujo</button>
                            <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => removeMedicion("barniz", idx)} disabled={saving}>Eliminar</button>
                          </div>
                        </div>
                        <div className="col-12">
                          <label className="form-label small">Lecturas (coma, punto con espacio o una por línea)</label>
                          <textarea
                            className="form-control"
                            rows={2}
                            defaultValue={lecturasToText(item.lecturas)}
                            onChange={(e) => updateLecturas("barniz", idx, e.target.value)}
                            disabled={saving}
                            placeholder="98, 102, 101  o  98. 102. 101"
                          />
                        </div>
                        <div className="col-12">
                          <div className="form-check">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              id={`barniz-informe-${idx}`}
                              checked={item.incluir_en_informe !== false}
                              onChange={(e) => updateMedicionField("barniz", idx, "incluir_en_informe", e.target.checked)}
                              disabled={saving}
                            />
                            <label className="form-check-label" htmlFor={`barniz-informe-${idx}`}>
                              Incluir en relatorio / hoja técnica
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card mb-3">
              <div className="card-header d-flex justify-content-between align-items-center">
                <strong>Brillo glosómetro (GU)</strong>
                <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => addMedicion("brillo")} disabled={saving}>
                  + Añadir medición
                </button>
              </div>
              <div className="card-body">
                {(form.mediciones_tecnicas?.brillo || []).length === 0 && (
                  <div className="text-muted small">Sin mediciones de brillo registradas.</div>
                )}
                {(form.mediciones_tecnicas?.brillo || []).map((item, idx) => {
                  const media = calcMedia(item.lecturas);
                  return (
                    <div key={`brillo-${idx}`} className="border rounded p-3 mb-3">
                      <div className="row g-2">
                        <div className="col-12 col-md-4">
                          <label className="form-label small">Zona</label>
                          <input className="form-control" value={item.zona || ""} onChange={(e) => updateMedicionField("brillo", idx, "zona", e.target.value)} disabled={saving} />
                        </div>
                        <div className="col-12 col-md-4">
                          <label className="form-label small">Localización</label>
                          <input
                            className="form-control"
                            list="sw-partes-coche-lista"
                            placeholder="Ej: Capó o puerta delantera izquierda"
                            value={item.localizacion || ""}
                            onChange={(e) => updateMedicionField("brillo", idx, "localizacion", e.target.value)}
                            disabled={saving}
                          />
                        </div>
                        <div className="col-12 col-md-4 d-flex align-items-end justify-content-between gap-2">
                          <div className="small text-muted">Media: <strong>{media !== null ? media.toFixed(2) : "-"} GU</strong></div>
                          <div className="d-flex gap-2">
                            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => seleccionarTargetMapa("brillo", idx)} disabled={saving}>Usar dibujo</button>
                            <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => removeMedicion("brillo", idx)} disabled={saving}>Eliminar</button>
                          </div>
                        </div>
                        <div className="col-12">
                          <label className="form-label small">Lecturas (coma, punto con espacio o una por línea)</label>
                          <textarea
                            className="form-control"
                            rows={2}
                            defaultValue={lecturasToText(item.lecturas)}
                            onChange={(e) => updateLecturas("brillo", idx, e.target.value)}
                            disabled={saving}
                            placeholder="81, 88, 58  o  81. 88. 58"
                          />
                        </div>
                        <div className="col-12">
                          <div className="form-check">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              id={`brillo-informe-${idx}`}
                              checked={item.incluir_en_informe !== false}
                              onChange={(e) => updateMedicionField("brillo", idx, "incluir_en_informe", e.target.checked)}
                              disabled={saving}
                            />
                            <label className="form-check-label" htmlFor={`brillo-informe-${idx}`}>
                              Incluir en relatorio / hoja técnica
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card">
              <div className="card-header d-flex justify-content-between align-items-center">
                <strong>Fotos de microscopio</strong>
                <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => addMedicion("microscopia")} disabled={saving}>
                  + Añadir bloque microscopia
                </button>
              </div>
              <div className="card-body">
                {(form.mediciones_tecnicas?.microscopia || []).length === 0 && (
                  <div className="text-muted small">Sin bloques de microscopía registrados.</div>
                )}
                {(form.mediciones_tecnicas?.microscopia || []).map((item, idx) => (
                  <div key={`micro-${idx}`} className="border rounded p-3 mb-3">
                    <div className="row g-2 mb-2">
                      <div className="col-12 col-md-4">
                        <label className="form-label small">Zona</label>
                        <input className="form-control" value={item.zona || ""} onChange={(e) => updateMedicionField("microscopia", idx, "zona", e.target.value)} disabled={saving} />
                      </div>
                      <div className="col-12 col-md-4">
                        <label className="form-label small">Localización</label>
                        <input
                          className="form-control"
                          list="sw-partes-coche-lista"
                          placeholder="Ej: Aleta trasera derecha"
                          value={item.localizacion || ""}
                          onChange={(e) => updateMedicionField("microscopia", idx, "localizacion", e.target.value)}
                          disabled={saving}
                        />
                      </div>
                      <div className="col-12 col-md-4 d-flex align-items-end justify-content-end gap-2">
                        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => seleccionarTargetMapa("microscopia", idx)} disabled={saving}>Usar dibujo</button>
                        <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => removeMedicion("microscopia", idx)} disabled={saving}>Eliminar</button>
                      </div>
                    </div>

                    <label className="form-label small">Nota técnica</label>
                    <textarea
                      className="form-control mb-2"
                      rows={2}
                      value={item.nota || ""}
                      onChange={(e) => updateMedicionField("microscopia", idx, "nota", e.target.value)}
                      disabled={saving}
                      placeholder="Observación al microscopio en esta zona"
                    />

                    <div className="form-check mb-2">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id={`micro-informe-${idx}`}
                        checked={item.incluir_en_informe !== false}
                        onChange={(e) => updateMedicionField("microscopia", idx, "incluir_en_informe", e.target.checked)}
                        disabled={saving}
                      />
                      <label className="form-check-label" htmlFor={`micro-informe-${idx}`}>
                        Incluir en relatorio / hoja técnica
                      </label>
                    </div>

                    {fotosMicroscopio.length > 0 ? (
                      <div>
                        <div className="small text-muted mb-2">Fotos asociadas</div>
                        <div className="row g-2">
                          {fotosMicroscopio.map((foto) => {
                            const selected = (item.media_refs || []).includes(foto.id);
                            return (
                              <div className="col-12 col-md-6 col-xl-4" key={`foto-ref-${idx}-${foto.id}`}>
                                <label className="border rounded p-2 d-block" style={{ cursor: "pointer" }}>
                                  <div className="form-check mb-2">
                                    <input
                                      className="form-check-input"
                                      type="checkbox"
                                      checked={selected}
                                      onChange={() => toggleMicroscopiaFoto(idx, foto.id)}
                                      disabled={saving}
                                    />
                                    <span className="form-check-label small ms-2">{foto.original_name || foto.id}</span>
                                  </div>
                                  {foto.url ? (
                                    <img src={foto.url} alt={foto.original_name || foto.id} style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 6 }} />
                                  ) : (
                                    <div className="text-muted small">Sin vista previa</div>
                                  )}
                                </label>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="small text-muted">No hay fotos de inspección subidas para asociar.</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

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
