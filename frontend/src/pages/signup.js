import React, { useContext, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Context } from "../store/appContext";

export default function Signup() {
  const { actions } = useContext(Context);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState("empleado"); // por defecto
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setOk(false);
    setLoading(true);

    try {
      const res = await actions.signup(nombre, email, password, rol);
      if (!res?.ok) {
        setErr(res?.error || "No se pudo crear el usuario");
        return;
      }

      setOk(true);

      // pequeño delay visual opcional
      setTimeout(() => {
        navigate("/login", { replace: true });
      }, 800);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sw-auth-wrapper">
      <div className="container h-100 d-flex align-items-center justify-content-center">
        <div className="sw-auth-card card border-0 shadow-lg">
          <div className="card-body p-4 p-md-5">
            <div className="text-center mb-4">
              <div
                className="text-uppercase small mb-2"
                style={{ color: "rgba(212,175,55,0.9)", letterSpacing: "0.16em" }}
              >
                Alta de usuario
              </div>
              <h2 className="sw-auth-title mb-1">Crear cuenta</h2>
              <p className="sw-auth-subtitle mb-0">
                Registra un nuevo usuario para el panel interno de SpecialWash.
              </p>
            </div>

            {err && (
              <div className="alert alert-danger py-2 small">
                {err}
              </div>
            )}
            {ok && (
              <div className="alert alert-success py-2 small">
                Cuenta creada correctamente. Redirigiendo al login…
              </div>
            )}

            <form onSubmit={onSubmit} className="sw-auth-form row g-3">
              <div className="col-12 col-md-6">
                <label className="form-label sw-auth-label">Nombre completo</label>
                <input
                  className="form-control sw-auth-input"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Nombre y apellidos"
                  required
                />
              </div>

              <div className="col-12 col-md-6">
                <label className="form-label sw-auth-label">Rol</label>
                <select
                  className="form-select sw-auth-input"
                  value={rol}
                  onChange={(e) => setRol(e.target.value)}
                >
                  <option value="empleado">Empleado</option>
                  <option value="administrador">Administrador</option>
                </select>
                <small className="sw-auth-hint">
                  Solo se deben crear administradores si son responsables del sistema.
                </small>
              </div>

              <div className="col-12">
                <label className="form-label sw-auth-label">Email</label>
                <input
                  className="form-control sw-auth-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="tucorreo@specialwash.es"
                  required
                />
              </div>

              <div className="col-12">
                <label className="form-label sw-auth-label">Contraseña</label>
                <input
                  type="password"
                  className="form-control sw-auth-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                />
              </div>

              <div className="col-12">
                <button
                  className="btn sw-btn-gold w-100"
                  disabled={loading}
                  type="submit"
                >
                  {loading ? "Creando cuenta..." : "Crear cuenta"}
                </button>
              </div>

              <div className="col-12 text-center">
                <small className="sw-auth-subtext">
                  ¿Ya tienes acceso?
                  {" "}
                  <Link to="/login" className="sw-auth-link">
                    Volver al login
                  </Link>
                </small>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}