import React, { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { Context } from "../store/appContext";
import "../../styles/specialwash-theme.css";

const Home = () => {
  const { actions } = useContext(Context);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({ email: "", password: "", rol: "" });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const success = await actions.login(formData);
    if (success) {
      const rol = sessionStorage.getItem("rol");
      rol === "administrador"
        ? navigate("/privateadmin")
        : navigate("/privatefuncionario");
    } else {
      alert("Credenciales inválidas");
    }
  };

  return (
    <div className="d-flex justify-content-center align-items-center vh-100 specialwash-login-bg">
      <div className="card bg-dark bg-opacity-75 text-white p-4" style={{ width: "100%", maxWidth: "420px" }}>
        <div className="card-body">
          <h2 className="card-title text-center mb-4">Login</h2>
          <form onSubmit={handleLogin}>
            <div className="mb-3">
              <label htmlFor="email" className="form-label">Correo electrónico</label>
              <input type="email" className="form-control" id="email" name="email" value={formData.email} onChange={handleChange} required />
            </div>
            <div className="mb-3">
              <label htmlFor="password" className="form-label">Contraseña</label>
              <input type="password" className="form-control" id="password" name="password" value={formData.password} onChange={handleChange} required />
            </div>
            <div className="mb-3">
              <label htmlFor="rol" className="form-label">Rol</label>
              <select className="form-select" id="rol" name="rol" value={formData.rol} onChange={handleChange} required>
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
              <button type="submit" className="btn btn-gold-outline">
                Entrar al sistema
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
};

export default Home;
