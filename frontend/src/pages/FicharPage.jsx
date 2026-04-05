import React, { useEffect, useRef, useState, useCallback } from "react";
import { fichar, obtenerHoy } from "../utils/horarioApi";
import { getStoredToken } from "../utils/authSession";

const TIPOS = [
  { key: "entrada", label: "Entrada", icon: "fa-sign-in-alt", color: "success", requiereFoto: true },
  { key: "inicio_comida", label: "Inicio comida", icon: "fa-utensils", color: "warning", requiereFoto: false },
  { key: "fin_comida", label: "Fin comida", icon: "fa-check-circle", color: "info", requiereFoto: false },
  { key: "salida", label: "Salida", icon: "fa-sign-out-alt", color: "danger", requiereFoto: true },
];

function formatHora(isoStr) {
  if (!isoStr) return "--:--";
  const d = new Date(isoStr);
  return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function formatFecha(isoStr) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  return d.toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function getRecordatorioPendiente(registro) {
  if (!registro || !registro.entrada) {
    return "No olvides fichar tu entrada para iniciar la jornada.";
  }
  if (registro.inicio_comida && !registro.fin_comida) {
    return "Tienes pendiente fichar el fin de comida.";
  }
  if (!registro.salida) {
    return "No olvides fichar tu salida al terminar la jornada.";
  }
  return "";
}

export default function FicharPage() {
  const [registro, setRegistro] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [fichando, setFichando] = useState(null);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");

  // Camera state
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [camaraActiva, setCamaraActiva] = useState(false);
  const [capturaBlob, setCapturaBlob] = useState(null);
  const [capturaUrl, setCapturaUrl] = useState(null);
  const [tipoSeleccionado, setTipoSeleccionado] = useState(null);

  const cargarHoy = useCallback(async () => {
    try {
      const data = await obtenerHoy();
      setRegistro(data);
    } catch {
      setRegistro(null);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarHoy();
  }, [cargarHoy]);

  const ficharSinFoto = async (tipo) => {
    setError("");
    setExito("");
    setFichando(tipo);
    try {
      const result = await fichar(tipo, null);
      setRegistro(result.registro);
      setExito(`Fichaje "${TIPOS.find(t => t.key === tipo)?.label}" registrado correctamente.`);
    } catch (e) {
      setError(e.message || "Error al fichar.");
    } finally {
      setFichando(null);
    }
  };

  const abrirCamara = async (tipo) => {
    setError("");
    setExito("");
    setTipoSeleccionado(tipo);
    setCapturaBlob(null);
    setCapturaUrl(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      setCamaraActiva(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 100);
    } catch {
      setError("No se pudo acceder a la cámara. Acepta el permiso o usa otro dispositivo.");
    }
  };

  const cerrarCamara = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCamaraActiva(false);
    setTipoSeleccionado(null);
    setCapturaBlob(null);
    setCapturaUrl(null);
  };

  const capturar = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      setCapturaBlob(blob);
      const url = URL.createObjectURL(blob);
      setCapturaUrl(url);
      // Stop stream after capture
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    }, "image/jpeg", 0.85);
  };

  const confirmarFichaje = async () => {
    if (!tipoSeleccionado) return;
    setFichando(tipoSeleccionado);
    setError("");
    setExito("");
    try {
      const result = await fichar(tipoSeleccionado, capturaBlob);
      setRegistro(result.registro);
      setExito(`Fichaje "${TIPOS.find(t => t.key === tipoSeleccionado)?.label}" registrado correctamente.`);
      cerrarCamara();
    } catch (e) {
      setError(e.message || "Error al fichar.");
    } finally {
      setFichando(null);
    }
  };

  const hoy = new Date().toLocaleDateString("es-ES", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const recordatorioPendiente = getRecordatorioPendiente(registro);

  return (
    <div className="container py-4" style={{ maxWidth: 540 }}>
      <h4 className="mb-1 fw-bold">Control de horario</h4>
      <p className="text-muted small mb-4 text-capitalize">{hoy}</p>

      {/* Estado del día */}
      {cargando ? (
        <div className="text-center py-4">
          <span className="spinner-border spinner-border-sm me-2" />Cargando...
        </div>
      ) : (
        <div className="card mb-4">
          <div className="card-body">
            <h6 className="card-title mb-3">Hoy</h6>
            <div className="row g-2">
              {TIPOS.map(({ key, label, icon, color }) => (
                <div key={key} className="col-6">
                  <div className={`d-flex align-items-center gap-2 p-2 rounded border ${registro?.[key] ? `border-${color} bg-opacity-10 bg-${color}` : "border-secondary-subtle"}`}>
                    <i className={`fa-solid ${icon} text-${color}`} />
                    <div>
                      <div className="small text-muted">{label}</div>
                      <div className="fw-semibold" style={{ fontSize: "0.95rem" }}>
                        {registro?.[key] ? formatHora(registro[key]) : "--:--"}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Alertas */}
      {!!recordatorioPendiente && !error && (
        <div className="alert alert-warning py-2">
          <i className="fa-solid fa-triangle-exclamation me-2" />
          {recordatorioPendiente}
        </div>
      )}
      {error && <div className="alert alert-danger py-2">{error}</div>}
      {exito && <div className="alert alert-success py-2">{exito}</div>}

      {/* Botones de fichaje */}
      {!camaraActiva && (
        <div className="row g-2">
          {TIPOS.map(({ key, label, icon, color, requiereFoto }) => {
            const yaFichado = registro?.[key];
            return (
              <div key={key} className="col-6">
                <button
                  className={`btn btn-outline-${color} w-100 py-3`}
                  disabled={!!yaFichado || !!fichando}
                  onClick={() => requiereFoto ? abrirCamara(key) : ficharSinFoto(key)}
                >
                  <i className={`fa-solid ${icon} me-2`} />
                  {yaFichado ? `${label} ✓` : label}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Cámara / captura */}
      {camaraActiva && (
        <div className="card">
          <div className="card-body text-center">
            <h6 className="mb-3">
              Hazte una selfie para confirmar:{" "}
              <strong>{TIPOS.find((t) => t.key === tipoSeleccionado)?.label}</strong>
            </h6>

            {!capturaBlob ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="rounded mb-3"
                  style={{ width: "100%", maxHeight: 360, background: "#000", objectFit: "cover" }}
                />
                <canvas ref={canvasRef} style={{ display: "none" }} />
                <div className="d-flex gap-2 justify-content-center">
                  <button className="btn btn-primary" onClick={capturar}>
                    <i className="fa-solid fa-camera me-2" />Capturar
                  </button>
                  <button className="btn btn-secondary" onClick={cerrarCamara}>Cancelar</button>
                </div>
              </>
            ) : (
              <>
                <img
                  src={capturaUrl}
                  alt="Selfie"
                  className="rounded mb-3"
                  style={{ width: "100%", maxHeight: 360, objectFit: "cover" }}
                />
                <p className="text-muted small mb-3">¿La foto es correcta?</p>
                <div className="d-flex gap-2 justify-content-center">
                  <button
                    className="btn btn-success"
                    onClick={confirmarFichaje}
                    disabled={!!fichando}
                  >
                    {fichando ? (
                      <><span className="spinner-border spinner-border-sm me-2" />Registrando...</>
                    ) : (
                      <><i className="fa-solid fa-check me-2" />Confirmar fichaje</>
                    )}
                  </button>
                  <button
                    className="btn btn-outline-secondary"
                    onClick={() => { setCapturaBlob(null); setCapturaUrl(null); abrirCamara(tipoSeleccionado); }}
                    disabled={!!fichando}
                  >
                    Repetir
                  </button>
                  <button className="btn btn-secondary" onClick={cerrarCamara} disabled={!!fichando}>
                    Cancelar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
