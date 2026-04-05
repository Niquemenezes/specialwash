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
  if (!res.ok) throw new Error((data && (data.msg || data.message || data.error)) || `HTTP ${res.status}`);
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

function startOfWeekMonday(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 domingo, 1 lunes...
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

const EMPTY_FORM = {
  cliente_id: "",
  coche_id: "",
  fecha_hora: "",
  motivo: "",
  notas: "",
};

const EMPTY_CLIENTE_FORM = {
  nombre: "",
  telefono: "",
  email: "",
  cif: "",
  direccion: "",
  notas: "",
};

const EMPTY_COCHE_FORM = {
  matricula: "",
  marca: "",
  modelo: "",
  color: "",
  notas: "",
};

export default function CitasPage() {
  const [citas, setCitas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [serviciosCatalogo, setServiciosCatalogo] = useState([]);
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
  const [clienteModo, setClienteModo] = useState("existente");
  const [clienteForm, setClienteForm] = useState(EMPTY_CLIENTE_FORM);
  const [actualizarClienteExistente, setActualizarClienteExistente] = useState(false);
  const [cocheModo, setCocheModo] = useState("existente");
  const [cocheForm, setCocheForm] = useState(EMPTY_COCHE_FORM);

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

  const cargarServiciosCatalogo = useCallback(async () => {
    try {
      const data = await apiFetch("/api/servicios_catalogo?activos=true");
      setServiciosCatalogo(Array.isArray(data) ? data : []);
    } catch {
      setServiciosCatalogo([]);
    }
  }, []);

  useEffect(() => { cargarCitas(); }, [cargarCitas]);
  useEffect(() => { cargarClientes(); }, [cargarClientes]);
  useEffect(() => { cargarServiciosCatalogo(); }, [cargarServiciosCatalogo]);

  // Cargar coches cuando cambia el cliente en el form
  useEffect(() => {
    if (!form.cliente_id) { setCochesCliente([]); return; }
    apiFetch(`/api/coches?cliente_id=${form.cliente_id}`)
      .then((d) => setCochesCliente(Array.isArray(d) ? d : []))
      .catch(() => setCochesCliente([]));
  }, [form.cliente_id]);

  // Prefill de datos de cliente cuando se selecciona cliente existente
  useEffect(() => {
    if (clienteModo !== "existente" || !form.cliente_id) {
      setClienteForm(EMPTY_CLIENTE_FORM);
      return;
    }
    const seleccionado = clientes.find((c) => Number(c.id) === Number(form.cliente_id));
    if (!seleccionado) return;
    setClienteForm({
      nombre: seleccionado.nombre || "",
      telefono: seleccionado.telefono || "",
      email: seleccionado.email || "",
      cif: seleccionado.cif || "",
      direccion: seleccionado.direccion || "",
      notas: seleccionado.notas || "",
    });
  }, [clienteModo, form.cliente_id, clientes]);

  // ── Abrir modal ─────────────────────────────────────────────────────────────
  const abrirCrear = () => {
    setEditandoId(null);
    setForm(EMPTY_FORM);
    setClienteModo("existente");
    setClienteForm(EMPTY_CLIENTE_FORM);
    setActualizarClienteExistente(false);
    setCocheModo("existente");
    setCocheForm(EMPTY_COCHE_FORM);
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
    setClienteModo("existente");
    setActualizarClienteExistente(false);
    setCocheModo("existente");
    setCocheForm(EMPTY_COCHE_FORM);
    setModalError("");
    setShowModal(true);
  };

  const cerrarModal = () => {
    setShowModal(false);
    setEditandoId(null);
    setForm(EMPTY_FORM);
    setClienteModo("existente");
    setClienteForm(EMPTY_CLIENTE_FORM);
    setActualizarClienteExistente(false);
    setCocheModo("existente");
    setCocheForm(EMPTY_COCHE_FORM);
    setModalError("");
  };

  // ── Guardar ─────────────────────────────────────────────────────────────────
  const guardar = async (e) => {
    e.preventDefault();
    if (!form.fecha_hora) { setModalError("Debes indicar fecha y hora."); return; }
    if (!form.motivo.trim()) { setModalError("El motivo es obligatorio."); return; }

    setSaving(true);
    setModalError("");
    try {
      let clienteIdFinal = form.cliente_id ? Number(form.cliente_id) : null;
      let cocheIdFinal = form.coche_id ? Number(form.coche_id) : null;

      // 1) Resolver cliente
      if (!editandoId && clienteModo === "nuevo") {
        if (!clienteForm.nombre.trim()) {
          throw new Error("Debes indicar el nombre del cliente nuevo.");
        }
        const nuevoCliente = await apiFetch("/api/clientes", {
          method: "POST",
          body: JSON.stringify({
            nombre: clienteForm.nombre.trim(),
            telefono: clienteForm.telefono.trim() || null,
            email: clienteForm.email.trim() || null,
            cif: clienteForm.cif.trim() || null,
            direccion: clienteForm.direccion.trim() || null,
            notas: clienteForm.notas.trim() || null,
          }),
        });
        clienteIdFinal = Number(nuevoCliente.id);
      } else {
        if (!clienteIdFinal) {
          throw new Error("Debes seleccionar un cliente.");
        }
        if (actualizarClienteExistente && !editandoId) {
          if (!clienteForm.nombre.trim()) {
            throw new Error("El nombre del cliente no puede estar vacío.");
          }
          await apiFetch(`/api/clientes/${clienteIdFinal}`, {
            method: "PUT",
            body: JSON.stringify({
              nombre: clienteForm.nombre.trim(),
              telefono: clienteForm.telefono.trim() || null,
              email: clienteForm.email.trim() || null,
              cif: clienteForm.cif.trim() || null,
              direccion: clienteForm.direccion.trim() || null,
              notas: clienteForm.notas.trim() || null,
            }),
          });
        }
      }

      // 2) Resolver coche (opcional)
      if (!editandoId && cocheModo === "nuevo") {
        if (!cocheForm.matricula.trim()) {
          throw new Error("Para registrar coche nuevo debes indicar matrícula.");
        }
        const nuevoCoche = await apiFetch("/api/coches", {
          method: "POST",
          body: JSON.stringify({
            cliente_id: clienteIdFinal,
            matricula: cocheForm.matricula.trim().toUpperCase(),
            marca: cocheForm.marca.trim() || null,
            modelo: cocheForm.modelo.trim() || null,
            color: cocheForm.color.trim() || null,
            notas: cocheForm.notas.trim() || null,
          }),
        });
        cocheIdFinal = Number(nuevoCoche.id);
      }

      const payload = {
        cliente_id: Number(clienteIdFinal),
        coche_id: cocheIdFinal || null,
        // Enviar el valor local del input datetime-local para evitar desfases UTC.
        fecha_hora: form.fecha_hora,
        motivo: form.motivo.trim(),
        notas: form.notas.trim() || null,
      };
      if (editandoId) {
        await apiFetch(`/api/citas/${editandoId}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await apiFetch("/api/citas", { method: "POST", body: JSON.stringify(payload) });
      }
      await cargarClientes();
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
  const inicioSemana = startOfWeekMonday(new Date());
  const finSemana = new Date(inicioSemana);
  finSemana.setDate(finSemana.getDate() + 7);
  const nombresDias = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  const citasSemana = citas
    .filter((c) => {
      if (!c.fecha_hora) return false;
      const fecha = new Date(c.fecha_hora);
      return !Number.isNaN(fecha.getTime()) && fecha >= inicioSemana && fecha < finSemana;
    })
    .sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora));

  const semanaResumen = Array.from({ length: 7 }, (_, idx) => {
    const dia = new Date(inicioSemana);
    dia.setDate(inicioSemana.getDate() + idx);
    const diaStr = dia.toDateString();
    const diaCitas = citasSemana.filter((c) => new Date(c.fecha_hora).toDateString() === diaStr);
    return {
      key: dia.toISOString(),
      nombre: nombresDias[idx],
      diaNumero: dia.getDate(),
      total: diaCitas.length,
    };
  });
  const servicioSeleccionadoId = serviciosCatalogo.find((s) => s.nombre === form.motivo)?.id || "";

  return (
    <div className="container py-4 sw-page-shell sw-view-stack" style={{ maxWidth: "1100px" }}>
      {/* HEADER */}
      <div
        className="d-flex flex-wrap align-items-center gap-3 p-3 mb-4 shadow-sm sw-view-header sw-header-dark"
        style={{ borderRadius: "12px" }}
      >
        <h2 className="fw-bold mb-0 me-auto sw-accent-text" style={{ fontSize: "clamp(1.2rem, 4vw, 1.75rem)" }}>
          📅 Gestión de Citas
        </h2>
        <p className="mb-0 d-none d-md-block sw-text-muted" style={{ fontSize: "0.85rem" }}>
          Agenda y seguimiento de citas con clientes
        </p>
        <button
          className="btn fw-semibold sw-btn-accent-gold"
          style={{ borderRadius: "10px" }}
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
                <p className="sw-text-muted mb-1">{s.label}</p>
                <h4 className="fw-bold mb-0" style={{ color: s.color }}>{s.value}</h4>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* SEMANA */}
      <div className="card shadow-sm mb-4" style={{ borderRadius: "12px" }}>
        <div className="card-body">
          <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
            <h6 className="fw-semibold mb-0">🗓️ Citas de esta semana</h6>
            <span className="badge text-bg-light border">
              {inicioSemana.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" })}
              {" - "}
              {new Date(finSemana.getTime() - 1).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" })}
            </span>
            <span className="badge sw-btn-accent-gold">
              Total: {citasSemana.length}
            </span>
          </div>

          <div className="row g-2 mb-3">
            {semanaResumen.map((dia) => (
              <div className="col-6 col-md" key={dia.key}>
                <div
                  className="border rounded p-2 h-100 text-center"
                  style={{ background: dia.total > 0 ? "#fff9e7" : "var(--sw-surface-light)" }}
                >
                  <div className="small text-muted">{dia.nombre}</div>
                  <div className="fw-semibold">{dia.diaNumero}</div>
                  <div className="fw-bold" style={{ color: dia.total > 0 ? "#b38700" : "#6c757d" }}>
                    {dia.total}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {citasSemana.length === 0 ? (
            <div className="text-muted small">No hay citas programadas para esta semana.</div>
          ) : (
            <div className="small">
              {citasSemana.slice(0, 5).map((cita) => (
                <div key={cita.id} className="d-flex justify-content-between border-top py-2">
                  <span>
                    <strong>{new Date(cita.fecha_hora).toLocaleDateString("es-ES", { weekday: "short", day: "2-digit" })}</strong>
                    {" · "}
                    {new Date(cita.fecha_hora).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                    {" · "}
                    {cita.cliente_nombre || "Cliente"}
                  </span>
                  <EstadoBadge estado={cita.estado} />
                </div>
              ))}
              {citasSemana.length > 5 && (
                <div className="text-muted pt-2">+ {citasSemana.length - 5} citas más esta semana</div>
              )}
            </div>
          )}
        </div>
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
            <h5 className="fw-semibold mb-3 sw-accent-text">📆 {fecha}</h5>

            {/* Cards en móvil */}
            <div className="d-md-none">
              {grupo.map((cita) => (
                <div key={cita.id} className="card mb-3 shadow-sm" style={{ borderRadius: "12px", borderLeft: "4px solid var(--sw-accent)" }}>
                  <div className="card-body">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div>
                        <strong>{cita.cliente_nombre}</strong>
                        {cita.coche_matricula && (
                          <span className="sw-text-muted ms-2 small">🚗 {cita.coche_matricula}</span>
                        )}
                      </div>
                      <EstadoBadge estado={cita.estado} />
                    </div>
                    <p className="mb-1 small"><strong>🕐</strong> {formatFechaHora(cita.fecha_hora)}</p>
                    <p className="mb-2 small sw-text-muted">{cita.motivo}</p>
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
                <thead style={{ background: "var(--sw-surface-light)" }}>
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
                          <div className="sw-text-muted small">📞 {cita.cliente_telefono}</div>
                        )}
                      </td>
                      <td className="small sw-text-muted">
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
          className="modal fade show d-block sw-modal-overlay"
          tabIndex="-1"
          onClick={(e) => { if (e.target === e.currentTarget) cerrarModal(); }}
        >
          <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-fullscreen-sm-down">
            <div
              className="modal-content"
              style={{
                borderRadius: "12px",
                maxHeight: "94vh",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div className="modal-header sw-header-dark" style={{ borderRadius: "12px 12px 0 0" }}>
                <h5 className="modal-title fw-bold sw-accent-text">
                  {editandoId ? "✏️ Editar cita" : "➕ Nueva cita"}
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={cerrarModal} />
              </div>
              <form onSubmit={guardar} style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
                <div
                  className="modal-body"
                  style={{
                    overflowY: "auto",
                    WebkitOverflowScrolling: "touch",
                    overscrollBehavior: "contain",
                    maxHeight: "calc(94vh - 140px)",
                  }}
                >
                  {modalError && (
                    <div className="alert alert-danger py-2 sw-alert-error" style={{ borderRadius: "8px" }}>{modalError}</div>
                  )}

                  {!editandoId && (
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Tipo de cliente</label>
                      <div className="d-flex gap-3 flex-wrap">
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="radio"
                            name="clienteModo"
                            id="clienteExistente"
                            checked={clienteModo === "existente"}
                            onChange={() => {
                              setClienteModo("existente");
                              setForm((prev) => ({ ...prev, cliente_id: "", coche_id: "" }));
                            }}
                          />
                          <label className="form-check-label" htmlFor="clienteExistente">Cliente existente</label>
                        </div>
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="radio"
                            name="clienteModo"
                            id="clienteNuevo"
                            checked={clienteModo === "nuevo"}
                            onChange={() => {
                              setClienteModo("nuevo");
                              setForm((prev) => ({ ...prev, cliente_id: "", coche_id: "" }));
                              setClienteForm(EMPTY_CLIENTE_FORM);
                            }}
                          />
                          <label className="form-check-label" htmlFor="clienteNuevo">Cliente nuevo</label>
                        </div>
                      </div>
                    </div>
                  )}

                  {(editandoId || clienteModo === "existente") && (
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
                  )}

                  {(!editandoId && clienteModo === "existente" && form.cliente_id) && (
                    <div className="mb-3 border rounded p-2 sw-surface-light" style={{}}>
                      <div className="form-check mb-2">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="actualizarCliente"
                          checked={actualizarClienteExistente}
                          onChange={(e) => setActualizarClienteExistente(e.target.checked)}
                        />
                        <label className="form-check-label" htmlFor="actualizarCliente">
                          Actualizar datos del cliente seleccionado
                        </label>
                      </div>
                    </div>
                  )}

                  {(clienteModo === "nuevo" || actualizarClienteExistente) && (
                    <div className="mb-3 border rounded p-3 sw-surface-light" style={{}}>
                      <h6 className="fw-semibold mb-3">👤 Datos del cliente</h6>
                      <div className="row g-2">
                        <div className="col-md-6">
                          <label className="form-label small">Nombre *</label>
                          <input
                            className="form-control"
                            value={clienteForm.nombre}
                            onChange={(e) => setClienteForm((p) => ({ ...p, nombre: e.target.value }))}
                            required={clienteModo === "nuevo"}
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label small">Teléfono</label>
                          <input
                            className="form-control"
                            value={clienteForm.telefono}
                            onChange={(e) => setClienteForm((p) => ({ ...p, telefono: e.target.value }))}
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label small">Email</label>
                          <input
                            className="form-control"
                            type="email"
                            value={clienteForm.email}
                            onChange={(e) => setClienteForm((p) => ({ ...p, email: e.target.value }))}
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label small">CIF</label>
                          <input
                            className="form-control"
                            value={clienteForm.cif}
                            onChange={(e) => setClienteForm((p) => ({ ...p, cif: e.target.value }))}
                          />
                        </div>
                        <div className="col-12">
                          <label className="form-label small">Dirección</label>
                          <input
                            className="form-control"
                            value={clienteForm.direccion}
                            onChange={(e) => setClienteForm((p) => ({ ...p, direccion: e.target.value }))}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {!editandoId && (
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Vehículo para la cita</label>
                      <div className="d-flex gap-3 flex-wrap">
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="radio"
                            name="cocheModo"
                            id="cocheExistente"
                            checked={cocheModo === "existente"}
                            onChange={() => setCocheModo("existente")}
                          />
                          <label className="form-check-label" htmlFor="cocheExistente">Coche existente</label>
                        </div>
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="radio"
                            name="cocheModo"
                            id="cocheNuevo"
                            checked={cocheModo === "nuevo"}
                            onChange={() => {
                              setCocheModo("nuevo");
                              setForm((prev) => ({ ...prev, coche_id: "" }));
                            }}
                          />
                          <label className="form-check-label" htmlFor="cocheNuevo">Registrar coche nuevo</label>
                        </div>
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="radio"
                            name="cocheModo"
                            id="sinCoche"
                            checked={cocheModo === "sin"}
                            onChange={() => {
                              setCocheModo("sin");
                              setForm((prev) => ({ ...prev, coche_id: "" }));
                            }}
                          />
                          <label className="form-check-label" htmlFor="sinCoche">Sin coche específico</label>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mb-3">
                    {(editandoId || cocheModo === "existente") && (
                      <>
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
                      </>
                    )}

                    {!editandoId && cocheModo === "nuevo" && (
                      <div className="border rounded p-3 sw-surface-light" style={{}}>
                        <h6 className="fw-semibold mb-3">🚗 Nuevo coche</h6>
                        <div className="row g-2">
                          <div className="col-md-6">
                            <label className="form-label small">Matrícula *</label>
                            <input
                              className="form-control"
                              value={cocheForm.matricula}
                              onChange={(e) => setCocheForm((p) => ({ ...p, matricula: e.target.value.toUpperCase() }))}
                              required={cocheModo === "nuevo"}
                            />
                          </div>
                          <div className="col-md-6">
                            <label className="form-label small">Marca</label>
                            <input
                              className="form-control"
                              value={cocheForm.marca}
                              onChange={(e) => setCocheForm((p) => ({ ...p, marca: e.target.value }))}
                            />
                          </div>
                          <div className="col-md-6">
                            <label className="form-label small">Modelo</label>
                            <input
                              className="form-control"
                              value={cocheForm.modelo}
                              onChange={(e) => setCocheForm((p) => ({ ...p, modelo: e.target.value }))}
                            />
                          </div>
                          <div className="col-md-6">
                            <label className="form-label small">Color</label>
                            <input
                              className="form-control"
                              value={cocheForm.color}
                              onChange={(e) => setCocheForm((p) => ({ ...p, color: e.target.value }))}
                            />
                          </div>
                        </div>
                      </div>
                    )}
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
                    <label className="form-label fw-semibold">Servicio del catálogo (opcional)</label>
                    <select
                      className="form-select"
                      value={servicioSeleccionadoId}
                      onChange={(e) => {
                        const selected = serviciosCatalogo.find((s) => String(s.id) === e.target.value);
                        setForm((prev) => ({
                          ...prev,
                          motivo: selected ? selected.nombre : "",
                        }));
                      }}
                    >
                      <option value="">Selecciona un servicio...</option>
                      {serviciosCatalogo.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nombre}{typeof s.precio_base === "number" ? ` · ${s.precio_base.toFixed(2)}€` : ""}
                        </option>
                      ))}
                    </select>
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
                    className="btn fw-semibold sw-btn-accent-gold"
                    style={{ borderRadius: "8px" }}
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
