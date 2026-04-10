import React, { useEffect, useState } from "react";
import {
  crearParteTrabajo,
  listarCochesParaCrearParte,
  listarCochesCatalogo,
  listarServiciosCatalogo,
  obtenerUltimaInspeccionPorCoche,
} from "../utils/parteTrabajoApi";
import { normalizeRol } from "../utils/authSession";
import "../styles/crear-parte-trabajo.css";

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
    <div className="sw-parte-modal-overlay">
      <div className="sw-parte-modal">
        {/* Header */}
        <div className="sw-parte-modal__header">
          <h5 className="sw-parte-modal__title">
            <span className="sw-parte-modal__accent">✦</span>
            Crear nuevo parte — Paso {paso}/3
          </h5>
          <button onClick={onClose} className="sw-parte-modal__close">×</button>
        </div>

        {/* Content */}
        <div className="sw-parte-modal__content">
          {error && (
            <div className="sw-parte-alert sw-parte-alert--error">
              <span>{error}</span>
              <button type="button" className="btn-close btn-close-white btn-sm" onClick={() => setError("")} />
            </div>
          )}

          {paso === 1 && (
            <div>
              <label className="sw-parte-label">Selecciona el coche *</label>
              <select
                value={nuevoCocheId}
                onChange={(e) => setNuevoCocheId(e.target.value)}
                className="sw-parte-control"
              >
                <option value="">Selecciona coche...</option>
                {cochesDisponibles.map((c) => (
                  <option key={c.coche_id} value={c.coche_id}>
                    {c.matricula} {c.coche_descripcion ? ` - ${c.coche_descripcion}` : ""} {c.cliente_nombre ? ` - ${c.cliente_nombre}` : ""}
                  </option>
                ))}
              </select>
              <p className="sw-parte-hint">
                Se cargarán automáticamente los servicios de la última inspección
              </p>
            </div>
          )}

          {paso === 2 && (
            <div>
              <label className="sw-parte-label">Servicios del parte *</label>

              {hayServiciosSinTiempo && (
                <div className="sw-parte-alert--warning">
                  ⚠ Servicios sin tiempo: {serviciosSinTiempo.map(s => s.nombre).join(", ")}
                </div>
              )}

              <div className="row g-2">
                <div className="col-8">
                  <select
                    value={nuevoServicioId}
                    onChange={(e) => setNuevoServicioId(e.target.value)}
                    className="sw-parte-control"
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
                    className="sw-parte-btn sw-parte-btn--subtle"
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
                    className="sw-parte-control"
                  />
                </div>
                <div className="col-2">
                  <input
                    type="number" step="0.01" min="0"
                    value={nuevoServicioManual.precio}
                    onChange={(e) => setNuevoServicioManual({ ...nuevoServicioManual, precio: e.target.value })}
                    placeholder="€"
                    className="sw-parte-control sw-parte-control--compact"
                  />
                </div>
                <div className="col-2">
                  <input
                    type="number" step="0.25" min="0"
                    value={nuevoServicioManual.horas}
                    onChange={(e) => setNuevoServicioManual({ ...nuevoServicioManual, horas: e.target.value })}
                    placeholder="h"
                    className="sw-parte-control sw-parte-control--compact"
                  />
                </div>
                <div className="col-2">
                  <select
                    value={nuevoServicioManual.tipoTarea}
                    onChange={(e) => setNuevoServicioManual({ ...nuevoServicioManual, tipoTarea: e.target.value })}
                    className="sw-parte-control sw-parte-control--tiny"
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
                    className="sw-parte-btn sw-parte-btn--plus"
                  >
                    +
                  </button>
                </div>
              </div>

              {serviciosParteSeleccionados.length === 0 ? (
                <div className="sw-parte-empty">
                  No hay servicios seleccionados
                </div>
              ) : (
                <div className="mt-3">
                  {hayServiciosSinTipo && (
                    <div className="sw-parte-alert--warning">
                      ⚠ Hay servicios sin área asignada
                    </div>
                  )}
                  <div className="sw-parte-list">
                    {serviciosParteSeleccionados.map((s) => (
                      <div key={s.key} className="sw-parte-chip">
                        <div className="sw-parte-chip__head">
                          <div className="sw-parte-chip__body">
                            <strong>{s.nombre}</strong>
                            <div className="sw-parte-chip__meta">
                              {Number.isFinite(s.precio) ? `${Number(s.precio).toFixed(2)}€ · ` : ""}
                              {formatMinutes(Number.parseInt(s.tiempo_estimado_minutos || 0, 10) || 0)}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => quitarServicioSeleccionado(s.key)}
                            className="sw-parte-chip__remove"
                          >
                            ×
                          </button>
                        </div>
                        <select
                          value={s.tipo_tarea || ""}
                          onChange={(e) => actualizarTipoServicio(s.key, e.target.value)}
                          className="sw-parte-control sw-parte-control--tiny mt-2"
                        >
                          <option value="">Selecciona área...</option>
                          {TIPO_TAREA_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                  <p className="sw-parte-total">
                    Total: <strong>{formatMinutes(serviciosParteSeleccionados.reduce((acc, s) => acc + (Number.parseInt(s.tiempo_estimado_minutos || 0, 10) || 0), 0))}</strong>
                  </p>
                </div>
              )}
            </div>
          )}

          {paso === 3 && (
            <div>
              <h6 style={{ fontWeight: 700, marginBottom: "1rem" }}>Resumen del parte</h6>
              <div className="sw-parte-summary">
                <div className="sw-parte-summary__row">
                  <span className="sw-parte-summary__label">Coche:</span>
                  <strong>{cochesDisponibles.find(c => c.coche_id == nuevoCocheId)?.matricula || nuevoCocheId}</strong>
                </div>
                <div className="sw-parte-summary__row">
                  <span className="sw-parte-summary__label">Servicios:</span>
                  <strong>{serviciosParteSeleccionados.length}</strong>
                </div>
                <div className="sw-parte-summary__row">
                  <span className="sw-parte-summary__label">Tiempo estimado:</span>
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
        <div className="sw-parte-modal__footer">
          <div className="sw-parte-footer-actions">
            {paso > 1 && (
              <button
                onClick={() => setPaso(paso - 1)}
                disabled={loading}
                className="sw-parte-btn sw-parte-btn--ghost"
              >
                ← Atrás
              </button>
            )}
          </div>
          <div className="sw-parte-footer-actions">
            <button
              onClick={onClose}
              disabled={loading}
              className="sw-parte-btn sw-parte-btn--ghost"
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
                className="sw-parte-btn sw-parte-btn--accent"
              >
                Siguiente →
              </button>
            )}
            {paso === 3 && (
              <button
                onClick={onCrearParte}
                disabled={loading}
                className="sw-parte-btn sw-parte-btn--accent"
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
