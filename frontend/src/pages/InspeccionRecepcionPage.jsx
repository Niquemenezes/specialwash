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

  return (
    <div className="container py-4 sw-page-shell sw-inspeccion-page sw-view-stack">
      {formError && (
        <div className="alert alert-danger d-flex justify-content-between align-items-start py-2 mb-3">
          <span>⚠️ {formError}</span>
          <button className="btn-close ms-3" onClick={() => setFormError("")} />
        </div>
      )}
      {formSuccess && (
        <div className="alert alert-success d-flex justify-content-between align-items-start py-2 mb-3">
          <span style={{ whiteSpace: "pre-line" }}>{formSuccess}</span>
          <button className="btn-close ms-3" onClick={() => setFormSuccess("")} />
        </div>
      )}

      {/* Header */}
      <div
        className="d-flex justify-content-center align-items-center mb-3 mb-md-4 p-3 rounded shadow-sm sw-view-header sw-header-dark"
      >
        <div className="w-100 d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2">
          <h2 className="fw-bold mb-0 fs-5 fs-md-3 text-center text-md-start sw-accent-text">
            {inspeccionEditandoId ? `✏️ Editar Inspección #${inspeccionEditandoId}` : "🚗 Inspección de Recepción"}
          </h2>
          <div className="d-flex flex-column flex-sm-row gap-2 sw-header-actions">
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={volver}>
              Volver
            </button>
            {isAdmin && (
              <Link to="/inspecciones-guardadas" className="btn btn-sm btn-outline-light">
                Ver inspecciones guardadas
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="mb-5">
        <div className="card shadow-sm border-0">
          <div className="card-header py-3 sw-card-header-gold">
            {inspeccionEditandoId ? "Edición de Inspección" : "Nueva Inspección"}
          </div>
          <div className="card-body p-3 p-md-4">
            <div className="row">
              {/* Nombre Cliente */}
              <div className="col-12 col-md-6 mb-3">
                <label className="form-label fw-bold">Cliente existente (opcional)</label>
                <select
                  className="form-select form-select-lg"
                  name="cliente_id"
                  value={formData.cliente_id}
                  onChange={handleClienteExistenteChange}
                >
                  <option value="">-- Selecciona cliente registrado --</option>
                  {clientesDisponibles
                    .slice()
                    .sort((a, b) => String(a?.nombre || "").localeCompare(String(b?.nombre || ""), "es"))
                    .map((cliente) => (
                      <option key={cliente.id} value={cliente.id}>
                        {cliente.nombre || "Sin nombre"}
                        {cliente.telefono ? ` · ${cliente.telefono}` : ""}
                      </option>
                    ))}
                </select>
                <small className="text-muted d-block mt-1">
                  Si lo seleccionas, se reutiliza ese cliente y evita duplicados.
                </small>
              </div>

              <div className="col-12 col-md-6 mb-3">
                <label className="form-label fw-bold">
                  Nombre del Cliente <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  className="form-control form-control-lg"
                  name="cliente_nombre"
                  value={formData.cliente_nombre}
                  onChange={handleInputChange}
                  placeholder="Ej: Taller Acme"
                  list="clientes-existentes"
                  autoComplete="off"
                  required
                />
                <datalist id="clientes-existentes">
                  {clientesDisponibles
                    .map((cliente) => String(cliente?.nombre || "").trim())
                    .filter((nombre, index, arr) => nombre && arr.indexOf(nombre) === index)
                    .sort((a, b) => a.localeCompare(b, "es"))
                    .map((nombre) => (
                      <option key={nombre} value={nombre} />
                    ))}
                </datalist>
                <small className="text-muted d-block mt-1">
                  Escribe o selecciona nombre existente para rellenar automaticamente el telefono.
                </small>
              </div>

              {/* Teléfono Cliente */}
              <div className="col-12 col-md-6 mb-3">
                <label className="form-label fw-bold">
                  Teléfono del Cliente <span className="text-danger">*</span>
                </label>
                <input
                  type="tel"
                  className="form-control form-control-lg"
                  name="cliente_telefono"
                  value={formData.cliente_telefono}
                  onChange={handleInputChange}
                  placeholder="Ej: 600123123"
                  list="telefonos-existentes"
                  required
                />
                <datalist id="telefonos-existentes">
                  {clientesDisponibles
                    .map((cliente) => ({
                      id: cliente?.id,
                      telefono: String(cliente?.telefono || "").trim(),
                      nombre: String(cliente?.nombre || "").trim(),
                    }))
                    .filter((item) => item.telefono)
                    .sort((a, b) => a.telefono.localeCompare(b.telefono, "es"))
                    .map((item) => (
                      <option key={`${item.id}-${item.telefono}`} value={item.telefono}>
                        {item.nombre ? `${item.nombre}` : ""}
                      </option>
                    ))}
                </datalist>
                <small className="text-muted d-block mt-1">
                  Búsqueda en vivo: al escribir un teléfono existente se vincula el cliente automáticamente.
                </small>
              </div>

              {/* Descripción del Coche */}
              <div className="col-12 col-md-6 mb-3">
                <label className="form-label fw-bold">
                  Coche (Marca/Modelo) <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  className="form-control form-control-lg"
                  name="coche_descripcion"
                  value={formData.coche_descripcion}
                  onChange={handleInputChange}
                  placeholder="Ej: Ford Focus 2015"
                  required
                />
              </div>

              {/* Matrícula */}
              <div className="col-12 col-md-6 mb-3">
                <label className="form-label fw-bold">
                  Matrícula <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  className="form-control form-control-lg"
                  name="matricula"
                  value={formData.matricula}
                  onChange={handleInputChange}
                  placeholder="Ej: 1234ABC"
                  style={{ textTransform: "uppercase" }}
                  required
                />
              </div>

              {/* Kilómetros */}
              <div className="col-12 col-md-6 mb-3">
                <label className="form-label fw-bold">
                  Kilómetros <span className="text-danger">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className="form-control form-control-lg"
                  name="kilometros"
                  value={formData.kilometros}
                  onChange={handleInputChange}
                  placeholder="Ej: 125000"
                  required
                />
              </div>

              <div className="col-12 mb-3">
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="es_concesionario"
                    name="es_concesionario"
                    checked={Boolean(formData.es_concesionario)}
                    onChange={handleInputChange}
                  />
                  <label className="form-check-label" htmlFor="es_concesionario">
                    Coche de concesionario/profesional (en recepcion no se solicita firma de cliente)
                  </label>
                </div>
              </div>

              {/* Fotos */}
              <div className="col-12 mb-3">
                <label className="form-label fw-bold">📸 Fotos del Vehículo</label>
                
                {/* Input para cámara */}
                <input
                  ref={fotosCamaraRef}
                  id="input-fotos-camara"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFotosChange}
                  style={{ display: 'none' }}
                />
                {/* Input para galería (sin capture, permite múltiples) */}
                <input
                  ref={fotosGaleriaRef}
                  id="input-fotos-galeria"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFotosChange}
                  style={{ display: 'none' }}
                />
                
                {/* Labels como botones - funcionan mejor en móviles */}
                <div className="d-grid gap-2 d-sm-flex mb-2">
                  <label 
                    htmlFor="input-fotos-camara"
                    className="btn btn-primary btn-lg flex-sm-fill mb-0"
                    style={{ cursor: 'pointer' }}
                  >
                    📷 Tomar Foto
                  </label>
                  <label 
                    htmlFor="input-fotos-galeria"
                    className="btn btn-outline-primary btn-lg flex-sm-fill mb-0"
                    style={{ cursor: 'pointer' }}
                  >
                    🖼️ Galería
                  </label>
                </div>
                <small className="text-muted d-block" style={{ fontSize: "0.85rem" }}>
                  📱 "Tomar Foto" abre la cámara • "Galería" permite seleccionar múltiples fotos
                </small>
                
                {/* Preview de fotos */}
                {fotosPreview.length > 0 && (
                  <div className="mt-3">
                    <div className="row g-2">
                      {fotosPreview.map((src, index) => (
                        <div key={index} className="col-6 col-sm-4 col-md-3 position-relative">
                          <img
                            src={src}
                            alt={`Preview ${index}`}
                            className="img-thumbnail"
                            style={{ width: "100%", height: "120px", objectFit: "cover" }}
                          />
                          <button
                            type="button"
                            className="btn btn-danger position-absolute top-0 end-0 m-1"
                            style={{ padding: "4px 10px", fontSize: "1rem" }}
                            onClick={() => eliminarFoto(index)}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Videos */}
              <div className="col-12 mb-3">
                <label className="form-label fw-bold">🎥 Videos del Vehículo</label>
                
                {/* Input para grabar video */}
                <input
                  ref={videosCamaraRef}
                  id="input-videos-camara"
                  type="file"
                  accept="video/*"
                  capture="environment"
                  onChange={handleVideosChange}
                  style={{ display: 'none' }}
                />
                {/* Input para galería de videos (sin capture, permite múltiples) */}
                <input
                  ref={videosGaleriaRef}
                  id="input-videos-galeria"
                  type="file"
                  accept="video/*,video/mp4,video/mov,video/avi,video/quicktime,video/x-msvideo"
                  multiple
                  onChange={handleVideosChange}
                  style={{ display: 'none' }}
                />
                
                {/* Labels como botones - funcionan mejor en móviles */}
                <div className="d-grid gap-2 d-sm-flex mb-2">
                  <label
                    htmlFor="input-videos-camara"
                    className="btn btn-danger btn-lg flex-sm-fill mb-0"
                    style={{ cursor: 'pointer' }}
                  >
                    🎬 Grabar Video
                  </label>
                  <label
                    htmlFor="input-videos-galeria"
                    className="btn btn-outline-danger btn-lg flex-sm-fill mb-0"
                    style={{ cursor: 'pointer' }}
                  >
                    📹 Galería
                  </label>
                </div>
                <small className="text-muted d-block" style={{ fontSize: "0.85rem" }}>
                  🎬 Máx {FORMATOS_VIDEO_LABEL} • Tamaño máx: 250MB por video
                </small>
                
                {/* Preview de videos */}
                {videosPreview.length > 0 && (
                  <div className="mt-3">
                    <div className="row g-2">
                      {videosPreview.map((src, index) => (
                        <div key={index} className="col-12 col-sm-6 col-md-4 position-relative">
                          <video
                            src={src}
                            className="img-thumbnail"
                            style={{ width: "100%", height: "180px", objectFit: "cover" }}
                            controls
                          />
                          <button
                            type="button"
                            className="btn btn-danger position-absolute top-0 end-0 m-1"
                            style={{ padding: "4px 10px", fontSize: "1rem" }}
                            onClick={() => eliminarVideo(index)}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Observaciones / Averías */}
              <div className="col-12 mb-3">
                <label className="form-label fw-bold">🔧 Observaciones / Averías</label>
                <textarea
                  className="form-control form-control-lg"
                  name="averias_notas"
                  value={formData.averias_notas}
                  onChange={handleInputChange}
                  rows="4"
                  placeholder="Describe el estado del vehículo, daños visibles, etc."
                  style={{ fontSize: "1rem" }}
                />
              </div>

              {/* Servicios aplicados */}
              <div className="col-12 mb-3">
                <div className="card border-0 sw-surface-light">
                  <div className="card-body p-3">
                    <h6 className="fw-bold mb-3">🧾 Servicios para esta recepción</h6>

                    <div className="mb-3">
                      <label className="form-label fw-semibold">Catálogo activo</label>
                      <div className="d-flex flex-column gap-2">
                        {catalogoServicios.length === 0 && (
                          <span className="text-muted small">No hay servicios activos en catálogo.</span>
                        )}

                        <details className="sw-servicios-group" open>
                          <summary className="sw-servicios-group__title">🧽 Servicios de Detailing</summary>
                          <div className="sw-servicios-group__body mt-2">
                            {serviciosCatalogoPorRol.detailing.length === 0 ? (
                              <span className="text-muted small">Sin servicios en este grupo.</span>
                            ) : (
                              <div className="d-flex flex-column flex-md-row gap-2">
                                <div className="flex-grow-1">
                                  <GoldSelect
                                    value={servicioCatalogoSeleccionado.detailing}
                                    onChange={(value) => seleccionarServicioCatalogoPorRol("detailing", value)}
                                    placeholder="Seleccionar servicio de detailing..."
                                    searchable
                                    options={serviciosCatalogoPorRol.detailing.map((servicio) => ({
                                      value: servicio.id,
                                      label: `${servicio.nombre} · ${Number(servicio.precio_base || 0).toFixed(2)} €${
                                        Number(servicio.tiempo_estimado_minutos || 0) > 0
                                          ? ` · ${Number(servicio.tiempo_estimado_minutos)} min`
                                          : ""
                                      }`,
                                    }))}
                                  />
                                </div>
                                <button
                                  type="button"
                                  className="btn btn-dark sw-touch-btn"
                                  onClick={() => agregarServicioCatalogoPorRol("detailing")}
                                  disabled={!servicioCatalogoSeleccionado.detailing}
                                >
                                  Añadir
                                </button>
                              </div>
                            )}
                          </div>
                        </details>

                        <details className="sw-servicios-group" open>
                          <summary className="sw-servicios-group__title">🎨 Servicios de Pintura</summary>
                          <div className="sw-servicios-group__body mt-2">
                            {serviciosCatalogoPorRol.pintura.length === 0 ? (
                              <span className="text-muted small">Sin servicios en este grupo.</span>
                            ) : (
                              <div className="d-flex flex-column flex-md-row gap-2">
                                <div className="flex-grow-1">
                                  <GoldSelect
                                    value={servicioCatalogoSeleccionado.pintura}
                                    onChange={(value) => seleccionarServicioCatalogoPorRol("pintura", value)}
                                    placeholder="Seleccionar servicio de pintura..."
                                    searchable
                                    options={serviciosCatalogoPorRol.pintura.map((servicio) => ({
                                      value: servicio.id,
                                      label: `${servicio.nombre} · ${Number(servicio.precio_base || 0).toFixed(2)} €${
                                        Number(servicio.tiempo_estimado_minutos || 0) > 0
                                          ? ` · ${Number(servicio.tiempo_estimado_minutos)} min`
                                          : ""
                                      }`,
                                    }))}
                                  />
                                </div>
                                <button
                                  type="button"
                                  className="btn btn-dark sw-touch-btn"
                                  onClick={() => agregarServicioCatalogoPorRol("pintura")}
                                  disabled={!servicioCatalogoSeleccionado.pintura}
                                >
                                  Añadir
                                </button>
                              </div>
                            )}
                          </div>
                        </details>

                        <details className="sw-servicios-group" open>
                          <summary className="sw-servicios-group__title">🪑 Servicios de Tapicería</summary>
                          <div className="sw-servicios-group__body mt-2">
                            {serviciosCatalogoPorRol.tapicero.length === 0 ? (
                              <span className="text-muted small">Sin servicios en este grupo.</span>
                            ) : (
                              <div className="d-flex flex-column flex-md-row gap-2">
                                <div className="flex-grow-1">
                                  <GoldSelect
                                    value={servicioCatalogoSeleccionado.tapicero}
                                    onChange={(value) => seleccionarServicioCatalogoPorRol("tapicero", value)}
                                    placeholder="Seleccionar servicio de tapicería..."
                                    searchable
                                    options={serviciosCatalogoPorRol.tapicero.map((servicio) => ({
                                      value: servicio.id,
                                      label: `${servicio.nombre} · ${Number(servicio.precio_base || 0).toFixed(2)} €${
                                        Number(servicio.tiempo_estimado_minutos || 0) > 0
                                          ? ` · ${Number(servicio.tiempo_estimado_minutos)} min`
                                          : ""
                                      }`,
                                    }))}
                                  />
                                </div>
                                <button
                                  type="button"
                                  className="btn btn-dark sw-touch-btn"
                                  onClick={() => agregarServicioCatalogoPorRol("tapicero")}
                                  disabled={!servicioCatalogoSeleccionado.tapicero}
                                >
                                  Añadir
                                </button>
                              </div>
                            )}
                          </div>
                        </details>
                      </div>
                    </div>

                    <div className="mb-3">
                      <label className="form-label fw-semibold">Servicio manual</label>
                      <div className="row g-2">
                        <div className="col-12 col-lg-5">
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="Nombre del servicio"
                            value={servicioManual.nombre}
                            onChange={(e) => setServicioManual((prev) => ({ ...prev, nombre: e.target.value }))}
                          />
                        </div>
                        <div className="col-6 col-lg-2">
                          <input
                            type="number"
                            className="form-control form-control-sm text-center"
                            min="0"
                            step="0.01"
                            placeholder="Precio"
                            value={servicioManual.precio}
                            onChange={(e) => setServicioManual((prev) => ({ ...prev, precio: e.target.value }))}
                          />
                        </div>
                        <div className="col-6 col-lg-1">
                          <input
                            type="number"
                            className="form-control form-control-sm text-center"
                            min="0"
                            step="1"
                            placeholder="Min"
                            value={servicioManual.tiempo_estimado_minutos}
                            onChange={(e) => setServicioManual((prev) => ({ ...prev, tiempo_estimado_minutos: e.target.value }))}
                          />
                        </div>
                        <div className="col-6 col-lg-1">
                          <input
                            type="number"
                            className="form-control form-control-sm text-center"
                            min="0"
                            step="0.25"
                            placeholder="Hora"
                            value={servicioManual.tiempo_estimado_horas}
                            onChange={(e) => setServicioManual((prev) => ({ ...prev, tiempo_estimado_horas: e.target.value }))}
                          />
                        </div>
                        <div className="col-8 col-lg-2">
                          <select
                            className="form-select form-select-sm"
                            aria-label="Rol"
                            value={servicioManual.tipo_tarea}
                            onChange={(e) => setServicioManual((prev) => ({ ...prev, tipo_tarea: e.target.value }))}
                          >
                            <option value="">Selecciona área...</option>
                            {ROLE_OPTIONS.map((role) => (
                              <option key={role.value} value={role.value}>
                                {role.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-4 col-lg-1 d-grid">
                          <button type="button" className="btn btn-dark btn-sm" onClick={agregarServicioManual}>
                            Añadir
                          </button>
                        </div>
                      </div>
                      {servicioManualError && (
                        <div className="text-danger small mt-1">⚠️ {servicioManualError}</div>
                      )}
                      <small className="text-muted d-block mt-1">
                        Puedes indicar minutos o horas (ej. 1.5 horas = 90 min). Si completas ambos, se prioriza horas.
                      </small>
                      <small className="text-muted d-block mt-1">
                        El rol seleccionado aquí se guarda como tipo de tarea y se usa para enviar el parte al rol correspondiente.
                      </small>
                    </div>

                    <div>
                      <label className="form-label fw-semibold">Servicios añadidos</label>
                      <div className="alert alert-info py-2 mb-3" role="alert">
                        Al guardar esta recepción, se crearán automáticamente partes de trabajo por cada servicio según su rol.
                      </div>
                      {(formData.servicios_aplicados || []).length === 0 ? (
                        <div className="text-muted small">No hay servicios añadidos aún.</div>
                      ) : (
                        <div className="table-responsive">
                          <table className="table table-sm align-middle mb-0">
                            <thead>
                              <tr>
                                <th>Tipo</th>
                                <th>Nombre</th>
                                <th>Precio</th>
                                <th>Tiempo estimado</th>
                                <th>Rol</th>
                                <th className="text-end">Acción</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(formData.servicios_aplicados || []).map((servicio, index) => (
                                <tr key={`${servicio.nombre}-${index}`}>
                                  <td>{servicio.origen === "catalogo" ? "Catálogo" : "Manual"}</td>
                                  <td>{servicio.nombre}</td>
                                  <td>{Number(servicio.precio || 0).toFixed(2)} €</td>
                                  <td>{Number(servicio.tiempo_estimado_minutos || 0)} min</td>
                                  <td>
                                    <select
                                      className="form-select form-select-sm"
                                      value={normalizeRol(servicio.tipo_tarea || "")}
                                      onChange={(e) => actualizarRolServicioAplicado(index, e.target.value)}
                                    >
                                      <option value="">Selecciona área...</option>
                                      {ROLE_OPTIONS.map((r) => (
                                        <option key={r.value} value={r.value}>{r.label}</option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="text-end">
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline-danger"
                                      onClick={() => eliminarServicioAplicado(index)}
                                    >
                                      Quitar
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr>
                                <th colSpan="2">Total</th>
                                <th>
                                  {(formData.servicios_aplicados || [])
                                    .reduce((acc, s) => acc + (Number(s.precio || 0) || 0), 0)
                                    .toFixed(2)}{" "}
                                  €
                                </th>
                                <th>
                                  {(formData.servicios_aplicados || [])
                                    .reduce((acc, s) => acc + (Number.parseInt(s.tiempo_estimado_minutos || 0, 10) || 0), 0)}{" "}
                                  min
                                </th>
                                <th />
                                <th />
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Proteccion de datos */}
              <div className="col-12 col-lg-6 mb-3 d-flex">
                <div className="border rounded p-3 sw-surface-light w-100">
                  <h6 className="fw-bold mb-2">Proteccion de datos y consentimiento</h6>
                  <p className="mb-2 small text-muted">
                    Uso interno: los datos del cliente, del vehiculo y la firma digital se registran para gestionar
                    la recepcion, documentar el estado del coche y generar el expediente de trabajo.
                  </p>
                  <p className="mb-2 small text-muted">
                    La firma en tablet queda guardada como constancia de conformidad en recepcion.
                  </p>
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="consentimiento_datos_recepcion"
                      name="consentimiento_datos_recepcion"
                      checked={formData.es_concesionario ? true : formData.consentimiento_datos_recepcion}
                      onChange={handleInputChange}
                      disabled={formData.es_concesionario}
                    />
                    <label className="form-check-label" htmlFor="consentimiento_datos_recepcion">
                      {formData.es_concesionario
                        ? "Consentimiento interno aplicado automáticamente para cliente profesional."
                        : "Confirmo que el cliente acepta este registro interno y la firma digital de recepcion."}
                    </label>
                  </div>
                </div>
              </div>

              {/* Firmas */}
              <div className="col-12 col-lg-6 mb-3 d-flex">
                <div className="card border-0 sw-surface-light w-100">
                  <div className="card-body p-3">
                    <h6 className="fw-bold mb-3">Firma de recepción</h6>
                    {formData.es_concesionario ? (
                      <div className="border rounded p-3 h-100 bg-white d-flex align-items-center">
                        <small className="text-muted mb-0">
                          En cliente profesional no se solicita firma del cliente en recepción.
                        </small>
                      </div>
                    ) : (
                      <SignaturePad
                        title="Firma Cliente"
                        height={150}
                        value={formData.firma_cliente_recepcion}
                        onChange={(firma) => setFormData((prev) => ({ ...prev, firma_cliente_recepcion: firma }))}
                      />
                    )}
                    <small className="text-muted">
                      {formData.es_concesionario
                        ? "En modo profesional no se requiere firma en recepción; en entrega firma quien repasa y entrega el vehículo."
                        : "La firma del cliente es obligatoria para dejar constancia de la revisión de estado en recepción."}
                    </small>
                  </div>
                </div>
              </div>
            </div>

            {/* Botón Guardar */}
            <div className="d-flex flex-column flex-md-row justify-content-center gap-2 mt-3">
              {inspeccionEditandoId && (
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-lg px-4 py-3"
                  onClick={cancelarEdicion}
                  disabled={guardando || cargandoEdicion}
                >
                  Cancelar edición
                </button>
              )}
              <button
                type="submit"
                className="btn btn-lg w-100 sw-btn-md-auto px-5 py-3 sw-btn-accent-gold"
                disabled={guardando || cargandoEdicion}
              >
                {cargandoEdicion
                  ? "⏳ Cargando inspección..."
                  : guardando
                    ? "⏳ Guardando..."
                    : inspeccionEditandoId
                      ? "💾 Actualizar Inspección"
                      : "💾 Guardar Inspección"}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Mensaje de éxito */}
      {inspeccionCreada && (
        <div className="alert alert-success mt-4" role="alert">
          ✅ Inspección #{inspeccionCreada.id} creada correctamente
        </div>
      )}

    </div>
  );
};

export default InspeccionRecepcionPage;
