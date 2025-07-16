import React, { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { Context } from "../store/appContext";
import "../../styles/specialwash-theme.css";



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
      rol: formData.rol
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
    <div className="container-fluid d-flex justify-content-center align-items-center min-vh-100 bg-light">
      <div className="card shadow rounded-4 p-4" style={{ maxWidth: "420px", width: "100%" }}>
        <h3 className="text-center mb-4 text-dark">Inicio de sesión</h3>
        <form onSubmit={handleLogin}>
          <div className="mb-3">
            <label htmlFor="email" className="form-label">Correo electrónico</label>
            <input
              id="email"
              type="email"
              name="email"
              className="form-control"
              value={formData.email}
              onChange={handleChange}
              placeholder="tucorreo@specialwash.es"
              required
            />
          </div>
          <div className="mb-3">
            <label htmlFor="password" className="form-label">Contraseña</label>
            <input
              id="password"
              type="password"
              name="password"
              className="form-control"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              required
            />
          </div>
          <div className="mb-3">
            <label htmlFor="rol" className="form-label">Rol</label>
            <select
              id="rol"
              name="rol"
              className="form-select"
              value={formData.rol}
              onChange={handleChange}
              required
            >
              <option value="">Selecciona tu rol</option>
              <option value="administrador">Administrador</option>
              <option value="empleado">Empleado</option>
              <option value="pintor">Pintor</option>
              <option value="limpiador">Limpiador</option>
              <option value="mantenimiento">Mantenimiento</option>
              <option value="almacen">Almacén</option>
            </select>
          </div>
          <div className="d-grid">
            <button type="submit" className="btn btn-primary">
              Entrar al sistema
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Home;
