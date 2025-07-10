import React, { useEffect, useState } from "react";

const CrudGenerico = ({
  titulo,
  endpoint,
  campos,
  filtro = () => true,
  extraCampos = {},
  filtroCategoria = null,
}) => {
  const API = process.env.REACT_APP_BACKEND_URL;
  const [items, setItems] = useState([]);
  const [formData, setFormData] = useState({});
  const [editId, setEditId] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    fetchDatos();
  }, []);

const fetchDatos = async () => {
  const token = sessionStorage.getItem("token");

  let url = `${API}/api/${endpoint}`;
  if (filtroCategoria) {
    url = `${API}/api/${endpoint}/categoria/${filtroCategoria}`;
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json();

  console.log("🔍 Respuesta del backend:", data); // <-- AÑADE ESTO

  if (Array.isArray(data)) {
    setItems(data.filter(filtro));
  } else {
    console.error("⚠️ La respuesta no es un array:", data);
    setItems([]);
  }
};

  const abrirModal = (item = null) => {
    setEditId(item?.id || null);
    const defaultData = campos.reduce(
      (acc, c) => ({ ...acc, [c.nombre]: "" }),
      {}
    );
    setFormData(item ? { ...defaultData, ...item } : defaultData);
    setModalVisible(true);
  };

  const guardar = async () => {
    const token = sessionStorage.getItem("token");
    const metodo = editId ? "PUT" : "POST";
    const url = editId
      ? `${API}/api/${endpoint}/${editId}`
      : `${API}/api/${endpoint}`;

    const payload = {
      ...formData,
      ...extraCampos,
    };

    // ✅ Validación de campos genérica
    for (const campo of campos) {
      const valor = payload[campo.nombre];
      if (editId && campo.nombre === "password") continue;
      if (!valor || valor.toString().trim() === "") {
        alert(`Por favor, completa el campo "${campo.label}".`);
        return;
      }
    }

    // Si está editando y el campo password está vacío, no lo mandamos
    if (editId && payload.password === "") {
      delete payload.password;
    }

    const res = await fetch(url, {
      method: metodo,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      setModalVisible(false);
      fetchDatos();
    } else {
      const errorData = await res.json();
      alert("Error al guardar: " + (errorData.msg || "verifica los campos"));
    }
  };

  const eliminar = async (id) => {
    const token = sessionStorage.getItem("token");
    if (!window.confirm("¿Eliminar este elemento?")) return;

    const res = await fetch(`${API}/api/${endpoint}/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) fetchDatos();
    else alert("Error al eliminar");
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="container mt-5">
      <h2>{titulo}</h2>
      <button className="btn btn-success mb-3" onClick={() => abrirModal()}>
        + Nuevo
      </button>

      <table className="table table-bordered">
        <thead>
          <tr>
            {campos.map((c) => (
              <th key={c.nombre}>{c.label}</th>
            ))}
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              {campos.map((c) => (
                <td key={c.nombre}>{item[c.nombre]}</td>
              ))}
              <td>
                <button
                  className="btn btn-warning btn-sm me-2"
                  onClick={() => abrirModal(item)}
                >
                  ✏️
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => eliminar(item.id)}
                >
                  🗑️
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {modalVisible && (
        <div className="modal show d-block" tabIndex="-1">
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {editId ? "✏️ Editar" : "➕ Nuevo"} {titulo}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setModalVisible(false)}
                ></button>
              </div>
              <div className="modal-body">
                {campos.map((c) => (
                  <input
                    key={c.nombre}
                    type={
                      c.nombre === "password"
                        ? "password"
                        : c.nombre === "email"
                        ? "email"
                        : "text"
                    }
                    name={c.nombre}
                    placeholder={c.label}
                    className="form-control mb-2"
                    value={formData[c.nombre] || ""}
                    onChange={handleChange}
                    required={c.nombre !== "password" || !editId}
                  />
                ))}
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setModalVisible(false)}
                >
                  Cancelar
                </button>
                <button className="btn btn-primary" onClick={guardar}>
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CrudGenerico;
