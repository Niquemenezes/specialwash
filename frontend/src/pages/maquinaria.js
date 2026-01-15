import React, { useContext, useEffect, useMemo, useState } from "react";
import { Context } from "../store/appContext";

// ------- CONFIGURACIÓN DE GARANTÍA -------
const DAYS_WARNING = 90;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

function getWarrantyInfo(m) {
  if (!m.fecha_compra) {
    return { hasDate: false, status: "unknown", daysRemaining: null, endDate: null };
  }

  const buy = new Date(m.fecha_compra);
  if (isNaN(buy.getTime())) {
    return { hasDate: false, status: "unknown", daysRemaining: null, endDate: null };
  }

  const end = new Date(buy);
  end.setFullYear(end.getFullYear() + 3);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  const diffDays = Math.round((end - today) / MS_PER_DAY);

  let status = "ok";
  if (diffDays < 0) status = "expired";
  else if (diffDays <= DAYS_WARNING) status = "warning";

  return { hasDate: true, status, daysRemaining: diffDays, endDate: end };
}

function fmtDate(d) {
  if (!d) return "-";
  const dt = d instanceof Date ? d : new Date(d);
  return isNaN(dt.getTime()) ? "-" : dt.toLocaleDateString("es-ES");
}

export default function Maquinaria() {
  const { store, actions } = useContext(Context);

  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState(null);

  const [form, setForm] = useState({
    nombre: "",
    tipo: "",
    marca: "",
    modelo: "",
    numero_serie: "",
    ubicacion: "",
    estado: "",
    fecha_compra: "",
    notas: "",
  });

  // ---------------- LOAD ----------------
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await actions.getMaquinaria();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ---------------- FILTER ----------------
  const items = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = store.maquinaria || [];
    if (!q) return list;

    return list.filter((m) => {
      const s = `${m.nombre} ${m.tipo} ${m.marca} ${m.modelo} ${m.numero_serie} ${m.ubicacion}`
        .toLowerCase();
      return s.includes(q);
    });
  }, [store.maquinaria, filter]);

  const proximasGarantia = useMemo(
    () => items.filter((m) => getWarrantyInfo(m).status === "warning"),
    [items]
  );

  // ---------------- FORM HANDLERS ----------------
  const startCreate = () => {
    setEditing({});
    setForm({
      nombre: "",
      tipo: "",
      marca: "",
      modelo: "",
      numero_serie: "",
      ubicacion: "",
      estado: "",
      fecha_compra: "",
      notas: "",
    });
  };

  const startEdit = (m) => {
    setEditing(m);
    setForm({
      nombre: m.nombre || "",
      tipo: m.tipo || "",
      marca: m.marca || "",
      modelo: m.modelo || "",
      numero_serie: m.numero_serie || "",
      ubicacion: m.ubicacion || "",
      estado: m.estado || "",
      fecha_compra: (m.fecha_compra || "").slice(0, 10),
      notas: m.notas || "",
    });
  };

  const cancel = () => {
    setEditing(null);
    setForm({
      nombre: "",
      tipo: "",
      marca: "",
      modelo: "",
      numero_serie: "",
      ubicacion: "",
      estado: "",
      fecha_compra: "",
      notas: "",
    });
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) return alert("El nombre es obligatorio");

    const payload = {
      nombre: form.nombre.trim(),
      tipo: form.tipo.trim() || undefined,
      marca: form.marca.trim() || undefined,
      modelo: form.modelo.trim() || undefined,
      numero_serie: form.numero_serie.trim() || undefined,
      ubicacion: form.ubicacion.trim() || undefined,
      estado: form.estado.trim() || undefined,
      fecha_compra: form.fecha_compra || undefined,
      notas: form.notas.trim() || undefined,
    };

    try {
      if (editing?.id) await actions.updateMaquina(editing.id, payload);
      else await actions.createMaquina(payload);

      cancel();
    } catch (err) {
      alert(err.message);
    }
  };

  const remove = async (m) => {
    if (!window.confirm(`¿Eliminar máquina "${m.nombre}"?`)) return;
    try {
      await actions.deleteMaquina(m.id);
    } catch (err) {
      alert(err.message);
    }
  };

  const onChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  // ---------------- UI ----------------
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
        <h2 className="fw-bold m-0" style={{ color: "#d4af37" }}>⚙️ Maquinaria</h2>

        <button
          className="btn"
          onClick={startCreate}
          style={{
            background: "#d4af37",
            color: "black",
            fontWeight: "600",
            borderRadius: "8px",
          }}
        >
          <i className="fa-solid fa-plus me-2" />
          Nueva máquina
        </button>
      </div>

      {/* BADGES RESUMEN */}
      <div className="d-flex gap-3 mb-3">
        <span className="badge text-bg-secondary fs-6 px-3 py-2">
          Total: {items.length}
        </span>
        <span className="badge text-bg-warning text-dark fs-6 px-3 py-2">
          Garantía por vencer: {proximasGarantia.length}
        </span>
      </div>

      {/* ALERTA GARANTÍA */}
      {proximasGarantia.length > 0 && (
        <div className="alert alert-warning shadow-sm" style={{ borderRadius: "10px" }}>
          <strong>{proximasGarantia.length}</strong> máquina(s) con garantía próxima a vencer.
          <details className="mt-2">
            <summary>Ver detalle</summary>
            <ul className="mt-2">
              {proximasGarantia.slice(0, 8).map((m) => {
                const info = getWarrantyInfo(m);
                return (
                  <li key={m.id}>
                    {m.nombre} — vence {fmtDate(info.endDate)} ({info.daysRemaining} días)
                  </li>
                );
              })}
              {proximasGarantia.length > 8 && (
                <li>… y {proximasGarantia.length - 8} más</li>
              )}
            </ul>
          </details>
        </div>
      )}

      {/* BUSCADOR */}
      <div className="row g-2 mb-4">
        <div className="col-md-6">
          <input
            className="form-control"
            placeholder="Buscar maquinaria…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ borderRadius: "10px" }}
          />
        </div>
      </div>

      {/* FORMULARIO */}
      {editing !== null && (
        <div
          className="card shadow-sm mb-4"
          style={{ borderRadius: "14px", border: "1px solid #d4af37" }}
        >
          <div className="card-body">
            <h5 className="fw-bold mb-3">
              {editing?.id ? "Editar máquina" : "Nueva máquina"}
            </h5>

            <form onSubmit={save} className="row g-3">

              {Object.entries({
                nombre: "Nombre *",
                tipo: "Tipo",
                marca: "Marca",
                modelo: "Modelo",
                numero_serie: "Nº Serie",
                ubicacion: "Ubicación",
                estado: "Estado",
              }).map(([key, label]) => (
                <div className="col-md-6" key={key}>
                  <label className="form-label">{label}</label>
                  <input
                    className="form-control"
                    name={key}
                    value={form[key]}
                    onChange={onChange}
                    required={key === "nombre"}
                    style={{ borderRadius: "10px" }}
                  />
                </div>
              ))}

              <div className="col-md-6">
                <label className="form-label">Fecha compra</label>
                <input
                  type="date"
                  className="form-control"
                  name="fecha_compra"
                  value={form.fecha_compra}
                  onChange={onChange}
                />
              </div>

              <div className="col-12">
                <label className="form-label">Notas</label>
                <textarea
                  className="form-control"
                  rows="3"
                  name="notas"
                  value={form.notas}
                  onChange={onChange}
                  style={{ borderRadius: "10px" }}
                />
              </div>

              <div className="col-12 mt-3 d-flex gap-2">
                <button
                  className="btn"
                  type="submit"
                  style={{
                    background: "#d4af37",
                    color: "black",
                    fontWeight: "600",
                    borderRadius: "8px",
                    paddingLeft: "1rem",
                    paddingRight: "1rem",
                  }}
                >
                  <i className="fa-solid fa-save me-2" />
                  Guardar
                </button>
                <button
                  className="btn"
                  type="button"
                  onClick={cancel}
                  style={{
                    borderColor: "#d4af37",
                    color: "#d4af37",
                    background: "transparent",
                    borderStyle: "solid",
                    borderWidth: "1px",
                    borderRadius: "8px",
                    paddingLeft: "1rem",
                    paddingRight: "1rem",
                  }}
                >
                  Cancelar
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* TABLA */}
      <div className="card shadow-sm" style={{ borderRadius: "14px" }}>
        <div className="table-responsive">
          <table className="table align-middle">
            <thead className="table-light">
              <tr>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Marca</th>
                <th>Modelo</th>
                <th>Ubicación</th>
                <th>Estado</th>
                <th>Garantía</th>
                <th className="text-end">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr><td colSpan="8" className="text-center py-4">Cargando…</td></tr>
              )}

              {!loading && items.length === 0 && (
                <tr><td colSpan="8" className="text-center text-muted py-4">Sin maquinaria</td></tr>
              )}

              {!loading &&
                items.map((m) => {
                  const info = getWarrantyInfo(m);

                  let rowClass = "";
                  if (info.status === "expired") rowClass = "table-danger";
                  else if (info.status === "warning") rowClass = "table-warning";

                  let badgeClass = "badge bg-secondary";
                  let text = "No registrada";

                  if (info.status === "expired") {
                    badgeClass = "badge bg-danger";
                    text = `Expirada (${fmtDate(info.endDate)})`;
                  } else if (info.status === "warning") {
                    badgeClass = "badge bg-warning text-dark";
                    text = `Vence en ${info.daysRemaining} días`;
                  } else if (info.status === "ok") {
                    badgeClass = "badge bg-success";
                    text = `Vigente hasta ${fmtDate(info.endDate)}`;
                  }

                  return (
                    <tr key={m.id} className={rowClass}>
                      <td>{m.nombre}</td>
                      <td>{m.tipo || "-"}</td>
                      <td>{m.marca || "-"}</td>
                      <td>{m.modelo || "-"}</td>
                      <td>{m.ubicacion || "-"}</td>
                      <td>{m.estado || "-"}</td>
                      <td><span className={badgeClass}>{text}</span></td>

                      <td className="text-end">
                        <button
                          className="btn btn-sm me-2"
                          onClick={() => startEdit(m)}
                          style={{
                            color: "#d4af37",
                            borderColor: "#d4af37",
                            background: "transparent",
                            borderStyle: "solid",
                            borderWidth: "1px",
                            borderRadius: "8px",
                            paddingLeft: "0.6rem",
                            paddingRight: "0.6rem",
                          }}
                        >
                          Editar
                        </button>

                        <button
                          className="btn btn-sm"
                          onClick={() => remove(m)}
                          style={{
                            color: "#fff",
                            background: "#dc3545",
                            borderRadius: "8px",
                            paddingLeft: "0.6rem",
                            paddingRight: "0.6rem",
                          }}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>

          </table>
        </div>
      </div>

    </div>
  );
}