import React, { useContext } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Context } from "../store/appContext";

const Navbar = () => {
  const { store, actions } = useContext(Context);
  const navigate = useNavigate();
  const user = JSON.parse(sessionStorage.getItem("user"));
  const rol = sessionStorage.getItem("rol");

  const handleLogout = () => {
    actions.logout();
    navigate("/");
  };

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark shadow-sm px-3">
      <div className="container-fluid">
        <span
          className="navbar-brand fw-bold"
          style={{ cursor: "pointer", fontSize: "1.3rem" }}
          onClick={() => navigate(-1)}
        >
          <i className="fas fa-car-side me-2"></i> SpecialWash
        </span>

        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarContent"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        <div className="collapse navbar-collapse justify-content-end" id="navbarContent">
          <ul className="navbar-nav align-items-center">
            {!store.token ? (
              <>
                <li className="nav-item">
                  <Link className="nav-link" to="/">
                    Iniciar sesión
                  </Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/signup-admin">
                    Registrarse
                  </Link>
                </li>
              </>
            ) : (
              <>
                <li className="nav-item me-3 text-white">
                  👤 {user?.nombre}{" "}
                  <span className="badge bg-secondary text-light text-capitalize ms-2">
                    {rol}
                  </span>
                </li>
                <li className="nav-item">
                  <button
                    className="btn btn-sm btn-outline-light"
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

export default Navbar;
