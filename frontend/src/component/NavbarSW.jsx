import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import logo from "../img/logo-specialwash-icon-black.png";
import { buildApiUrl } from "../utils/apiBase";
import { clearStoredSession, getStoredRol, getStoredToken, isEmployeeRole } from "../utils/authSession";
import { NAVIGATION_BY_ROLE, ROLES } from "../config/rolePermissions.js";

// ─── Campana de notificaciones ───────────────────────────────────────────────
const CampanaNotificaciones = ({ token }) => {
  const [count, setCount] = useState(0);
  const [lista, setLista] = useState([]);
  const [abierto, setAbierto] = useState(false);
  const [ocultarLeidas, setOcultarLeidas] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  const cargar = useCallback(async () => {
    if (!token) return;
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [rCount, rLista] = await Promise.all([
        fetch(buildApiUrl("/api/notificaciones/no-leidas"), { headers }),
        fetch(buildApiUrl("/api/notificaciones"), { headers }),
      ]);
      if (rCount.ok) { const d = await rCount.json(); setCount(d.count ?? 0); }
      if (rLista.ok) { setLista(await rLista.json()); }
    } catch { /* silencioso */ }
  }, [token]);

  // Polling cada 30 s
  useEffect(() => {
    cargar();
    const id = setInterval(cargar, 30000);
    return () => clearInterval(id);
  }, [cargar]);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const marcarLeida = async (id) => {
    try {
      await fetch(buildApiUrl(`/api/notificaciones/${id}/leida`), {
        method: "PATCH", headers: { Authorization: `Bearer ${token}` }
      });
      await cargar();
    } catch { /* silencioso */ }
  };

  const marcarTodas = async () => {
    try {
      await fetch(buildApiUrl("/api/notificaciones/marcar-todas"), {
        method: "PATCH", headers: { Authorization: `Bearer ${token}` }
      });
      await cargar();
    } catch { /* silencioso */ }
  };

  const getDestinoNotificacion = (n) => {
    if (!n) return null;
    if (n.tipo === "inspeccion") {
      return n.ref_id ? `/inspecciones-guardadas?focusId=${n.ref_id}` : "/inspecciones-guardadas";
    }
    if (n.tipo === "parte_finalizado") return "/partes-trabajo-finalizados";
    if (n.tipo === "entrega") return "/entregados";
    if (n.tipo === "cita") return "/citas";
    return null;
  };

  const getIconoNotificacion = (tipo) => {
    if (tipo === "inspeccion") return "🚗";
    if (tipo === "parte_finalizado") return "🧰";
    if (tipo === "entrega") return "✅";
    if (tipo === "cita") return "📅";
    return "📋";
  };

  const onClickNotificacion = async (n) => {
    await marcarLeida(n.id);
    const destino = getDestinoNotificacion(n);
    if (destino) {
      setAbierto(false);
      navigate(destino);
    }
  };

  const formatHora = (iso) => {
    if (!iso) return "";
    try { return new Date(iso).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); }
    catch { return ""; }
  };

  const listaVisible = ocultarLeidas ? lista.filter((n) => !n.leida) : lista;

  return (
    <li className="nav-item position-relative" ref={ref}>
      <button
        className="btn p-0 sw-campana"
        onClick={() => { setAbierto(o => !o); if (!abierto) cargar(); }}
        title="Notificaciones"
        style={{ background: "none", border: "none", color: "var(--sw-muted)", fontSize: "1.1rem", lineHeight: 1, position: "relative" }}
      >
        <i className="fas fa-bell"></i>
        {count > 0 && (
          <span style={{
            position: "absolute", top: -4, right: -6,
            background: "var(--sw-danger)", color: "#fff", borderRadius: "50%",
            fontSize: "0.6rem", fontWeight: 700, minWidth: 16, height: 16,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "0 3px", lineHeight: 1,
          }}>
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {abierto && (
        <div style={{
          position: "absolute", right: 0, top: "calc(100% + 8px)",
          width: 320, maxHeight: 420, overflowY: "auto",
          background: "var(--sw-surface)", border: "1px solid var(--sw-border)",
          borderRadius: 10, boxShadow: "var(--sw-shadow)",
          zIndex: 9999,
        }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--sw-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ color: "var(--sw-accent)", fontWeight: 700, fontSize: "0.78rem" }}>Notificaciones</span>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {lista.some((n) => n.leida) && (
                <button
                  onClick={() => setOcultarLeidas((prev) => !prev)}
                  style={{ background: "none", border: "none", color: "var(--sw-muted)", fontSize: "0.68rem", cursor: "pointer", padding: 0 }}
                >
                  {ocultarLeidas ? "Mostrar leídas" : "Apagar leídas"}
                </button>
              )}
              {count > 0 && (
                <button onClick={marcarTodas} style={{ background: "none", border: "none", color: "var(--sw-muted)", fontSize: "0.68rem", cursor: "pointer", padding: 0 }}>
                  Borrar todas
                </button>
              )}
            </div>
          </div>
          {listaVisible.length === 0 ? (
            <div style={{ padding: 16, color: "var(--sw-muted)", fontSize: "0.75rem", textAlign: "center" }}>
              {ocultarLeidas ? "No hay notificaciones pendientes" : "Sin notificaciones"}
            </div>
          ) : listaVisible.map(n => (
            <div
              key={n.id}
              onClick={() => onClickNotificacion(n)}
              style={{
                padding: "10px 14px",
                borderBottom: "1px solid var(--sw-border)",
                cursor: "pointer",
                background: n.leida ? "transparent" : "color-mix(in srgb, var(--sw-accent) 7%, transparent)",
                transition: "background 0.15s",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
                <span style={{ color: n.leida ? "var(--sw-muted)" : "var(--sw-text)", fontSize: "0.74rem", fontWeight: n.leida ? 400 : 600 }}>
                  {getIconoNotificacion(n.tipo)} {n.titulo}
                </span>
                {!n.leida && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--sw-danger)", flexShrink: 0, marginTop: 3 }} />}
              </div>
              {n.cuerpo && <div style={{ color: "var(--sw-muted)", fontSize: "0.67rem", marginTop: 2 }}>{n.cuerpo}</div>}
              <div style={{ color: "var(--sw-muted)", fontSize: "0.63rem", marginTop: 3, opacity: 0.7 }}>{formatHora(n.created_at)}</div>
            </div>
          ))}
        </div>
      )}
    </li>
  );
};

// ─── Navbar principal ─────────────────────────────────────────────────────────
const NavbarSW = () => {
  const navigate = useNavigate();
  const token = getStoredToken();
  const rol = getStoredRol();

  const [theme, setTheme] = useState(
    () => localStorage.getItem("sw-theme") || document.documentElement.getAttribute("data-theme") || "dark"
  );
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("sw-theme", next);
  };

  const isEmpleadoOperativo = isEmployeeRole(rol);
  const handleLogout = async () => {
    try {
      await fetch(buildApiUrl("/api/auth/logout"), {
        method: "POST",
        credentials: "include",
      });
    } catch (_) {}
    clearStoredSession();
    navigate("/login", { replace: true });
  };

  return (
    <nav className="navbar navbar-expand-lg sw-navbar shadow-sm">
      <div className="container-fluid">
        {/* Brand + Primeros items del menú (lado izquierdo) */}
        <div className="d-flex align-items-center gap-1 flex-grow-1">
          {/* Brand */}
          <Link
            className="navbar-brand d-flex align-items-center sw-brand"
            to="/"
            title="Ir a inicio"
          >
            <div className="sw-logo-wrap">
              <img src={logo} alt="SpecialWash" className="sw-logo-img" />
            </div>
          </Link>

          {/* Primeros cuatro items del menú al lado del logo (solo desktop) */}
          {token && (
            <ul className="navbar-nav d-none d-lg-flex gap-1 sw-nav-highlighted">
              {(() => {
                const navItems = NAVIGATION_BY_ROLE[rol];
                if (!navItems || navItems.length < 4) return null;

                // Mostrar solo los primeros 4 items si tienen section (dropdowns)
                if (navItems[0].section && navItems[1].section && navItems[2].section && navItems[3].section) {
                  return [navItems[0], navItems[1], navItems[2], navItems[3]].map((grupo, idx) => (
                    <li key={idx} className="nav-item dropdown">
                      <button
                        className="nav-link dropdown-toggle sw-navlink btn btn-link"
                        id={`navHighlight${idx}`}
                        type="button"
                        data-bs-toggle="dropdown"
                        aria-expanded="false"
                      >
                        {grupo.section}
                      </button>
                      <ul className="dropdown-menu dropdown-menu-start" aria-labelledby={`navHighlight${idx}`}>
                        {grupo.items.map((item, itemIdx) => (
                          <li key={itemIdx}>
                            <NavLink
                              to={item.to}
                              className={({ isActive }) =>
                                `dropdown-item ${isActive ? "active" : ""}`
                              }
                            >
                              {item.label}
                            </NavLink>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ));
                }
                return null;
              })()}
            </ul>
          )}
        </div>

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
          {/* Menú por rol (resto de items después de los primeros cuatro) */}
          {token && (
            <ul className="navbar-nav me-auto mt-3 mt-lg-0 sw-nav-left">
              {(() => {
                const navItems = NAVIGATION_BY_ROLE[rol];
                if (!navItems) return null;

                // Si para este rol los items son objetos con "section" (admin), renderizar con dropdowns
                if (navItems.length > 0 && navItems[0].section) {
                  // Saltar los primeros 4 items (ya están al lado del logo)
                  const restItems = navItems.slice(4);
                  return restItems.map((grupo, idx) => (
                    <li key={idx} className="nav-item dropdown">
                      <button
                        className="nav-link dropdown-toggle sw-navlink btn btn-link"
                        id={`nav${idx + 4}`}
                        type="button"
                        data-bs-toggle="dropdown"
                        aria-expanded="false"
                      >
                        {grupo.section}
                      </button>
                      <ul className="dropdown-menu dropdown-menu-start" aria-labelledby={`nav${idx + 4}`}>
                        {grupo.items.map((item, itemIdx) => (
                          <li key={itemIdx}>
                            <NavLink
                              to={item.to}
                              className={({ isActive }) =>
                                `dropdown-item ${isActive ? "active" : ""}`
                              }
                              onClick={() => {
                                const toggler = document.querySelector('.navbar-toggler');
                                if (toggler && !window.matchMedia('(min-width: 992px)').matches) {
                                  toggler.click();
                                }
                              }}
                            >
                              {item.label}
                            </NavLink>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ));
                }

                // Si los items son directos (calidad, empleados, encargado), renderizar sin dropdowns (todos)
                return navItems.map((item, idx) => (
                  <li key={idx} className="nav-item">
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        `nav-link sw-navlink ${isActive ? "active" : ""}`
                      }
                      onClick={() => {
                        const toggler = document.querySelector('.navbar-toggler');
                        if (toggler && !window.matchMedia('(min-width: 992px)').matches) {
                          toggler.click();
                        }
                      }}
                    >
                      {item.label}
                    </NavLink>
                  </li>
                ));
              })()}
            </ul>
          )}

          {/* Lado derecho */}
          <ul className="navbar-nav ms-lg-auto align-items-center gap-1 gap-lg-2 mt-3 mt-lg-0 sw-nav-right">
            {!token ? (
              <>
                <li className="nav-item w-100">
                  <NavLink
                    to="/login"
                    className={({ isActive }) =>
                      `nav-link sw-navlink text-center ${isActive ? "active" : ""}`
                    }
                  >
                    <i className="fas fa-sign-in-alt me-2"></i>Login
                  </NavLink>
                </li>
              </>
            ) : (
              <>
                {/* Campana: solo admin y encargado */}
                {(rol === "administrador" || rol === "encargado") && (
                  <CampanaNotificaciones token={token} />
                )}

                {/* Rol del usuario - Solo en desktop */}
                <li className="nav-item d-none d-lg-flex align-items-center">
                  <span className="sw-role-pill">
                    <i className="fas fa-user-circle me-1"></i>
                    {rol ? rol.charAt(0).toUpperCase() + rol.slice(1) : "—"}
                  </span>
                </li>

                {/* Citas */}
                {(rol === "administrador" || rol === "encargado" || rol === "calidad" || rol === "detailing") && (
                  <li className="nav-item">
                    <NavLink
                      to="/citas"
                      className={({ isActive }) =>
                        `nav-link sw-navlink ${isActive ? "active" : ""}`
                      }
                      title="Ver citas"
                      onClick={() => {
                        const toggler = document.querySelector('.navbar-toggler');
                        if (toggler && !window.matchMedia('(min-width: 992px)').matches) {
                          toggler.click();
                        }
                      }}
                    >
                      <i className="fas fa-calendar me-1 d-lg-none"></i>
                      <span className="d-lg-none">Citas</span>
                      <span className="d-none d-lg-inline">📅 Citas</span>
                    </NavLink>
                  </li>
                )}

                {/* Fichar */}
                <li className="nav-item">
                  <NavLink
                    to="/fichar"
                    className={({ isActive }) =>
                      `nav-link sw-navlink ${isActive ? "active" : ""}`
                    }
                    title="Fichar entrada/salida"
                    onClick={() => {
                      const toggler = document.querySelector('.navbar-toggler');
                      if (toggler && !window.matchMedia('(min-width: 992px)').matches) {
                        toggler.click();
                      }
                    }}
                  >
                    <i className="fas fa-clock me-1 d-lg-none"></i>
                    <span className="d-lg-none">Fichar</span>
                    <span className="d-none d-lg-inline">⏱️ Fichar</span>
                  </NavLink>
                </li>

                {/* Theme Toggle */}
                <li className="nav-item">
                  <button
                    className="sw-theme-toggle"
                    onClick={toggleTheme}
                    title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
                  >
                    <i className={`fas ${theme === "dark" ? "fa-sun" : "fa-moon"}`}></i>
                  </button>
                </li>

                {/* Logout */}
                <li className="nav-item">
                  <button
                    className="btn sw-btn-gold"
                    onClick={handleLogout}
                    title="Cerrar sesión"
                  >
                    <i className="fas fa-sign-out-alt me-1"></i>
                    <span className="d-lg-none">Salir</span>
                    <span className="d-none d-lg-inline">Salir</span>
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
