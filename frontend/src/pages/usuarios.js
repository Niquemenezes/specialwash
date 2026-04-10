import React, { useContext, useEffect, useMemo, useState } from "react";
import { Context } from "../store/appContext";
import { normalizeRol } from "../utils/authSession";
import { confirmar } from "../utils/confirmar";
import { toast } from "../utils/toast";
import EmptyState from "../components/EmptyState.jsx";

/* ── Iconos SVG ─────────────────────────────────────────────────── */
const ICONS = {
  users:  (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>),
  plus:   (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>),
  edit:   (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>),
  trash:  (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>),
  search: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>),
  save:   (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>),
};

const ROL_COLORS = {
  administrador: { bg: "rgba(212,175,55,0.12)", border: "rgba(212,175,55,0.35)", text: "#d4af37" },
  encargado:     { bg: "rgba(99,102,241,0.12)", border: "rgba(99,102,241,0.35)", text: "#818cf8" },
  detailing:     { bg: "rgba(56,189,248,0.12)", border: "rgba(56,189,248,0.35)", text: "#38bdf8" },
  calidad:       { bg: "rgba(34,197,94,0.12)",  border: "rgba(34,197,94,0.35)",  text: "#22c55e" },
  pintura:       { bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.35)", text: "#fb923c" },
  tapicero:      { bg: "rgba(168,85,247,0.12)", border: "rgba(168,85,247,0.35)", text: "#c084fc" },
};

export default function Usuarios() {
  const { store, actions } = useContext(Context);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState(null);

  const [form, setForm] = useState({
    nombre: "",
    email: "",
    password: "",
    rol: "detailing",
    activo: true,
  });

  // ================================
  // Carga inicial
  // ================================
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        await actions.getUsuarios();
      } catch (err) {
        if (alive) setError(err?.message || "No se pudieron cargar los usuarios");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [actions]);

  // ================================
  // Filtrar usuarios
  // ================================
  const usuarios = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = store.usuarios || [];

    if (!q) return list;

    return list.filter((u) => {
      const s = `${u.nombre || ""} ${u.email || ""} ${u.rol || ""}`.toLowerCase();
      return s.includes(q);
    });
  }, [store.usuarios, filter]);

  // ================================
  // Acciones
  // ================================
  const startCreate = () => {
    setFormError("");
    setEditing({});
    setForm({
      nombre: "",
      email: "",
      password: "",
      rol: "detailing",
      activo: true,
    });
  };

  const startEdit = (u) => {
    setEditing(u);
    setForm({
      nombre: u.nombre || "",
      email: u.email || "",
      password: "",
      rol: normalizeRol(u.rol) || "detailing",
      activo: "activo" in u ? !!u.activo : true,
    });
  };

  const cancel = () => {
    setFormError("");
    setEditing(null);
    setForm({
      nombre: "",
      email: "",
      password: "",
      rol: "detailing",
      activo: true,
    });
  };

  const save = async (e) => {
    e?.preventDefault?.();

    if (!form.nombre.trim()) { setFormError("El nombre es obligatorio"); return; }
    if (!form.email.trim()) { setFormError("El email es obligatorio"); return; }
    if (!editing?.id && !form.password.trim()) { setFormError("La contraseña es obligatoria al crear"); return; }
    setFormError("");

    try {
      const payload = {
        nombre: form.nombre.trim(),
        email: form.email.trim().toLowerCase(),
        rol: form.rol,
        activo: form.activo,
      };
      if (form.password.trim()) payload.password = form.password.trim();

      if (editing?.id) {
        await actions.updateUsuario(editing.id, payload);
        toast.success("Usuario actualizado");
      } else {
        await actions.createUsuario(payload);
        toast.success("Usuario creado");
      }
      cancel();
    } catch (err) {
      setFormError(err.message);
    }
  };

  const remove = async (u) => {
    if (!await confirmar(`¿Eliminar usuario "${u.nombre}"?`)) return;
    try {
      await actions.deleteUsuario(u.id);
      toast.success("Usuario eliminado");
    } catch (err) {
      setError(err.message);
    }
  };

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  };

  // ================================
  // Render
  // ================================
  return (
    <div className="sw-ent-wrapper">

      {/* ── Hero ─────────────────────────────────────────────── */}
      <div className="sw-veh-hero">
        <div className="sw-veh-hero-inner container">
          <div className="sw-veh-hero-body">
            <div className="sw-veh-hero-icon">
              <span style={{ width: 24, height: 24, display: "flex" }}>{ICONS.users}</span>
            </div>
            <div style={{ flex: 1 }}>
              <p className="sw-home-eyebrow" style={{ marginBottom: "0.2rem" }}>Administración</p>
              <h1 className="sw-veh-hero-title">Usuarios</h1>
              <p className="sw-veh-hero-sub">Gestión de cuentas, roles y accesos al sistema</p>
            </div>
            <button className="sw-ent-submit-btn" onClick={startCreate}>
              <span style={{ width: 16, height: 16, display: "inline-flex" }}>{ICONS.plus}</span>
              Nuevo usuario
            </button>
          </div>
        </div>
      </div>

      <div className="container sw-ent-content">

        {/* ── Error global ────────────────────────────────────── */}
        {error && (
          <div style={{
            padding: "0.85rem 1.1rem", borderRadius: 10, marginBottom: "0.5rem",
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
            color: "#fca5a5", fontSize: "0.875rem", display: "flex", justifyContent: "space-between",
          }}>
            <span>{error}</span>
            <button onClick={() => setError("")} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", opacity: 0.6 }}>✕</button>
          </div>
        )}

        {/* ── Formulario creación / edición ────────────────────── */}
        {editing !== null && (
          <div className="sw-ent-card" style={{ animation: "sw-fade-up 0.3s ease both" }}>
            <div className="sw-ent-card-header">
              <div className="sw-ent-card-header-icon" style={{ background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.22)", color: "var(--sw-accent,#d4af37)" }}>
                <span style={{ width: 18, height: 18, display: "flex" }}>{editing?.id ? ICONS.edit : ICONS.plus}</span>
              </div>
              <div>
                <p className="sw-ent-card-eyebrow">{editing?.id ? "Modificar registro" : "Nuevo registro"}</p>
                <h2 className="sw-ent-card-title">{editing?.id ? "Editar usuario" : "Crear nuevo usuario"}</h2>
              </div>
            </div>

            <form onSubmit={save}>
              <div className="sw-ent-card-body">
                <div className="sw-ent-grid">
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                    <label className="sw-plbl">Nombre <span style={{ color: "var(--sw-accent,#d4af37)" }}>*</span></label>
                    <input className="form-control sw-pinput" name="nombre" value={form.nombre} onChange={onChange} required placeholder="Nombre completo" />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                    <label className="sw-plbl">Email <span style={{ color: "var(--sw-accent,#d4af37)" }}>*</span></label>
                    <input className="form-control sw-pinput" name="email" type="email" value={form.email} onChange={onChange} required placeholder="correo@ejemplo.com" />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                    <label className="sw-plbl">Rol <span style={{ color: "var(--sw-accent,#d4af37)" }}>*</span></label>
                    <select className="form-select sw-pinput" name="rol" value={form.rol} onChange={onChange} required>
                      <option value="detailing">Detailing</option>
                      <option value="calidad">Calidad</option>
                      <option value="pintura">Pintura</option>
                      <option value="tapicero">Tapicero</option>
                      <option value="administrador">Administrador</option>
                      <option value="encargado">Encargado</option>
                    </select>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                    <label className="sw-plbl">Contraseña {editing?.id ? <span style={{ fontSize: "0.72rem", color: "var(--sw-muted)" }}>(vacío = sin cambios)</span> : <span style={{ color: "var(--sw-accent,#d4af37)" }}>*</span>}</label>
                    <input className="form-control sw-pinput" name="password" type="password" value={form.password} onChange={onChange} placeholder={editing?.id ? "••••••••" : "Mínimo 6 caracteres"} />
                  </div>
                </div>

                {"activo" in form && (
                  <label style={{ display: "flex", alignItems: "center", gap: "0.6rem", cursor: "pointer", fontSize: "0.875rem", color: "var(--sw-text)", userSelect: "none" }}>
                    <input
                      type="checkbox"
                      name="activo"
                      id="user-activo"
                      checked={!!form.activo}
                      onChange={onChange}
                      style={{ width: 16, height: 16, accentColor: "var(--sw-accent,#d4af37)", cursor: "pointer" }}
                    />
                    Usuario activo
                  </label>
                )}

                {formError && (
                  <div style={{
                    padding: "0.75rem 1rem", borderRadius: 8,
                    background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
                    color: "#fca5a5", fontSize: "0.85rem", display: "flex", justifyContent: "space-between",
                  }}>
                    <span>{formError}</span>
                    <button type="button" onClick={() => setFormError("")} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", opacity: 0.6 }}>✕</button>
                  </div>
                )}
              </div>

              <div className="sw-ent-card-footer" style={{ gap: "0.65rem" }}>
                <button type="button" onClick={cancel} style={{
                  padding: "0.5rem 1.25rem", borderRadius: 8, border: "1px solid var(--sw-border)",
                  background: "transparent", color: "var(--sw-text)", cursor: "pointer", fontWeight: 600, fontSize: "0.85rem",
                }}>
                  Cancelar
                </button>
                <button type="submit" className="sw-ent-submit-btn" style={{ padding: "0.5rem 1.5rem" }}>
                  <span style={{ width: 15, height: 15, display: "inline-flex" }}>{ICONS.save}</span>
                  Guardar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Buscador ─────────────────────────────────────────── */}
        <div style={{
          display: "flex", alignItems: "center", gap: "0.65rem",
          background: "var(--sw-surface)", border: "1px solid var(--sw-border)",
          borderRadius: 12, padding: "0.6rem 1rem",
        }}>
          <span style={{ width: 16, height: 16, display: "flex", color: "var(--sw-muted)", flexShrink: 0 }}>{ICONS.search}</span>
          <input
            className="sw-pinput"
            style={{ border: "none", background: "transparent", flex: 1, outline: "none", color: "var(--sw-text)", fontSize: "0.875rem" }}
            placeholder="Buscar por nombre, email o rol…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          {filter && (
            <button onClick={() => setFilter("")} style={{ background: "none", border: "none", color: "var(--sw-muted)", cursor: "pointer", padding: 2, fontSize: "0.85rem" }}>✕</button>
          )}
        </div>

        {/* ── Tabla ────────────────────────────────────────────── */}
        <div className="sw-ent-table-card">
          <div className="sw-ent-table-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p className="sw-home-eyebrow" style={{ marginBottom: 0 }}>Listado</p>
              <h3 className="sw-ent-table-title">
                {usuarios.length} {usuarios.length === 1 ? "usuario" : "usuarios"}
                {filter && <span style={{ fontSize: "0.75rem", color: "var(--sw-muted)", fontWeight: 400, marginLeft: 6 }}>— filtrado</span>}
              </h3>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table mb-0 sw-ent-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th style={{ width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan="5" style={{ textAlign: "center", padding: "2rem", color: "var(--sw-muted)", fontSize: "0.875rem" }}>
                      Cargando…
                    </td>
                  </tr>
                )}
                {!loading && usuarios.length === 0 && (
                  <EmptyState
                    colSpan={5}
                    title="Sin usuarios"
                    subtitle="No hay usuarios registrados. Crea el primero con el botón Nuevo usuario."
                  />
                )}
                {!loading && usuarios.map((u) => {
                  const rol = normalizeRol(u.rol) || "detailing";
                  const rc = ROL_COLORS[rol] || ROL_COLORS.detailing;
                  return (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 600, fontSize: "0.875rem" }}>{u.nombre}</td>
                      <td style={{ fontSize: "0.82rem", color: "var(--sw-muted)" }}>{u.email}</td>
                      <td>
                        <span style={{
                          display: "inline-block", padding: "0.2rem 0.65rem",
                          borderRadius: 999, fontSize: "0.72rem", fontWeight: 700,
                          letterSpacing: "0.06em", textTransform: "capitalize",
                          background: rc.bg, border: `1px solid ${rc.border}`, color: rc.text,
                        }}>
                          {rol}
                        </span>
                      </td>
                      <td>
                        <span style={{
                          display: "inline-block", padding: "0.2rem 0.6rem",
                          borderRadius: 999, fontSize: "0.72rem", fontWeight: 700,
                          background: u.activo ? "rgba(34,197,94,0.10)" : "rgba(239,68,68,0.10)",
                          border: `1px solid ${u.activo ? "rgba(34,197,94,0.30)" : "rgba(239,68,68,0.30)"}`,
                          color: u.activo ? "#22c55e" : "#ef4444",
                        }}>
                          {u.activo ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button className="sw-ent-icon-btn" title="Editar" onClick={() => startEdit(u)}>
                            <span style={{ width: 14, height: 14, display: "flex" }}>{ICONS.edit}</span>
                          </button>
                          <button className="sw-ent-icon-btn sw-ent-icon-btn--danger" title="Eliminar" onClick={() => remove(u)}>
                            <span style={{ width: 14, height: 14, display: "flex" }}>{ICONS.trash}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}