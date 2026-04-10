import React, { useEffect, useState, useContext, useRef, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Context } from "../store/appContext";
import SignaturePad from "../components/SignaturePad.jsx";
import ProgressIndicator from "../components/ProgressIndicator.jsx";
import NextStepsModal from "../components/NextStepsModal.jsx";
import { getStoredRol, normalizeRol } from "../utils/authSession";
import "../styles/inspeccion-responsive.css";
import "../styles/progress-indicator.css";
import "../styles/next-steps-modal.css";

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

const MAX_VIDEO_SIZE_BYTES = 250 * 1024 * 1024; // 250 MB (1080p ~30fps, 1-2 min)
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

const normalizeText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const normalizePhoneDigits = (value) => String(value || "").replace(/\D/g, "");
const sameClientName = (cliente, nombre) => {
  if (!cliente) return false;
  const nombreManual = normalizeText(nombre);
  if (!nombreManual) return true;
  return normalizeText(cliente?.nombre) === nombreManual;
};
const sameClientPhone = (cliente, telefono) => {
  if (!cliente) return false;
  const telefonoManual = normalizePhoneDigits(telefono);
  if (!telefonoManual) return true;
  return normalizePhoneDigits(cliente?.telefono) === telefonoManual;
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
  const [videos, setVideos] = useState([]);
  const [fotosPreview, setFotosPreview] = useState([]);
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
  const [servicioManual, setServicioManual] = useState({
    nombre: "",
    precio: "",
    tiempo_estimado_minutos: "",
    tiempo_estimado_horas: "",
    tipo_tarea: "",
  });
  const [servicioCatalogoSeleccionado, setServicioCatalogoSeleccionado] = useState(EMPTY_CATALOG_SELECTION);
  const [showNextStepsModal, setShowNextStepsModal] = useState(false);
  const [esProfesional, setEsProfesional] = useState(false);
  const [clienteExistenteBusqueda, setClienteExistenteBusqueda] = useState("");
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
        setClienteExistenteBusqueda(
          inspeccion.cliente_nombre
            ? `${inspeccion.cliente_nombre}${inspeccion.cliente_telefono ? ` · ${inspeccion.cliente_telefono}` : ""}`
            : ""
        );
        setInspeccionEditandoId(inspeccion.id);
        setFotos([]);
        setVideos([]);
        setFotosPreview([]);
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
  }, [actions, searchParams]);

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

  const buscarClientePorNombre = (nombre) => {
    const nombreNormalizado = normalizeText(nombre);
    if (!nombreNormalizado) return null;

    return (
      clientesDisponibles.find((c) => normalizeText(c?.nombre) === nombreNormalizado) || null
    );
  };

  const buscarClientePorTelefono = (telefono) => {
    const telefonoDigits = normalizePhoneDigits(telefono);
    if (!telefonoDigits) return null;

    const coincidencias = clientesDisponibles.filter((c) => {
      const candidatoDigits = normalizePhoneDigits(c?.telefono);
      if (!candidatoDigits) return false;
      return (
        candidatoDigits === telefonoDigits ||
        candidatoDigits.startsWith(telefonoDigits) ||
        telefonoDigits.startsWith(candidatoDigits)
      );
    });

    if (coincidencias.length === 1) return coincidencias[0];

    const exacta = coincidencias.find((c) => normalizePhoneDigits(c?.telefono) === telefonoDigits);
    return exacta || null;
  };

  const formatClienteExistenteLabel = (cliente) => {
    if (!cliente) return "";
    const nombre = String(cliente?.nombre || "Sin nombre").trim();
    const telefono = String(cliente?.telefono || "").trim();
    return telefono ? `${nombre} · ${telefono}` : nombre;
  };

  const buscarClienteExistentePorBusqueda = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return null;

    const nombreBase = raw.split("·")[0]?.trim() || raw;
    const nombreNormalizado = normalizeText(nombreBase);
    const telefonoDigits = normalizePhoneDigits(raw);

    return clientesDisponibles.find((cliente) => {
      const nombreCliente = normalizeText(cliente?.nombre);
      const telefonoCliente = normalizePhoneDigits(cliente?.telefono);
      return (
        (nombreNormalizado && nombreCliente === nombreNormalizado) ||
        (telefonoDigits && telefonoCliente && telefonoCliente === telefonoDigits)
      );
    }) || null;
  };

  const handleClienteExistenteChange = (e) => {
    const rawValue = String(e.target.value || "");
    setClienteExistenteBusqueda(rawValue);

    if (!rawValue.trim()) {
      setFormData((prev) => ({
        ...prev,
        cliente_id: "",
      }));
      return;
    }

    const cliente = buscarClienteExistentePorBusqueda(rawValue);
    if (!cliente) return;

    setFormData((prev) => ({
      ...prev,
      cliente_id: String(cliente.id || ""),
      cliente_nombre: cliente?.nombre || prev.cliente_nombre,
      cliente_telefono: cliente?.telefono || prev.cliente_telefono,
    }));
    setClienteExistenteBusqueda(formatClienteExistenteLabel(cliente));
  };

  const clientesExistentesSugeridos = useMemo(() => {
    const texto = normalizeText(clienteExistenteBusqueda || formData.cliente_nombre);
    const telefono = normalizePhoneDigits(clienteExistenteBusqueda);
    const listaOrdenada = [...clientesDisponibles].sort((a, b) => String(a?.nombre || "").localeCompare(String(b?.nombre || ""), "es"));

    if (!texto && !telefono) return listaOrdenada.slice(0, 40);

    return listaOrdenada.filter((cliente) => {
      const nombre = normalizeText(cliente?.nombre);
      const tel = normalizePhoneDigits(cliente?.telefono);
      return (
        (texto && nombre.includes(texto)) ||
        (telefono && tel.includes(telefono))
      );
    }).slice(0, 40);
  }, [clientesDisponibles, clienteExistenteBusqueda, formData.cliente_nombre]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    const nextValue = type === "checkbox" ? checked : value;

    if (name === "cliente_nombre") {
      const clienteCoincidente = buscarClientePorNombre(value);
      setFormData((prev) => {
        const vincularCliente = Boolean(
          clienteCoincidente?.id && sameClientPhone(clienteCoincidente, prev.cliente_telefono)
        );
        return {
          ...prev,
          cliente_id: vincularCliente ? String(clienteCoincidente.id) : "",
          cliente_nombre: value,
          cliente_telefono: !prev.cliente_telefono && vincularCliente
            ? (clienteCoincidente?.telefono || "")
            : prev.cliente_telefono,
        };
      });
      return;
    }

    if (name === "cliente_telefono") {
      const clienteCoincidente = buscarClientePorTelefono(value);
      setFormData((prev) => {
        const vincularCliente = Boolean(
          clienteCoincidente?.id && sameClientName(clienteCoincidente, prev.cliente_nombre)
        );
        return {
          ...prev,
          cliente_id: vincularCliente ? String(clienteCoincidente.id) : "",
          cliente_nombre: !prev.cliente_nombre && vincularCliente
            ? (clienteCoincidente?.nombre || "")
            : prev.cliente_nombre,
          cliente_telefono: value,
        };
      });
      return;
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

      return {
        ...prev,
        servicios_aplicados: [
          ...existentes,
          {
            origen: "catalogo",
            servicio_catalogo_id: servicioId,
            nombre: servicio.nombre || "Servicio",
            precio: Number(servicio.precio_base || 0),
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

  const appendFilePreviews = (archivos, setPreviewState) => {
    archivos.forEach((archivo) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPreviewState((prev) => [...prev, event.target.result]);
      };
      reader.readAsDataURL(archivo);
    });
  };

  const handleFotosChange = (e) => {
    const archivos = Array.from(e.target.files);
    if (archivos.length === 0) return;

    setFotos((prev) => [...prev, ...archivos]);
    appendFilePreviews(archivos, setFotosPreview);
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
      avisos.push(`Videos demasiado grandes (máx 250 MB): ${videosGrandes.join(", ")}`);
    if (formatosInvalidos.length > 0)
      avisos.push(`Formatos no válidos (acepta: ${FORMATOS_VIDEO_LABEL}): ${formatosInvalidos.join(", ")}`);
    if (avisos.length > 0) setFormError(avisos.join(" · "));

    if (videosValidos.length === 0) return;

    setVideos((prev) => [...prev, ...videosValidos]);
    appendFilePreviews(videosValidos, setVideosPreview);
  };

  const eliminarFoto = (index) => {
    setFotos((prev) => prev.filter((_, i) => i !== index));
    setFotosPreview((prev) => prev.filter((_, i) => i !== index));
  };

  const eliminarVideo = (index) => {
    setVideos((prev) => prev.filter((_, i) => i !== index));
    setVideosPreview((prev) => prev.filter((_, i) => i !== index));
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
        cliente_id: formData.cliente_id ? Number.parseInt(formData.cliente_id, 10) : null,
        kilometros,
        servicios_aplicados: serviciosPayload
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

      const { subidos: fotosSubidas, fallidos: fotosFallidas } = await subirArchivos({
        inspeccionId: inspeccion.id,
        archivos: fotos,
        subirArchivo: actions.subirFotoInspeccion
      });

      const { subidos: videosSubidos, fallidos: videosFallidos } = await subirArchivos({
        inspeccionId: inspeccion.id,
        archivos: videos,
        subirArchivo: actions.subirVideoInspeccion,
        validarAntes: (video) => {
          if (video.size <= MAX_VIDEO_SIZE_BYTES) return null;
          const videoSize = formatFileSizeMB(video.size);
          return `⚠️ El video "${video.name}" es muy grande (${videoSize} MB). Máximo: 250 MB`;
        }
      });

      window.scrollTo({ top: 0, behavior: "smooth" });

      // Limpiar formulario
      setFormData(INITIAL_FORM_DATA);
      setClienteExistenteBusqueda("");
      setServicioManual({ nombre: "", precio: "", tiempo_estimado_minutos: "", tiempo_estimado_horas: "", tipo_tarea: "" });
      setFotos([]);
      setVideos([]);
      setFotosPreview([]);
      setVideosPreview([]);
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
    setClienteExistenteBusqueda("");
    setServicioManual({ nombre: "", precio: "", tiempo_estimado_minutos: "", tiempo_estimado_horas: "", tipo_tarea: "" });
    setFotos([]);
    setVideos([]);
    setFotosPreview([]);
    setVideosPreview([]);
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

      const servicioNormalizado = {
        origen: "catalogo",
        servicio_catalogo_id: Number(servicio.id),
        nombre: servicio.nombre || "Servicio",
        precio: Number(servicio.precio_base || 0),
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
                Panel de gestión · SpecialWash
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
                  <input type="text" className="form-control" name="cliente_nombre" value={formData.cliente_nombre} onChange={handleInputChange} placeholder="Ej: Monique / Taller Acme" list="clientes-existentes" autoComplete="off" required style={_inp} />
                  <datalist id="clientes-existentes">
                    {clientesDisponibles.map((c) => String(c?.nombre || "").trim()).filter((n, i, a) => n && a.indexOf(n) === i).sort((a, b) => a.localeCompare(b, "es")).map((n) => (<option key={n} value={n} />))}
                  </datalist>
                  <small style={{ color: "var(--sw-muted)", fontSize: "0.74rem", display: "block", marginTop: "0.35rem" }}>Primero escribe el nombre. Si ya existe, puedes seleccionarlo justo al lado.</small>
                </div>

                <div className="col-12 col-md-6">
                  <label style={_lbl}>Cliente existente (opcional)</label>
                  <input
                    type="text"
                    className="form-control"
                    name="cliente_existente_busqueda"
                    value={clienteExistenteBusqueda}
                    onChange={handleClienteExistenteChange}
                    placeholder="Busca cliente ya creado: Toyota"
                    list="clientes-registrados-busqueda"
                    autoComplete="off"
                    style={_inp}
                  />
                  <datalist id="clientes-registrados-busqueda">
                    {clientesExistentesSugeridos.map((cliente) => {
                      const label = formatClienteExistenteLabel(cliente);
                      return <option key={cliente.id} value={label} />;
                    })}
                  </datalist>
                  <small style={{ color: "var(--sw-muted)", fontSize: "0.74rem", display: "block", marginTop: "0.35rem" }}>Si existe, escribe por ejemplo <strong>Toyota</strong> y selecciónalo para traer sus datos. Si no, sigues rellenando normal.</small>
                </div>

                <div className="col-12 col-md-6">
                  <label style={_lbl}>Teléfono del cliente <span style={{ color: "var(--sw-danger)" }}>*</span></label>
                  <input type="tel" className="form-control" name="cliente_telefono" value={formData.cliente_telefono} onChange={handleInputChange} placeholder="Ej: 600123123" list="telefonos-existentes" required style={_inp} />
                  <datalist id="telefonos-existentes">
                    {clientesDisponibles.map((c) => ({ id: c?.id, telefono: String(c?.telefono || "").trim(), nombre: String(c?.nombre || "").trim() })).filter((i) => i.telefono).sort((a, b) => a.telefono.localeCompare(b.telefono, "es")).map((i) => (<option key={`${i.id}-${i.telefono}`} value={i.telefono}>{i.nombre}</option>))}
                  </datalist>
                  <small style={{ color: "var(--sw-muted)", fontSize: "0.74rem", display: "block", marginTop: "0.35rem" }}>Al escribir un teléfono existente se vincula el cliente automáticamente.</small>
                </div>

                <div className="col-12 col-md-6">
                  <label style={_lbl}>Coche (Marca/Modelo) <span style={{ color: "var(--sw-danger)" }}>*</span></label>
                  <input type="text" className="form-control" name="coche_descripcion" value={formData.coche_descripcion} onChange={handleInputChange} placeholder="Ej: Ford Focus 2015" required style={_inp} />
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
              <small style={{ color: "var(--sw-muted)", fontSize: "0.74rem" }}>Formatos soportados: {FORMATOS_VIDEO_LABEL} · Tamaño máx: 250 MB por video</small>
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

          {/* SERVICIOS */}
          <div style={{ ..._card, borderTopColor: "#22c55e" }}>
            <div style={_cardH}><span style={{ color: "#6ee7b7", marginRight: "0.5rem" }}>✦</span>Servicios para esta recepción</div>
            <div style={_cardB}>

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
                              className="form-select"
                              value={servicioCatalogoSeleccionado[rol]}
                              onChange={(e) => seleccionarServicioCatalogoPorRol(rol, e.target.value)}
                              style={_inp}
                            >
                              <option value="">Seleccionar servicio de {label.toLowerCase()}...</option>
                              {serviciosCatalogoPorRol[rol].map((s) => (
                                <option key={s.id} value={s.id}>
                                  {`${s.nombre} · ${Number(s.precio_base || 0).toFixed(2)} €${Number(s.tiempo_estimado_minutos || 0) > 0 ? ` · ${Number(s.tiempo_estimado_minutos)} min` : ""}`}
                                </option>
                              ))}
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

