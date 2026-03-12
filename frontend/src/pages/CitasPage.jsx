import React, { useCallback, useEffect, useState } from "react";
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

const ESTADOS = [
  { value: "pendiente",  label: "Pendiente",  color: "warning" },
  { value: "confirmada", label: "Confirmada", color: "success" },
  { value: "cancelada",  label: "Cancelada",  color: "danger" },
  { value: "completada", label: "Completada", color: "secondary" },
];

function EstadoBadge({ estado }) {
  const e = ESTADOS.find((x) => x.value === estado) || { label: estado, color: "secondary" };
  return <span className={`badge bg-${e.color}`}>{e.label}</span>;
}

function formatFechaHora(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" });
}

const EMPTY_FORM = {
  cliente_id: "",
  coche_id: "",
  fecha_hora: "",
  motivo: "",
  notas: "",
};

export default function CitasPage() {
  const [citas, setCitas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [cochesCliente, setCochesCliente] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroFecha, setFiltroFecha] = useState("");
  const [soloProximas, setSoloProximas] = useState(false);

  // ── Cargar citas ────────────────────────────────────────────────────────────
  const cargarCitas = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = [];
      if (filtroEstado) params.push(`estado=${filtroEstado}`);
      if (filtroFecha) params.push(`fecha=${filtroFecha}`);
      if (soloProximas) params.push("proximas=true");
      const query = params.length ? `?${params.join("&")}` : "";
      const data = await apiFetch(`/api/citas${query}`);
      setCitas(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || "Error al cargar citas");
    } finally {
      setLoading(false);
    }
  }, [filtroEstado, filtroFecha, soloProximas]);

  // ── Cargar clientes ─────────────────────────────────────────────────────────
  const cargarClientes = useCallback(async () => {
    try {
      const data = await apiFetch("/api/clientes");
      setClientes(Array.isArray(data) ? data : []);
    } catch {
      setClientes([]);
    }
  }, []);

  useEffect(() => { cargarCitas(); }, [cargarCitas]);
  useEffect(() => { cargarClientes(); }, [cargarClientes]);

  // Cargar coches cuando cambia el cliente en el form
  useEffect(() => {
    if (!form.cliente_id) { setCochesCliente([]); return; }
    apiFetch(`/api/coches?cliente_id=${form.cliente_id}`)
      .then((d) => setCochesCliente(Array.isArray(d) ? d : []))
      .catch(() => setCochesCliente([]));
  }, [form.cliente_id]);

  // ── Abrir modal ─────────────────────────────────────────────────────────────
  const abrirCrear = () => {
    setEditandoId(null);
    setForm(EMPTY_FORM);
    setModalError("");
    setShowModal(true);
  };

  const abrirEditar = (cita) => {
    setEditandoId(cita.id);
    const fechaLocal = cita.fecha_hora
      ? new Date(cita.fecha_hora).toISOString().slice(0, 16)
      : "";
    setForm({
      cliente_id: cita.cliente_id || "",
      coche_id: cita.coche_id || "",
      fecha_hora: fechaLocal,
      motivo: cita.motivo || "",
      notas: cita.notas || "",
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

  // ── Guardar ─────────────────────────────────────────────────────────────────
  const guardar = async (e) => {
    e.preventDefault();
    if (!form.cliente_id) { setModalError("Debes seleccionar un cliente."); return; }
    if (!form.fecha_hora) { setModalError("Debes indicar fecha y hora."); return; }
    if (!form.motivo.trim()) { setModalError("El motivo es obligatorio."); return; }

    setSaving(true);
    setModalError("");
    try {
      const payload = {
        cliente_id: Number(form.cliente_id),
        coche_id: form.coche_id ? Number(form.coche_id) : null,
        fecha_hora: new Date(form.fecha_hora).toISOString(),
        motivo: form.motivo.trim(),
        notas: form.notas.trim() || null,
      };
      if (editandoId) {
        await apiFetch(`/api/citas/${editandoId}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await apiFetch("/api/citas", { method: "POST", body: JSON.stringify(payload) });
      }
      await cargarCitas();
      cerrarModal();
    } catch (e) {
      setModalError(e.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  // ── Cambiar estado ──────────────────────────────────────────────────────────
  const cambiarEstado = async (cita, nuevoEstado) => {
    try {
      await apiFetch(`/api/citas/${cita.id}/estado`, {
        method: "PATCH",
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      await cargarCitas();
    } catch (e) {
      setError(e.message || "Error al cambiar estado");
    }
  };

  // ── Eliminar ────────────────────────────────────────────────────────────────
  const eliminar = async (cita) => {
    if (!window.confirm(`¿Eliminar la cita de "${cita.cliente_nombre}" el ${formatFechaHora(cita.fecha_hora)}?`)) return;
    try {
      await apiFetch(`/api/citas/${cita.id}`, { method: "DELETE" });
      await cargarCitas();
    } catch (e) {
      setError(e.message || "Error al eliminar");
    }
  };

  // ── Agrupar por fecha ───────────────────────────────────────────────────────
  const citasPorFecha = citas.reduce((acc, cita) => {
    const fecha = cita.fecha_hora
      ? new Date(cita.fecha_hora).toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
      : "Sin fecha";
    if (!acc[fecha]) acc[fecha] = [];
    acc[fecha].push(cita);
    return acc;
  }, {});

  // Stats
  const totalPendientes = citas.filter((c) => c.estado === "pendiente").length;
  const totalConfirmadas = citas.filter((c) => c.estado === "confirmada").length;
  const totalHoy = citas.filter((c) => {
    if (!c.fecha_hora) return false;
    const hoy = new Date().toDateString();
    return new Date(c.fecha_hora).toDateString() === hoy;
  }).length;

  return (
    <div className="container py-4" style={{ maxWidth: "1100px" }}>
      {/* HEADER */}
      <div
        className="d-flex flex-wrap align-items-center gap-3 p-3 mb-4 shadow-sm"
        style={{ background: "#0f0f0f", borderRadius: "12px" }}
      >
        <h2 className="fw-bold mb-0 me-auto" style={{ color: "#d4af37", fontSize: "clamp(1.2rem, 4vw, 1.75rem)" }}>
          📅 Gestión de Citas
        </h2>
        <p className="mb-0 d-none d-md-block" style={{ color: "#aaa", fontSize: "0.85rem" }}>
          Agenda y seguimiento de citas con clientes
        </p>
        <button
          className="btn fw-semibold"
          style={{ background: "#d4af37", color: "#000", borderRadius: "10px" }}
          onClick={abrirCrear}
        >
          ➕ Nueva cita
        </button>
      </div>

      {/* STATS */}
      <div className="row g-3 mb-4">
        {[
          { label: "📅 Citas hoy", value: totalHoy, color: "#d4af37" },
          { label: "⏳ Pendientes", value: totalPendientes, color: "#ffc107" },
          { label: "✅ Confirmadas", value: totalConfirmadas, color: "#198754" },
        ].map((s) => (
          <div className="col-md-4" key={s.label}>
            <div className="card shadow-sm" style={{ borderRadius: "12px" }}>
              <div className="card-body">
                <p className="text-muted mb-1">{s.label}</p>
                <h4 className="fw-bold mb-0" style={{ color: s.color }}>{s.value}</h4>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* FILTROS */}
      <div className="card shadow-sm mb-4" style={{ borderRadius: "12px" }}>
        <div className="card-body">
          <h6 className="fw-semibold mb-3">🔎 Filtros</h6>
          <div className="row g-3 align-items-end">
            <div className="col-md-4">
              <label className="form-label">Estado</label>
              <select
                className="form-select"
                value={filtroEstado}
                onChange={(e) => { setFiltroEstado(e.target.value); setSoloProximas(false); }}
                style={{ borderRadius: "8px" }}
              >
                <option value="">Todos</option>
                {ESTADOS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label">Fecha</label>
              <input
                type="date"
                className="form-control"
                value={filtroFecha}
                onChange={(e) => { setFiltroFecha(e.target.value); setSoloProximas(false); }}
                style={{ borderRadius: "8px" }}
              />
            </div>
            <div className="col-md-4 d-flex align-items-end gap-3">
              <div className="form-check mb-1">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="soloProximas"
                  checked={soloProximas}
                  onChange={(e) => {
                    setSoloProximas(e.target.checked);
                    if (e.target.checked) { setFiltroEstado(""); setFiltroFecha(""); }
                  }}
                />
                <label className="form-check-label" htmlFor="soloProximas">Solo próximas</label>
              </div>
              <button
                className="btn btn-sm btn-outline-secondary mb-1"
                style={{ borderRadius: "8px" }}
                onClick={() => { setFiltroEstado(""); setFiltroFecha(""); setSoloProximas(false); }}
              >
                Limpiar
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger alert-dismissible" role="alert">
          {error}
          <button type="button" className="btn-close" onClick={() => setError("")} />
        </div>
      )}

      {/* LISTA */}
      {loading ? (
        <div className="text-center py-5 text-muted">Cargando citas...</div>
      ) : citas.length === 0 ? (
        <div className="alert alert-info">No hay citas con los filtros actuales.</div>
      ) : (
        Object.entries(citasPorFecha).map(([fecha, grupo]) => (
          <div key={fecha} className="mb-4">
            <h5 className="fw-semibold mb-3" style={{ color: "#d4af37" }}>📆 {fecha}</h5>

            {/* Cards en móvil */}
            <div className="d-md-none">
              {grupo.map((cita) => (
                <div key={cita.id} className="card mb-3 shadow-sm" style={{ borderRadius: "12px", borderLeft: "4px solid #d4af37" }}>
                  <div className="card-body">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div>
                        <strong>{cita.cliente_nombre}</strong>
                        {cita.coche_matricula && (
                          <span className="text-muted ms-2 small">🚗 {cita.coche_matricula}</span>
                        )}
                      </div>
                      <EstadoBadge estado={cita.estado} />
                    </div>
                    <p className="mb-1 small"><strong>🕐</strong> {formatFechaHora(cita.fecha_hora)}</p>
                    <p className="mb-2 small text-muted">{cita.motivo}</p>
                    <div className="d-flex flex-wrap gap-2">
                      <select
                        className="form-select form-select-sm w-auto"
                        value={cita.estado}
                        onChange={(e) => cambiarEstado(cita, e.target.value)}
                        style={{ borderRadius: "8px" }}
                      >
                        {ESTADOS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
                      </select>
                      <button className="btn btn-sm btn-outline-primary" style={{ borderRadius: "8px" }} onClick={() => abrirEditar(cita)}>✏️</button>
                      <button className="btn btn-sm btn-outline-danger" style={{ borderRadius: "8px" }} onClick={() => eliminar(cita)}>🗑️</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Tabla en desktop */}
            <div className="d-none d-md-block table-responsive">
              <table className="table table-hover align-middle" style={{ borderRadius: "12px", overflow: "hidden" }}>
                <thead style={{ background: "#f8f9fa" }}>
                  <tr>
                    <th>Cliente</th>
                    <th>Coche</th>
                    <th>Fecha y hora</th>
                    <th>Motivo</th>
                    <th>Estado</th>
                    <th className="text-end">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {grupo.map((cita) => (
                    <tr key={cita.id}>
                      <td>
                        <strong>{cita.cliente_nombre}</strong>
                        {cita.cliente_telefono && (
                          <div className="text-muted small">📞 {cita.cliente_telefono}</div>
                        )}
                      </td>
                      <td className="small text-muted">
                        {cita.coche_matricula
                          ? `${cita.coche_matricula}${cita.coche_descripcion ? ` · ${cita.coche_descripcion}` : ""}`
                          : "—"}
                      </td>
                      <td className="small">{formatFechaHora(cita.fecha_hora)}</td>
                      <td>{cita.motivo}</td>
                      <td>
                        <select
                          className="form-select form-select-sm"
                          value={cita.estado}
                          onChange={(e) => cambiarEstado(cita, e.target.value)}
                          style={{ borderRadius: "8px", minWidth: "130px" }}
                        >
                          {ESTADOS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
                        </select>
                      </td>
                      <td className="text-end">
                        <div className="d-flex justify-content-end gap-2">
                          <button className="btn btn-sm btn-outline-primary" style={{ borderRadius: "8px" }} onClick={() => abrirEditar(cita)}>
                            ✏️ Editar
                          </button>
                          <button className="btn btn-sm btn-outline-danger" style={{ borderRadius: "8px" }} onClick={() => eliminar(cita)}>
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
        ))
      )}

      {/* MODAL CREAR / EDITAR */}
      {showModal && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          onClick={(e) => { if (e.target === e.currentTarget) cerrarModal(); }}
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-fullscreen-sm-down">
            <div className="modal-content" style={{ borderRadius: "12px" }}>
              <div className="modal-header" style={{ background: "#0f0f0f", borderRadius: "12px 12px 0 0" }}>
                <h5 className="modal-title fw-bold" style={{ color: "#d4af37" }}>
                  {editandoId ? "✏️ Editar cita" : "➕ Nueva cita"}
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={cerrarModal} />
              </div>
              <form onSubmit={guardar}>
                <div className="modal-body">
                  {modalError && (
                    <div className="alert alert-danger py-2" style={{ borderRadius: "8px" }}>{modalError}</div>
                  )}

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Cliente *</label>
                    <select
                      className="form-select"
                      value={form.cliente_id}
                      onChange={(e) => setForm({ ...form, cliente_id: e.target.value, coche_id: "" })}
                      required
                    >
                      <option value="">Selecciona cliente...</option>
                      {clientes.map((c) => (
                        <option key={c.id} value={c.id}>{c.nombre}{c.telefono ? ` · ${c.telefono}` : ""}</option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Coche (opcional)</label>
                    <select
                      className="form-select"
                      value={form.coche_id}
                      onChange={(e) => setForm({ ...form, coche_id: e.target.value })}
                      disabled={!form.cliente_id}
                    >
                      <option value="">Sin coche específico</option>
                      {cochesCliente.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.matricula}{c.marca ? ` · ${c.marca}` : ""}{c.modelo ? ` ${c.modelo}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Fecha y hora *</label>
                    <input
                      type="datetime-local"
                      className="form-control"
                      value={form.fecha_hora}
                      onChange={(e) => setForm({ ...form, fecha_hora: e.target.value })}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Motivo / Servicio *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={form.motivo}
                      onChange={(e) => setForm({ ...form, motivo: e.target.value })}
                      placeholder="Ej.: Lavado completo + encerado"
                      required
                    />
                  </div>

                  <div className="mb-1">
                    <label className="form-label fw-semibold">Notas adicionales</label>
                    <textarea
                      className="form-control"
                      value={form.notas}
                      onChange={(e) => setForm({ ...form, notas: e.target.value })}
                      rows={3}
                      placeholder="Instrucciones especiales, acceso al vehículo, etc."
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" style={{ borderRadius: "8px" }} onClick={cerrarModal}>
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn fw-semibold"
                    style={{ background: "#d4af37", color: "#000", borderRadius: "8px" }}
                    disabled={saving}
                  >
                    {saving ? "Guardando..." : editandoId ? "💾 Guardar cambios" : "✅ Crear cita"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
