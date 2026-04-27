import React, { useContext, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Context } from "../store/appContext";
import { getDefaultRouteForRole, getStoredRol } from "../utils/authSession";

export default function Login() {
  const { actions } = useContext(Context);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const expired = searchParams.get("expired") === "1";

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);

    try {
      const res = await actions.login(email, password); // usa /auth/login_json
      if (!res?.ok) {
        setErr(res?.error || "Login inválido");
        return;
      }

      // Disparar aviso de fichaje pendiente al iniciar sesión si aplica
      window.dispatchEvent(new Event("sw:login-success"));

      navigate(getDefaultRouteForRole(getStoredRol()), { replace: true });
    } catch (error) {
      setErr("Error de conexión. Inténtelo de nuevo.");
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
                Acceso interno
              </div>
              <h2 className="sw-auth-title mb-1">Iniciar sesión</h2>
              <p className="sw-auth-subtitle mb-0">
                Introduce tus credenciales para acceder al panel de SpecialWash.
              </p>
            </div>

            {err && (
              <div className="alert alert-danger py-2 small">
                {err}
              </div>
            )}

            {expired && !err && (
              <div className="alert alert-warning py-2 small">
                Tu sesión ha expirado por tiempo o inactividad. Vuelve a iniciar sesión.
              </div>
            )}

            <form onSubmit={onSubmit} className="sw-auth-form">
              <div className="mb-3">
                <label className="form-label sw-auth-label">Email o usuario</label>
                <input
                  className="form-control sw-auth-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  placeholder="ej. c@c o Carlos"
                  type="text"
                  required
                />
              </div>

              <div className="mb-1">
                <label className="form-label sw-auth-label">Contraseña</label>
                <input
                  type="password"
                  className="form-control sw-auth-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  required
                />
              </div>

              <div className="mb-3 d-flex justify-content-end">
                <small className="text-muted">
                  (Si la contraseña falla, consulta con el administrador.)
                </small>
              </div>

              <button
                className="btn sw-btn-gold w-100 mb-3"
                disabled={loading}
                type="submit"
              >
                {loading ? "Accediendo..." : "Entrar"}
              </button>

              <div className="text-center">
                <small className="sw-auth-subtext">
                  Contacta con administración para solicitar acceso.
                </small>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
