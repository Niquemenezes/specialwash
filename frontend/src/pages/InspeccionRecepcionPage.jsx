import React, { useState, useContext, useEffect, useRef, useCallback } from "react";
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

const InspeccionRecepcionPage = () => {
  const { actions } = useContext(Context);
  
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
  const [inspeccionCreada, setInspeccionCreada] = useState(null);
  const [misInspecciones, setMisInspecciones] = useState([]);
  const [inspeccionEditandoId, setInspeccionEditandoId] = useState(null);
  const [showDetalleModal, setShowDetalleModal] = useState(false);
  const [inspeccionDetalle, setInspeccionDetalle] = useState(null);

  const cargarMisInspecciones = useCallback(async () => {
    const inspecciones = await actions.getMisInspecciones();
    if (inspecciones) {
      setMisInspecciones(inspecciones);
    }
  }, [actions]);

  useEffect(() => {
    cargarMisInspecciones();
  }, [cargarMisInspecciones]);

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

      if (inspeccionEditandoId) {
        const inspeccionActualizada = await actions.actualizarInspeccion(inspeccionEditandoId, payload);
        if (!inspeccionActualizada?.id) {
          throw new Error("No se pudo actualizar la inspección");
        }
        alert(`✅ Inspección #${inspeccionActualizada.id} actualizada correctamente`);
      } else {
        // 1. Crear la inspección
        const inspeccion = await actions.crearInspeccion(payload);

        if (!inspeccion || !inspeccion.id) {
          throw new Error("No se pudo crear la inspección");
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
        let mensaje = `✅ Inspección #${inspeccion.id} creada correctamente`;
        if (fotosSubidas > 0) mensaje += `\n📸 ${fotosSubidas} foto(s) subida(s)`;
        if (fotosFallidas > 0) mensaje += `\n⚠️ ${fotosFallidas} foto(s) fallaron`;
        if (videosSubidos > 0) mensaje += `\n🎥 ${videosSubidos} video(s) subido(s)`;
        if (videosFallidos > 0) mensaje += `\n⚠️ ${videosFallidos} video(s) fallaron`;

        alert(mensaje);
      }
      
      // Limpiar formulario
      setFormData(INITIAL_FORM_DATA);
      setFotos([]);
      setVideos([]);
      setFotosPreview([]);
      setVideosPreview([]);
      setInspeccionEditandoId(null);
      
      // Recargar lista
      cargarMisInspecciones();
      
    } catch (error) {
      const accion = inspeccionEditandoId ? "actualizar" : "crear";
      console.error(`Error al ${accion} inspección:`, error);
      alert(`❌ Error al ${accion} la inspección: ${error.message}`);
    } finally {
      setGuardando(false);
    }
  };

  const verInspeccion = async (inspeccion) => {
    try {
      // Cargar la inspección completa con todos los detalles
      const inspeccionCompleta = await actions.getInspeccion(inspeccion.id);
      setInspeccionDetalle(inspeccionCompleta);
      setShowDetalleModal(true);
    } catch (error) {
      console.error("Error al cargar inspección:", error);
      alert("❌ Error al cargar los detalles: " + error.message);
    }
  };

  const cerrarDetalleModal = () => {
    setShowDetalleModal(false);
    setInspeccionDetalle(null);
  };

  const editarInspeccion = async (inspeccion) => {
    if (inspeccion.entregado) {
      alert("No se puede editar una inspección que ya fue entregada");
      return;
    }
    // Cargar datos en el formulario
    setFormData({
      cliente_nombre: inspeccion.cliente_nombre || "",
      cliente_telefono: inspeccion.cliente_telefono || "",
      coche_descripcion: inspeccion.coche_descripcion || "",
      matricula: inspeccion.matricula || "",
      kilometros: inspeccion.kilometros || "",
      firma_cliente_recepcion: inspeccion.firma_cliente_recepcion || "",
      firma_empleado_recepcion: inspeccion.firma_empleado_recepcion || "",
      consentimiento_datos_recepcion: inspeccion.consentimiento_datos_recepcion || false,
      averias_notas: inspeccion.averias_notas || ""
    });
    setInspeccionEditandoId(inspeccion.id);
    setFotos([]);
    setVideos([]);
    setFotosPreview([]);
    setVideosPreview([]);
    // Scroll al formulario
    window.scrollTo({ top: 0, behavior: "smooth" });
    alert("Datos cargados en el formulario. Modifica lo necesario y pulsa Actualizar.");
  };

  const eliminarInspeccion = async (inspeccionId) => {
    if (!window.confirm("¿Estás seguro de eliminar esta inspección? Esta acción no se puede deshacer.")) {
      return;
    }
    try {
      await actions.eliminarInspeccion(inspeccionId);
      alert("Inspección eliminada correctamente");
      await cargarMisInspecciones();
    } catch (error) {
      console.error("Error al eliminar:", error);
      alert(`Error al eliminar la inspección: ${error.message}`);
    }
  };

  const cancelarEdicion = () => {
    setInspeccionEditandoId(null);
    setFormData(INITIAL_FORM_DATA);
    setFotos([]);
    setVideos([]);
    setFotosPreview([]);
    setVideosPreview([]);
  };

  const abrirSelectorArchivo = (inputRef) => {
    inputRef.current?.click();
  };

  return (
    <div className="container py-4" style={{ maxWidth: "900px" }}>
      {/* Header - Responsive */}
      <div
        className="d-flex justify-content-center align-items-center mb-3 mb-md-4 p-3 rounded shadow-sm"
        style={{ background: "#0f0f0f", color: "white" }}
      >
        <h2 className="fw-bold mb-0 fs-4 fs-md-3 text-center" style={{ color: "#d4af37" }}>
          🚗 Inspección de Recepción
        </h2>
      </div>

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="mb-5">
        <div className="card shadow-sm border-0">
          <div className="card-header py-3" style={{ background: "#d4af37", fontWeight: "600", fontSize: "1.1rem" }}>
            {inspeccionEditandoId ? `Editar Inspección #${inspeccionEditandoId}` : "Nueva Inspección"}
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
                
                {/* Inputs ocultos */}
                <input
                  ref={fotosCamaraRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFotosChange}
                  style={{ display: 'none' }}
                />
                <input
                  ref={fotosGaleriaRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFotosChange}
                  style={{ display: 'none' }}
                />
                
                {/* Botones de acción */}
                <div className="d-grid gap-2 d-sm-flex mb-2">
                  <button
                    type="button"
                    className="btn btn-primary btn-lg flex-sm-fill"
                    onClick={() => abrirSelectorArchivo(fotosCamaraRef)}
                  >
                    📷 Tomar Foto
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-lg flex-sm-fill"
                    onClick={() => abrirSelectorArchivo(fotosGaleriaRef)}
                  >
                    🖼️ Galería
                  </button>
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
                
                {/* Inputs ocultos */}
                <input
                  ref={videosCamaraRef}
                  type="file"
                  accept="video/*"
                  capture="environment"
                  onChange={handleVideosChange}
                  style={{ display: 'none' }}
                />
                <input
                  ref={videosGaleriaRef}
                  type="file"
                  accept="video/mp4,video/mov,video/avi,video/quicktime,video/x-msvideo"
                  multiple
                  onChange={handleVideosChange}
                  style={{ display: 'none' }}
                />
                
                {/* Botones de acción */}
                <div className="d-grid gap-2 d-sm-flex mb-2">
                  <button
                    type="button"
                    className="btn btn-danger btn-lg flex-sm-fill"
                    onClick={() => abrirSelectorArchivo(videosCamaraRef)}
                  >
                    🎬 Grabar Video
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-danger btn-lg flex-sm-fill"
                    onClick={() => abrirSelectorArchivo(videosGaleriaRef)}
                  >
                    📁 Seleccionar
                  </button>
                </div>
                <small className="text-muted d-block" style={{ fontSize: "0.85rem" }}>
                  📱 "Grabar Video" abre la cámara • "Seleccionar" permite elegir videos (máx. 100MB)
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
                  disabled={guardando}
                >
                  Cancelar edición
                </button>
              )}
              <button
                type="submit"
                className="btn btn-lg w-100 w-md-auto px-5 py-3"
                style={{ background: "#d4af37", color: "black", fontWeight: "600", fontSize: "1.1rem" }}
                disabled={guardando}
              >
                {guardando
                  ? "⏳ Guardando..."
                  : inspeccionEditandoId
                    ? "💾 Actualizar Inspección"
                    : "💾 Guardar Inspección"}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Lista de Mis Inspecciones */}
      <div className="card shadow-sm border-0">
        <div className="card-header py-3" style={{ background: "#0f0f0f", color: "#d4af37", fontWeight: "600", fontSize: "1.1rem" }}>
          Mis Inspecciones Recientes
        </div>
        <div className="card-body p-2 p-md-3">
          {misInspecciones.length === 0 ? (
            <p className="text-muted text-center">No tienes inspecciones registradas aún.</p>
          ) : (
            <>
              {/* Vista de tabla para desktop */}
              <div className="d-none d-md-block table-responsive">
                <table className="table table-hover">
                  <thead className="table-light">
                    <tr>
                      <th>Fecha</th>
                      <th>Cliente</th>
                      <th>Coche</th>
                      <th>Matrícula</th>
                      <th>Estado</th>
                      <th>Fotos</th>
                      <th>Videos</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {misInspecciones.map((insp) => (
                      <tr key={insp.id}>
                        <td>{new Date(insp.fecha_inspeccion).toLocaleDateString()}</td>
                        <td>{insp.cliente_nombre}</td>
                        <td>{insp.coche_descripcion}</td>
                        <td><span className="badge bg-secondary">{insp.matricula}</span></td>
                        <td>
                          {insp.entregado ? (
                            <span className="badge bg-success">Entregado</span>
                          ) : (
                            <span className="badge bg-warning text-dark">Pendiente</span>
                          )}
                        </td>
                        <td>{insp.fotos_cloudinary?.length || 0}</td>
                        <td>{insp.videos_cloudinary?.length || 0}</td>
                        <td>
                          <div className="btn-group" role="group">
                            <button
                              className="btn btn-sm btn-outline-primary"
                              onClick={() => verInspeccion(insp)}
                              title="Ver detalles"
                            >
                              👁️
                            </button>
                            <button
                              className="btn btn-sm btn-outline-warning"
                              onClick={() => editarInspeccion(insp)}
                              title={insp.entregado ? "No editable: la inspección ya fue entregada" : "Editar"}
                            >
                              ✏️
                            </button>
                            <button
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => eliminarInspeccion(insp.id)}
                              title="Eliminar"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Vista de cards para móvil/tablet */}
              <div className="d-md-none">
                {misInspecciones.map((insp) => (
                  <div key={insp.id} className="card mb-3 shadow-sm">
                    <div className="card-body p-3">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <h6 className="mb-0 fw-bold">{insp.coche_descripcion}</h6>
                        <div className="d-flex gap-2">
                          <span className="badge bg-dark">{insp.matricula}</span>
                          {insp.entregado ? (
                            <span className="badge bg-success">Entregado</span>
                          ) : (
                            <span className="badge bg-warning text-dark">Pendiente</span>
                          )}
                        </div>
                      </div>
                      <p className="mb-2 text-muted small">
                        <strong>Cliente:</strong> {insp.cliente_nombre}
                      </p>
                      <p className="mb-2 text-muted small">
                        <strong>Fecha:</strong> {new Date(insp.fecha_inspeccion).toLocaleDateString()}
                      </p>
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <span className="badge bg-primary me-2">📸 {insp.fotos_cloudinary?.length || 0}</span>
                          <span className="badge bg-danger">🎥 {insp.videos_cloudinary?.length || 0}</span>
                        </div>
                        <div className="btn-group" role="group">
                          <button
                            className="btn btn-outline-primary btn-sm"
                            onClick={() => verInspeccion(insp)}
                          >
                            👁️ Ver
                          </button>
                          <button
                            className="btn btn-outline-warning btn-sm"
                            onClick={() => editarInspeccion(insp)}
                            title={insp.entregado ? "No editable: la inspección ya fue entregada" : "Editar"}
                          >
                            ✏️
                          </button>
                          <button
                            className="btn btn-outline-danger btn-sm"
                            onClick={() => eliminarInspeccion(insp.id)}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Mensaje de éxito */}
      {inspeccionCreada && (
        <div className="alert alert-success mt-4" role="alert">
          ✅ Inspección #{inspeccionCreada.id} creada correctamente
        </div>
      )}

      {/* Modal de Detalles de Inspección */}
      {showDetalleModal && inspeccionDetalle && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.8)" }}>
          <div className="modal-dialog modal-xl modal-dialog-scrollable modal-fullscreen-md-down">
            <div className="modal-content">
              {/* Header */}
              <div className="modal-header py-3" style={{ background: "#0f0f0f", color: "#d4af37" }}>
                <h5 className="modal-title fw-bold fs-6 fs-md-5">
                  🚗 #{inspeccionDetalle.id} - {inspeccionDetalle.matricula}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={cerrarDetalleModal}
                  aria-label="Cerrar"
                ></button>
              </div>

              {/* Body */}
              <div className="modal-body p-3">
                {/* Información del Cliente */}
                <div className="card mb-3">
                  <div className="card-header py-2" style={{ background: "#d4af37", fontWeight: "600" }}>
                    👤 Datos del Cliente
                  </div>
                  <div className="card-body p-3">
                    <div className="row">
                      <div className="col-12 col-md-6 mb-2 mb-md-0">
                        <p className="mb-2">
                          <strong>Nombre:</strong> {inspeccionDetalle.cliente_nombre}
                        </p>
                      </div>
                      <div className="col-12 col-md-6">
                        <p className="mb-2">
                          <strong>Teléfono:</strong> {inspeccionDetalle.cliente_telefono}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Información del Vehículo */}
                <div className="card mb-3">
                  <div className="card-header py-2" style={{ background: "#d4af37", fontWeight: "600" }}>
                    🚗 Datos del Vehículo
                  </div>
                  <div className="card-body p-3">
                    <div className="row">
                      <div className="col-12 col-md-6 mb-2">
                        <p className="mb-2">
                          <strong>Coche:</strong> {inspeccionDetalle.coche_descripcion}
                        </p>
                      </div>
                      <div className="col-12 col-md-6 mb-2">
                        <p className="mb-2">
                          <strong>Matrícula:</strong>{" "}
                          <span className="badge bg-dark">{inspeccionDetalle.matricula}</span>
                        </p>
                      </div>
                      <div className="col-12 col-md-6 mb-2">
                        <p className="mb-2">
                          <strong>Kilómetros:</strong>{" "}
                          {Number.isFinite(inspeccionDetalle.kilometros)
                            ? inspeccionDetalle.kilometros.toLocaleString("es-ES")
                            : "-"}
                          {" "}km
                        </p>
                      </div>
                      <div className="col-12">
                        <p className="mb-0">
                          <strong>Fecha de Inspección:</strong>{" "}
                          {new Date(inspeccionDetalle.fecha_inspeccion).toLocaleString('es-ES')}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Firmas de recepción */}
                {(inspeccionDetalle.firma_cliente_recepcion || inspeccionDetalle.firma_empleado_recepcion) && (
                  <div className="card mb-3">
                    <div className="card-header py-2" style={{ background: "#d4af37", fontWeight: "600" }}>
                      ✍️ Firmas de Recepcion
                    </div>
                    <div className="card-body p-3">
                      <div className="row g-3">
                        {inspeccionDetalle.firma_cliente_recepcion && (
                          <div className="col-12 col-md-6">
                            <p className="mb-1 fw-bold">Cliente</p>
                            <img
                              src={inspeccionDetalle.firma_cliente_recepcion}
                              alt="Firma cliente recepcion"
                              className="img-fluid border rounded"
                              style={{ background: "#fff", maxHeight: "180px", width: "100%", objectFit: "contain" }}
                            />
                          </div>
                        )}
                        {inspeccionDetalle.firma_empleado_recepcion && (
                          <div className="col-12 col-md-6">
                            <p className="mb-1 fw-bold">Empleado</p>
                            <img
                              src={inspeccionDetalle.firma_empleado_recepcion}
                              alt="Firma empleado recepcion"
                              className="img-fluid border rounded"
                              style={{ background: "#fff", maxHeight: "180px", width: "100%", objectFit: "contain" }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Observaciones / Averías */}
                {inspeccionDetalle.averias_notas && (
                  <div className="card mb-3">
                    <div className="card-header py-2" style={{ background: "#d4af37", fontWeight: "600" }}>
                      🔧 Observaciones y Averías
                    </div>
                    <div className="card-body p-3">
                      <p className="mb-0" style={{ whiteSpace: "pre-wrap" }}>
                        {inspeccionDetalle.averias_notas}
                      </p>
                    </div>
                  </div>
                )}

                {/* Fotos */}
                {inspeccionDetalle.fotos_cloudinary && inspeccionDetalle.fotos_cloudinary.length > 0 && (
                  <div className="card mb-3">
                    <div className="card-header py-2" style={{ background: "#d4af37", fontWeight: "600" }}>
                      📸 Fotos del Vehículo ({inspeccionDetalle.fotos_cloudinary.length})
                    </div>
                    <div className="card-body p-2 p-md-3">
                      <div className="row g-3">
                        {inspeccionDetalle.fotos_cloudinary.map((foto, index) => (
                          <div key={index} className="col-6 col-sm-6 col-md-4">
                            <div className="border rounded p-2">
                              <a
                                href={typeof foto === 'string' ? foto : foto.url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <img
                                  src={typeof foto === 'string' ? foto : foto.url}
                                  alt={`Foto ${index + 1}`}
                                  className="img-fluid rounded"
                                  style={{ width: "100%", height: "180px", objectFit: "cover", cursor: "pointer" }}
                                />
                              </a>
                              <p className="text-center mt-2 mb-0 small text-muted d-none d-md-block">
                                Foto #{index + 1} - Click para ampliar
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Videos */}
                {inspeccionDetalle.videos_cloudinary && inspeccionDetalle.videos_cloudinary.length > 0 && (
                  <div className="card mb-3">
                    <div className="card-header py-2" style={{ background: "#d4af37", fontWeight: "600" }}>
                      🎥 Videos del Vehículo ({inspeccionDetalle.videos_cloudinary.length})
                    </div>
                    <div className="card-body p-2 p-md-3">
                      <div className="row g-3">
                        {inspeccionDetalle.videos_cloudinary.map((video, index) => (
                          <div key={index} className="col-12 col-sm-6">
                            <div className="border rounded p-2">
                              <video
                                src={typeof video === 'string' ? video : video.url}
                                controls
                                className="w-100 rounded"
                                style={{ maxHeight: "400px" }}
                              >
                                Tu navegador no soporta el elemento de video.
                              </video>
                              <p className="text-center mt-2 mb-0 small text-muted">
                                Video #{index + 1}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Si no hay fotos ni videos */}
                {(!inspeccionDetalle.fotos_cloudinary || inspeccionDetalle.fotos_cloudinary.length === 0) &&
                 (!inspeccionDetalle.videos_cloudinary || inspeccionDetalle.videos_cloudinary.length === 0) && (
                  <div className="alert alert-info">
                    ℹ️ No hay fotos ni videos adjuntos en esta inspección.
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={cerrarDetalleModal}
                >
                  Cerrar
                </button>
                <a
                  href={`https://wa.me/${inspeccionDetalle.cliente_telefono.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn"
                  style={{ background: "#25D366", color: "white" }}
                >
                  📱 WhatsApp Cliente
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InspeccionRecepcionPage;
