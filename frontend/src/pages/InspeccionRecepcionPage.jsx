import React, { useEffect, useState, useContext, useRef, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Context } from "../store/appContext";
import SignaturePad from "../component/SignaturePad.jsx";
import GoldSelect from "../component/GoldSelect.jsx";
import { getStoredRol, normalizeRol } from "../utils/authSession";
import "../styles/inspeccion-responsive.css";

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
  const tipo = normalizeRol(tipoRaw) || undefined;
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
  const [formSuccess, setFormSuccess] = useState("");
  const [servicioManualError, setServicioManualError] = useState("");
  const [inspeccionEditandoId, setInspeccionEditandoId] = useState(null);
  const [catalogoServicios, setCatalogoServicios] = useState([]);
  const [clientesDisponibles, setClientesDisponibles] = useState([]);
  const [servicioManual, setServicioManual] = useState({
    nombre: "",
    precio: "",
    tiempo_estimado_minutos: "",
    tiempo_estimado_horas: "",
    tipo_tarea: "",
  });
  const [servicioCatalogoSeleccionado, setServicioCatalogoSeleccionado] = useState({
    detailing: "",
    pintura: "",
    tapicero: "",
  });
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
      try {
        const servicios = await actions.getServiciosCatalogo(true);
        if (active) setCatalogoServicios(Array.isArray(servicios) ? servicios : []);
      } catch {
        if (active) setCatalogoServicios([]);
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

  const handleClienteExistenteChange = (e) => {
    const selectedId = String(e.target.value || "").trim();
    if (!selectedId) {
      setFormData((prev) => ({
        ...prev,
        cliente_id: "",
      }));
      return;
    }

    const cliente = clientesDisponibles.find((c) => String(c?.id) === selectedId);
    if (!cliente) return;

    setFormData((prev) => ({
      ...prev,
      cliente_id: selectedId,
      cliente_nombre: cliente?.nombre || "",
      cliente_telefono: cliente?.telefono || "",
    }));
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    const nextValue = type === "checkbox" ? checked : value;

    if (name === "cliente_nombre") {
      const clienteCoincidente = buscarClientePorNombre(value);
      setFormData((prev) => ({
        ...prev,
        cliente_id: clienteCoincidente?.id ? String(clienteCoincidente.id) : "",
        cliente_nombre: value,
        cliente_telefono: clienteCoincidente?.telefono || prev.cliente_telefono
      }));
      return;
    }

    if (name === "cliente_telefono") {
      const clienteCoincidente = buscarClientePorTelefono(value);
      setFormData((prev) => ({
        ...prev,
        cliente_id: clienteCoincidente?.id ? String(clienteCoincidente.id) : "",
        cliente_nombre: clienteCoincidente?.nombre || prev.cliente_nombre,
        cliente_telefono: value,
      }));
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
            tipo_tarea: normalizeRol(servicio.rol_responsable || "") || "otro",
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
    setFormSuccess("");

    if (!formData.cliente_nombre || !formData.cliente_telefono ||
        !formData.coche_descripcion || !formData.matricula || !formData.kilometros) {
      setFormError("Completa todos los campos obligatorios antes de guardar.");
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
      const serviciosPayload = (formData.servicios_aplicados || []).map(mapServicioForPayload);
      const serviciosSinRol = serviciosPayload.filter((servicio) => !normalizeRol(servicio?.tipo_tarea || ""));
      if (serviciosSinRol.length > 0) {
        setFormError("Todos los servicios deben tener un rol/área asignado para enrutar correctamente el parte.");
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

      // Mensaje de resultado
      let mensaje = inspeccionEditandoId
        ? `✅ Inspección #${inspeccion.id} actualizada correctamente`
        : `✅ Inspección #${inspeccion.id} creada correctamente`;
      if (fotosSubidas > 0) mensaje += `\n📸 ${fotosSubidas} foto(s) subida(s)`;
      if (fotosFallidas > 0) mensaje += `\n⚠️ ${fotosFallidas} foto(s) fallaron`;
      if (videosSubidos > 0) mensaje += `\n🎥 ${videosSubidos} video(s) subido(s)`;
      if (videosFallidos > 0) mensaje += `\n⚠️ ${videosFallidos} video(s) fallaron`;

      setFormSuccess(mensaje);
      window.scrollTo({ top: 0, behavior: "smooth" });

      // Limpiar formulario
      setFormData(INITIAL_FORM_DATA);
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
    const grupos = {
      detailing: [],
      pintura: [],
      tapicero: [],
    };

    for (const servicio of catalogoServicios || []) {
      const rolServicio = normalizeRol(servicio?.rol_responsable || servicio?.tipo_tarea || "");
      if (rolServicio === "detailing" || rolServicio === "pintura" || rolServicio === "tapicero") {
        grupos[rolServicio].push(servicio);
      }
    }

    return grupos;
  }, [catalogoServicios]);

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

  const _inp = { background: "#131620", border: "1px solid rgba(255,255,255,0.1)", color: "#eef2f7", borderRadius: "10px" };
  const _lbl = { color: "rgba(200,209,224,0.75)", fontSize: "0.78rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.4rem" };
  const _card = { background: "#0e1219", border: "1px solid rgba(255,255,255,0.07)", borderTop: "3px solid #d4af37", borderRadius: "18px", overflow: "hidden", marginBottom: "1.5rem" };
  const _cardH = { padding: "1.1rem 1.25rem", borderBottom: "1px solid rgba(255,255,255,0.06)", fontWeight: 700, color: "#fff", fontSize: "0.95rem" };
  const _cardB = { padding: "1.25rem" };

  return (
    <div style={{ minHeight: "calc(100vh - 56px)", background: "radial-gradient(ellipse 70% 44% at 50% -10%, rgba(212,175,55,0.06) 0%, transparent 60%), linear-gradient(180deg, #08090d 0%, #0d1017 100%)", color: "#eef2f7" }}>

      {/* ── HERO ── */}
      <div style={{ borderBottom: "1px solid rgba(212,175,55,0.1)", padding: "1.75rem 0 1.5rem", animation: "sw-fade-up 0.4s ease both" }}>
        <div className="container" style={{ maxWidth: "900px" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "1.5rem", flexWrap: "wrap" }}>
            <div>
              <p style={{ fontSize: "0.73rem", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#d4af37", opacity: 0.85, marginBottom: "0.4rem" }}>
                Panel de gestión · SpecialWash
              </p>
              <h1 style={{ fontSize: "clamp(1.4rem, 3vw, 2rem)", fontWeight: 700, color: "#fff", margin: 0, letterSpacing: "-0.01em" }}>
                {inspeccionEditandoId ? `Editar Inspección #${inspeccionEditandoId}` : "Inspección de Recepción"}
              </h1>
              <p style={{ fontSize: "0.85rem", color: "rgba(200,209,224,0.55)", marginTop: "0.35rem", marginBottom: 0 }}>
                Registro de entrada · datos del vehículo y servicios acordados
              </p>
            </div>
            <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
              <button type="button" onClick={volver}
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(200,209,224,0.7)", borderRadius: "9px", padding: "0.4rem 1rem", fontSize: "0.84rem", cursor: "pointer" }}>
                ← Volver
              </button>
              {isAdmin && (
                <Link to="/inspecciones-guardadas"
                  style={{ background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.3)", color: "#d4af37", borderRadius: "9px", padding: "0.4rem 1rem", fontSize: "0.84rem", textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
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
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "10px", padding: "0.85rem 1rem", marginBottom: "1rem", display: "flex", justifyContent: "space-between", alignItems: "flex-start", color: "#fca5a5" }}>
            <span>⚠ {formError}</span>
            <button type="button" className="btn-close btn-close-white btn-sm" onClick={() => setFormError("")} />
          </div>
        )}
        {formSuccess && (
          <div style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: "10px", padding: "0.85rem 1rem", marginBottom: "1rem", display: "flex", justifyContent: "space-between", alignItems: "flex-start", color: "#6ee7b7" }}>
            <span style={{ whiteSpace: "pre-line" }}>{formSuccess}</span>
            <button type="button" className="btn-close btn-close-white btn-sm" onClick={() => setFormSuccess("")} />
          </div>
        )}

        {/* FORM */}
        <form onSubmit={handleSubmit}>

          {/* DATOS CLIENTE Y VEHÍCULO */}
          <div style={_card}>
            <div style={_cardH}><span style={{ color: "#d4af37", marginRight: "0.5rem" }}>✦</span>Datos del cliente y vehículo</div>
            <div style={_cardB}>
              <div className="row g-3">

                <div className="col-12 col-md-6">
                  <label style={_lbl}>Cliente existente (opcional)</label>
                  <select className="form-select" name="cliente_id" value={formData.cliente_id} onChange={handleClienteExistenteChange} style={_inp}>
                    <option value="">-- Selecciona cliente registrado --</option>
                    {clientesDisponibles.slice().sort((a, b) => String(a?.nombre || "").localeCompare(String(b?.nombre || ""), "es")).map((cliente) => (
                      <option key={cliente.id} value={cliente.id}>{cliente.nombre || "Sin nombre"}{cliente.telefono ? ` · ${cliente.telefono}` : ""}</option>
                    ))}
                  </select>
                  <small style={{ color: "rgba(200,209,224,0.38)", fontSize: "0.74rem", display: "block", marginTop: "0.35rem" }}>Si lo seleccionas, se reutiliza ese cliente y evita duplicados.</small>
                </div>

                <div className="col-12 col-md-6">
                  <label style={_lbl}>Nombre del cliente <span style={{ color: "#f87171" }}>*</span></label>
                  <input type="text" className="form-control" name="cliente_nombre" value={formData.cliente_nombre} onChange={handleInputChange} placeholder="Ej: Taller Acme" list="clientes-existentes" autoComplete="off" required style={_inp} />
                  <datalist id="clientes-existentes">
                    {clientesDisponibles.map((c) => String(c?.nombre || "").trim()).filter((n, i, a) => n && a.indexOf(n) === i).sort((a, b) => a.localeCompare(b, "es")).map((n) => (<option key={n} value={n} />))}
                  </datalist>
                  <small style={{ color: "rgba(200,209,224,0.38)", fontSize: "0.74rem", display: "block", marginTop: "0.35rem" }}>Escribe o selecciona nombre existente para rellenar automáticamente el teléfono.</small>
                </div>

                <div className="col-12 col-md-6">
                  <label style={_lbl}>Teléfono del cliente <span style={{ color: "#f87171" }}>*</span></label>
                  <input type="tel" className="form-control" name="cliente_telefono" value={formData.cliente_telefono} onChange={handleInputChange} placeholder="Ej: 600123123" list="telefonos-existentes" required style={_inp} />
                  <datalist id="telefonos-existentes">
                    {clientesDisponibles.map((c) => ({ id: c?.id, telefono: String(c?.telefono || "").trim(), nombre: String(c?.nombre || "").trim() })).filter((i) => i.telefono).sort((a, b) => a.telefono.localeCompare(b.telefono, "es")).map((i) => (<option key={`${i.id}-${i.telefono}`} value={i.telefono}>{i.nombre}</option>))}
                  </datalist>
                  <small style={{ color: "rgba(200,209,224,0.38)", fontSize: "0.74rem", display: "block", marginTop: "0.35rem" }}>Al escribir un teléfono existente se vincula el cliente automáticamente.</small>
                </div>

                <div className="col-12 col-md-6">
                  <label style={_lbl}>Coche (Marca/Modelo) <span style={{ color: "#f87171" }}>*</span></label>
                  <input type="text" className="form-control" name="coche_descripcion" value={formData.coche_descripcion} onChange={handleInputChange} placeholder="Ej: Ford Focus 2015" required style={_inp} />
                </div>

                <div className="col-12 col-md-6">
                  <label style={_lbl}>Matrícula <span style={{ color: "#f87171" }}>*</span></label>
                  <input type="text" className="form-control" name="matricula" value={formData.matricula} onChange={handleInputChange} placeholder="Ej: 1234ABC" style={{ ..._inp, textTransform: "uppercase" }} required />
                </div>

                <div className="col-12 col-md-6">
                  <label style={_lbl}>Kilómetros <span style={{ color: "#f87171" }}>*</span></label>
                  <input type="number" min="0" step="1" className="form-control" name="kilometros" value={formData.kilometros} onChange={handleInputChange} placeholder="Ej: 125000" required style={_inp} />
                </div>

                <div className="col-12">
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.75rem 1rem", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "10px" }}>
                    <input className="form-check-input" type="checkbox" id="es_concesionario" name="es_concesionario" checked={Boolean(formData.es_concesionario)} onChange={handleInputChange} style={{ flexShrink: 0 }} />
                    <label className="form-check-label" htmlFor="es_concesionario" style={{ color: "rgba(200,209,224,0.8)", fontSize: "0.88rem", cursor: "pointer" }}>
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
              <small style={{ color: "rgba(200,209,224,0.38)", fontSize: "0.74rem" }}>"Tomar foto" abre la cámara · "Galería" permite seleccionar múltiples fotos</small>
              {fotosPreview.length > 0 && (
                <div className="row g-2 mt-3">
                  {fotosPreview.map((src, index) => (
                    <div key={index} className="col-6 col-sm-4 col-md-3 position-relative">
                      <img src={src} alt={`Preview ${index}`} style={{ width: "100%", height: "120px", objectFit: "cover", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.08)" }} />
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
              <small style={{ color: "rgba(200,209,224,0.38)", fontSize: "0.74rem" }}>Formatos soportados: {FORMATOS_VIDEO_LABEL} · Tamaño máx: 250 MB por video</small>
              {videosPreview.length > 0 && (
                <div className="row g-2 mt-3">
                  {videosPreview.map((src, index) => (
                    <div key={index} className="col-12 col-sm-6 col-md-4 position-relative">
                      <video src={src} style={{ width: "100%", height: "180px", objectFit: "cover", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.08)" }} controls />
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
                {catalogoServicios.length === 0 && (
                  <p style={{ color: "rgba(200,209,224,0.4)", fontSize: "0.85rem" }}>No hay servicios activos en catálogo.</p>
                )}
                {[
                  { rol: "detailing", label: "Detailing", color: "#6366f1" },
                  { rol: "pintura",   label: "Pintura",   color: "#f87171" },
                  { rol: "tapicero",  label: "Tapicería", color: "#fbbf24" },
                ].map(({ rol, label, color }) => (
                  <details key={rol} style={{ marginBottom: "0.75rem", background: "#131620", border: "1px solid rgba(255,255,255,0.07)", borderLeft: `3px solid ${color}`, borderRadius: "10px", overflow: "hidden" }} open>
                    <summary style={{ padding: "0.7rem 1rem", cursor: "pointer", fontWeight: 600, fontSize: "0.88rem", color: "rgba(200,209,224,0.85)", listStyle: "none", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ color, fontSize: "0.65rem" }}>▶</span> Servicios de {label}
                    </summary>
                    <div style={{ padding: "0.75rem 1rem", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                      {serviciosCatalogoPorRol[rol].length === 0 ? (
                        <span style={{ color: "rgba(200,209,224,0.35)", fontSize: "0.82rem" }}>Sin servicios en este grupo.</span>
                      ) : (
                        <div className="d-flex flex-column flex-md-row gap-2">
                          <div className="flex-grow-1">
                            <GoldSelect
                              value={servicioCatalogoSeleccionado[rol]}
                              onChange={(value) => seleccionarServicioCatalogoPorRol(rol, value)}
                              placeholder={`Seleccionar servicio de ${label.toLowerCase()}...`}
                              searchable
                              options={serviciosCatalogoPorRol[rol].map((s) => ({
                                value: s.id,
                                label: `${s.nombre} · ${Number(s.precio_base || 0).toFixed(2)} €${Number(s.tiempo_estimado_minutos || 0) > 0 ? ` · ${Number(s.tiempo_estimado_minutos)} min` : ""}`,
                              }))}
                            />
                          </div>
                          <button type="button" onClick={() => agregarServicioCatalogoPorRol(rol)} disabled={!servicioCatalogoSeleccionado[rol]}
                            style={{ background: "rgba(212,175,55,0.12)", border: "1px solid rgba(212,175,55,0.3)", color: "#d4af37", borderRadius: "9px", padding: "0.4rem 1.1rem", fontWeight: 600, fontSize: "0.85rem", cursor: servicioCatalogoSeleccionado[rol] ? "pointer" : "not-allowed", opacity: servicioCatalogoSeleccionado[rol] ? 1 : 0.4, whiteSpace: "nowrap" }}>
                            + Añadir
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
                    <button type="button" onClick={agregarServicioManual} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#eef2f7", borderRadius: "9px", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer" }}>
                      + Añadir
                    </button>
                  </div>
                </div>
                {servicioManualError && <p style={{ color: "#f87171", fontSize: "0.78rem", marginTop: "0.4rem" }}>⚠ {servicioManualError}</p>}
                <small style={{ color: "rgba(200,209,224,0.35)", fontSize: "0.74rem", display: "block", marginTop: "0.4rem" }}>
                  Puedes indicar minutos o horas (ej. 1.5 h = 90 min). Si completas ambos, se prioriza horas. El rol define a qué área se envía el parte.
                </small>
              </div>

              {/* Servicios añadidos */}
              <div>
                <p style={{ ..._lbl, marginBottom: "0.6rem" }}>Servicios añadidos</p>
                <div style={{ background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: "8px", padding: "0.6rem 1rem", marginBottom: "0.85rem", color: "#6ee7b7", fontSize: "0.82rem" }}>
                  Al guardar esta recepción se crearán automáticamente partes de trabajo por cada servicio según su rol.
                </div>
                {(formData.servicios_aplicados || []).length === 0 ? (
                  <div style={{ color: "rgba(200,209,224,0.3)", fontSize: "0.83rem", borderRadius: "10px", padding: "0.9rem 1rem", border: "1px dashed rgba(255,255,255,0.07)", textAlign: "center" }}>
                    No hay servicios añadidos aún.
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                      <thead>
                        <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                          {["Tipo", "Nombre", "Precio", "Tiempo", "Rol", ""].map((h) => (
                            <th key={h} style={{ padding: "0.5rem 0.75rem", color: "rgba(200,209,224,0.4)", fontWeight: 600, textTransform: "uppercase", fontSize: "0.68rem", letterSpacing: "0.07em", borderBottom: "1px solid rgba(255,255,255,0.06)", whiteSpace: "nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(formData.servicios_aplicados || []).map((servicio, index) => (
                          <tr key={`${servicio.nombre}-${index}`} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                            <td style={{ padding: "0.5rem 0.75rem" }}>
                              <span style={{ background: servicio.origen === "catalogo" ? "rgba(99,102,241,0.15)" : "rgba(107,114,128,0.15)", color: servicio.origen === "catalogo" ? "#a5b4fc" : "#9ca3af", borderRadius: "5px", padding: "0.1rem 0.5rem", fontSize: "0.72rem" }}>
                                {servicio.origen === "catalogo" ? "Catálogo" : "Manual"}
                              </span>
                            </td>
                            <td style={{ padding: "0.5rem 0.75rem", color: "#eef2f7", fontWeight: 500 }}>{servicio.nombre}</td>
                            <td style={{ padding: "0.5rem 0.75rem", color: "#d4af37", fontWeight: 600 }}>{Number(servicio.precio || 0).toFixed(2)} €</td>
                            <td style={{ padding: "0.5rem 0.75rem", color: "rgba(200,209,224,0.55)" }}>{Number(servicio.tiempo_estimado_minutos || 0)} min</td>
                            <td style={{ padding: "0.5rem 0.75rem" }}>
                              <select className="form-select form-select-sm" value={normalizeRol(servicio.tipo_tarea || "")} onChange={(e) => actualizarRolServicioAplicado(index, e.target.value)}
                                style={{ background: "#1a1e28", border: "1px solid rgba(255,255,255,0.1)", color: "#eef2f7", borderRadius: "7px", fontSize: "0.78rem" }}>
                                <option value="">Área...</option>
                                {ROLE_OPTIONS.map((r) => (<option key={r.value} value={r.value}>{r.label}</option>))}
                              </select>
                            </td>
                            <td style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>
                              <button type="button" onClick={() => eliminarServicioAplicado(index)}
                                style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171", borderRadius: "7px", padding: "0.2rem 0.65rem", fontSize: "0.78rem", cursor: "pointer" }}>
                                Quitar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ borderTop: "1px solid rgba(212,175,55,0.2)", background: "rgba(212,175,55,0.04)" }}>
                          <th colSpan="2" style={{ padding: "0.55rem 0.75rem", color: "rgba(200,209,224,0.55)", fontSize: "0.78rem" }}>Total</th>
                          <th style={{ padding: "0.55rem 0.75rem", color: "#d4af37" }}>
                            {(formData.servicios_aplicados || []).reduce((acc, s) => acc + (Number(s.precio || 0) || 0), 0).toFixed(2)} €
                          </th>
                          <th style={{ padding: "0.55rem 0.75rem", color: "rgba(200,209,224,0.55)" }}>
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
              <div style={{ background: "#0e1219", border: "1px solid rgba(255,255,255,0.07)", borderTop: "3px solid rgba(212,175,55,0.3)", borderRadius: "18px", padding: "1.25rem", height: "100%" }}>
                <p style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(212,175,55,0.7)", margin: "0 0 0.75rem" }}>Protección de datos y consentimiento</p>
                <p style={{ color: "rgba(200,209,224,0.45)", fontSize: "0.82rem", lineHeight: 1.5, marginBottom: "0.6rem" }}>
                  Los datos del cliente, del vehículo y la firma digital se registran para gestionar la recepción, documentar el estado del coche y generar el expediente de trabajo.
                </p>
                <p style={{ color: "rgba(200,209,224,0.45)", fontSize: "0.82rem", lineHeight: 1.5, marginBottom: "0.75rem" }}>
                  La firma en tablet queda guardada como constancia de conformidad en recepción.
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.65rem 0.85rem", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "9px" }}>
                  <input className="form-check-input" type="checkbox" id="consentimiento_datos_recepcion" name="consentimiento_datos_recepcion"
                    checked={formData.es_concesionario ? true : formData.consentimiento_datos_recepcion}
                    onChange={handleInputChange} disabled={formData.es_concesionario} style={{ flexShrink: 0 }} />
                  <label className="form-check-label" htmlFor="consentimiento_datos_recepcion" style={{ color: "rgba(200,209,224,0.75)", fontSize: "0.85rem", cursor: formData.es_concesionario ? "default" : "pointer" }}>
                    {formData.es_concesionario
                      ? "Consentimiento interno aplicado automáticamente para cliente profesional."
                      : "Confirmo que el cliente acepta este registro interno y la firma digital de recepción."}
                  </label>
                </div>
              </div>
            </div>
            <div className="col-12 col-lg-6">
              <div style={{ background: "#0e1219", border: "1px solid rgba(255,255,255,0.07)", borderTop: "3px solid rgba(212,175,55,0.3)", borderRadius: "18px", padding: "1.25rem", height: "100%" }}>
                <p style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(212,175,55,0.7)", margin: "0 0 0.75rem" }}>Firma de recepción</p>
                {formData.es_concesionario ? (
                  <div style={{ padding: "1.5rem", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px" }}>
                    <small style={{ color: "rgba(200,209,224,0.4)" }}>En cliente profesional no se solicita firma del cliente en recepción.</small>
                  </div>
                ) : (
                  <SignaturePad
                    title="Firma Cliente"
                    height={150}
                    value={formData.firma_cliente_recepcion}
                    onChange={(firma) => setFormData((prev) => ({ ...prev, firma_cliente_recepcion: firma }))}
                  />
                )}
                <small style={{ color: "rgba(200,209,224,0.35)", fontSize: "0.74rem", display: "block", marginTop: "0.5rem" }}>
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
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(200,209,224,0.7)", borderRadius: "12px", padding: "0.85rem 2rem", fontSize: "1rem", cursor: "pointer", fontWeight: 600 }}>
                Cancelar edición
              </button>
            )}
            <button type="submit" disabled={guardando || cargandoEdicion}
              style={{ background: guardando || cargandoEdicion ? "rgba(212,175,55,0.4)" : "linear-gradient(135deg,#f5e19a,#d4af37)", border: "none", color: "#0a0b0e", fontWeight: 800, fontSize: "1rem", borderRadius: "12px", padding: "0.85rem 2.5rem", cursor: guardando || cargandoEdicion ? "not-allowed" : "pointer", letterSpacing: "0.03em", minWidth: "220px" }}>
              {cargandoEdicion ? "⏳ Cargando inspección..." : guardando ? "⏳ Guardando..." : inspeccionEditandoId ? "💾 Actualizar inspección" : "✦ Guardar inspección"}
            </button>
          </div>

        </form>

        {inspeccionCreada && (
          <div style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: "12px", padding: "1rem 1.25rem", color: "#6ee7b7", marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
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

      </div>
    </div>
  );
};

export default InspeccionRecepcionPage;

