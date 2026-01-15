import React, { useContext, useEffect, useMemo, useState } from "react";
import { Context } from "../store/appContext";

// Normalización de roles
const normalizeRol = (r) => {
  r = (r || "").toLowerCase().trim();
  if (["admin", "administrator"].includes(r)) return "administrador";
  if (["employee", "staff"].includes(r)) return "empleado";
  if (["manager", "responsable"].includes(r)) return "encargado";
  return r;
};

export default function Usuarios() {
  const { store, actions } = useContext(Context);

  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState(null);

  const [form, setForm] = useState({
    nombre: "",
    email: "",
    password: "",
    rol: "empleado",
    activo: true,
  });

  // ================================
  // Carga inicial
  // ================================
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        await actions.getUsuarios();
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

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
    setEditing({});
    setForm({
      nombre: "",
      email: "",
      password: "",
      rol: "empleado",
      activo: true,
    });
  };

  const startEdit = (u) => {
    setEditing(u);
    setForm({
      nombre: u.nombre || "",
      email: u.email || "",
      password: "",
      rol: normalizeRol(u.rol) || "empleado",
      activo: "activo" in u ? !!u.activo : true,
    });
  };

  const cancel = () => {
    setEditing(null);
    setForm({
      nombre: "",
      email: "",
      password: "",
      rol: "empleado",
      activo: true,
    });
  };

  const save = async (e) => {
    e?.preventDefault?.();

    if (!form.nombre.trim()) return alert("El nombre es obligatorio");
    if (!form.email.trim()) return alert("El email es obligatorio");
    if (!editing?.id && !form.password.trim())
      return alert("La contraseña es obligatoria al crear");

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
      } else {
        await actions.createUsuario(payload);
      }
      cancel();
    } catch (err) {
      alert(err.message);
    }
  };

  const remove = async (u) => {
    if (!window.confirm(`¿Eliminar usuario "${u.nombre}"?`)) return;
    try {
      await actions.deleteUsuario(u.id);
    } catch (err) {
      alert(err.message);
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
    <div className="container py-4" style={{ maxWidth: "1100px" }}>
      
      {/* HEADER PREMIUM */}
      <div
        className="d-flex justify-content-between align-items-center p-3 mb-4 shadow-sm"
        style={{
          background: "#0f0f0f",
          borderRadius: "12px",
          color: "white",
        }}
      >
        <h2 className="fw-bold m-0" style={{ color: "#d4af37" }}>
          👥 Usuarios
        </h2>
        <button
          className="btn btn-dark"
          style={{ borderColor: "#d4af37" }}
          onClick={startCreate}
        >
          <i className="fa-solid fa-user-plus me-2" /> Nuevo usuario
        </button>
      </div>

      {/* BUSCADOR */}
      <div className="row g-2 mb-3">
        <div className="col-12 col-md-6">
          <input
            className="form-control"
            placeholder="Buscar por nombre, email o rol…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ borderRadius: "10px" }}
          />
        </div>
      </div>

      {/* FORMULARIO DE CREACIÓN / EDICIÓN */}
      {editing !== null && (
        <div className="card mb-4 shadow-sm" style={{ borderRadius: "12px", border: "1px solid #d4af37" }}>
          <div className="card-body">
            <h5 className="card-title fw-semibold">
              {editing?.id ? "Editar usuario" : "Nuevo usuario"}
            </h5>

            <form onSubmit={save} className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Nombre *</label>
                <input
                  className="form-control"
                  name="nombre"
                  value={form.nombre}
                  onChange={onChange}
                  required
                  style={{ borderRadius: "8px" }}
                />
              </div>

              <div className="col-md-6">
                <label className="form-label">Email *</label>
                <input
                  className="form-control"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={onChange}
                  required
                  style={{ borderRadius: "8px" }}
                />
              </div>

              <div className="col-md-6">
                <label className="form-label">Rol *</label>
                <select
                  className="form-select"
                  name="rol"
                  value={form.rol}
                  onChange={onChange}
                  required
                  style={{ borderRadius: "8px" }}
                >
                  <option value="empleado">Empleado</option>
                  <option value="administrador">Administrador</option>
                  <option value="encargado">Encargado</option>
                </select>
              </div>

              <div className="col-md-6">
                <label className="form-label">
                  Contraseña {editing?.id ? "(vacío para no cambiar)" : "*"}
                </label>
                <input
                  className="form-control"
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={onChange}
                  style={{ borderRadius: "8px" }}
                />
              </div>

              {"activo" in form && (
                <div className="col-12">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      id="user-activo"
                      type="checkbox"
                      name="activo"
                      checked={!!form.activo}
                      onChange={onChange}
                    />
                    <label className="form-check-label" htmlFor="user-activo">
                      Usuario activo
                    </label>
                  </div>
                </div>
              )}

              <div className="col-12 d-flex gap-2">
                <button
                  className="btn btn-primary"
                  type="submit"
                  style={{ borderRadius: "8px" }}
                >
                  <i className="fa-solid fa-floppy-disk me-2" />
                  Guardar
                </button>

                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={cancel}
                  style={{ borderRadius: "8px" }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TABLA */}
      <div className="card shadow-sm" style={{ borderRadius: "12px" }}>
        <div className="table-responsive">
          <table className="table table-sm align-middle">
            <thead className="table-light">
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Activo</th>
                <th className="text-end">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td colSpan="5" className="text-center py-4">
                    Cargando…
                  </td>
                </tr>
              )}

              {!loading && usuarios.length === 0 && (
                <tr>
                  <td colSpan="5" className="text-center text-muted py-4">
                    No hay usuarios registrados
                  </td>
                </tr>
              )}

              {!loading &&
                usuarios.map((u) => (
                  <tr key={u.id}>
                    <td>{u.nombre}</td>
                    <td>{u.email}</td>
                    <td className="text-capitalize">{normalizeRol(u.rol)}</td>
                    <td>{u.activo ? "Sí" : "No"}</td>

                    <td className="text-end">
                      <button
                        className="btn btn-sm me-2"
                        onClick={() => startEdit(u)}
                        style={{ borderRadius: "8px" }}
                      >
                        <i className="fa-solid fa-pen-to-square" /> Editar
                      </button>

                      <button
                        className="btn btn-outline-danger btn-sm"
                        onClick={() => remove(u)}
                        style={{ borderRadius: "8px" }}
                      >
                        <i className="fa-solid fa-trash" /> Eliminar
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