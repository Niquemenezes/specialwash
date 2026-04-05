import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { Context } from "../store/appContext";

export default function Proveedores() {
  const { store, actions } = useContext(Context);
  const formRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [formError, setFormError] = useState("");
  const [editing, setEditing] = useState(null); // null = oculto, {} = nuevo, obj = editar

  const [form, setForm] = useState({
    nombre: "",
    telefono: "",
    email: "",
    direccion: "",
    contacto: "",
    notas: "",
  });

  // ================================
  // Cargar proveedores
  // ================================
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await actions.getProveedores?.();
      } finally {
        setLoading(false);
      }
    })();
  }, [actions]);

  // Filtrado
  const proveedores = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = store.proveedores || [];
    if (!q) return list;

    return list.filter((p) => {
      const s = `${p.nombre || ""} ${p.email || ""} ${p.telefono || ""}`.toLowerCase();
      return s.includes(q);
    });
  }, [store.proveedores, filter]);

  // ================================
  // CRUD helpers
  // ================================
  const startCreate = () => {
    setEditing({});
    setForm({
      nombre: "",
      telefono: "",
      email: "",
      direccion: "",
      contacto: "",
      notas: "",
    });
  };

  const startEdit = (p) => {
    setEditing(p);
    setForm({
      nombre: p.nombre || "",
      telefono: p.telefono || "",
      email: p.email || "",
      direccion: p.direccion || "",
      contacto: p.contacto || "",
      notas: p.notas || "",
    });
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  };

  const cancel = () => {
    setFormError("");
    setEditing(null);
    setForm({
      nombre: "",
      telefono: "",
      email: "",
      direccion: "",
      contacto: "",
      notas: "",
    });
  };

  const save = async (e) => {
    e?.preventDefault?.();

    if (!form.nombre.trim()) { setFormError("El nombre es obligatorio"); return; }
    setFormError("");

    try {
      const payload = {
        nombre: form.nombre.trim(),
        telefono: form.telefono.trim() || undefined,
        email: form.email.trim() || undefined,
        direccion: form.direccion.trim() || undefined,
        contacto: form.contacto.trim() || undefined,
        notas: form.notas.trim() || undefined,
      };

      if (editing?.id) {
        await actions.updateProveedor(editing.id, payload);
      } else {
        await actions.createProveedor(payload);
      }

      cancel();
    } catch (err) {
      setFormError(err.message);
    }
  };

  const remove = async (p) => {
    if (!window.confirm(`¿Eliminar proveedor "${p.nombre}"?`)) return;

    try {
      await actions.deleteProveedor(p.id);
    } catch (err) {
      setFormError(err.message);
    }
  };

  const onChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  // ================================
  // RENDER
  // ================================
  return (
    <div className="container py-4" style={{ maxWidth: "1100px" }}>
      {/* Encabezado */}
      <div
        className="d-flex justify-content-between align-items-center p-3 mb-4 shadow-sm"
        style={{
          background: "#0f0f0f",
          borderRadius: "12px",
          color: "white",
        }}
      >
        <h2 className="fw-bold mb-0" style={{ color: "#d4af37" }}>
          🧾 Proveedores
        </h2>

        <button
          className="btn"
          style={{
            background: "#d4af37",
            color: "black",
            fontWeight: "600",
            borderRadius: "8px",
          }}
          onClick={startCreate}
        >
          ➕ Nuevo proveedor
        </button>
      </div>

      {/* Buscador */}
      <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: "12px" }}>
        <div className="card-body">
          <input
            className="form-control"
            placeholder="Buscar por nombre, email o teléfono…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ borderRadius: "10px" }}
          />
        </div>
      </div>

      {/* Formulario */}
      {editing !== null && (
        <div
          ref={formRef}
          className="card shadow-sm mb-4"
          style={{
            borderRadius: "12px",
            border: "1px solid #d4af37",
          }}
        >
          <div className="card-body">
            <h5 className="card-title fw-bold">
              {editing?.id ? "Editar proveedor" : "Nuevo proveedor"}
            </h5>

            <form onSubmit={save} className="row g-3 mt-2">

              <div className="col-md-6">
                <label className="form-label fw-semibold">Nombre *</label>
                <input
                  className="form-control"
                  name="nombre"
                  value={form.nombre}
                  onChange={onChange}
                  required
                  style={{ borderRadius: "10px" }}
                />
              </div>

              <div className="col-md-6">
                <label className="form-label fw-semibold">Teléfono</label>
                <input
                  className="form-control"
                  name="telefono"
                  value={form.telefono}
                  onChange={onChange}
                  style={{ borderRadius: "10px" }}
                />
              </div>

              <div className="col-md-6">
                <label className="form-label fw-semibold">Email</label>
                <input
                  className="form-control"
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={onChange}
                  style={{ borderRadius: "10px" }}
                />
              </div>

              <div className="col-md-6">
                <label className="form-label fw-semibold">Contacto</label>
                <input
                  className="form-control"
                  name="contacto"
                  value={form.contacto}
                  onChange={onChange}
                  style={{ borderRadius: "10px" }}
                />
              </div>

              <div className="col-md-12">
                <label className="form-label fw-semibold">Dirección</label>
                <input
                  className="form-control"
                  name="direccion"
                  value={form.direccion}
                  onChange={onChange}
                  style={{ borderRadius: "10px" }}
                />
              </div>

              <div className="col-md-12">
                <label className="form-label fw-semibold">Notas</label>
                <textarea
                  className="form-control"
                  rows="3"
                  name="notas"
                  value={form.notas}
                  onChange={onChange}
                  style={{ borderRadius: "10px" }}
                />
              </div>

              {formError && (
                <div className="col-12">
                  <div className="alert alert-danger d-flex justify-content-between align-items-start py-2 mb-0">
                    <span>{formError}</span>
                    <button className="btn-close ms-3" onClick={() => setFormError("")} />
                  </div>
                </div>
              )}

              {/* Botones */}
              <div className="col-12 d-flex gap-2 mt-2">
                <button
                  className="btn"
                  type="submit"
                  style={{
                    background: "#d4af37",
                    color: "black",
                    fontWeight: "600",
                    borderRadius: "10px",
                  }}
                >
                  💾 Guardar
                </button>

                <button
                  className="btn btn-outline-secondary"
                  type="button"
                  onClick={cancel}
                  style={{ borderRadius: "10px" }}
                >
                  Cancelar
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Tabla de proveedores */}
      <div
        className="card border-0 shadow-sm"
        style={{ borderRadius: "12px" }}
      >
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead style={{ background: "#f8f8f8" }}>
              <tr>
                <th>Nombre</th>
                <th>Contacto</th>
                <th>Email</th>
                <th>Teléfono</th>
                <th className="text-end">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td colSpan="5" className="py-4 text-center text-muted">
                    Cargando…
                  </td>
                </tr>
              )}

              {!loading && proveedores.length === 0 && (
                <tr>
                  <td colSpan="5" className="py-4 text-center text-muted">
                    Sin proveedores.
                  </td>
                </tr>
              )}

              {!loading &&
                proveedores.map((p) => (
                  <tr key={p.id}>
                    <td className="fw-semibold">{p.nombre}</td>
                    <td>{p.contacto || "-"}</td>
                    <td>{p.email || "-"}</td>
                    <td>{p.telefono || "-"}</td>

                    <td className="text-end">
                      <button
                        className="btn btn-sm btn-outline-warning me-1"
                        onClick={() => startEdit(p)}
                        title="Editar"
                      >
                        ✏️
                      </button>
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => remove(p)}
                        title="Eliminar"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>

          </table>
        </div>
      </div>
    </div>
  );
}