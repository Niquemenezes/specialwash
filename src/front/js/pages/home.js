import React, { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { Context } from "../store/appContext";

const Home = () => {
  const { actions } = useContext(Context);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rol: ""
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleLogin = async (e) => {
  e.preventDefault();

  const success = await actions.login({
  email: formData.email,
  password: formData.password,
  rol: formData.rol   // ✅ Agregar esto
});


  if (success) {
    const rol = sessionStorage.getItem("rol");

    switch (rol) {
      case "administrador":
        navigate("/privateadmin");
        break;
      case "empleado":
      case "pintor":
      case "limpiador":
      case "mantenimiento":
      case "almacen":
        navigate("/privatefuncionario");
        break;
      default:
        alert("Rol no válido o sin página asignada");
        navigate("/");
        break;
    }
  } else {
    alert("Credenciales inválidas");
  }
};

  return (
    <div className="container mt-5">
      <div className="card mx-auto" style={{ maxWidth: "400px" }}>
        <div className="card-body">
          <h2 className="card-title text-center mb-4">Login</h2>
          <form onSubmit={handleLogin}>
            <div className="mb-3">
              <label className="form-label">Email</label>
              <input
                type="email"
                name="email"
                className="form-control"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Contraseña</label>
              <input
                type="password"
                name="password"
                className="form-control"
                value={formData.password}
                onChange={handleChange}
                required
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Rol</label>
              <select
                name="rol"
                className="form-select"
                value={formData.rol}
                onChange={handleChange}
                required
              >
                <option value="">Selecciona tu rol</option>
                <option value="administrador">administrador</option>
                <option value="empleado">empleado</option>
                <option value="pintor">pintor</option>
                <option value="limpiador">limpiador</option>
                <option value="mantenimiento">mantenimiento</option>
                <option value="almacen">almacén</option>
              </select>
            </div>
            <div className="d-grid">
              <button type="submit" className="btn btn-primary">
                Entrar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Home;
