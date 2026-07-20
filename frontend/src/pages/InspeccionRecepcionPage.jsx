import React, { useEffect, useState, useContext, useRef, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Context } from "../store/appContext";
import SignaturePad from "../components/SignaturePad.jsx";
import { getStoredRol, normalizeRol } from "../utils/authSession";
import "../styles/inspeccion-responsive.css";

const TECH_SCHEMA = "swstudio_tecnica_v1";

const EMPTY_MEDICIONES_TECNICAS = {
  barniz: [],
  brillo: [],
  microscopia: [],
};

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

const createMedicionBase = (unidad = "") => ({
  zona: "",
  localizacion: "",
  lecturas: [],
  unidad,
  incluir_en_informe: true,
});

const safeNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const parseLecturasText = (value) => {
  const parts = String(value || "")
    .split(/[\n,;]+/)
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
  return nums.reduce((acc, val) => acc + val, 0) / nums.length;
};

const normalizeMedicionesTecnicas = (input) => {
  const source = input && typeof input === "object" ? input : {};
  return {
    barniz: Array.isArray(source.barniz)
      ? source.barniz.map((item) => ({
        ...createMedicionBase("um"),
        ...item,
        lecturas: Array.isArray(item?.lecturas)
          ? item.lecturas.map((v) => safeNumber(v)).filter((v) => v !== null)
          : [],
      }))
      : [],
    brillo: Array.isArray(source.brillo)
      ? source.brillo.map((item) => ({
        ...createMedicionBase("GU"),
        ...item,
        lecturas: Array.isArray(item?.lecturas)
          ? item.lecturas.map((v) => safeNumber(v)).filter((v) => v !== null)
          : [],
      }))
      : [],
    microscopia: Array.isArray(source.microscopia) ? source.microscopia : [],
  };
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
        medicionesRecepcion: hasStages ? normalizeMedicionesTecnicas(root.recepcion || {}) : { ...EMPTY_MEDICIONES_TECNICAS },
        medicionesEntrega: hasStages ? normalizeMedicionesTecnicas(root.entrega || {}) : normalizeMedicionesTecnicas(root),
      };
    }
  } catch {
    // Registros legacy en texto.
  }
  return {
    textoLibre: raw,
    medicionesRecepcion: { ...EMPTY_MEDICIONES_TECNICAS },
    medicionesEntrega: { ...EMPTY_MEDICIONES_TECNICAS },
  };
};

const serializeObservacionesTecnicas = ({ textoLibre = "", medicionesRecepcion, medicionesEntrega }) => {
  const payload = {
    schema: TECH_SCHEMA,
    texto_libre: String(textoLibre || "").trim(),
    mediciones_tecnicas: {
      recepcion: normalizeMedicionesTecnicas(medicionesRecepcion),
      entrega: normalizeMedicionesTecnicas(medicionesEntrega),
    },
  };
  return JSON.stringify(payload);
};

const INITIAL_FORM_DATA = {
  cliente_id: "",
  cliente_nombre: "",
  cliente_telefono: "",
  coche_descripcion: "",
  matricula: "",
  kilometros: "",
  es_concesionario: false,
  firma_cliente_recepcion: "",
  consentimiento_datos_recepcion: false,
  averias_notas: "",
  servicios_aplicados: []
};

const MAX_VIDEO_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB (1080p ~30fps, 3-5 min)
const FORMATOS_VIDEO_ACEPTADOS = ["mp4", "mov", "avi", "mkv", "webm", "3gp", "flv"];
const FORMATOS_VIDEO_LABEL = "MP4, MOV, AVI, MKV, WEBM, 3GP, FLV";

const formatFileSizeMB = (sizeInBytes) => (sizeInBytes / (1024 * 1024)).toFixed(2);

const parseHoursToMinutes = (rawHours) => {
  const raw = String(rawHours ?? "").trim();
  if (!raw) return 0;
  const value = Number(raw.replace(",", "."));
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 60);
};

const ROLE_OPTIONS = [
  { value: "detailing", label: "Detailing" },
  { value: "pintura", label: "Pintura" },
  { value: "tapicero", label: "Tapicería" },
  { value: "calidad", label: "Calidad" },
  { value: "otro", label: "Otro" },
];

const ROUTEABLE_SERVICE_ROLES = new Set(["detailing", "pintura", "tapicero", "calidad"]);
const CATALOG_ROLE_SECTIONS = [
  { rol: "detailing", label: "Detailing", color: "#6366f1" },
  { rol: "pintura", label: "Pintura", color: "#f87171" },
  { rol: "tapicero", label: "Tapicería", color: "#fbbf24" },
];
const EMPTY_CATALOG_SELECTION = CATALOG_ROLE_SECTIONS.reduce((acc, { rol }) => {
  acc[rol] = "";
  return acc;
}, {});
const resolveCatalogRole = (servicio) => {
  const normalized = normalizeRol(servicio?.rol_responsable || servicio?.tipo_tarea || "");
  return ROUTEABLE_SERVICE_ROLES.has(normalized) ? normalized : "otro";
};

// eslint-disable-next-line no-unused-vars
const getRoleBadgeClass = (role) => {
  switch (normalizeRol(role)) {
    case "detailing":
      return "bg-primary";
    case "pintura":
      return "bg-danger";
    case "tapicero":
      return "bg-warning text-dark";
    case "calidad":
      return "bg-info text-dark";
    default:
      return "bg-secondary";
  }
};

const mapServicioForPayload = (servicio) => {
  const tipoRaw = servicio?.tipo_tarea || servicio?.rol_responsable || "";
  const tipoNormalizado = normalizeRol(tipoRaw);
  const tipo = ROUTEABLE_SERVICE_ROLES.has(tipoNormalizado) ? tipoNormalizado : undefined;
  return {
    origen: servicio?.origen || "manual",
    servicio_catalogo_id: servicio?.servicio_catalogo_id ?? null,
    nombre: String(servicio?.nombre || "").trim(),
    precio: Number.parseFloat(servicio?.precio || 0) || 0,
    tiempo_estimado_minutos: Number.parseInt(servicio?.tiempo_estimado_minutos || 0, 10) || 0,
    ...(tipo ? { tipo_tarea: tipo } : {}),
  };
};

const formatCocheDescripcion = (coche) => {
  if (!coche) return "";
  return [coche?.marca, coche?.modelo].filter(Boolean).join(" ").trim();
};

const formatCocheExistenteLabel = (coche) => {
  if (!coche) return "";
  const matricula = String(coche?.matricula || "").trim().toUpperCase();
  const descripcion = formatCocheDescripcion(coche);
  return descripcion ? `${matricula} · ${descripcion}` : matricula;
};

const InspeccionRecepcionPage = () => {
  const { actions } = useContext(Context);
  const navigate = useNavigate();
  
  // Referencias para los inputs file
  const fotosCamaraRef = useRef(null);
  const fotosGaleriaRef = useRef(null);
  const videosCamaraRef = useRef(null);
  const videosGaleriaRef = useRef(null);
  
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);
  
  const [fotos, setFotos] = useState([]);
  const [fotosMicroscopio, setFotosMicroscopio] = useState([]);
  const [videos, setVideos] = useState([]);
  const [fotosPreview, setFotosPreview] = useState([]);
  const [fotosMicroscopioPreview, setFotosMicroscopioPreview] = useState([]);
  const [videosPreview, setVideosPreview] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [cargandoEdicion, setCargandoEdicion] = useState(false);
  const [inspeccionCreada, setInspeccionCreada] = useState(null);
  const [formError, setFormError] = useState("");
  const [servicioManualError, setServicioManualError] = useState("");
  const [inspeccionEditandoId, setInspeccionEditandoId] = useState(null);
  const [catalogoServicios, setCatalogoServicios] = useState([]);
  const [catalogoServiciosCargando, setCatalogoServiciosCargando] = useState(true);
  const [clientesDisponibles, setClientesDisponibles] = useState([]);
  const [cochesCliente, setCochesCliente] = useState([]);
  const [cochesClienteCargando, setCochesClienteCargando] = useState(false);
  const [cocheExistenteSeleccionado, setCocheExistenteSeleccionado] = useState("");
  const [servicioManual, setServicioManual] = useState({
    nombre: "",
    precio: "",
    tiempo_estimado_minutos: "",
    tiempo_estimado_horas: "",
    tipo_tarea: "",
  });
  const [servicioCatalogoSeleccionado, setServicioCatalogoSeleccionado] = useState(EMPTY_CATALOG_SELECTION);
  const [tamanoVehiculo, setTamanoVehiculo] = useState(""); // "turismo" | "suv" | "todoterreno" | ""
  const [historialClienteResumen, setHistorialClienteResumen] = useState(null);
  const [historialClienteCargando, setHistorialClienteCargando] = useState(false);
  const [medicionesRecepcion, setMedicionesRecepcion] = useState({ ...EMPTY_MEDICIONES_TECNICAS });
  const [medicionesEntregaExistentes, setMedicionesEntregaExistentes] = useState({ ...EMPTY_MEDICIONES_TECNICAS });
  const [targetMapaRecepcion, setTargetMapaRecepcion] = useState(null);
  const [localizacionManualMapaRecepcion, setLocalizacionManualMapaRecepcion] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const rol = getStoredRol();
  const isAdmin = rol === "administrador";

  useEffect(() => {
    let active = true;
    const editIdRaw = searchParams.get("editId");

    if (!editIdRaw) {
      setInspeccionEditandoId(null);
      return;
    }

    const editId = Number.parseInt(editIdRaw, 10);
    if (!Number.isFinite(editId) || editId <= 0) {
      return;
    }

    const cargarParaEdicion = async () => {
      setCargandoEdicion(true);
      try {
        const inspeccion = await actions.getInspeccion(editId);
        if (!active || !inspeccion) return;
        const tecnicas = parseObservacionesTecnicas(inspeccion.observaciones_tecnicas_adicionales);

        setFormData({
          cliente_id: inspeccion.cliente_id ? String(inspeccion.cliente_id) : "",
          cliente_nombre: inspeccion.cliente_nombre || "",
          cliente_telefono: inspeccion.cliente_telefono || "",
          coche_descripcion: inspeccion.coche_descripcion || "",
          matricula: inspeccion.matricula || "",
          kilometros: inspeccion.kilometros || "",
          es_concesionario: Boolean(inspeccion.es_concesionario),
          firma_cliente_recepcion: inspeccion.firma_cliente_recepcion || "",
          consentimiento_datos_recepcion: Boolean(inspeccion.consentimiento_datos_recepcion),
          averias_notas: inspeccion.averias_notas || "",
          servicios_aplicados: Array.isArray(inspeccion.servicios_aplicados)
            ? inspeccion.servicios_aplicados.map(mapServicioForPayload)
            : []
        });
        setCocheExistenteSeleccionado(inspeccion.coche_id ? String(inspeccion.coche_id) : "");
        setInspeccionEditandoId(inspeccion.id);
        setMedicionesRecepcion(tecnicas.medicionesRecepcion);
        setMedicionesEntregaExistentes(tecnicas.medicionesEntrega);
        setTargetMapaRecepcion(null);
        setLocalizacionManualMapaRecepcion("");
        setFotos([]);
        setFotosMicroscopio([]);
        setVideos([]);
        setFotosPreview([]);
        setFotosMicroscopioPreview([]);
        setVideosPreview([]);
      } catch (error) {
        setFormError(`No se pudo cargar la inspección para editar: ${error.message}`);
      } finally {
        if (active) setCargandoEdicion(false);
      }
    };

    cargarParaEdicion();
    return () => {
      active = false;
    };
  }, [actions, searchParams, clientesDisponibles]);

  const addMedicionRecepcion = (tipo) => {
    setMedicionesRecepcion((prev) => ({
      ...prev,
      [tipo]: [
        ...(prev?.[tipo] || []),
        createMedicionBase(tipo === "barniz" ? "um" : "GU"),
      ],
    }));
  };

  const removeMedicionRecepcion = (tipo, index) => {
    setMedicionesRecepcion((prev) => ({
      ...prev,
      [tipo]: (prev?.[tipo] || []).filter((_, idx) => idx !== index),
    }));
  };

  const updateMedicionRecepcionField = (tipo, index, field, value) => {
    setMedicionesRecepcion((prev) => ({
      ...prev,
      [tipo]: (prev?.[tipo] || []).map((item, idx) => (idx === index ? { ...item, [field]: value } : item)),
    }));
  };

  const updateLecturasRecepcion = (tipo, index, value) => {
    updateMedicionRecepcionField(tipo, index, "lecturas", parseLecturasText(value));
  };

  const seleccionarTargetMapaRecepcion = (tipo, index) => {
    setTargetMapaRecepcion({ tipo, index });
  };

  const aplicarZonaMapaRecepcion = (pieza) => {
    if (!targetMapaRecepcion || targetMapaRecepcion.index < 0) return;
    updateMedicionRecepcionField(targetMapaRecepcion.tipo, targetMapaRecepcion.index, "localizacion", pieza);
  };

  const aplicarLocalizacionManualMapaRecepcion = () => {
    const manual = String(localizacionManualMapaRecepcion || "").trim();
    if (!targetMapaRecepcion || targetMapaRecepcion.index < 0 || !manual) return;
    updateMedicionRecepcionField(targetMapaRecepcion.tipo, targetMapaRecepcion.index, "localizacion", manual);
  };

  useEffect(() => {
    let active = true;
    (async () => {
      if (active) setCatalogoServiciosCargando(true);
      try {
        const servicios = await actions.getServiciosCatalogo(true);
        if (active) setCatalogoServicios(Array.isArray(servicios) ? servicios : []);
      } catch {
        if (active) setCatalogoServicios([]);
      } finally {
        if (active) setCatalogoServiciosCargando(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [actions]);

  useEffect(() => {
    let active = true;
    const clienteId = Number.parseInt(formData.cliente_id || "", 10);

    if (!Number.isFinite(clienteId) || clienteId <= 0) {
      setCochesCliente([]);
      setCochesClienteCargando(false);
      setCocheExistenteSeleccionado("");
      return;
    }

    setCochesClienteCargando(true);
    actions.getCoches({ clienteId })
      .then((coches) => {
        if (!active) return;
        setCochesCliente(Array.isArray(coches) ? coches : []);
      })
      .catch(() => {
        if (!active) return;
        setCochesCliente([]);
      })
      .finally(() => {
        if (active) setCochesClienteCargando(false);
      });

    return () => {
      active = false;
    };
  }, [actions, formData.cliente_id]);

  useEffect(() => {
    let active = true;
    const matricula = String(formData.matricula || "").trim().toUpperCase();
    const esConcesionario = Boolean(formData.es_concesionario);
    const excluirInspeccionId = Number.parseInt(inspeccionEditandoId || "", 10);

    if (esConcesionario || matricula.length < 4) {
      setHistorialClienteResumen(null);
      setHistorialClienteCargando(false);
      return;
    }

    setHistorialClienteCargando(true);
    actions.getHistorialResumenPorMatricula(matricula, {
      excluirInspeccionId: Number.isFinite(excluirInspeccionId) && excluirInspeccionId > 0 ? excluirInspeccionId : undefined,
    })
      .then((data) => {
        if (!active) return;
        setHistorialClienteResumen(data || null);
      })
      .catch(() => {
        if (!active) return;
        setHistorialClienteResumen(null);
      })
      .finally(() => {
        if (active) setHistorialClienteCargando(false);
      });

    return () => {
      active = false;
    };
  }, [actions, formData.matricula, formData.es_concesionario, inspeccionEditandoId]);

  const formatHistorialDate = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return new Intl.DateTimeFormat("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date);
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const clientes = await actions.getClientes();
        if (active) setClientesDisponibles(Array.isArray(clientes) ? clientes : []);
      } catch {
        if (active) setClientesDisponibles([]);
      }
    })();

    return () => {
      active = false;
    };
  }, [actions]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    const nextValue = type === "checkbox" ? checked : value;

    if (name === "cliente_nombre" || name === "cliente_telefono") {
      setCocheExistenteSeleccionado("");
      setFormData((prev) => ({
        ...prev,
        cliente_id: "",
        [name]: nextValue,
      }));
      return;
    }

    if (name === "coche_descripcion" || name === "matricula") {
      setCocheExistenteSeleccionado("");
    }

    setFormData((prev) => ({
      ...prev,
      [name]: nextValue,
      ...(name === "es_concesionario" && checked
        ? {
            firma_cliente_recepcion: "",
            consentimiento_datos_recepcion: true,
          }
        : {})
    }));
  };

  const handleCocheExistenteChange = (e) => {
    const cocheId = String(e.target.value || "");
    setCocheExistenteSeleccionado(cocheId);

    if (!cocheId) return;

    const coche = cochesCliente.find((item) => String(item?.id) === cocheId);
    if (!coche) return;

    setFormData((prev) => ({
      ...prev,
      coche_descripcion: formatCocheDescripcion(coche) || prev.coche_descripcion,
      matricula: String(coche?.matricula || "").trim().toUpperCase() || prev.matricula,
    }));
  };

  const agregarServicioCatalogo = (servicio) => {
    const servicioId = Number(servicio?.id);
    if (!servicioId) return;

    const rolServicio = resolveCatalogRole(servicio);
    if (rolServicio === "otro") {
      setFormError(`El servicio "${servicio?.nombre || "seleccionado"}" no tiene un rol válido asignado en el catálogo. Asígnale detailing, pintura, tapicería o calidad.`);
      return;
    }

    setFormData((prev) => {
      const existentes = prev.servicios_aplicados || [];
      if (existentes.some((s) => Number(s.servicio_catalogo_id) === servicioId)) {
        return prev;
      }

      // Precio según tamaño del vehículo seleccionado
      let precio = Number(servicio.precio_base || 0);
      if (tamanoVehiculo === "turismo" && servicio.precio_turismo != null) precio = Number(servicio.precio_turismo);
      else if (tamanoVehiculo === "suv" && servicio.precio_suv != null) precio = Number(servicio.precio_suv);
      else if (tamanoVehiculo === "todoterreno" && servicio.precio_todoterreno != null) precio = Number(servicio.precio_todoterreno);
      else if (servicio.precio_turismo != null) precio = Number(servicio.precio_turismo); // fallback al menor

      return {
        ...prev,
        servicios_aplicados: [
          ...existentes,
          {
            origen: "catalogo",
            servicio_catalogo_id: servicioId,
            nombre: servicio.nombre || "Servicio",
            precio,
            tiempo_estimado_minutos: Number.parseInt(servicio.tiempo_estimado_minutos || 0, 10) || 0,
            tipo_tarea: rolServicio,
          },
        ],
      };
    });
  };

  const agregarServicioManual = () => {
    setServicioManualError("");
    const nombre = String(servicioManual.nombre || "").trim();
    const precio = Number.parseFloat(servicioManual.precio || "0");

    if (!nombre) {
      setServicioManualError("Debes indicar el nombre del servicio.");
      return;
    }
    if (Number.isNaN(precio) || precio < 0) {
      setServicioManualError("El precio debe ser 0 o mayor.");
      return;
    }
    const tiempoEnMinutos = Number.parseInt(servicioManual.tiempo_estimado_minutos || "0", 10);
    if (Number.isNaN(tiempoEnMinutos) || tiempoEnMinutos < 0) {
      setServicioManualError("El tiempo estimado debe ser 0 o mayor.");
      return;
    }
    const tiempoDesdeHoras = parseHoursToMinutes(servicioManual.tiempo_estimado_horas);
    if (tiempoDesdeHoras === null) {
      setServicioManualError("Las horas estimadas deben ser un número válido (0 o mayor).");
      return;
    }
    const tiempoEstimado = tiempoDesdeHoras > 0 ? tiempoDesdeHoras : tiempoEnMinutos;
    const tipoTarea = normalizeRol(servicioManual.tipo_tarea || "");
    if (!tipoTarea) {
      setServicioManualError("Debes seleccionar el rol/área del servicio manual.");
      return;
    }

    setFormData((prev) => ({
      ...prev,
      servicios_aplicados: [
        ...(prev.servicios_aplicados || []),
        {
          origen: "manual",
          servicio_catalogo_id: null,
          nombre,
          precio,
          tiempo_estimado_minutos: tiempoEstimado,
          tipo_tarea: tipoTarea,
        },
      ],
    }));

    setServicioManual({ nombre: "", precio: "", tiempo_estimado_minutos: "", tiempo_estimado_horas: "", tipo_tarea: "" });
  };

  const eliminarServicioAplicado = (index) => {
    setFormData((prev) => ({
      ...prev,
      servicios_aplicados: (prev.servicios_aplicados || []).filter((_, i) => i !== index),
    }));
  };

  const actualizarRolServicioAplicado = (index, tipoTarea) => {
    setFormData((prev) => ({
      ...prev,
      servicios_aplicados: (prev.servicios_aplicados || []).map((servicio, i) => (
        i === index
          ? { ...servicio, tipo_tarea: normalizeRol(tipoTarea || "") || "" }
          : servicio
      )),
    }));
  };

  const appendFotoPreviews = (archivos, setPreviewState) => {
    archivos.forEach((archivo) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPreviewState((prev) => [...prev, event.target.result]);
      };
      reader.readAsDataURL(archivo);
    });
  };

  const appendVideoPreviews = (archivos, setPreviewState) => {
    // URL.createObjectURL evita cargar el binario completo en RAM (crítico en móvil)
    archivos.forEach((archivo) => {
      const objectUrl = URL.createObjectURL(archivo);
      setPreviewState((prev) => [...prev, objectUrl]);
    });
  };

  const handleFotosChange = (e) => {
    const archivos = Array.from(e.target.files);
    if (archivos.length === 0) return;

    setFotos((prev) => [...prev, ...archivos]);
    appendFotoPreviews(archivos, setFotosPreview);
  };

  const handleFotosMicroscopioChange = (e) => {
    const archivos = Array.from(e.target.files);
    if (archivos.length === 0) return;

    setFotosMicroscopio((prev) => [...prev, ...archivos]);
    appendFotoPreviews(archivos, setFotosMicroscopioPreview);
  };

  const handleVideosChange = (e) => {
    const archivos = Array.from(e.target.files);
    if (archivos.length === 0) return;

    const videosValidos = [];
    const videosGrandes = [];
    const formatosInvalidos = [];

    archivos.forEach((archivo) => {
      const sizeInMB = formatFileSizeMB(archivo.size);

      // Validar tamaño (máx 250 MB para 1080p)
      if (archivo.size > MAX_VIDEO_SIZE_BYTES) {
        videosGrandes.push(`${archivo.name} (${sizeInMB} MB)`);
        return;
      }

      // Validar formato por extensión
      const extension = archivo.name.split(".").pop()?.toLowerCase();

      if (!extension || !FORMATOS_VIDEO_ACEPTADOS.includes(extension)) {
        formatosInvalidos.push(`${archivo.name} (.${extension})`);
        return;
      }

      videosValidos.push(archivo);
    });

    const avisos = [];
    if (videosGrandes.length > 0)
      avisos.push(`Videos demasiado grandes (máx 500 MB): ${videosGrandes.join(", ")}`);
    if (formatosInvalidos.length > 0)
      avisos.push(`Formatos no válidos (acepta: ${FORMATOS_VIDEO_LABEL}): ${formatosInvalidos.join(", ")}`);
    if (avisos.length > 0) setFormError(avisos.join(" · "));

    if (videosValidos.length === 0) return;

    setVideos((prev) => [...prev, ...videosValidos]);
    appendVideoPreviews(videosValidos, setVideosPreview);
  };

  const eliminarFoto = (index) => {
    setFotos((prev) => prev.filter((_, i) => i !== index));
    setFotosPreview((prev) => prev.filter((_, i) => i !== index));
  };

  const eliminarVideo = (index) => {
    setVideosPreview((prev) => {
      const url = prev[index];
      if (url && url.startsWith("blob:")) URL.revokeObjectURL(url);
      return prev.filter((_, i) => i !== index);
    });
    setVideos((prev) => prev.filter((_, i) => i !== index));
  };

  const subirArchivos = async ({ inspeccionId, archivos, subirArchivo, validarAntes }) => {
    let subidos = 0;
    let fallidos = 0;

    for (let i = 0; i < archivos.length; i++) {
      const archivo = archivos[i];

      if (validarAntes) {
        const error = validarAntes(archivo);
        if (error) {
          fallidos++;
          continue;
        }
      }

      try {
        await subirArchivo(inspeccionId, archivo);
        subidos++;
      } catch (err) {
        console.error(`Error subiendo archivo ${i + 1}:`, err);
        fallidos++;
      }
    }

    return { subidos, fallidos };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    setFormError("");

    const { servicios: serviciosPreparados, agregados: serviciosAutoAgregados } = construirServiciosConPendientes();

    if (serviciosAutoAgregados.length > 0) {
      setFormData((prev) => ({
        ...prev,
        servicios_aplicados: serviciosPreparados,
      }));
      setServicioCatalogoSeleccionado(EMPTY_CATALOG_SELECTION);
    }

    if (!formData.cliente_nombre || !formData.cliente_telefono ||
        !formData.coche_descripcion || !formData.matricula || !formData.kilometros) {
      setFormError("Completa todos los campos obligatorios antes de guardar.");
      return;
    }
    if (!serviciosPreparados.length) {
      setFormError("Añade al menos un servicio. Recuerda pulsar «Añadir servicio» para que aparezca en la lista de abajo.");
      return;
    }
    if (!formData.es_concesionario && !formData.firma_cliente_recepcion) {
      setFormError("La firma del cliente es obligatoria para el flujo normal de recepción.");
      return;
    }
    if (!formData.consentimiento_datos_recepcion) {
      setFormError("Debes aceptar la protección de datos para registrar la recepción.");
      return;
    }
    const kilometros = Number.parseInt(formData.kilometros, 10);
    if (Number.isNaN(kilometros) || kilometros < 0) {
      setFormError("Introduce un valor válido de kilómetros (0 o mayor).");
      return;
    }

    setGuardando(true);

    try {
      const serviciosPayload = serviciosPreparados.map(mapServicioForPayload);
      const serviciosSinRol = serviciosPayload.filter((servicio) => !ROUTEABLE_SERVICE_ROLES.has(normalizeRol(servicio?.tipo_tarea || "")));
      if (serviciosSinRol.length > 0) {
        setFormError("Todos los servicios deben tener un rol válido del catálogo (detailing, pintura, tapicería o calidad) para enrutar correctamente el parte.");
        setGuardando(false);
        return;
      }

      const payload = {
        ...formData,
        cliente_id: null,
        kilometros,
        servicios_aplicados: serviciosPayload,
        observaciones_tecnicas_adicionales: serializeObservacionesTecnicas({
          textoLibre: "",
          medicionesRecepcion,
          medicionesEntrega: medicionesEntregaExistentes,
        }),
      };

      let inspeccion = null;
      if (inspeccionEditandoId) {
        inspeccion = await actions.actualizarInspeccion(inspeccionEditandoId, payload);
        if (!inspeccion?.id) {
          throw new Error("No se pudo actualizar la inspección");
        }
      } else {
        inspeccion = await actions.crearInspeccion(payload);
        if (!inspeccion || !inspeccion.id) {
          throw new Error("No se pudo crear la inspección");
        }
      }

      setInspeccionCreada(inspeccion);

      await subirArchivos({
        inspeccionId: inspeccion.id,
        archivos: fotos,
        subirArchivo: actions.subirFotoInspeccion
      });

      await subirArchivos({
        inspeccionId: inspeccion.id,
        archivos: fotosMicroscopio,
        subirArchivo: (inspeccionId, archivo) => actions.subirFotoInspeccion(inspeccionId, archivo, { tipo: "microscopio" })
      });

      const resultVideos = await subirArchivos({
        inspeccionId: inspeccion.id,
        archivos: videos,
        subirArchivo: actions.subirVideoInspeccion,
        validarAntes: (video) => {
          if (video.size <= MAX_VIDEO_SIZE_BYTES) return null;
          const videoSize = formatFileSizeMB(video.size);
          return `⚠️ El video "${video.name}" es muy grande (${videoSize} MB). Máximo: 500 MB`;
        }
      });

      window.scrollTo({ top: 0, behavior: "smooth" });

      if (resultVideos.fallidos > 0) {
        setFormError(`La inspección se guardó correctamente, pero ${resultVideos.fallidos} vídeo(s) no se pudieron subir. Comprueba tu conexión e inténtalo de nuevo editando la inspección.`);
      }

      // Limpiar formulario
      setFormData(INITIAL_FORM_DATA);
      setMedicionesRecepcion({ ...EMPTY_MEDICIONES_TECNICAS });
      setMedicionesEntregaExistentes({ ...EMPTY_MEDICIONES_TECNICAS });
      setTargetMapaRecepcion(null);
      setLocalizacionManualMapaRecepcion("");
      setServicioManual({ nombre: "", precio: "", tiempo_estimado_minutos: "", tiempo_estimado_horas: "", tipo_tarea: "" });
      setFotos([]);
      setFotosMicroscopio([]);
      setVideos([]);
      setFotosPreview([]);
      setFotosMicroscopioPreview([]);
      setVideosPreview((prev) => {
        prev.forEach((url) => { if (url && url.startsWith("blob:")) URL.revokeObjectURL(url); });
        return [];
      });
      if (inspeccionEditandoId) {
        setInspeccionEditandoId(null);
        setSearchParams({});
      }
      
    } catch (error) {
      const accion = inspeccionEditandoId ? "actualizar" : "crear";
      setFormError(`Error al ${accion} la inspección: ${error.message}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setGuardando(false);
    }
  };

  const cancelarEdicion = () => {
    setInspeccionEditandoId(null);
    setSearchParams({});
    setFormData(INITIAL_FORM_DATA);
    setMedicionesRecepcion({ ...EMPTY_MEDICIONES_TECNICAS });
    setMedicionesEntregaExistentes({ ...EMPTY_MEDICIONES_TECNICAS });
    setTargetMapaRecepcion(null);
    setLocalizacionManualMapaRecepcion("");
    setServicioManual({ nombre: "", precio: "", tiempo_estimado_minutos: "", tiempo_estimado_horas: "", tipo_tarea: "" });
    setFotos([]);
    setFotosMicroscopio([]);
    setVideos([]);
    setFotosPreview([]);
    setFotosMicroscopioPreview([]);
    setVideosPreview((prev) => {
      prev.forEach((url) => { if (url && url.startsWith("blob:")) URL.revokeObjectURL(url); });
      return [];
    });
  };

  const volver = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/", { replace: true });
  };

  const serviciosCatalogoPorRol = useMemo(() => {
    const grupos = CATALOG_ROLE_SECTIONS.reduce((acc, { rol }) => {
      acc[rol] = [];
      return acc;
    }, {});

    for (const servicio of catalogoServicios || []) {
      const rolServicio = resolveCatalogRole(servicio);
      if (rolServicio !== "otro") {
        grupos[rolServicio].push(servicio);
      }
    }

    return grupos;
  }, [catalogoServicios]);

  const serviciosCatalogoSinRol = useMemo(
    () => (catalogoServicios || []).filter((servicio) => resolveCatalogRole(servicio) === "otro"),
    [catalogoServicios]
  );

  const seleccionarServicioCatalogoPorRol = (rolServicio, servicioId) => {
    setServicioCatalogoSeleccionado((prev) => ({ ...prev, [rolServicio]: servicioId }));
  };

  const agregarServicioCatalogoPorRol = (rolServicio) => {
    const servicioId = servicioCatalogoSeleccionado?.[rolServicio];
    if (!servicioId) return;

    const servicio = (serviciosCatalogoPorRol[rolServicio] || []).find(
      (s) => String(s.id) === String(servicioId)
    );
    if (!servicio) return;

    agregarServicioCatalogo(servicio);
    setServicioCatalogoSeleccionado((prev) => ({ ...prev, [rolServicio]: "" }));
  };

  const serviciosCatalogoPendientes = useMemo(() => {
    const pendientes = [];

    for (const { rol, label } of CATALOG_ROLE_SECTIONS) {
      const servicioId = servicioCatalogoSeleccionado?.[rol];
      if (!servicioId) continue;

      const servicio = (serviciosCatalogoPorRol[rol] || []).find(
        (s) => String(s.id) === String(servicioId)
      );
      if (!servicio) continue;

      pendientes.push({
        rol,
        label,
        nombre: servicio.nombre || "Servicio",
      });
    }

    return pendientes;
  }, [servicioCatalogoSeleccionado, serviciosCatalogoPorRol]);

  const construirServiciosConPendientes = () => {
    const actuales = Array.isArray(formData.servicios_aplicados)
      ? [...formData.servicios_aplicados]
      : [];
    const agregados = [];

    for (const { rol } of CATALOG_ROLE_SECTIONS) {
      const servicioId = servicioCatalogoSeleccionado?.[rol];
      if (!servicioId) continue;

      const servicio = (serviciosCatalogoPorRol[rol] || []).find(
        (s) => String(s.id) === String(servicioId)
      );
      if (!servicio) continue;

      const yaExiste = actuales.some(
        (item) => Number(item?.servicio_catalogo_id) === Number(servicio.id)
      );
      if (yaExiste) continue;

      const rolServicio = resolveCatalogRole(servicio);
      if (rolServicio === "otro") continue;

      let precio = Number(servicio.precio_base || 0);
      if (tamanoVehiculo === "turismo" && servicio.precio_turismo != null) precio = Number(servicio.precio_turismo);
      else if (tamanoVehiculo === "suv" && servicio.precio_suv != null) precio = Number(servicio.precio_suv);
      else if (tamanoVehiculo === "todoterreno" && servicio.precio_todoterreno != null) precio = Number(servicio.precio_todoterreno);
      else if (servicio.precio_turismo != null) precio = Number(servicio.precio_turismo);

      const servicioNormalizado = {
        origen: "catalogo",
        servicio_catalogo_id: Number(servicio.id),
        nombre: servicio.nombre || "Servicio",
        precio,
        tiempo_estimado_minutos: Number.parseInt(servicio.tiempo_estimado_minutos || 0, 10) || 0,
        tipo_tarea: rolServicio,
      };

      actuales.push(servicioNormalizado);
      agregados.push(servicioNormalizado);
    }

    return { servicios: actuales, agregados };
  };

  const _inp = { background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)", color: "var(--sw-text)", borderRadius: "10px" };
  const _lbl = { color: "var(--sw-muted)", fontSize: "0.78rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.4rem" };
  const _card = { background: "var(--sw-surface)", border: "1px solid var(--sw-border)", borderTop: "3px solid var(--sw-accent)", borderRadius: "18px", overflow: "hidden", marginBottom: "1.5rem" };
  const _cardH = { padding: "1.1rem 1.25rem", borderBottom: "1px solid var(--sw-border)", fontWeight: 700, color: "var(--sw-text)", fontSize: "0.95rem" };
  const _cardB = { padding: "1.25rem" };

  return (
    <div className="sw-page-bg">

      {/* ── HERO ── */}
      <div className="sw-hero-section">
        <div className="container" style={{ maxWidth: "900px" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "1.5rem", flexWrap: "wrap" }}>
            <div>
              <p style={{ fontSize: "0.73rem", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--sw-accent)", opacity: 0.85, marginBottom: "0.4rem" }}>
                Panel de gestión · SW Studio
              </p>
              <h1 style={{ fontSize: "clamp(1.4rem, 3vw, 2rem)", fontWeight: 700, color: "var(--sw-text)", margin: 0, letterSpacing: "-0.01em" }}>
                {inspeccionEditandoId ? `Editar Inspección #${inspeccionEditandoId}` : "Inspección de Recepción"}
              </h1>
              <p style={{ fontSize: "0.85rem", color: "var(--sw-muted)", marginTop: "0.35rem", marginBottom: 0 }}>
                Registro de entrada · datos del vehículo y servicios acordados
              </p>
            </div>
            <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
              <button type="button" onClick={volver}
                style={{ background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)", color: "var(--sw-muted)", borderRadius: "9px", padding: "0.4rem 1rem", fontSize: "0.84rem", cursor: "pointer" }}>
                ← Volver
              </button>
              {isAdmin && (
                <Link to="/inspecciones-guardadas"
                  style={{ background: "color-mix(in srgb, var(--sw-accent) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--sw-accent) 35%, transparent)", color: "var(--sw-accent)", borderRadius: "9px", padding: "0.4rem 1rem", fontSize: "0.84rem", textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
                  Ver guardadas
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container py-4" style={{ maxWidth: "900px", animation: "sw-fade-up 0.45s ease 0.05s both" }}>

        {/* ALERTS */}
        {formError && (
          <div style={{ background: "color-mix(in srgb, var(--sw-danger) 12%, var(--sw-surface))", border: "1px solid color-mix(in srgb, var(--sw-danger) 35%, transparent)", borderRadius: "10px", padding: "0.85rem 1rem", marginBottom: "1rem", display: "flex", justifyContent: "space-between", alignItems: "flex-start", color: "var(--sw-danger)" }}>
            <span>⚠ {formError}</span>
            <button type="button" className="btn-close btn-sm" onClick={() => setFormError("")} />
          </div>
        )}
        {/* BANNER SIGUIENTE (arriba) */}
        {inspeccionCreada && (
          <div style={{ background: "color-mix(in srgb, var(--sw-success) 10%, var(--sw-surface))", border: "1px solid color-mix(in srgb, var(--sw-success) 30%, transparent)", borderRadius: "12px", padding: "1rem 1.25rem", color: "var(--sw-success)", marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
            <div>
              <div>✦ Inspección #{inspeccionCreada.id} creada correctamente</div>
              <small style={{ opacity: 0.8 }}>Partes de trabajo creados automáticamente</small>
            </div>
            <button
              type="button"
              onClick={() => navigate(`/vehiculo-detalle/${inspeccionCreada.id}`)}
              style={{ background: "#22c55e", border: "none", color: "#ffffff", fontWeight: 600, fontSize: "0.9rem", borderRadius: "8px", padding: "0.6rem 1.2rem", cursor: "pointer", whiteSpace: "nowrap" }}
            >
              Siguiente →
            </button>
          </div>
        )}

        {/* FORM */}
        <form onSubmit={handleSubmit}>

          {/* DATOS CLIENTE Y VEHÍCULO */}
          <div style={_card}>
            <div style={_cardH}><span style={{ color: "var(--sw-accent)", marginRight: "0.5rem" }}>✦</span>Datos del cliente y vehículo</div>
            <div style={_cardB}>
              <div className="row g-3">

                <div className="col-12 col-md-6">
                  <label style={_lbl}>Nombre del cliente <span style={{ color: "#f87171" }}>*</span></label>
                  <input type="text" className="form-control" name="cliente_nombre" value={formData.cliente_nombre} onChange={handleInputChange} placeholder="Ej: Juan Pérez / Flexicar / YokaMotril" autoComplete="off" required style={_inp} />
                  <small style={{ color: "var(--sw-muted)", fontSize: "0.74rem", display: "block", marginTop: "0.35rem" }}>Dato manual obligatorio. No se vincula automáticamente por nombre.</small>
                </div>

                <div className="col-12 col-md-6">
                  <label style={_lbl}>Teléfono del cliente <span style={{ color: "var(--sw-danger)" }}>*</span></label>
                  <input type="tel" className="form-control" name="cliente_telefono" value={formData.cliente_telefono} onChange={handleInputChange} placeholder="Ej: 600123123" required style={_inp} />
                  <small style={{ color: "var(--sw-muted)", fontSize: "0.74rem", display: "block", marginTop: "0.35rem" }}>Dato manual obligatorio. No se vincula automáticamente por teléfono.</small>
                </div>

                {historialClienteCargando && (
                  <div className="col-12">
                    <div style={{
                      borderRadius: "10px",
                      padding: "0.7rem 0.9rem",
                      border: "1px solid color-mix(in srgb, var(--sw-accent) 30%, transparent)",
                      background: "color-mix(in srgb, var(--sw-accent) 8%, var(--sw-surface))",
                      color: "var(--sw-muted)",
                      fontSize: "0.82rem",
                    }}>
                      Revisando historial previo del cliente...
                    </div>
                  </div>
                )}

                {!historialClienteCargando && Number(historialClienteResumen?.total_trabajos || 0) > 0 && (
                  <div className="col-12">
                    <div style={{
                      borderRadius: "10px",
                      padding: "0.85rem 1rem",
                      border: "1px solid rgba(245,158,11,0.45)",
                      background: "rgba(245,158,11,0.12)",
                      color: "#fcd34d",
                    }}>
                      <div style={{ fontWeight: 700, fontSize: "0.88rem", marginBottom: "0.35rem" }}>
                        ⚠ Este coche ({historialClienteResumen?.matricula || String(formData.matricula || "").trim().toUpperCase()}) ya tiene {historialClienteResumen.total_trabajos} trabajo{historialClienteResumen.total_trabajos !== 1 ? "s" : ""} previo{historialClienteResumen.total_trabajos !== 1 ? "s" : ""} en particulares
                      </div>
                      {historialClienteResumen.ultimo_trabajo && (
                        <div style={{ fontSize: "0.8rem", color: "#fde68a" }}>
                          Último trabajo: <strong>{historialClienteResumen.ultimo_trabajo.trabajo || "Trabajo registrado"}</strong>
                          {" · "}Fecha: {formatHistorialDate(historialClienteResumen.ultimo_trabajo.fecha_entrega || historialClienteResumen.ultimo_trabajo.fecha_inspeccion)}
                          {historialClienteResumen.ultimo_trabajo.matricula ? ` · Matrícula: ${historialClienteResumen.ultimo_trabajo.matricula}` : ""}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="col-12 col-md-6">
                  <label style={_lbl}>Coche (Marca/Modelo) <span style={{ color: "var(--sw-danger)" }}>*</span></label>
                  <input type="text" className="form-control" name="coche_descripcion" value={formData.coche_descripcion} onChange={handleInputChange} placeholder="Ej: Ford Focus 2015" required style={_inp} />
                </div>

                <div className="col-12 col-md-6">
                  <label style={_lbl}>Coche existente del cliente (opcional)</label>
                  <select
                    className="form-select"
                    value={cocheExistenteSeleccionado}
                    onChange={handleCocheExistenteChange}
                    disabled={!formData.cliente_id || cochesClienteCargando || cochesCliente.length === 0}
                    style={_inp}
                  >
                    <option value="">
                      {!formData.cliente_id
                        ? "Selecciona primero un cliente existente..."
                        : cochesClienteCargando
                          ? "Cargando coches..."
                          : cochesCliente.length === 0
                            ? "Este cliente no tiene coches guardados"
                            : "Selecciona un coche del cliente..."}
                    </option>
                    {cochesCliente.map((coche) => (
                      <option key={coche.id} value={coche.id}>
                        {formatCocheExistenteLabel(coche)}
                      </option>
                    ))}
                  </select>
                  <small style={{ color: "var(--sw-muted)", fontSize: "0.74rem", display: "block", marginTop: "0.35rem" }}>
                    Si el cliente ya tiene coches registrados, al elegir uno se rellenan automáticamente la descripción y la matrícula.
                  </small>
                </div>

                <div className="col-12 col-md-6">
                  <label style={_lbl}>Matrícula <span style={{ color: "var(--sw-danger)" }}>*</span></label>
                  <input type="text" className="form-control" name="matricula" value={formData.matricula} onChange={handleInputChange} placeholder="Ej: 1234ABC" style={{ ..._inp, textTransform: "uppercase" }} required />
                </div>

                <div className="col-12 col-md-6">
                  <label style={_lbl}>Kilómetros <span style={{ color: "var(--sw-danger)" }}>*</span></label>
                  <input type="number" min="0" step="1" className="form-control" name="kilometros" value={formData.kilometros} onChange={handleInputChange} placeholder="Ej: 125000" required style={_inp} />
                </div>

                <div className="col-12">
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.75rem 1rem", background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)", borderRadius: "10px" }}>
                    <input className="form-check-input" type="checkbox" id="es_concesionario" name="es_concesionario" checked={Boolean(formData.es_concesionario)} onChange={handleInputChange} style={{ flexShrink: 0 }} />
                    <label className="form-check-label" htmlFor="es_concesionario" style={{ color: "var(--sw-text)", fontSize: "0.88rem", cursor: "pointer" }}>
                      Coche de concesionario / profesional — no se solicita firma de cliente en recepción
                    </label>
                  </div>
                </div>


              </div>
            </div>
          </div>

          {/* FOTOS */}
          <div style={{ ..._card, borderTopColor: "#6366f1" }}>
            <div style={_cardH}><span style={{ color: "#a5b4fc", marginRight: "0.5rem" }}>✦</span>Fotos del vehículo</div>
            <div style={_cardB}>
              <input
                ref={fotosCamaraRef}
                id="input-fotos-camara"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFotosChange}
                style={{ display: "none" }}
              />
              <input
                ref={fotosGaleriaRef}
                id="input-fotos-galeria"
                type="file"
                accept="image/*"
                multiple
                onChange={handleFotosChange}
                style={{ display: "none" }}
              />
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.6rem" }}>
                <label htmlFor="input-fotos-camara" style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.35)", color: "#a5b4fc", borderRadius: "10px", padding: "0.55rem 1.2rem", fontSize: "0.88rem", fontWeight: 600, cursor: "pointer" }}>
                  📷 Tomar foto
                </label>
                <label htmlFor="input-fotos-galeria" style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", color: "#a5b4fc", borderRadius: "10px", padding: "0.55rem 1.2rem", fontSize: "0.88rem", fontWeight: 600, cursor: "pointer" }}>
                  🖼 Galería (múltiples)
                </label>
              </div>
              <small style={{ color: "var(--sw-muted)", fontSize: "0.74rem" }}>"Tomar foto" abre la cámara · "Galería" permite seleccionar múltiples fotos</small>
              {fotosPreview.length > 0 && (
                <div className="row g-2 mt-3">
                  {fotosPreview.map((src, index) => (
                    <div key={index} className="col-6 col-sm-4 col-md-3 position-relative">
                      <img src={src} alt={`Preview ${index}`} style={{ width: "100%", height: "120px", objectFit: "cover", borderRadius: "8px", border: "1px solid var(--sw-border)" }} />
                      <button type="button" onClick={() => eliminarFoto(index)} style={{ position: "absolute", top: "6px", right: "6px", background: "rgba(239,68,68,0.8)", border: "none", color: "#fff", borderRadius: "6px", padding: "2px 8px", fontSize: "0.8rem", cursor: "pointer" }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ ..._card, borderTopColor: "#22d3ee" }}>
            <div style={_cardH}><span style={{ color: "#67e8f9", marginRight: "0.5rem" }}>✦</span>Fotos de microscopio</div>
            <div style={_cardB}>
              <input
                id="input-fotos-microscopio"
                type="file"
                accept="image/*"
                multiple
                onChange={handleFotosMicroscopioChange}
                style={{ display: "none" }}
              />
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.6rem" }}>
                <label htmlFor="input-fotos-microscopio" style={{ background: "rgba(34,211,238,0.12)", border: "1px solid rgba(34,211,238,0.3)", color: "#67e8f9", borderRadius: "10px", padding: "0.55rem 1.2rem", fontSize: "0.88rem", fontWeight: 600, cursor: "pointer" }}>
                  🔬 Subir fotos de microscopio
                </label>
              </div>
              <small style={{ color: "var(--sw-muted)", fontSize: "0.74rem" }}>Estas fotos se marcarán como microscopio y luego podrás asociarlas a la medición técnica.</small>
              {fotosMicroscopioPreview.length > 0 && (
                <div className="row g-2 mt-3">
                  {fotosMicroscopioPreview.map((src, index) => (
                    <div key={index} className="col-6 col-sm-4 col-md-3 position-relative">
                      <img src={src} alt={`Microscopio preview ${index}`} style={{ width: "100%", height: "120px", objectFit: "cover", borderRadius: "8px", border: "1px solid var(--sw-border)" }} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* VIDEOS */}
          <div style={{ ..._card, borderTopColor: "#ef4444" }}>
            <div style={_cardH}><span style={{ color: "#f87171", marginRight: "0.5rem" }}>✦</span>Videos del vehículo</div>
            <div style={_cardB}>
              <input
                ref={videosCamaraRef}
                id="input-videos-camara"
                type="file"
                accept="video/*"
                capture="environment"
                onChange={handleVideosChange}
                style={{ display: "none" }}
              />
              <input
                ref={videosGaleriaRef}
                id="input-videos-galeria"
                type="file"
                accept="video/*,video/mp4,video/mov,video/avi,video/quicktime,video/x-msvideo"
                multiple
                onChange={handleVideosChange}
                style={{ display: "none" }}
              />
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.6rem" }}>
                <label htmlFor="input-videos-camara" style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", borderRadius: "10px", padding: "0.55rem 1.2rem", fontSize: "0.88rem", fontWeight: 600, cursor: "pointer" }}>
                  🎬 Grabar video
                </label>
                <label htmlFor="input-videos-galeria" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", color: "#f87171", borderRadius: "10px", padding: "0.55rem 1.2rem", fontSize: "0.88rem", fontWeight: 600, cursor: "pointer" }}>
                  📹 Galería (múltiples)
                </label>
              </div>
              <small style={{ color: "var(--sw-muted)", fontSize: "0.74rem" }}>Formatos soportados: {FORMATOS_VIDEO_LABEL} · Tamaño máx: 500 MB por video</small>
              {videosPreview.length > 0 && (
                <div className="row g-2 mt-3">
                  {videosPreview.map((src, index) => (
                    <div key={index} className="col-12 col-sm-6 col-md-4 position-relative">
                      <video src={src} style={{ width: "100%", height: "180px", objectFit: "cover", borderRadius: "8px", border: "1px solid var(--sw-border)" }} controls />
                      <button type="button" onClick={() => eliminarVideo(index)} style={{ position: "absolute", top: "6px", right: "6px", background: "rgba(239,68,68,0.8)", border: "none", color: "#fff", borderRadius: "6px", padding: "2px 8px", fontSize: "0.8rem", cursor: "pointer" }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* OBSERVACIONES */}
          <div style={{ ..._card, borderTopColor: "rgba(212,175,55,0.3)" }}>
            <div style={_cardH}><span style={{ color: "#d4af37", marginRight: "0.5rem" }}>✦</span>Observaciones / Averías</div>
            <div style={_cardB}>
              <textarea
                className="form-control"
                name="averias_notas"
                value={formData.averias_notas}
                onChange={handleInputChange}
                rows="4"
                placeholder="Describe el estado del vehículo, daños visibles, etc."
                style={{ ..._inp, fontSize: "0.95rem", resize: "vertical" }}
              />
            </div>
          </div>

          <div style={{ ..._card, borderTopColor: "#0ea5e9" }}>
            <div style={_cardH}><span style={{ color: "#67e8f9", marginRight: "0.5rem" }}>✦</span>Lecturas iniciales de recepción</div>
            <div style={_cardB}>
              <p style={{ color: "var(--sw-muted)", fontSize: "0.82rem", marginBottom: "0.9rem" }}>
                Aquí guardas los valores iniciales. En la entrega se guardarán los valores finales y se calculará automáticamente la mejoría.
              </p>

              <datalist id="sw-partes-coche-lista-recepcion">
                {PARTES_COCHE_SUGERIDAS.map((pieza) => (
                  <option key={pieza} value={pieza} />
                ))}
              </datalist>

              <div style={{ marginBottom: "1rem", border: "1px solid var(--sw-border)", borderRadius: "12px", padding: "0.8rem", background: "var(--sw-surface-2)" }}>
                <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
                  <strong style={{ color: "var(--sw-text)", fontSize: "0.85rem" }}>Mapa del coche</strong>
                  <span style={{ color: "var(--sw-muted)", fontSize: "0.76rem" }}>
                    {targetMapaRecepcion ? `Objetivo activo: ${targetMapaRecepcion.tipo} #${targetMapaRecepcion.index + 1}` : "Pulsa 'Usar dibujo' en una medición"}
                  </span>
                </div>
                <div className="position-relative mx-auto" style={{ maxWidth: 500, width: "100%", aspectRatio: "5 / 9", border: "1px solid #d9e1ea", borderRadius: 14, background: "linear-gradient(180deg,#f9fcff,#eef4fb)" }}>
                  <svg viewBox="0 0 100 180" className="w-100 h-100" aria-hidden="true">
                    <rect x="20" y="8" width="60" height="164" rx="20" ry="20" fill="#dde7f3" stroke="#8ca0b8" strokeWidth="1.2" />
                    <rect x="30" y="26" width="40" height="24" rx="8" fill="#f7fbff" stroke="#a7b7ca" strokeWidth="1" />
                    <rect x="28" y="58" width="44" height="58" rx="10" fill="#f7fbff" stroke="#a7b7ca" strokeWidth="1" />
                    <rect x="30" y="124" width="40" height="24" rx="8" fill="#f7fbff" stroke="#a7b7ca" strokeWidth="1" />
                  </svg>
                  {MAPA_PARTES_COCHE.map((part) => (
                    <button
                      key={`mapa-rec-${part.label}`}
                      type="button"
                      className="btn btn-sm btn-light border position-absolute"
                      onClick={() => aplicarZonaMapaRecepcion(part.label)}
                      style={{ left: `${part.x}%`, top: `${part.y}%`, transform: "translate(-50%, -50%)", fontSize: 10, lineHeight: 1.1, padding: "2px 5px", whiteSpace: "nowrap" }}
                      title={part.label}
                    >
                      •
                    </button>
                  ))}
                </div>
                <div className="row g-2 mt-2">
                  <div className="col-12 col-md-8">
                    <input
                      className="form-control"
                      list="sw-partes-coche-lista-recepcion"
                      value={localizacionManualMapaRecepcion}
                      onChange={(e) => setLocalizacionManualMapaRecepcion(e.target.value)}
                      placeholder="O escribe localización manual"
                      style={_inp}
                    />
                  </div>
                  <div className="col-12 col-md-4">
                    <button
                      type="button"
                      onClick={aplicarLocalizacionManualMapaRecepcion}
                      style={{ background: "transparent", border: "1px solid var(--sw-border)", color: "var(--sw-muted)", borderRadius: "8px", padding: "0.5rem 0.65rem", fontSize: "0.78rem", width: "100%" }}
                    >
                      Aplicar manual
                    </button>
                  </div>
                </div>
              </div>

              {[{ key: "barniz", label: "Grosor de barniz (um)", unidad: "um" }, { key: "brillo", label: "Brillo glosómetro (GU)", unidad: "GU" }].map((block) => (
                <div key={`block-${block.key}`} style={{ border: "1px solid var(--sw-border)", borderRadius: "12px", padding: "0.8rem", marginBottom: "0.9rem" }}>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <strong style={{ color: "var(--sw-text)", fontSize: "0.84rem" }}>{block.label}</strong>
                    <button
                      type="button"
                      onClick={() => addMedicionRecepcion(block.key)}
                      style={{ background: "rgba(14,165,233,0.12)", border: "1px solid rgba(14,165,233,0.35)", color: "#38bdf8", borderRadius: "8px", padding: "0.35rem 0.8rem", fontSize: "0.8rem", fontWeight: 600 }}
                    >
                      + Añadir
                    </button>
                  </div>

                  {(medicionesRecepcion?.[block.key] || []).length === 0 && (
                    <div style={{ color: "var(--sw-muted)", fontSize: "0.78rem" }}>Sin lecturas registradas.</div>
                  )}

                  {(medicionesRecepcion?.[block.key] || []).map((item, idx) => {
                    const media = calcMedia(item.lecturas);
                    return (
                      <div key={`med-rec-${block.key}-${idx}`} style={{ border: "1px dashed var(--sw-border)", borderRadius: "10px", padding: "0.65rem", marginBottom: "0.6rem" }}>
                        <div className="row g-2">
                          <div className="col-12 col-md-3">
                            <label style={_lbl}>Zona</label>
                            <input className="form-control" value={item.zona || ""} onChange={(e) => updateMedicionRecepcionField(block.key, idx, "zona", e.target.value)} style={_inp} />
                          </div>
                          <div className="col-12 col-md-5">
                            <label style={_lbl}>Localización</label>
                            <input className="form-control" list="sw-partes-coche-lista-recepcion" value={item.localizacion || ""} onChange={(e) => updateMedicionRecepcionField(block.key, idx, "localizacion", e.target.value)} style={_inp} placeholder="Ej: Paragolpes delantero derecho" />
                          </div>
                          <div className="col-12 col-md-4 d-flex align-items-end justify-content-end gap-2">
                            <button type="button" onClick={() => seleccionarTargetMapaRecepcion(block.key, idx)} style={{ background: "transparent", border: "1px solid var(--sw-border)", color: "var(--sw-muted)", borderRadius: "8px", padding: "0.35rem 0.65rem", fontSize: "0.78rem" }}>Usar dibujo</button>
                            <button type="button" onClick={() => removeMedicionRecepcion(block.key, idx)} style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.35)", color: "#f87171", borderRadius: "8px", padding: "0.35rem 0.65rem", fontSize: "0.78rem" }}>Eliminar</button>
                          </div>
                          <div className="col-12">
                            <label style={_lbl}>Lecturas</label>
                            <textarea className="form-control" rows="2" value={lecturasToText(item.lecturas)} onChange={(e) => updateLecturasRecepcion(block.key, idx, e.target.value)} style={{ ..._inp, resize: "vertical" }} placeholder="98, 102, 101" />
                          </div>
                        </div>
                        <div style={{ color: "var(--sw-muted)", fontSize: "0.78rem", marginTop: "0.35rem" }}>
                          Media: <strong style={{ color: "var(--sw-text)" }}>{media !== null ? media.toFixed(2) : "-"}</strong> {block.unidad}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* SERVICIOS */}
          <div style={{ ..._card, borderTopColor: "#22c55e" }}>
            <div style={_cardH}><span style={{ color: "#6ee7b7", marginRight: "0.5rem" }}>✦</span>Servicios para esta recepción</div>
            <div style={_cardB}>

              {/* Tamaño del vehículo para precios por tramo */}
              <div style={{ marginBottom: "1rem" }}>
                <p style={{ ..._lbl, marginBottom: "0.5rem" }}>Tamaño del vehículo <span style={{ fontWeight: 400, color: "var(--sw-muted)", fontSize: "0.8rem" }}>(aplica el precio correcto a los servicios del catálogo)</span></p>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  {[
                    { key: "turismo", label: "Turismo" },
                    { key: "suv", label: "SUV / Minifurgoneta" },
                    { key: "todoterreno", label: "Todoterreno / Furgoneta" },
                  ].map(({ key, label }) => {
                    const active = tamanoVehiculo === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setTamanoVehiculo(active ? "" : key)}
                        style={{
                          padding: "0.4rem 0.85rem",
                          borderRadius: "999px",
                          border: active ? "1px solid rgba(212,175,55,0.5)" : "1px solid var(--sw-border)",
                          background: active ? "rgba(212,175,55,0.12)" : "var(--sw-surface-2)",
                          color: active ? "var(--sw-accent,#d4af37)" : "var(--sw-muted)",
                          fontWeight: 700,
                          fontSize: "0.82rem",
                          cursor: "pointer",
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Catálogo por rol */}
              <div style={{ marginBottom: "1.5rem" }}>
                <p style={{ ..._lbl, marginBottom: "0.75rem" }}>Catálogo activo</p>
                {catalogoServiciosCargando ? (
                  <p style={{ color: "var(--sw-muted)", fontSize: "0.85rem" }}>Cargando servicios del catálogo…</p>
                ) : catalogoServicios.length === 0 ? (
                  <p style={{ color: "var(--sw-muted)", fontSize: "0.85rem" }}>No hay servicios activos en catálogo.</p>
                ) : null}
                <div style={{ marginBottom: "0.85rem", background: "color-mix(in srgb, var(--sw-warning, #f59e0b) 10%, var(--sw-surface))", border: "1px solid color-mix(in srgb, var(--sw-warning, #f59e0b) 30%, transparent)", borderRadius: "10px", padding: "0.7rem 0.9rem", color: "var(--sw-text)", fontSize: "0.82rem" }}>
                  <strong>Paso importante:</strong> después de escoger un servicio pulsa <strong>+ Añadir servicio</strong> para que baje a <strong>Servicios añadidos</strong>. Si se te olvida pero lo dejas seleccionado, el sistema lo añadirá automáticamente al guardar.
                </div>
                {!catalogoServiciosCargando && serviciosCatalogoSinRol.length > 0 && (
                  <div style={{ marginBottom: "0.85rem", background: "color-mix(in srgb, var(--sw-warning, #f59e0b) 10%, var(--sw-surface))", border: "1px solid color-mix(in srgb, var(--sw-warning, #f59e0b) 30%, transparent)", borderRadius: "10px", padding: "0.7rem 0.9rem", color: "var(--sw-text)", fontSize: "0.82rem" }}>
                    Hay {serviciosCatalogoSinRol.length} servicio(s) en el catálogo sin un rol válido. Asígnales <strong>detailing</strong>, <strong>pintura</strong>, <strong>tapicería</strong> o <strong>calidad</strong> para que salgan aquí.
                  </div>
                )}
                {serviciosCatalogoPendientes.length > 0 && (
                  <div style={{ marginBottom: "0.85rem", background: "color-mix(in srgb, var(--sw-accent) 10%, var(--sw-surface))", border: "1px solid color-mix(in srgb, var(--sw-accent) 28%, transparent)", borderRadius: "10px", padding: "0.7rem 0.9rem", color: "var(--sw-text)", fontSize: "0.82rem" }}>
                    <strong>Pendiente por añadir:</strong> {serviciosCatalogoPendientes.map((servicio) => `${servicio.nombre} (${servicio.label})`).join(", ")}
                  </div>
                )}
                {CATALOG_ROLE_SECTIONS.map(({ rol, label, color }) => (
                  <details key={rol} style={{ marginBottom: "0.75rem", background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)", borderLeft: `3px solid ${color}`, borderRadius: "10px", overflow: "hidden" }} open>
                    <summary style={{ padding: "0.7rem 1rem", cursor: "pointer", fontWeight: 600, fontSize: "0.88rem", color: "var(--sw-text)", listStyle: "none", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ color, fontSize: "0.65rem" }}>▶</span> Servicios de {label}
                    </summary>
                    <div style={{ padding: "0.75rem 1rem", borderTop: "1px solid var(--sw-border)" }}>
                      {serviciosCatalogoPorRol[rol].length === 0 ? (
                        <span style={{ color: "var(--sw-muted)", fontSize: "0.82rem" }}>Sin servicios en este grupo.</span>
                      ) : (
                        <div className="d-flex flex-column flex-md-row gap-2">
                          <div className="flex-grow-1">
                            <select
                              key={`${rol}-${tamanoVehiculo}`}
                              className="form-select"
                              value={servicioCatalogoSeleccionado[rol]}
                              onChange={(e) => seleccionarServicioCatalogoPorRol(rol, e.target.value)}
                              style={_inp}
                            >
                              <option value="">Seleccionar servicio de {label.toLowerCase()}...</option>
                              {serviciosCatalogoPorRol[rol].map((s) => {
                                let precio = s.precio_base;
                                if (tamanoVehiculo === "turismo" && s.precio_turismo != null) precio = s.precio_turismo;
                                else if (tamanoVehiculo === "suv" && s.precio_suv != null) precio = s.precio_suv;
                                else if (tamanoVehiculo === "todoterreno" && s.precio_todoterreno != null) precio = s.precio_todoterreno;
                                else if (s.precio_turismo != null) precio = s.precio_turismo;
                                const precioStr = precio != null ? `${Number(precio).toFixed(0)} €` : "—";
                                const tiempoStr = Number(s.tiempo_estimado_minutos || 0) > 0 ? ` · ${Number(s.tiempo_estimado_minutos)} min` : "";
                                return (
                                  <option key={s.id} value={s.id}>
                                    {`${s.nombre} · ${precioStr}${tiempoStr}`}
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                          <button
                            type="button"
                            onClick={() => agregarServicioCatalogoPorRol(rol)}
                            disabled={!servicioCatalogoSeleccionado[rol]}
                            style={{
                              background: "color-mix(in srgb, var(--sw-accent) 12%, transparent)",
                              border: "1px solid color-mix(in srgb, var(--sw-accent) 35%, transparent)",
                              color: "var(--sw-accent)",
                              borderRadius: "9px",
                              padding: "0.4rem 1.1rem",
                              fontWeight: 600,
                              fontSize: "0.85rem",
                              cursor: servicioCatalogoSeleccionado[rol] ? "pointer" : "not-allowed",
                              opacity: servicioCatalogoSeleccionado[rol] ? 1 : 0.4,
                              whiteSpace: "nowrap"
                            }}
                          >
                            + Añadir servicio
                          </button>
                        </div>
                      )}
                    </div>
                  </details>
                ))}
              </div>

              {/* Servicio manual */}
              <div style={{ marginBottom: "1.5rem" }}>
                <p style={{ ..._lbl, marginBottom: "0.75rem" }}>Servicio manual</p>
                <div className="row g-2">
                  <div className="col-12 col-lg-5">
                    <input type="text" className="form-control" placeholder="Nombre del servicio" value={servicioManual.nombre} onChange={(e) => setServicioManual((prev) => ({ ...prev, nombre: e.target.value }))} style={_inp} />
                  </div>
                  <div className="col-6 col-lg-2">
                    <input type="number" className="form-control" min="0" step="0.01" placeholder="Precio (€)" value={servicioManual.precio} onChange={(e) => setServicioManual((prev) => ({ ...prev, precio: e.target.value }))} style={_inp} />
                  </div>
                  <div className="col-6 col-lg-1">
                    <input type="number" className="form-control" min="0" step="1" placeholder="Min" value={servicioManual.tiempo_estimado_minutos} onChange={(e) => setServicioManual((prev) => ({ ...prev, tiempo_estimado_minutos: e.target.value }))} style={_inp} />
                  </div>
                  <div className="col-6 col-lg-1">
                    <input type="number" className="form-control" min="0" step="0.25" placeholder="Hora" value={servicioManual.tiempo_estimado_horas} onChange={(e) => setServicioManual((prev) => ({ ...prev, tiempo_estimado_horas: e.target.value }))} style={_inp} />
                  </div>
                  <div className="col-8 col-lg-2">
                    <select className="form-select" value={servicioManual.tipo_tarea} onChange={(e) => setServicioManual((prev) => ({ ...prev, tipo_tarea: e.target.value }))} style={_inp}>
                      <option value="">Área...</option>
                      {ROLE_OPTIONS.map((r) => (<option key={r.value} value={r.value}>{r.label}</option>))}
                    </select>
                  </div>
                  <div className="col-4 col-lg-1 d-grid">
                    <button type="button" onClick={agregarServicioManual} style={{ background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)", color: "var(--sw-text)", borderRadius: "9px", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer" }}>
                      + Añadir
                    </button>
                  </div>
                </div>
                {servicioManualError && <p style={{ color: "var(--sw-danger)", fontSize: "0.78rem", marginTop: "0.4rem" }}>⚠ {servicioManualError}</p>}
                <small style={{ color: "var(--sw-muted)", fontSize: "0.74rem", display: "block", marginTop: "0.4rem" }}>
                  Puedes indicar minutos o horas (ej. 1.5 h = 90 min). Si completas ambos, se prioriza horas. El rol define a qué área se envía el parte.
                </small>
              </div>

              {/* Servicios añadidos */}
              <div>
                <p style={{ ..._lbl, marginBottom: "0.6rem" }}>Servicios añadidos</p>
                <div style={{ background: "color-mix(in srgb, var(--sw-success) 8%, var(--sw-surface))", border: "1px solid color-mix(in srgb, var(--sw-success) 22%, transparent)", borderRadius: "8px", padding: "0.6rem 1rem", marginBottom: "0.85rem", color: "var(--sw-success)", fontSize: "0.82rem" }}>
                  Al guardar esta recepción se crearán automáticamente partes de trabajo por cada servicio según su rol.
                </div>
                {(formData.servicios_aplicados || []).length === 0 ? (
                  <div style={{ color: "var(--sw-muted)", fontSize: "0.83rem", borderRadius: "10px", padding: "0.9rem 1rem", border: "1px dashed var(--sw-border)", textAlign: "center" }}>
                    No hay servicios añadidos aún.
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                      <thead>
                        <tr style={{ background: "var(--sw-surface-2)" }}>
                          {["Tipo", "Nombre", "Precio", "Tiempo", "Rol", ""].map((h) => (
                            <th key={h} style={{ padding: "0.5rem 0.75rem", color: "var(--sw-muted)", fontWeight: 600, textTransform: "uppercase", fontSize: "0.68rem", letterSpacing: "0.07em", borderBottom: "1px solid var(--sw-border)", whiteSpace: "nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(formData.servicios_aplicados || []).map((servicio, index) => (
                          <tr key={`${servicio.nombre}-${index}`} style={{ borderBottom: "1px solid var(--sw-border)" }}>
                            <td style={{ padding: "0.5rem 0.75rem" }}>
                              <span style={{ background: servicio.origen === "catalogo" ? "rgba(99,102,241,0.15)" : "rgba(107,114,128,0.15)", color: servicio.origen === "catalogo" ? "#a5b4fc" : "#9ca3af", borderRadius: "5px", padding: "0.1rem 0.5rem", fontSize: "0.72rem" }}>
                                {servicio.origen === "catalogo" ? "Catálogo" : "Manual"}
                              </span>
                            </td>
                            <td style={{ padding: "0.5rem 0.75rem", color: "var(--sw-text)", fontWeight: 500 }}>{servicio.nombre}</td>
                            <td style={{ padding: "0.5rem 0.75rem", color: "var(--sw-accent)", fontWeight: 600 }}>{Number(servicio.precio || 0).toFixed(2)} €</td>
                            <td style={{ padding: "0.5rem 0.75rem", color: "var(--sw-muted)" }}>{Number(servicio.tiempo_estimado_minutos || 0)} min</td>
                            <td style={{ padding: "0.5rem 0.75rem" }}>
                              <select className="form-select form-select-sm" value={normalizeRol(servicio.tipo_tarea || "")} onChange={(e) => actualizarRolServicioAplicado(index, e.target.value)}
                                style={{ background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)", color: "var(--sw-text)", borderRadius: "7px", fontSize: "0.78rem" }}>
                                <option value="">Área...</option>
                                {ROLE_OPTIONS.map((r) => (<option key={r.value} value={r.value}>{r.label}</option>))}
                              </select>
                            </td>
                            <td style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>
                              <button type="button" onClick={() => eliminarServicioAplicado(index)}
                                style={{ background: "color-mix(in srgb, var(--sw-danger) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--sw-danger) 28%, transparent)", color: "var(--sw-danger)", borderRadius: "7px", padding: "0.2rem 0.65rem", fontSize: "0.78rem", cursor: "pointer" }}>
                                Quitar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ borderTop: "1px solid color-mix(in srgb, var(--sw-accent) 22%, var(--sw-border))", background: "color-mix(in srgb, var(--sw-accent) 5%, transparent)" }}>
                          <th colSpan="2" style={{ padding: "0.55rem 0.75rem", color: "var(--sw-muted)", fontSize: "0.78rem" }}>Total</th>
                          <th style={{ padding: "0.55rem 0.75rem", color: "var(--sw-accent)" }}>
                            {(formData.servicios_aplicados || []).reduce((acc, s) => acc + (Number(s.precio || 0) || 0), 0).toFixed(2)} €
                          </th>
                          <th style={{ padding: "0.55rem 0.75rem", color: "var(--sw-muted)" }}>
                            {(formData.servicios_aplicados || []).reduce((acc, s) => acc + (Number.parseInt(s.tiempo_estimado_minutos || 0, 10) || 0), 0)} min
                          </th>
                          <th /><th />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* CONSENTIMIENTO + FIRMA */}
          <div className="row g-3" style={{ marginBottom: "1.5rem" }}>
            <div className="col-12 col-lg-6">
              <div style={{ background: "var(--sw-surface)", border: "1px solid var(--sw-border)", borderTop: "3px solid color-mix(in srgb, var(--sw-accent) 35%, transparent)", borderRadius: "18px", padding: "1.25rem", height: "100%" }}>
                <p style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--sw-accent)", margin: "0 0 0.75rem" }}>Protección de datos y consentimiento</p>
                <p style={{ color: "var(--sw-muted)", fontSize: "0.82rem", lineHeight: 1.5, marginBottom: "0.6rem" }}>
                  Los datos del cliente, del vehículo y la firma digital se registran para gestionar la recepción, documentar el estado del coche y generar el expediente de trabajo.
                </p>
                <p style={{ color: "var(--sw-muted)", fontSize: "0.82rem", lineHeight: 1.5, marginBottom: "0.75rem" }}>
                  La firma en tablet queda guardada como constancia de conformidad en recepción.
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.65rem 0.85rem", background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)", borderRadius: "9px" }}>
                  <input className="form-check-input" type="checkbox" id="consentimiento_datos_recepcion" name="consentimiento_datos_recepcion"
                    checked={formData.es_concesionario ? true : formData.consentimiento_datos_recepcion}
                    onChange={handleInputChange} disabled={formData.es_concesionario} style={{ flexShrink: 0 }} />
                  <label className="form-check-label" htmlFor="consentimiento_datos_recepcion" style={{ color: "var(--sw-text)", fontSize: "0.85rem", cursor: formData.es_concesionario ? "default" : "pointer" }}>
                    {formData.es_concesionario
                      ? "Consentimiento interno aplicado automáticamente para cliente profesional."
                      : "Confirmo que el cliente acepta este registro interno y la firma digital de recepción."}
                  </label>
                </div>
              </div>
            </div>
            <div className="col-12 col-lg-6">
              <div style={{ background: "var(--sw-surface)", border: "1px solid var(--sw-border)", borderTop: "3px solid color-mix(in srgb, var(--sw-accent) 35%, transparent)", borderRadius: "18px", padding: "1.25rem", height: "100%" }}>
                <p style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--sw-accent)", margin: "0 0 0.75rem" }}>Firma de recepción</p>
                {formData.es_concesionario ? (
                  <div style={{ padding: "1.5rem", background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)", borderRadius: "10px" }}>
                    <small style={{ color: "var(--sw-muted)" }}>En cliente profesional no se solicita firma del cliente en recepción.</small>
                  </div>
                ) : (
                  <SignaturePad
                    title="Firma Cliente"
                    height={150}
                    value={formData.firma_cliente_recepcion}
                    onChange={(firma) => setFormData((prev) => ({ ...prev, firma_cliente_recepcion: firma }))}
                  />
                )}
                <small style={{ color: "var(--sw-muted)", fontSize: "0.74rem", display: "block", marginTop: "0.5rem" }}>
                  {formData.es_concesionario
                    ? "En modo profesional no se requiere firma en recepción."
                    : "La firma del cliente es obligatoria para dejar constancia de la revisión en recepción."}
                </small>
              </div>
            </div>
          </div>

          {/* SUBMIT */}
          <div className="d-flex flex-column flex-md-row justify-content-center gap-2 mb-5">
            {inspeccionEditandoId && (
              <button type="button" onClick={cancelarEdicion} disabled={guardando || cargandoEdicion}
                style={{ background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)", color: "var(--sw-muted)", borderRadius: "12px", padding: "0.85rem 2rem", fontSize: "1rem", cursor: "pointer", fontWeight: 600 }}>
                Cancelar edición
              </button>
            )}
            <button type="submit" disabled={guardando || cargandoEdicion}
              style={{ background: guardando || cargandoEdicion ? "rgba(212,175,55,0.4)" : "linear-gradient(135deg,#f5e19a,#d4af37)", border: "none", color: "#0a0b0e", fontWeight: 800, fontSize: "1rem", borderRadius: "12px", padding: "0.85rem 2.5rem", cursor: guardando || cargandoEdicion ? "not-allowed" : "pointer", letterSpacing: "0.03em", minWidth: "220px" }}>
              {cargandoEdicion ? "⏳ Cargando inspección..." : guardando ? "⏳ Guardando..." : inspeccionEditandoId ? "💾 Actualizar inspección" : "✦ Guardar inspección"}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};

export default InspeccionRecepcionPage;

