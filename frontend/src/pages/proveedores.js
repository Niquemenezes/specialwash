import React, { useContext, useEffect, useMemo, useState } from "react";
import { Context } from "../store/appContext";
import { confirmar } from "../utils/confirmar";
import { toast } from "../utils/toast";
import EmptyState from "../components/EmptyState.jsx";

/* ── Iconos SVG ─────────────────────────────────────────────────── */
const ICONS = {
  proveedores: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>),
  search:      (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>),
  plus:        (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>),
  pen:         (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>),
  trash:       (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>),
  phone:       (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.65 3.38 2 2 0 0 1 3.62 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.46a16 16 0 0 0 6.01 6.01l1.54-1.54a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>),
  mail:        (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>),
  user:        (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>),
  close:       (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>),
  save:        (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>),
};

const EMPTY_FORM = { nombre: "", telefono: "", email: "", direccion: "", contacto: "", notas: "" };

export default function Proveedores() {
  const { store, actions } = useContext(Context);

  const [loading, setLoading]     = useState(false);
  const [filter, setFilter]       = useState("");
  const [formError, setFormError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState(null); // null = crear, obj = editar
  const [saving, setSaving]       = useState(false);
  const [form, setForm]           = useState(EMPTY_FORM);

  /* ── Cargar ──────────────────────────────────────────────────── */
  useEffect(() => {
    (async () => {
      setLoading(true);
      try { await actions.getProveedores?.(); }
      finally { setLoading(false); }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Filtrado ────────────────────────────────────────────────── */
  const proveedores = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = store.proveedores || [];
    if (!q) return list;
    return list.filter((p) =>
      `${p.nombre || ""} ${p.email || ""} ${p.telefono || ""}`.toLowerCase().includes(q)
    );
  }, [store.proveedores, filter]);

  /* ── Modal helpers ───────────────────────────────────────────── */
  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setShowModal(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({
      nombre: p.nombre || "",
      telefono: p.telefono || "",
      email: p.email || "",
      direccion: p.direccion || "",
      contacto: p.contacto || "",
      notas: p.notas || "",
    });
    setFormError("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError("");
  };

  /* ── CRUD ────────────────────────────────────────────────────── */
  const save = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) { setFormError("El nombre es obligatorio"); return; }
    setSaving(true);
    setFormError("");
    try {
      const payload = {
        nombre:    form.nombre.trim(),
        telefono:  form.telefono.trim()  || undefined,
        email:     form.email.trim()     || undefined,
        direccion: form.direccion.trim() || undefined,
        contacto:  form.contacto.trim()  || undefined,
        notas:     form.notas.trim()     || undefined,
      };
      if (editing?.id) {
        await actions.updateProveedor(editing.id, payload);
        toast.success("Proveedor actualizado");
      } else {
        await actions.createProveedor(payload);
        toast.success("Proveedor creado");
      }
      closeModal();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p) => {
    if (!await confirmar(`¿Eliminar proveedor "${p.nombre}"?`)) return;
    try { await actions.deleteProveedor(p.id); toast.success("Proveedor eliminado"); }
    catch (err) { toast.error(err.message); }
  };

  const onField = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  /* ── Render ──────────────────────────────────────────────────── */
  return (
    <div className="sw-ent-wrapper">

      {/* ── Hero ──────────────────────────────────────────────── */}
      <div className="sw-veh-hero">
        <div className="sw-veh-hero-inner container">
          <div className="sw-veh-hero-body">
            <div className="sw-veh-hero-icon">
              <span style={{ width: 24, height: 24, display: "flex" }}>{ICONS.proveedores}</span>
            </div>
            <div style={{ flex: 1 }}>
              <p className="sw-home-eyebrow" style={{ marginBottom: "0.2rem" }}>Compras · Suministros</p>
              <h1 className="sw-veh-hero-title">Proveedores</h1>
              <p className="sw-veh-hero-sub">Gestión de proveedores y datos de contacto del taller</p>
            </div>
            <button
              className="sw-ent-submit-btn"
              onClick={openCreate}
              style={{ padding: "0.6rem 1.4rem", display: "flex", alignItems: "center", gap: "0.45rem" }}
            >
              <span style={{ width: 16, height: 16, display: "inline-flex" }}>{ICONS.plus}</span>
              Nuevo proveedor
            </button>
          </div>
        </div>
      </div>

      <div className="container sw-ent-content" style={{ maxWidth: 1100 }}>

        {/* ── Stats ─────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "1rem" }}>
          {[
            { label: "Total", value: (store.proveedores || []).length, color: "var(--sw-accent,#d4af37)" },
            { label: "Filtrados", value: proveedores.length, color: "#38bdf8" },
            { label: "Con email", value: (store.proveedores || []).filter(p => p.email).length, color: "#22c55e" },
            { label: "Con teléfono", value: (store.proveedores || []).filter(p => p.telefono).length, color: "#a78bfa" },
          ].map((item) => (
            <div key={item.label} style={{
              background: "var(--sw-surface)", border: "1px solid var(--sw-border)",
              borderRadius: 14, padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.25rem",
            }}>
              <span style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--sw-muted)" }}>{item.label}</span>
              <span style={{ fontSize: "1.5rem", fontWeight: 800, color: item.color, lineHeight: 1.2 }}>{item.value}</span>
            </div>
          ))}
        </div>

        {/* ── Buscador ──────────────────────────────────────── */}
        <div className="sw-ent-card" style={{ marginTop: "1.25rem" }}>
          <div className="sw-ent-card-header">
            <div className="sw-ent-card-header-icon" style={{ background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.22)", color: "var(--sw-accent,#d4af37)" }}>
              <span style={{ width: 18, height: 18, display: "flex" }}>{ICONS.search}</span>
            </div>
            <div>
              <p className="sw-ent-card-eyebrow">Búsqueda</p>
              <h2 className="sw-ent-card-title">Filtrar proveedores</h2>
            </div>
          </div>
          <div className="sw-ent-card-body">
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", width: 16, height: 16, color: "var(--sw-muted)", display: "flex", pointerEvents: "none" }}>{ICONS.search}</span>
              <input
                className="form-control sw-pinput"
                style={{ paddingLeft: "2.2rem" }}
                placeholder="Buscar por nombre, email o teléfono…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* ── Tabla ─────────────────────────────────────────── */}
        <div style={{
          background: "var(--sw-surface)", border: "1px solid var(--sw-border)",
          borderRadius: 16, overflow: "hidden", marginTop: "1.25rem",
          boxShadow: "0 4px 20px rgba(0,0,0,0.18)",
        }}>
          <div className="table-responsive">
            <table className="table align-middle mb-0" style={{ color: "var(--sw-text)" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--sw-border)", background: "var(--sw-surface-2)" }}>
                  {["Nombre", "Contacto", "Email", "Teléfono", "Notas", ""].map((h) => (
                    <th key={h} style={{
                      padding: "0.85rem 1rem", fontSize: "0.7rem", fontWeight: 700,
                      letterSpacing: "0.08em", textTransform: "uppercase",
                      color: "var(--sw-muted)", border: "none",
                      textAlign: h === "" ? "right" : "left",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "3rem", color: "var(--sw-muted)" }}>
                      <div className="spinner-border spinner-border-sm me-2" style={{ color: "var(--sw-accent,#d4af37)" }} />
                      Cargando…
                    </td>
                  </tr>
                )}
                {!loading && proveedores.length === 0 && (
                  <EmptyState
                    colSpan={6}
                    title={filter ? "Sin resultados" : "Sin proveedores"}
                    subtitle={filter ? `Ningún proveedor coincide con "${filter}".` : "No hay proveedores registrados. Añade el primero con Nuevo proveedor."}
                  />
                )}
                {!loading && proveedores.map((p) => (
                  <tr key={p.id} style={{ borderBottom: "1px solid var(--sw-border)", transition: "background 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "color-mix(in srgb,var(--sw-accent,#d4af37) 6%,transparent)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <td style={{ padding: "0.9rem 1rem", fontWeight: 700, color: "var(--sw-text)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                        <span style={{
                          width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                          background: "color-mix(in srgb,var(--sw-accent,#d4af37) 14%,transparent)",
                          border: "1px solid color-mix(in srgb,var(--sw-accent,#d4af37) 28%,transparent)",
                          color: "var(--sw-accent,#d4af37)", display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "0.85rem", fontWeight: 800,
                        }}>
                          {(p.nombre || "?")[0].toUpperCase()}
                        </span>
                        {p.nombre}
                      </div>
                    </td>
                    <td style={{ padding: "0.9rem 1rem", color: "var(--sw-muted)", fontSize: "0.88rem" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                        <span style={{ width: 13, height: 13, display: "inline-flex", opacity: 0.6 }}>{ICONS.user}</span>
                        {p.contacto || <span style={{ fontStyle: "italic", opacity: 0.4 }}>—</span>}
                      </span>
                    </td>
                    <td style={{ padding: "0.9rem 1rem", color: "var(--sw-muted)", fontSize: "0.88rem" }}>
                      {p.email
                        ? <a href={`mailto:${p.email}`} style={{ color: "#38bdf8", textDecoration: "none", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                            <span style={{ width: 13, height: 13, display: "inline-flex" }}>{ICONS.mail}</span>
                            {p.email}
                          </a>
                        : <span style={{ fontStyle: "italic", opacity: 0.4 }}>—</span>}
                    </td>
                    <td style={{ padding: "0.9rem 1rem", color: "var(--sw-muted)", fontSize: "0.88rem" }}>
                      {p.telefono
                        ? <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                            <span style={{ width: 13, height: 13, display: "inline-flex", opacity: 0.6 }}>{ICONS.phone}</span>
                            {p.telefono}
                          </span>
                        : <span style={{ fontStyle: "italic", opacity: 0.4 }}>—</span>}
                    </td>
                    <td style={{ padding: "0.9rem 1rem", color: "var(--sw-muted)", fontSize: "0.82rem", maxWidth: 200 }}>
                      <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {p.notas || <span style={{ fontStyle: "italic", opacity: 0.4 }}>—</span>}
                      </span>
                    </td>
                    <td style={{ padding: "0.9rem 1rem", textAlign: "right" }}>
                      <div style={{ display: "flex", gap: "0.4rem", justifyContent: "flex-end" }}>
                        <button
                          onClick={() => openEdit(p)}
                          title="Editar"
                          style={{
                            background: "color-mix(in srgb,var(--sw-accent,#d4af37) 12%,transparent)",
                            border: "1px solid color-mix(in srgb,var(--sw-accent,#d4af37) 30%,transparent)",
                            color: "var(--sw-accent,#d4af37)", borderRadius: 8,
                            padding: "0.35rem 0.55rem", cursor: "pointer", display: "flex", alignItems: "center",
                            transition: "background 0.15s",
                          }}
                        >
                          <span style={{ width: 15, height: 15, display: "flex" }}>{ICONS.pen}</span>
                        </button>
                        <button
                          onClick={() => remove(p)}
                          title="Eliminar"
                          style={{
                            background: "color-mix(in srgb,var(--sw-danger,#ef4444) 10%,transparent)",
                            border: "1px solid color-mix(in srgb,var(--sw-danger,#ef4444) 28%,transparent)",
                            color: "var(--sw-danger,#ef4444)", borderRadius: 8,
                            padding: "0.35rem 0.55rem", cursor: "pointer", display: "flex", alignItems: "center",
                            transition: "background 0.15s",
                          }}
                        >
                          <span style={{ width: 15, height: 15, display: "flex" }}>{ICONS.trash}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* ── Modal crear / editar ───────────────────────────────── */}
      {showModal && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 1050,
            background: "var(--sw-overlay-bg,rgba(0,0,0,0.55))",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "1rem", backdropFilter: "blur(4px)",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div style={{
            background: "var(--sw-surface)", border: "1px solid var(--sw-border)",
            borderRadius: 20, width: "100%", maxWidth: 580,
            boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
            animation: "sw-fade-up 0.22s ease both",
          }}>
            {/* Header modal */}
            <div style={{
              padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--sw-border)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span style={{
                  width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
                  background: "color-mix(in srgb,var(--sw-accent,#d4af37) 14%,transparent)",
                  border: "1px solid color-mix(in srgb,var(--sw-accent,#d4af37) 28%,transparent)",
                  color: "var(--sw-accent,#d4af37)",
                }}>
                  <span style={{ width: 18, height: 18, display: "flex" }}>{editing ? ICONS.pen : ICONS.plus}</span>
                </span>
                <div>
                  <p style={{ margin: 0, fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--sw-muted)" }}>
                    {editing ? "Modificar datos" : "Registrar nuevo"}
                  </p>
                  <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "var(--sw-text)" }}>
                    {editing ? "Editar proveedor" : "Nuevo proveedor"}
                  </h3>
                </div>
              </div>
              <button
                onClick={closeModal}
                style={{ background: "none", border: "none", color: "var(--sw-muted)", cursor: "pointer", padding: "0.25rem", borderRadius: 6, display: "flex" }}
              >
                <span style={{ width: 20, height: 20, display: "flex" }}>{ICONS.close}</span>
              </button>
            </div>

            {/* Body modal */}
            <form onSubmit={save}>
              <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>

                {formError && (
                  <div style={{
                    background: "color-mix(in srgb,var(--sw-danger,#ef4444) 12%,transparent)",
                    border: "1px solid color-mix(in srgb,var(--sw-danger,#ef4444) 30%,transparent)",
                    color: "var(--sw-danger,#ef4444)", borderRadius: 10, padding: "0.65rem 1rem",
                    fontSize: "0.88rem",
                  }}>
                    {formError}
                  </div>
                )}

                <div className="sw-ent-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                    <label className="sw-plbl">Nombre *</label>
                    <input name="nombre" className="form-control sw-pinput" value={form.nombre} onChange={onField} placeholder="Nombre del proveedor" autoFocus required />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                    <label className="sw-plbl">Persona de contacto</label>
                    <input name="contacto" className="form-control sw-pinput" value={form.contacto} onChange={onField} placeholder="Nombre del contacto" />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                    <label className="sw-plbl">Teléfono</label>
                    <input name="telefono" className="form-control sw-pinput" value={form.telefono} onChange={onField} placeholder="+34 600 000 000" />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                    <label className="sw-plbl">Email</label>
                    <input name="email" type="email" className="form-control sw-pinput" value={form.email} onChange={onField} placeholder="correo@proveedor.com" />
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  <label className="sw-plbl">Dirección</label>
                  <input name="direccion" className="form-control sw-pinput" value={form.direccion} onChange={onField} placeholder="Calle, número, ciudad…" />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  <label className="sw-plbl">Notas</label>
                  <textarea name="notas" className="form-control sw-pinput" rows={3} value={form.notas} onChange={onField} placeholder="Condiciones de pago, observaciones…" style={{ resize: "vertical" }} />
                </div>
              </div>

              {/* Footer modal */}
              <div style={{
                padding: "1rem 1.5rem", borderTop: "1px solid var(--sw-border)",
                display: "flex", gap: "0.75rem", justifyContent: "flex-end",
              }}>
                <button
                  type="button"
                  onClick={closeModal}
                  style={{
                    background: "transparent", border: "1px solid var(--sw-border)",
                    color: "var(--sw-text)", borderRadius: 10,
                    padding: "0.6rem 1.25rem", cursor: "pointer", fontWeight: 600, fontSize: "0.9rem",
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="sw-ent-submit-btn"
                  disabled={saving}
                  style={{ padding: "0.6rem 1.5rem", display: "flex", alignItems: "center", gap: "0.4rem" }}
                >
                  <span style={{ width: 15, height: 15, display: "inline-flex" }}>{ICONS.save}</span>
                  {saving ? "Guardando…" : editing ? "Guardar cambios" : "Crear proveedor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
