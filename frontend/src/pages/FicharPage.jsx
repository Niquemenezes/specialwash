import React, { useEffect, useRef, useState, useCallback } from "react";
import { fichar, obtenerHoy, obtenerHoyTodos, editarRegistro, crearRegistroAdmin, eliminarRegistro } from "../utils/horarioApi";
import { getStoredRol } from "../utils/authSession";

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

function formatMinutesShort(totalMinutes) {
  const total = Number.isFinite(Number(totalMinutes)) ? Math.max(0, Number(totalMinutes)) : 0;
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

const HORAS_VACIAS = { entrada: "", inicio_comida: "", fin_comida: "", salida: "" };

function calcularHoras(r) {
  if (!r.entrada || !r.salida) return null;
  let ms = new Date(r.salida) - new Date(r.entrada);
  const descansoMin = Number(r.descanso_total_minutos || 0);
  if (descansoMin > 0) {
    ms -= descansoMin * 60000;
  } else if (r.inicio_comida && r.fin_comida) {
    const pausa = new Date(r.fin_comida) - new Date(r.inicio_comida);
    if (pausa > 0) ms -= pausa;
  }
  if (ms <= 0) return null;
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function formatPausas(r) {
  const pausas = Array.isArray(r?.pausas) ? r.pausas : [];
  if (pausas.length === 0) {
    if (r.inicio_comida) {
      return r.fin_comida
        ? `${formatHora(r.inicio_comida)} – ${formatHora(r.fin_comida)}`
        : `${formatHora(r.inicio_comida)} (activo)`;
    }
    return "—";
  }
  return pausas.map(([ini, fin]) =>
    fin ? `${formatHora(ini)} – ${formatHora(fin)}` : `${formatHora(ini)} …`
  ).join(" / ");
}

function isoToHHMM(isoStr) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export default function FicharPage() {
  const esAdmin = String(getStoredRol() || "").toLowerCase() === "administrador";

  const [registro, setRegistro] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [fichando, setFichando] = useState(null);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");

  // Admin state
  const [registrosHoy, setRegistrosHoy] = useState([]);
  const [cargandoAdmin, setCargandoAdmin] = useState(false);
  const [modalAdmin, setModalAdmin] = useState(null); // { empleado_id, empleado_nombre, id, fecha, horas }
  const [formAdmin, setFormAdmin] = useState(HORAS_VACIAS);
  const [guardandoAdmin, setGuardandoAdmin] = useState(false);
  const [errorAdmin, setErrorAdmin] = useState("");

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

  useEffect(() => { cargarHoy(); }, [cargarHoy]);

  const cargarAdmin = useCallback(async () => {
    if (!esAdmin) return;
    setCargandoAdmin(true);
    try {
      const data = await obtenerHoyTodos();
      setRegistrosHoy(data || []);
    } catch {
      setRegistrosHoy([]);
    } finally {
      setCargandoAdmin(false);
    }
  }, [esAdmin]);

  useEffect(() => { cargarAdmin(); }, [cargarAdmin]);

  const abrirModalAdmin = (r) => {
    setModalAdmin(r);
    setFormAdmin({
      entrada: isoToHHMM(r.entrada),
      inicio_comida: isoToHHMM(r.inicio_comida),
      fin_comida: isoToHHMM(r.fin_comida),
      salida: isoToHHMM(r.salida),
    });
    setErrorAdmin("");
  };

  const guardarAdmin = async () => {
    setGuardandoAdmin(true);
    setErrorAdmin("");
    try {
      if (modalAdmin.id) {
        await editarRegistro(modalAdmin.id, formAdmin);
      } else {
        await crearRegistroAdmin({ empleado_id: modalAdmin.empleado_id, fecha: modalAdmin.fecha, ...formAdmin });
      }
      setModalAdmin(null);
      await cargarAdmin();
    } catch (e) {
      setErrorAdmin(e.message || "Error al guardar.");
    } finally {
      setGuardandoAdmin(false);
    }
  };

  const eliminarAdmin = async (r) => {
    if (!r.id) return;
    if (!window.confirm(`¿Eliminar el registro de ${r.empleado_nombre} del ${r.fecha}?`)) return;
    try {
      await eliminarRegistro(r.id);
      await cargarAdmin();
    } catch (e) {
      setError(e.message || "Error al eliminar.");
    }
  };

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

      {/* ── Sección admin: fichajes de hoy de todos los empleados ── */}
      {esAdmin && (
        <div className="mt-4">
          <div className="d-flex align-items-center justify-content-between mb-2">
            <h6 className="fw-bold mb-0" style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--sw-muted, #888)" }}>
              Fichajes de hoy — todos los empleados
            </h6>
            <button className="btn btn-sm btn-outline-secondary" onClick={cargarAdmin} disabled={cargandoAdmin}>
              {cargandoAdmin ? "⏳" : "↻"}
            </button>
          </div>
          <div className="table-responsive">
            <table className="table table-sm table-bordered align-middle" style={{ fontSize: "0.82rem" }}>
              <thead className="table-light">
                <tr>
                  <th>Empleado</th>
                  <th>Entrada</th>
                  <th>Descansos</th>
                  <th>Salida</th>
                  <th>Horas</th>
                  <th className="text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {registrosHoy.map((r) => {
                  const incompleto = !r.entrada || !r.salida;
                  return (
                    <tr key={r.empleado_id} style={incompleto ? { background: "rgba(245,158,11,0.08)" } : {}}>
                      <td className="fw-semibold text-nowrap">{r.empleado_nombre}</td>
                      <td className="text-nowrap">{r.entrada ? formatHora(r.entrada) : <span className="text-danger fw-bold">—</span>}</td>
                      <td className="text-nowrap" style={{ fontSize: "0.78rem" }}>{formatPausas(r)}</td>
                      <td className="text-nowrap">{r.salida ? formatHora(r.salida) : "—"}</td>
                      <td className="text-nowrap fw-semibold" style={{ color: calcularHoras(r) ? "#16a34a" : "var(--sw-muted)" }}>
                        {calcularHoras(r) || "—"}
                      </td>
                      <td className="text-nowrap text-center">
                        <button
                          className="btn btn-sm btn-outline-primary me-1"
                          onClick={() => abrirModalAdmin(r)}
                          title="Editar"
                        >
                          ✏️
                        </button>
                        {r.id && (
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => eliminarAdmin(r)}
                            title="Eliminar"
                          >
                            🗑️
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {registrosHoy.length === 0 && !cargandoAdmin && (
                  <tr><td colSpan={6} className="text-center text-muted py-3">No hay empleados activos.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal edición admin */}
      {modalAdmin && (
        <div className="modal show d-block" style={{ background: "rgba(0,0,0,0.5)", zIndex: 1060 }}>
          <div className="modal-dialog modal-sm modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h6 className="modal-title">
                  {modalAdmin.id ? "Editar fichaje" : "Crear fichaje"}<br />
                  <small className="text-muted fw-normal">{modalAdmin.empleado_nombre} · {modalAdmin.fecha}</small>
                </h6>
                <button className="btn-close" onClick={() => setModalAdmin(null)} disabled={guardandoAdmin} />
              </div>
              <div className="modal-body">
                {errorAdmin && <div className="alert alert-danger py-1 small">{errorAdmin}</div>}
                {[
                  { key: "entrada", label: "Entrada" },
                  { key: "inicio_comida", label: "Inicio descanso" },
                  { key: "fin_comida", label: "Fin descanso" },
                  { key: "salida", label: "Salida" },
                ].map(({ key, label }) => (
                  <div className="mb-2" key={key}>
                    <label className="form-label small mb-1">{label}</label>
                    <input
                      type="time"
                      className="form-control form-control-sm"
                      value={formAdmin[key]}
                      onChange={e => setFormAdmin(prev => ({ ...prev, [key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary btn-sm" onClick={() => setModalAdmin(null)} disabled={guardandoAdmin}>
                  Cancelar
                </button>
                <button className="btn btn-primary btn-sm" onClick={guardarAdmin} disabled={guardandoAdmin}>
                  {guardandoAdmin ? <><span className="spinner-border spinner-border-sm me-1" />Guardando...</> : "Guardar"}
                </button>
              </div>
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
