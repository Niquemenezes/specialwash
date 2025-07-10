import React, { useEffect, useState, useContext } from "react";
import { Context } from "../store/appContext";

const Funcionarios = () => {
  const { actions } = useContext(Context);
  const [funcionarios, setFuncionarios] = useState([]);
  const [formData, setFormData] = useState({
    nombre: "",
    email: "",
    password: "",
    rol: "funcionario",
  });
  const [editId, setEditId] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    cargarFuncionarios();
  }, []);

  const cargarFuncionarios = async () => {
    const lista = await actions.obtenerFuncionarios();
    setFuncionarios(lista);
  };

  const abrirModal = (funcionario = null) => {
    if (funcionario) {
      setFormData({
        nombre: funcionario.nombre,
        email: funcionario.email,
        password: "",
        rol: funcionario.rol || "funcionario",
      });
      setEditId(funcionario.id);
    } else {
      setFormData({
        nombre: "",
        email: "",
        password: "",
        rol: "funcionario",
      });
      setEditId(null);
    }
    setModalVisible(true);
  };

  const guardarFuncionario = async () => {
    if (
      !formData.nombre ||
      !formData.email ||
      (!editId && !formData.password)
    ) {
      alert("Todos los campos son obligatorios");
      return;
    }

    const success = editId
      ? await actions.editarFuncionario(editId, formData)
      : await actions.crearFuncionario(formData);

    if (success) {
      setModalVisible(false);
      cargarFuncionarios();
    }
  };

  const eliminarFuncionario = async (id) => {
    if (!window.confirm("¿Seguro que quieres eliminar este funcionario?"))
      return;
    const success = await actions.eliminarFuncionario(id);
    if (success) cargarFuncionarios();
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="container mt-5">
      <h2>Gestión de Funcionarios</h2>
      <button className="btn btn-success mb-3" onClick={() => abrirModal()}>
        + Nuevo Funcionario
      </button>

      <table className="table table-bordered">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Email</th>
            <th>Rol</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {funcionarios.map((f) => (
            <tr key={f.id}>
              <td>{f.nombre}</td>
              <td>{f.email}</td>
              <td>{f.rol}</td>
              <td>
                <button
                  className="btn btn-warning btn-sm me-2"
                  onClick={() => abrirModal(f)}
                >
                  ✏️ Editar
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => eliminarFuncionario(f.id)}
                >
                  🗑️ Eliminar
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
                  {editId ? "Editar" : "Nuevo"} Funcionario
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setModalVisible(false)}
                ></button>
              </div>
              <div className="modal-body">
                <input
                  type="text"
                  name="nombre"
                  placeholder="Nombre"
                  className="form-control mb-2"
                  value={formData.nombre}
                  onChange={handleChange}
                />
                <input
                  type="email"
                  name="email"
                  placeholder="Email"
                  className="form-control mb-2"
                  value={formData.email}
                  onChange={handleChange}
                />
                <input
                  type="password"
                  name="password"
                  placeholder="Contraseña"
                  className="form-control mb-2"
                  value={formData.password}
                  onChange={handleChange}
                />
                <select
                  name="rol"
                  className="form-control mb-2"
                  value={formData.rol}
                  onChange={handleChange}
                >
                  <option value="administrador">Administrador</option>
                  <option value="pintor">Pintor</option>
                  <option value="limpiador">Limpiador</option>
                  <option value="mantenimiento">Mantenimiento</option>
                  <option value="almacen">Almacén</option>
                </select>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setModalVisible(false)}
                >
                  Cancelar
                </button>
                <button
                  className="btn btn-primary"
                  onClick={guardarFuncionario}
                >
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

export default Funcionarios;
