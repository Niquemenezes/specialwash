import React, { useEffect, useState } from "react";
import {
  crearParteTrabajo,
  listarCochesParaCrearParte,
  listarCochesCatalogo,
  listarServiciosCatalogo,
  obtenerUltimaInspeccionPorCoche,
} from "../utils/parteTrabajoApi";
import { normalizeRol } from "../utils/authSession";

const TIPO_TAREA_OPTIONS = [
  { value: "pintura", label: "Pintor / Pintura" },
  { value: "detailing", label: "Detailing / Lavado" },
  { value: "tapicero", label: "Tapicero / Tapicería" },
  { value: "otro", label: "Empleado general / Otro" },
];

function formatMinutes(minutes) {
  const total = Number.isFinite(Number(minutes)) ? Math.max(0, Number(minutes)) : 0;
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

function parseHoursToMinutes(hoursValue) {
  const raw = String(hoursValue ?? "").trim();
  if (!raw) return 0;
  const hours = Number(raw.replace(",", "."));
  if (!Number.isFinite(hours) || hours < 0) return null;
  return Math.round(hours * 60);
}

export default function CrearParteTrabajo({ isOpen, onClose, onSuccess }) {
  const [paso, setPaso] = useState(1); // 1: coche, 2: servicios, 3: confirmar
  const [nuevoCocheId, setNuevoCocheId] = useState("");
  const [serviciosParteSeleccionados, setServiciosParteSeleccionados] = useState([]);
  const [cochesDisponibles, setCochesDisponibles] = useState([]);
  const [serviciosCatalogo, setServiciosCatalogo] = useState([]);
  const [nuevoServicioId, setNuevoServicioId] = useState("");
  const [nuevoServicioManual, setNuevoServicioManual] = useState({
    nombre: "", precio: "", horas: "", tipoTarea: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setPaso(1);
      setNuevoCocheId("");
      setServiciosParteSeleccionados([]);
      setError("");
      return;
    }

    const cargarRecursos = async () => {
      try {
        const [coches, catalogo] = await Promise.all([
          listarCochesParaCrearParte(),
          listarServiciosCatalogo(true),
        ]);
        setCochesDisponibles(Array.isArray(coches) ? coches : []);
        setServiciosCatalogo(Array.isArray(catalogo) ? catalogo : []);
      } catch (e) {
        setError(e?.message || "No se pudieron cargar los recursos.");
      }
    };
    cargarRecursos();
  }, [isOpen]);

  useEffect(() => {
    let active = true;

    const cargarServiciosDesdeInspeccion = async () => {
      if (!nuevoCocheId) {
        setServiciosParteSeleccionados([]);
        return;
      }

      try {
        const inspeccion = await obtenerUltimaInspeccionPorCoche(nuevoCocheId);
        if (!active) return;

        const desdeRecepcion = Array.isArray(inspeccion?.servicios_aplicados)
          ? inspeccion.servicios_aplicados.map((s, idx) => ({
              key: `rec-${s?.servicio_catalogo_id || "x"}-${idx}`,
              nombre: String(s?.nombre || "").trim(),
              precio: Number(s?.precio || 0),
              tiempo_estimado_minutos: Number.parseInt(s?.tiempo_estimado_minutos || 0, 10) || 0,
              origen: "recepcion",
              servicio_catalogo_id: s?.servicio_catalogo_id ?? null,
              tipo_tarea: s?.tipo_tarea || "",
            }))
          : [];

        const limpios = desdeRecepcion.filter((s) => s.nombre);
        setServiciosParteSeleccionados(limpios);
      } catch {
        if (active) setServiciosParteSeleccionados([]);
      }
    };

    cargarServiciosDesdeInspeccion();
    return () => {
      active = false;
    };
  }, [nuevoCocheId]);

  const agregarServicioExtra = () => {
    if (!nuevoServicioId) {
      setError("Debes seleccionar un servicio del catálogo.");
      return;
    }

    const servicioElegido = serviciosCatalogo.find((s) => Number(s.id) === Number(nuevoServicioId));
    if (!servicioElegido) {
      setError("Servicio no válido.");
      return;
    }

    const nombre = String(servicioElegido.nombre || "").trim();
    if (!nombre) return;

    setServiciosParteSeleccionados((prev) => [
      ...prev,
      {
        key: `extra-${servicioElegido.id}`,
        nombre,
        precio: Number(servicioElegido.precio_base || 0),
        tiempo_estimado_minutos: Number.parseInt(servicioElegido.tiempo_estimado_minutos || 0, 10) || 0,
        origen: "extra",
        servicio_catalogo_id: servicioElegido.id,
        tipo_tarea: normalizeRol(servicioElegido.rol_responsable || "") || "",
      },
    ]);
    setNuevoServicioId("");
    setError("");
  };

  const agregarServicioManual = () => {
    const nombre = String(nuevoServicioManual.nombre || "").trim();
    if (!nombre) {
      setError("Debes escribir el nombre del servicio manual.");
      return;
    }

    const precioRaw = String(nuevoServicioManual.precio || "").trim();
    const precio = precioRaw === "" ? 0 : Number(precioRaw);
    if (!Number.isFinite(precio) || precio < 0) {
      setError("El precio manual debe ser un número válido mayor o igual a 0.");
      return;
    }

    const tiempoEstimadoMin = parseHoursToMinutes(nuevoServicioManual.horas);
    if (tiempoEstimadoMin === null) {
      setError("Las horas estimadas deben ser un número válido mayor o igual a 0.");
      return;
    }

    const tipoTarea = String(nuevoServicioManual.tipoTarea || "").trim();
    if (!tipoTarea) {
      setError("En servicio manual debes indicar el área/rol en el desplegable.");
      return;
    }

    setServiciosParteSeleccionados((prev) => [
      ...prev,
      {
        key: `manual-${Date.now()}`,
        nombre,
        precio: Math.round(precio * 100) / 100,
        tiempo_estimado_minutos: tiempoEstimadoMin,
        origen: "manual",
        servicio_catalogo_id: null,
        tipo_tarea: tipoTarea,
      },
    ]);

    setNuevoServicioManual({ nombre: "", precio: "", horas: "", tipoTarea: "" });
    setError("");
  };

  const quitarServicioSeleccionado = (key) => {
    setServiciosParteSeleccionados((prev) => prev.filter((s) => s.key !== key));
  };

  const actualizarTipoServicio = (key, tipoTarea) => {
    setServiciosParteSeleccionados((prev) => prev.map((s) => (
      s.key === key ? { ...s, tipo_tarea: tipoTarea } : s
    )));
  };

  const serviciosSinTiempo = serviciosParteSeleccionados.filter(
    (s) => (Number.parseInt(s.tiempo_estimado_minutos || 0, 10) || 0) <= 0
  );
  const hayServiciosSinTiempo = serviciosSinTiempo.length > 0;

  const serviciosSinTipo = serviciosParteSeleccionados.filter(
    (s) => !String(s.tipo_tarea || "").trim()
  );
  const hayServiciosSinTipo = serviciosSinTipo.length > 0;

  const onCrearParte = async (e) => {
    e.preventDefault();
    setError("");

    if (!nuevoCocheId) {
      setError("Debes seleccionar un coche.");
      return;
    }

    if (serviciosParteSeleccionados.length === 0) {
      setError("Debes añadir al menos un servicio para el parte.");
      return;
    }

    if (hayServiciosSinTipo) {
      setError("Todos los servicios deben tener un rol o área asignado antes de crear el parte.");
      return;
    }

    const trabajoFinal = serviciosParteSeleccionados
      .map((s) => s.nombre)
      .filter(Boolean)
      .join(" | ");

    const tiposUnicos = Array.from(new Set(
      serviciosParteSeleccionados.map((s) => String(s.tipo_tarea || "").trim()).filter(Boolean)
    ));

    const payload = {
      coche_id: Number(nuevoCocheId),
      observaciones: trabajoFinal,
      tipo_tarea: tiposUnicos.length === 1 ? tiposUnicos[0] : null,
      tiempo_estimado_minutos: serviciosParteSeleccionados.reduce(
        (acc, s) => acc + (Number.parseInt(s.tiempo_estimado_minutos || 0, 10) || 0),
        0
      ),
      servicios: serviciosParteSeleccionados.map((s) => ({
        nombre: String(s.nombre || "").trim(),
        tiempo_estimado_minutos: Number.parseInt(s.tiempo_estimado_minutos || 0, 10) || 0,
        servicio_catalogo_id: s.servicio_catalogo_id ?? null,
        precio: Number(s.precio || 0),
        origen: s.origen || "manual",
        tipo_tarea: s.tipo_tarea || null,
      })),
    };

    setLoading(true);
    try {
      await crearParteTrabajo(payload);
      setNuevoCocheId("");
      setServiciosParteSeleccionados([]);
      setPaso(1);
      onClose();
      if (onSuccess) onSuccess();
    } catch (e) {
      setError(e?.message || "Error al crear el parte.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1050, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", backdropFilter: "blur(4px)" }}>
      <div style={{ background: "var(--sw-surface)", border: "1px solid var(--sw-border)", borderTop: "3px solid #d4af37", borderRadius: "18px", width: "100%", maxWidth: "560px", maxHeight: "90vh", boxShadow: "0 24px 64px rgba(0,0,0,0.7)", animation: "sw-fade-up 0.25s ease both", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ padding: "1.1rem 1.25rem", borderBottom: "1px solid var(--sw-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h5 style={{ fontWeight: 700, color: "var(--sw-text)", margin: 0, fontSize: "0.95rem" }}>
            <span style={{ color: "var(--sw-accent)", marginRight: "0.5rem" }}>✦</span>
            Crear nuevo parte — Paso {paso}/3
          </h5>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "var(--sw-muted)", fontSize: "1.2rem", cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem" }}>
          {error && (
            <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "10px", padding: "0.75rem 1rem", marginBottom: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center", color: "#fca5a5", fontSize: "0.85rem" }}>
              <span>{error}</span>
              <button type="button" className="btn-close btn-close-white btn-sm" onClick={() => setError("")} />
            </div>
          )}

          {paso === 1 && (
            <div>
              <label style={{ color: "var(--sw-muted)", fontSize: "0.78rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.4rem" }}>Selecciona el coche *</label>
              <select
                value={nuevoCocheId}
                onChange={(e) => setNuevoCocheId(e.target.value)}
                style={{ width: "100%", background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)", color: "var(--sw-text)", borderRadius: "10px", padding: "0.6rem 0.8rem" }}
              >
                <option value="">Selecciona coche...</option>
                {cochesDisponibles.map((c) => (
                  <option key={c.coche_id} value={c.coche_id}>
                    {c.matricula} {c.coche_descripcion ? ` - ${c.coche_descripcion}` : ""} {c.cliente_nombre ? ` - ${c.cliente_nombre}` : ""}
                  </option>
                ))}
              </select>
              <p style={{ fontSize: "0.75rem", color: "var(--sw-muted)", marginTop: "0.6rem", marginBottom: 0 }}>
                Se cargarán automáticamente los servicios de la última inspección
              </p>
            </div>
          )}

          {paso === 2 && (
            <div>
              <label style={{ color: "var(--sw-muted)", fontSize: "0.78rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.4rem" }}>Servicios del parte *</label>

              {hayServiciosSinTiempo && (
                <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "8px", padding: "0.65rem 1rem", marginBottom: "0.75rem", color: "#fbbf24", fontSize: "0.83rem" }}>
                  ⚠ Servicios sin tiempo: {serviciosSinTiempo.map(s => s.nombre).join(", ")}
                </div>
              )}

              <div className="row g-2">
                <div className="col-8">
                  <select
                    value={nuevoServicioId}
                    onChange={(e) => setNuevoServicioId(e.target.value)}
                    style={{ width: "100%", background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)", color: "var(--sw-text)", borderRadius: "10px", padding: "0.6rem 0.8rem" }}
                  >
                    <option value="">Añadir servicio del catálogo...</option>
                    {serviciosCatalogo.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nombre} {s.precio_base != null ? `(${Number(s.precio_base).toFixed(2)}€)` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-4">
                  <button
                    type="button"
                    onClick={agregarServicioExtra}
                    style={{ width: "100%", background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.3)", color: "var(--sw-accent)", borderRadius: "10px", fontWeight: 600, fontSize: "0.85rem", cursor: "pointer", padding: "0.6rem" }}
                  >
                    + Añadir
                  </button>
                </div>
              </div>

              <div className="row g-2 mt-2">
                <div className="col-5">
                  <input
                    type="text"
                    value={nuevoServicioManual.nombre}
                    onChange={(e) => setNuevoServicioManual({ ...nuevoServicioManual, nombre: e.target.value })}
                    placeholder="Servicio manual"
                    style={{ width: "100%", background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)", color: "var(--sw-text)", borderRadius: "10px", padding: "0.6rem 0.8rem" }}
                  />
                </div>
                <div className="col-2">
                  <input
                    type="number" step="0.01" min="0"
                    value={nuevoServicioManual.precio}
                    onChange={(e) => setNuevoServicioManual({ ...nuevoServicioManual, precio: e.target.value })}
                    placeholder="€"
                    style={{ width: "100%", background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)", color: "var(--sw-text)", borderRadius: "10px", padding: "0.6rem 0.4rem", fontSize: "0.8rem" }}
                  />
                </div>
                <div className="col-2">
                  <input
                    type="number" step="0.25" min="0"
                    value={nuevoServicioManual.horas}
                    onChange={(e) => setNuevoServicioManual({ ...nuevoServicioManual, horas: e.target.value })}
                    placeholder="h"
                    style={{ width: "100%", background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)", color: "var(--sw-text)", borderRadius: "10px", padding: "0.6rem 0.4rem", fontSize: "0.8rem" }}
                  />
                </div>
                <div className="col-2">
                  <select
                    value={nuevoServicioManual.tipoTarea}
                    onChange={(e) => setNuevoServicioManual({ ...nuevoServicioManual, tipoTarea: e.target.value })}
                    style={{ width: "100%", background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)", color: "var(--sw-text)", borderRadius: "10px", padding: "0.4rem 0.4rem", fontSize: "0.75rem" }}
                  >
                    <option value="">Área...</option>
                    {TIPO_TAREA_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div className="col-1">
                  <button
                    type="button"
                    onClick={agregarServicioManual}
                    style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid var(--sw-border)", color: "var(--sw-text)", borderRadius: "10px", fontWeight: 600, fontSize: "0.7rem", cursor: "pointer", padding: "0.6rem 0.2rem" }}
                  >
                    +
                  </button>
                </div>
              </div>

              {serviciosParteSeleccionados.length === 0 ? (
                <div style={{ color: "var(--sw-muted)", fontSize: "0.83rem", borderRadius: "10px", padding: "0.9rem 1rem", border: "1px dashed rgba(255,255,255,0.07)", textAlign: "center", marginTop: "1rem" }}>
                  No hay servicios seleccionados
                </div>
              ) : (
                <div style={{ marginTop: "1rem" }}>
                  {hayServiciosSinTipo && (
                    <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "8px", padding: "0.6rem 1rem", marginBottom: "0.75rem", color: "#fbbf24", fontSize: "0.82rem" }}>
                      ⚠ Hay servicios sin área asignada
                    </div>
                  )}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
                    {serviciosParteSeleccionados.map((s) => (
                      <div key={s.key} style={{ background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)", borderRadius: "10px", padding: "0.6rem 0.8rem", fontSize: "0.8rem", minWidth: "180px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "0.4rem" }}>
                          <div style={{ flex: 1 }}>
                            <strong>{s.nombre}</strong>
                            <div style={{ fontSize: "0.72rem", color: "var(--sw-muted)", marginTop: "0.2rem" }}>
                              {Number.isFinite(s.precio) ? `${Number(s.precio).toFixed(2)}€ · ` : ""}
                              {formatMinutes(Number.parseInt(s.tiempo_estimado_minutos || 0, 10) || 0)}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => quitarServicioSeleccionado(s.key)}
                            style={{ background: "transparent", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", borderRadius: "4px", width: "20px", height: "20px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem", flexShrink: 0 }}
                          >
                            ×
                          </button>
                        </div>
                        <select
                          value={s.tipo_tarea || ""}
                          onChange={(e) => actualizarTipoServicio(s.key, e.target.value)}
                          style={{ width: "100%", marginTop: "0.4rem", background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)", color: "var(--sw-text)", borderRadius: "6px", fontSize: "0.75rem", padding: "0.3rem 0.4rem" }}
                        >
                          <option value="">Selecciona área...</option>
                          {TIPO_TAREA_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: "0.78rem", color: "var(--sw-muted)", marginTop: "0.75rem", marginBottom: 0 }}>
                    Total: <strong style={{ color: "var(--sw-accent)" }}>{formatMinutes(serviciosParteSeleccionados.reduce((acc, s) => acc + (Number.parseInt(s.tiempo_estimado_minutos || 0, 10) || 0), 0))}</strong>
                  </p>
                </div>
              )}
            </div>
          )}

          {paso === 3 && (
            <div>
              <h6 style={{ fontWeight: 700, marginBottom: "1rem" }}>Resumen del parte</h6>
              <div style={{ background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)", borderRadius: "10px", padding: "1rem", marginBottom: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.6rem" }}>
                  <span style={{ color: "var(--sw-muted)" }}>Coche:</span>
                  <strong>{cochesDisponibles.find(c => c.coche_id == nuevoCocheId)?.matricula || nuevoCocheId}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.6rem" }}>
                  <span style={{ color: "var(--sw-muted)" }}>Servicios:</span>
                  <strong>{serviciosParteSeleccionados.length}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--sw-muted)" }}>Tiempo estimado:</span>
                  <strong style={{ color: "var(--sw-accent)" }}>{formatMinutes(serviciosParteSeleccionados.reduce((acc, s) => acc + (Number.parseInt(s.tiempo_estimado_minutos || 0, 10) || 0), 0))}</strong>
                </div>
              </div>
              <p style={{ fontSize: "0.85rem", color: "var(--sw-muted)" }}>
                Haz clic en "Crear parte" para confirmación
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "1rem 1.25rem", borderTop: "1px solid var(--sw-border)", display: "flex", gap: "0.6rem", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: "0.6rem" }}>
            {paso > 1 && (
              <button
                onClick={() => setPaso(paso - 1)}
                disabled={loading}
                style={{ background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)", color: "var(--sw-muted)", borderRadius: "9px", padding: "0.45rem 1rem", fontSize: "0.84rem", cursor: "pointer" }}
              >
                ← Atrás
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: "0.6rem" }}>
            <button
              onClick={onClose}
              disabled={loading}
              style={{ background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)", color: "var(--sw-muted)", borderRadius: "9px", padding: "0.45rem 1rem", fontSize: "0.84rem", cursor: "pointer" }}
            >
              Cancelar
            </button>
            {paso < 3 && (
              <button
                onClick={() => {
                  if (paso === 1 && !nuevoCocheId) {
                    setError("Debes seleccionar un coche");
                    return;
                  }
                  if (paso === 2 && (serviciosParteSeleccionados.length === 0 || hayServiciosSinTipo)) {
                    setError("Debes añadir servicios con área asignada");
                    return;
                  }
                  setError("");
                  setPaso(paso + 1);
                }}
                style={{ background: "linear-gradient(135deg,#f5e19a,#d4af37)", border: "none", color: "#0a0b0e", fontWeight: 700, borderRadius: "9px", padding: "0.45rem 1.2rem", fontSize: "0.84rem", cursor: "pointer" }}
              >
                Siguiente →
              </button>
            )}
            {paso === 3 && (
              <button
                onClick={onCrearParte}
                disabled={loading}
                style={{ background: "linear-gradient(135deg,#f5e19a,#d4af37)", border: "none", color: "#0a0b0e", fontWeight: 700, borderRadius: "9px", padding: "0.45rem 1.2rem", fontSize: "0.84rem", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}
              >
                {loading ? "Creando…" : "✦ Crear parte"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
