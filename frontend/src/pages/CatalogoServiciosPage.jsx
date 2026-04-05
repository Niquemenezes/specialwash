import React, { useEffect, useState, useCallback } from "react";
import { buildApiUrl } from "../utils/apiBase";
import { getStoredToken } from "../utils/authSession";

async function apiFetch(path, options = {}) {
  const token = getStoredToken();
  const res = await fetch(buildApiUrl(path), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const raw = await res.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  if (!res.ok) throw new Error((data && (data.msg || data.message)) || `HTTP ${res.status}`);
  return data;
}

const EMPTY_FORM = {
  nombre: "",
  descripcion: "",
  precio_base: "",
  tiempo_estimado_minutos: "",
  rol_responsable: "detailing",
};

const ROLE_OPTIONS = [
  { value: "detailing", label: "Detailing" },
  { value: "pintura", label: "Pintura" },
  { value: "tapicero", label: "Tapicería" },
  { value: "calidad", label: "Calidad" },
  { value: "otro", label: "Otro" },
];

const getRoleBadgeClass = (role) => {
  switch (role) {
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

export default function CatalogoServiciosPage() {
  const [servicios, setServicios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [editandoId, setEditandoId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState("");
  const [filtro, setFiltro] = useState("");
  const [soloActivos, setSoloActivos] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch("/api/servicios_catalogo");
      setServicios(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || "Error al cargar servicios");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const serviciosFiltrados = servicios.filter((s) => {
    const term = filtro.trim().toLowerCase();
    if (soloActivos && !s.activo) return false;
    if (!term) return true;
    return (
      (s.nombre || "").toLowerCase().includes(term) ||
      (s.descripcion || "").toLowerCase().includes(term)
    );
  });

  const abrirCrear = () => {
    setEditandoId(null);
    setForm(EMPTY_FORM);
    setModalError("");
    setShowModal(true);
  };

  const abrirEditar = (s) => {
    setEditandoId(s.id);
    setForm({
      nombre: s.nombre || "",
      descripcion: s.descripcion || "",
      precio_base: s.precio_base != null ? String(s.precio_base) : "",
      tiempo_estimado_minutos:
        s.tiempo_estimado_minutos != null ? String(s.tiempo_estimado_minutos) : "",
      rol_responsable: s.rol_responsable || "detailing",
    });
    setModalError("");
    setShowModal(true);
  };

  const cerrarModal = () => {
    setShowModal(false);
    setEditandoId(null);
    setForm(EMPTY_FORM);
    setModalError("");
  };

  const guardar = async (e) => {
    e.preventDefault();
    const nombre = form.nombre.trim();
    if (!nombre) { setModalError("El nombre es obligatorio."); return; }
    const tiempoRaw = String(form.tiempo_estimado_minutos ?? "").trim();
    const tiempo = Number.parseInt(tiempoRaw, 10);
    if (!Number.isFinite(tiempo) || tiempo <= 0) {
      setModalError("El tiempo estimado es obligatorio y debe ser mayor que 0 minutos.");
      return;
    }
    setSaving(true);
    setModalError("");
    try {
      const payload = {
        nombre,
        descripcion: form.descripcion.trim() || null,
        precio_base: form.precio_base !== "" ? parseFloat(form.precio_base) : null,
        tiempo_estimado_minutos: tiempo,
        rol_responsable: String(form.rol_responsable || "").trim() || null,
      };
      if (editandoId) {
        await apiFetch(`/api/servicios_catalogo/${editandoId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/api/servicios_catalogo", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      await cargar();
      cerrarModal();
    } catch (e) {
      setModalError(e.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const toggleActivo = async (s) => {
    try {
      await apiFetch(`/api/servicios_catalogo/${s.id}`, {
        method: "PUT",
        body: JSON.stringify({ activo: !s.activo }),
      });
      await cargar();
    } catch (e) {
      setError(e.message || "Error al cambiar estado");
    }
  };

  const eliminar = async (s) => {
    if (!window.confirm(`¿Eliminar el servicio "${s.nombre}"?`)) return;
    try {
      await apiFetch(`/api/servicios_catalogo/${s.id}`, { method: "DELETE" });
      await cargar();
    } catch (e) {
      setError(e.message || "Error al eliminar");
    }
  };

  return (
    <div className="container py-4" style={{ maxWidth: "960px" }}>
      {/* ENCABEZADO */}
      <div
        className="d-flex flex-wrap align-items-center p-3 mb-4 shadow-sm sw-header-dark"
        style={{ borderRadius: "12px", gap: "12px" }}
      >
        <h2 className="fw-bold mb-0 me-auto sw-accent-text">
          🛠️ Catálogo de Servicios
        </h2>
        <input
          className="form-control"
          style={{ maxWidth: "220px", borderRadius: "10px" }}
          placeholder="Buscar servicio…"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
        />
        <div className="form-check text-white mb-0">
          <input
            id="soloActivos"
            className="form-check-input"
            type="checkbox"
            checked={soloActivos}
            onChange={(e) => setSoloActivos(e.target.checked)}
          />
          <label className="form-check-label" htmlFor="soloActivos">
            Solo activos
          </label>
        </div>
        <button
          className="btn fw-semibold sw-btn-accent-gold"
          style={{ borderRadius: "10px", whiteSpace: "nowrap" }}
          onClick={abrirCrear}
        >
          ➕ Nuevo servicio
        </button>
      </div>

      {/* RESUMEN */}
      <div className="d-flex flex-wrap gap-2 mb-3">
        <span className="badge bg-secondary">Total: {servicios.length}</span>
        <span className="badge bg-success">Activos: {servicios.filter((s) => s.activo).length}</span>
        <span className="badge bg-danger">Inactivos: {servicios.filter((s) => !s.activo).length}</span>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ borderRadius: "10px" }}>
          {error}
        </div>
      )}

      {/* TABLA */}
      <div className="card shadow-sm" style={{ borderRadius: "12px" }}>
        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead className="sw-table-header">
              <tr>
                <th style={{ width: 48 }}>#</th>
                <th>Nombre</th>
                <th>Descripción</th>
                <th className="text-end" style={{ width: 110 }}>Precio base</th>
                <th className="text-end" style={{ width: 130 }}>Tiempo estimado</th>
                <th style={{ width: 120 }}>Rol</th>
                <th className="text-center" style={{ width: 90 }}>Estado</th>
                <th className="text-end" style={{ width: 200 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="text-center py-4">Cargando…</td>
                </tr>
              )}
              {!loading && serviciosFiltrados.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-4 text-muted">
                    No hay servicios{filtro ? " que coincidan con la búsqueda" : ""}.
                  </td>
                </tr>
              )}
              {!loading &&
                serviciosFiltrados.map((s) => (
                  <tr key={s.id} style={{ opacity: s.activo ? 1 : 0.55 }}>
                    <td className="text-muted">{s.id}</td>
                    <td className="fw-semibold">{s.nombre}</td>
                    <td className="text-muted" style={{ fontSize: "0.9em" }}>
                      {s.descripcion || <span className="fst-italic">—</span>}
                    </td>
                    <td className="text-end">
                      {s.precio_base != null
                        ? `${Number(s.precio_base).toFixed(2)} €`
                        : <span className="fst-italic text-muted">—</span>}
                    </td>
                    <td className="text-end">
                      {s.tiempo_estimado_minutos != null
                        ? `${Number(s.tiempo_estimado_minutos)} min`
                        : <span className="fst-italic text-muted">—</span>}
                    </td>
                    <td>
                      <span className={`badge ${getRoleBadgeClass(s.rol_responsable)}`}>
                        {ROLE_OPTIONS.find((r) => r.value === s.rol_responsable)?.label || "Otro"}
                      </span>
                    </td>
                    <td className="text-center">
                      <span className={`badge ${s.activo ? "bg-success" : "bg-secondary"}`}>
                        {s.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="text-end">
                      <div className="d-flex justify-content-end gap-2">
                        <button
                          className="btn btn-sm btn-outline-primary"
                          style={{ borderRadius: "8px" }}
                          onClick={() => abrirEditar(s)}
                        >
                          ✏️ Editar
                        </button>
                        <button
                          className="btn btn-sm"
                          style={{
                            borderRadius: "8px",
                            background: s.activo ? "#ffc107" : "#198754",
                            color: "#fff",
                            border: "none",
                          }}
                          onClick={() => toggleActivo(s)}
                        >
                          {s.activo ? "⏸ Desactivar" : "✅ Activar"}
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          style={{ borderRadius: "8px" }}
                          onClick={() => eliminar(s)}
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
      </div>

      {/* MODAL CREAR / EDITAR */}
      {showModal && (
        <>
          <div
            className="modal fade show d-block"
            tabIndex="-1"
            role="dialog"
            onClick={(e) => { if (e.target === e.currentTarget) cerrarModal(); }}
            style={{ backgroundColor: "var(--sw-overlay-bg)" }}
          >
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content" style={{ borderRadius: "12px" }}>
                <div
                  className="modal-header sw-modal-header-dark"
                  style={{ borderRadius: "12px 12px 0 0" }}
                >
                  <h5 className="modal-title fw-bold sw-accent-text">
                    {editandoId ? "✏️ Editar servicio" : "➕ Nuevo servicio"}
                  </h5>
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    onClick={cerrarModal}
                  />
                </div>
                <form onSubmit={guardar}>
                  <div className="modal-body">
                    {modalError && (
                      <div className="alert alert-danger py-2" style={{ borderRadius: "8px" }}>
                        {modalError}
                      </div>
                    )}
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Nombre *</label>
                      <input
                        className="form-control"
                        value={form.nombre}
                        onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                        placeholder="Ej.: Lavado interior completo"
                        required
                        autoFocus
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Descripción</label>
                      <input
                        className="form-control"
                        value={form.descripcion}
                        onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                        placeholder="Descripción breve (opcional)"
                      />
                    </div>
                    <div className="mb-1">
                      <label className="form-label fw-semibold">Precio base (€)</label>
                      <input
                        className="form-control"
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.precio_base}
                        onChange={(e) => setForm({ ...form, precio_base: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="mt-3 mb-1">
                      <label className="form-label fw-semibold">Tiempo estimado (min) *</label>
                      <input
                        className="form-control"
                        type="number"
                        step="1"
                        min="1"
                        value={form.tiempo_estimado_minutos}
                        onChange={(e) =>
                          setForm({ ...form, tiempo_estimado_minutos: e.target.value })
                        }
                        placeholder="Ej.: 60"
                        required
                      />
                    </div>
                    <div className="mt-3 mb-1">
                      <label className="form-label fw-semibold">Rol responsable *</label>
                      <select
                        className="form-select"
                        value={form.rol_responsable}
                        onChange={(e) => setForm({ ...form, rol_responsable: e.target.value })}
                        required
                      >
                        {ROLE_OPTIONS.map((role) => (
                          <option key={role.value} value={role.value}>
                            {role.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ borderRadius: "8px" }}
                      onClick={cerrarModal}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="btn fw-semibold sw-btn-accent-gold"
                      style={{ borderRadius: "8px" }}
                      disabled={saving}
                    >
                      {saving ? "Guardando…" : editandoId ? "💾 Guardar cambios" : "✅ Crear servicio"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
