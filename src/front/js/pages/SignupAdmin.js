import React, { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { Context } from "../store/appContext";
import "../../styles/specialwash-theme.css";

const SignupAdmin = () => {
  const { actions } = useContext(Context);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    nombre: "",
    email: "",
    password: ""
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const success = await actions.signupAdmin(formData);
    if (success) {
      alert("Administrador registrado correctamente");
      navigate("/");
    } else {
      alert("Error al registrar. Verifica los datos.");
    }
  };

  return (
    <div className="d-flex justify-content-center align-items-center vh-100 specialwash-login-bg">
      <div className="card bg-dark bg-opacity-75 text-white p-4" style={{ width: "100%", maxWidth: "420px" }}>
        <div className="card-body">
          <h2 className="card-title text-center mb-4">Registro de Administrador</h2>
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label htmlFor="nombre" className="form-label">Nombre completo</label>
              <input type="text" className="form-control" id="nombre" name="nombre" value={formData.nombre} onChange={handleChange} required />
            </div>
            <div className="mb-3">
              <label htmlFor="email" className="form-label">Correo electrónico</label>
              <input type="email" className="form-control" id="email" name="email" value={formData.email} onChange={handleChange} required />
            </div>
            <div className="mb-3">
              <label htmlFor="password" className="form-label">Contraseña</label>
              <input type="password" className="form-control" id="password" name="password" value={formData.password} onChange={handleChange} required />
            </div>
            <div className="d-grid">
              <button type="submit" className="btn btn-gold-outline">
                Crear cuenta
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
};

export default SignupAdmin;
