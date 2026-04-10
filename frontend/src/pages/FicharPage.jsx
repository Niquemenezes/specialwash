import React, { useEffect, useRef, useState, useCallback } from "react";
import { fichar, obtenerHoy } from "../utils/horarioApi";
import { getStoredToken } from "../utils/authSession";

const TIPOS = [
  { key: "entrada", label: "Entrada", icon: "fa-sign-in-alt", color: "success", requiereFoto: true },
  { key: "inicio_comida", label: "Inicio descanso", icon: "fa-mug-hot", color: "warning", requiereFoto: false },
  { key: "fin_comida", label: "Fin descanso", icon: "fa-check-circle", color: "info", requiereFoto: false },
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

function formatMinutesShort(totalMinutes) {
  const total = Number.isFinite(Number(totalMinutes)) ? Math.max(0, Number(totalMinutes)) : 0;
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

function getRecordatorioPendiente(registro) {
  if (!registro || !registro.entrada) {
    return "No olvides fichar tu entrada para iniciar la jornada.";
  }
  if (registro?.descanso_activo) {
    return "Tienes pendiente fichar el fin de descanso.";
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
    setCapturaUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
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
      setCapturaUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
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
  const descansoTotalMin = Number(registro?.descanso_total_minutos || 0);
  const descansoActivo = Boolean(registro?.descanso_activo);
  const descansoDisponibleMin = Math.max(0, 60 - descansoTotalMin);

  const isTipoDisabled = (key) => {
    if (fichando) return true;
    if (key === "entrada") return Boolean(registro?.entrada);
    if (key === "inicio_comida") return !registro?.entrada || Boolean(registro?.salida) || descansoActivo || descansoDisponibleMin <= 0;
    if (key === "fin_comida") return !descansoActivo || Boolean(registro?.salida);
    if (key === "salida") return !registro?.entrada || Boolean(registro?.salida) || descansoActivo;
    return false;
  };

  const getTipoButtonText = (key, label) => {
    if (key === "entrada" && registro?.entrada) return `${label} ✓`;
    if (key === "salida" && registro?.salida) return `${label} ✓`;
    if (key === "inicio_comida" && descansoDisponibleMin <= 0) return `Descanso completo ✓`;
    if (key === "inicio_comida" && descansoActivo) return "Descanso en curso";
    if (key === "fin_comida" && descansoActivo) return label;
    if (key === "fin_comida" && descansoTotalMin > 0) return `${label} ✓`;
    return label;
  };

  const tipoActual = TIPOS.find((t) => t.key === tipoSeleccionado);

  return (
    <div className="container py-4" style={{ maxWidth: 540 }}>
      <h4 className="mb-1 fw-bold">Control de horario</h4>
      <p className="text-muted small mb-4 text-capitalize">{hoy}</p>

      {/* Alertas */}
      {!!recordatorioPendiente && !error && (
        <div className="alert alert-warning py-2 mb-3">
          <i className="fa-solid fa-triangle-exclamation me-2" />
          {recordatorioPendiente}
        </div>
      )}
      {error && <div className="alert alert-danger py-2 mb-3">{error}</div>}
      {exito && <div className="alert alert-success py-2 mb-3">{exito}</div>}

      <div className="alert alert-info py-2 mb-3">
        <i className="fa-solid fa-mug-hot me-2" />
        Descanso usado hoy: <strong>{formatMinutesShort(descansoTotalMin)}</strong> · disponible: <strong>{formatMinutesShort(descansoDisponibleMin)}</strong> de 1 h.
      </div>

      {/* Botones de fichaje */}
      <div className="row g-3 mb-4">
        {TIPOS.map(({ key, label, icon, color, requiereFoto }) => {
          const marcado = key === "entrada" || key === "salida"
            ? Boolean(registro?.[key])
            : (descansoActivo || descansoTotalMin > 0);
          return (
            <div key={key} className="col-6">
              <button
                className={`btn w-100 ${marcado ? `btn-${color}` : `btn-outline-${color}`}`}
                style={{ padding: "1rem 0.5rem", fontSize: "1rem", fontWeight: 600, borderRadius: 14 }}
                disabled={isTipoDisabled(key)}
                onClick={() => requiereFoto ? abrirCamara(key) : ficharSinFoto(key)}
              >
                {fichando === key ? (
                  <span className="spinner-border spinner-border-sm" />
                ) : (
                  <i className={`fa-solid ${icon} d-block mb-1`} style={{ fontSize: "1.4rem" }} />
                )}
                <span style={{ fontSize: "0.85rem" }}>
                  {getTipoButtonText(key, label)}
                </span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Estado del día — resumen de horas */}
      {cargando ? (
        <div className="text-center py-4">
          <span className="spinner-border spinner-border-sm me-2" />Cargando...
        </div>
      ) : (
        <div className="card">
          <div className="card-body">
            <h6 className="card-title mb-3 text-muted" style={{ fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Registro de hoy
            </h6>
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

      {/* Modal cámara */}
      {camaraActiva && (
        <>
          {/* Backdrop */}
          <div
            onClick={!fichando ? cerrarCamara : undefined}
            style={{
              position: "fixed", inset: 0,
              background: "rgba(0,0,0,0.75)",
              zIndex: 1050,
            }}
          />

          {/* Modal centrado */}
          <div
            style={{
              position: "fixed",
              top: "50%", left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 1055,
              width: "min(480px, 94vw)",
              background: "var(--sw-surface, #fff)",
              borderRadius: 16,
              boxShadow: "0 24px 60px rgba(0,0,0,0.4)",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "1rem 1.25rem 0.75rem",
              borderBottom: "1px solid var(--sw-border, #e5e7eb)",
            }}>
              <div>
                <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--sw-muted, #888)", marginBottom: 2 }}>
                  Fichaje con foto
                </div>
                <strong style={{ fontSize: "1rem" }}>
                  {tipoActual?.label}
                </strong>
              </div>
              <button
                type="button"
                onClick={cerrarCamara}
                disabled={!!fichando}
                aria-label="Cerrar"
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--sw-muted, #888)", fontSize: "1.3rem", lineHeight: 1,
                  padding: "0.25rem 0.4rem", borderRadius: 6,
                }}
              >
                ✕
              </button>
            </div>

            {/* Cuerpo */}
            <div style={{ padding: "1.25rem" }}>
              {!capturaBlob ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{
                      width: "100%", borderRadius: 10,
                      background: "#000", objectFit: "cover",
                      maxHeight: 300, display: "block", marginBottom: "1rem",
                    }}
                  />
                  <canvas ref={canvasRef} style={{ display: "none" }} />
                  <p className="text-muted small text-center mb-3" style={{ margin: 0 }}>
                    Colócate frente a la cámara y captura la foto
                  </p>
                  <div className="d-flex gap-2 mt-3">
                    <button className="btn btn-primary flex-fill" onClick={capturar}>
                      <i className="fa-solid fa-camera me-2" />Capturar foto
                    </button>
                    <button className="btn btn-outline-secondary" onClick={cerrarCamara}>
                      Cancelar
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <img
                    src={capturaUrl}
                    alt="Selfie"
                    style={{
                      width: "100%", borderRadius: 10,
                      objectFit: "cover", maxHeight: 300,
                      display: "block", marginBottom: "1rem",
                    }}
                  />
                  <p className="text-muted small text-center mb-3">¿La foto se ve bien?</p>
                  <div className="d-flex gap-2">
                    <button
                      className="btn btn-success flex-fill"
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
                      <i className="fa-solid fa-rotate-left me-1" />Repetir
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
