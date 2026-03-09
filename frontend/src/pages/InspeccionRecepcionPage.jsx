import React, { useEffect, useState, useContext, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Context } from "../store/appContext";
import SignaturePad from "../component/SignaturePad.jsx";

const INITIAL_FORM_DATA = {
  cliente_nombre: "",
  cliente_telefono: "",
  coche_descripcion: "",
  matricula: "",
  kilometros: "",
  firma_cliente_recepcion: "",
  firma_empleado_recepcion: "",
  consentimiento_datos_recepcion: false,
  averias_notas: ""
};

const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024;
const FORMATOS_VIDEO_ACEPTADOS = ["mp4", "mov", "avi", "mkv", "webm", "3gp", "flv"];
const FORMATOS_VIDEO_LABEL = "MP4, MOV, AVI, MKV, WEBM, 3GP, FLV";

const formatFileSizeMB = (sizeInBytes) => (sizeInBytes / (1024 * 1024)).toFixed(2);

const getStored = (k) =>
  (typeof sessionStorage !== "undefined" && sessionStorage.getItem(k)) ||
  (typeof localStorage !== "undefined" && localStorage.getItem(k)) || "";

const normalizeRol = (r) => {
  r = (r || "").toLowerCase().trim();
  if (r === "admin" || r === "administrator") return "administrador";
  if (r === "employee" || r === "staff") return "empleado";
  if (r === "manager" || r === "responsable") return "encargado";
  return r;
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
  const [inspeccionEditandoId, setInspeccionEditandoId] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const rol = normalizeRol(getStored("rol"));
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
          cliente_nombre: inspeccion.cliente_nombre || "",
          cliente_telefono: inspeccion.cliente_telefono || "",
          coche_descripcion: inspeccion.coche_descripcion || "",
          matricula: inspeccion.matricula || "",
          kilometros: inspeccion.kilometros || "",
          firma_cliente_recepcion: inspeccion.firma_cliente_recepcion || "",
          firma_empleado_recepcion: inspeccion.firma_empleado_recepcion || "",
          consentimiento_datos_recepcion: Boolean(inspeccion.consentimiento_datos_recepcion),
          averias_notas: inspeccion.averias_notas || ""
        });
        setInspeccionEditandoId(inspeccion.id);
        setFotos([]);
        setVideos([]);
        setFotosPreview([]);
        setVideosPreview([]);
      } catch (error) {
        alert(`No se pudo cargar la inspección para editar: ${error.message}`);
      } finally {
        if (active) setCargandoEdicion(false);
      }
    };

    cargarParaEdicion();
    return () => {
      active = false;
    };
  }, [actions, searchParams]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
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
      
      // Validar tamaño
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
    
    // Mostrar alertas si hay problemas
    if (videosGrandes.length > 0) {
      alert(`⚠️ Los siguientes videos exceden 100MB y no se añadirán:\n${videosGrandes.join("\n")}`);
    }
    
    if (formatosInvalidos.length > 0) {
      alert(`⚠️ Formatos no válidos (se aceptan: ${FORMATOS_VIDEO_LABEL}):\n${formatosInvalidos.join("\n")}`);
    }

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
          alert(error);
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
    
    // Validaciones básicas
    if (!formData.cliente_nombre || !formData.cliente_telefono || 
        !formData.coche_descripcion || !formData.matricula || !formData.kilometros ||
        !formData.firma_cliente_recepcion || !formData.firma_empleado_recepcion) {
      alert("Por favor, completa todos los campos obligatorios");
      return;
    }

    if (!formData.consentimiento_datos_recepcion) {
      alert("Debes aceptar la proteccion de datos para registrar la recepcion");
      return;
    }

    const kilometros = Number.parseInt(formData.kilometros, 10);
    if (Number.isNaN(kilometros) || kilometros < 0) {
      alert("Por favor, introduce un valor valido de kilometros (0 o mayor)");
      return;
    }

    setGuardando(true);

    try {
      const payload = {
        ...formData,
        kilometros
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
          return `⚠️ El video "${video.name}" es muy grande (${videoSize} MB). Máximo: 100 MB`;
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

      alert(mensaje);
      
      // Limpiar formulario
      setFormData(INITIAL_FORM_DATA);
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
      console.error(`Error al ${accion} inspección:`, error);
      alert(`❌ Error al ${accion} la inspección: ${error.message}`);
    } finally {
      setGuardando(false);
    }
  };

  const cancelarEdicion = () => {
    setInspeccionEditandoId(null);
    setSearchParams({});
    setFormData(INITIAL_FORM_DATA);
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

  return (
    <div className="container py-4" style={{ maxWidth: "900px" }}>
      {/* Header - Responsive */}
      <div
        className="d-flex justify-content-center align-items-center mb-3 mb-md-4 p-3 rounded shadow-sm"
        style={{ background: "#0f0f0f", color: "white" }}
      >
        <div className="w-100 d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2">
          <h2 className="fw-bold mb-0 fs-4 fs-md-3 text-center text-md-start" style={{ color: "#d4af37" }}>
            {inspeccionEditandoId ? `✏️ Editar Inspección #${inspeccionEditandoId}` : "🚗 Inspección de Recepción"}
          </h2>
          <div className="d-flex gap-2">
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
          <div className="card-header py-3" style={{ background: "#d4af37", fontWeight: "600", fontSize: "1.1rem" }}>
            {inspeccionEditandoId ? "Edición de Inspección" : "Nueva Inspección"}
          </div>
          <div className="card-body p-3 p-md-4">
            <div className="row">
              {/* Nombre Cliente */}
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
                  placeholder="Ej: Juan Pérez"
                  required
                />
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
                  placeholder="Ej: 600123456"
                  required
                />
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
                  🎬 Máx {FORMATOS_VIDEO_LABEL} • Tamaño máx: 100MB por video
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

              {/* Proteccion de datos */}
              <div className="col-12 mb-3">
                <div className="border rounded p-3" style={{ background: "#f8f9fa" }}>
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
                      checked={formData.consentimiento_datos_recepcion}
                      onChange={handleInputChange}
                    />
                    <label className="form-check-label" htmlFor="consentimiento_datos_recepcion">
                      Confirmo que el cliente acepta este registro interno y la firma digital de recepcion.
                    </label>
                  </div>
                </div>
              </div>

              {/* Firmas */}
              <div className="col-12 mb-3">
                <div className="card border-0" style={{ background: "#f8f9fa" }}>
                  <div className="card-body p-3">
                    <h6 className="fw-bold mb-3">Firmas de Revision de Estado (Recepcion)</h6>
                    <div className="row">
                      <div className="col-12 col-md-6">
                        <SignaturePad
                          title="Firma Empleado"
                          value={formData.firma_empleado_recepcion}
                          onChange={(firma) => setFormData((prev) => ({ ...prev, firma_empleado_recepcion: firma }))}
                        />
                      </div>
                      <div className="col-12 col-md-6">
                        <SignaturePad
                          title="Firma Cliente"
                          value={formData.firma_cliente_recepcion}
                          onChange={(firma) => setFormData((prev) => ({ ...prev, firma_cliente_recepcion: firma }))}
                        />
                      </div>
                    </div>
                    <small className="text-muted">
                      Ambas firmas son obligatorias para dejar constancia de la revision de estado del coche en recepcion.
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
                className="btn btn-lg w-100 w-md-auto px-5 py-3"
                style={{ background: "#d4af37", color: "black", fontWeight: "600", fontSize: "1.1rem" }}
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
