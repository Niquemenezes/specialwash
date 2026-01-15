import React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import logo from "../img/logospecialwash.jpg";

const getStored = (k) =>
  (typeof sessionStorage !== "undefined" && sessionStorage.getItem(k)) ||
  (typeof localStorage !== "undefined" && localStorage.getItem(k)) ||
  "";

const normalizeRol = (r) => {
  r = (r || "").toLowerCase().trim();
  if (r === "admin" || r === "administrator") return "administrador";
  if (r === "employee" || r === "staff") return "empleado";
  if (r === "manager" || r === "responsable") return "encargado";
  return r;
};

const NavbarSW = () => {
  const navigate = useNavigate();
  const token = getStored("token");
  const rol = normalizeRol(getStored("rol"));

  const handleLogout = async () => {
    try {
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (_) {}
    sessionStorage.removeItem("token"); sessionStorage.removeItem("rol");
    localStorage.removeItem("token");   localStorage.removeItem("rol");
    navigate("/login", { replace: true });
  };

  return (
    <nav className="navbar navbar-expand-md sw-navbar shadow-sm">
      <div className="container">
        {/* Brand */}
        <Link
          className="navbar-brand d-flex align-items-center gap-2 sw-brand"
          to="/"
        >
          <div className="sw-logo-wrap">
            <img src={logo} alt="SpecialWash" className="sw-logo-img" />
          </div>
          <div className="d-flex flex-column lh-1">
            <span className="sw-brand-main">SpecialWash</span>
            <span className="sw-brand-sub">Internal Panel</span>
          </div>
        </Link>

        {/* Toggler */}
        <button
          className="navbar-toggler sw-navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#swNav"
          aria-controls="swNav"
          aria-expanded="false"
          aria-label="Menú"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        {/* Collapsable */}
        <div className="collapse navbar-collapse" id="swNav">
          {/* Menú por rol */}
          {token && (
            <ul className="navbar-nav me-auto mt-3 mt-md-0 sw-nav-left">
              {rol === "administrador" && (
                <>
                  {/* Dropdown Inventario */}
                  <li className="nav-item dropdown">
                    <button
                      className="nav-link dropdown-toggle sw-navlink btn btn-link"
                      id="navInventario"
                      type="button"
                      data-bs-toggle="dropdown"
                      aria-expanded="false"
                    >
                      Inventario
                    </button>
                    <ul className="dropdown-menu" aria-labelledby="navInventario">
                      <li>
                        <NavLink to="/productos" className="dropdown-item">
                          Productos
                        </NavLink>
                      </li>
                      <li>
                        <NavLink to="/entradas" className="dropdown-item">
                          Entradas
                        </NavLink>
                      </li>
                      <li>
                        <NavLink to="/salidas" className="dropdown-item">
                          Salidas
                        </NavLink>
                      </li>
                      <li><hr className="dropdown-divider" /></li>
                      <li>
                        <NavLink to="/resumen-entradas" className="dropdown-item">
                          Resumen Entradas
                        </NavLink>
                      </li>
                      <li>
                        <NavLink to="/historial-salidas" className="dropdown-item">
                          Historial Salidas
                        </NavLink>
                      </li>
                      <li>
                        <NavLink to="/proveedores" className="dropdown-item">
                          Proveedores
                        </NavLink>
                      </li>
                    </ul>
                  </li>

                  {/* Dropdown Clientes */}
                  <li className="nav-item dropdown">
                    <button
                      className="nav-link dropdown-toggle sw-navlink btn btn-link"
                      id="navClientes"
                      type="button"
                      data-bs-toggle="dropdown"
                      aria-expanded="false"
                    >
                      Clientes
                    </button>
                    <ul className="dropdown-menu" aria-labelledby="navClientes">
                      <li>
                        <NavLink to="/clientes" className="dropdown-item">
                          Gestión Clientes
                        </NavLink>
                      </li>
                      <li>
                        <NavLink to="/coches" className="dropdown-item">
                          Coches
                        </NavLink>
                      </li>
                      <li>
                        <NavLink to="/servicios" className="dropdown-item">
                          Servicios
                        </NavLink>
                      </li>
                      <li><hr className="dropdown-divider" /></li>
                      <li>
                        <NavLink to="/resumen-clientes" className="dropdown-item">
                          Resumen Clientes
                        </NavLink>
                      </li>
                    </ul>
                  </li>

                  {/* Link directo Maquinaria */}
                  <li className="nav-item">
                    <NavLink to="/maquinaria" className="nav-link sw-navlink">
                      Maquinaria
                    </NavLink>
                  </li>

                  {/* Link directo Usuarios */}
                  <li className="nav-item">
                    <NavLink to="/usuarios" className="nav-link sw-navlink">
                      Usuarios
                    </NavLink>
                  </li>
                </>
              )}

              {(rol === "empleado" || rol === "encargado") && (
                <>
                  <li className="nav-item">
                    <NavLink to="/salidas" className="nav-link sw-navlink">
                      Registrar salida
                    </NavLink>
                  </li>
                  <li className="nav-item">
                    <NavLink to="/servicios" className="nav-link sw-navlink">
                      Servicios
                    </NavLink>
                  </li>
                  <li className="nav-item">
                    <NavLink to="/mis-salidas" className="nav-link sw-navlink">
                      Mis salidas
                    </NavLink>
                  </li>
                </>
              )}
            </ul>
          )}

          {/* Lado derecho */}
          <ul className="navbar-nav ms-auto align-items-md-center gap-2 sw-nav-right">
            {!token ? (
              <>
                <li className="nav-item">
                  <NavLink to="/login" className="nav-link sw-navlink">
                    Login
                  </NavLink>
                </li>
              </>
            ) : (
              <>
                <li className="nav-item d-flex align-items-center">
                  <span className="sw-role-pill">
                    Rol:&nbsp;
                    <strong>
                      {rol ? rol.charAt(0).toUpperCase() + rol.slice(1) : "—"}
                    </strong>
                  </span>
                </li>
                <li className="nav-item">
                  <button
                    className="btn sw-btn-gold"
                    onClick={handleLogout}
                  >
                    Cerrar sesión
                  </button>
                </li>
              </>
            )}
          </ul>
        </div>
      </div>
    </nav>
  );
};

export default NavbarSW;