import React, { useState, useEffect, useRef, useCallback, useContext } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import logo from "../img/logo-specialwash-icon-black.png";
import { buildApiUrl } from "../utils/apiBase";
import { clearStoredSession, getDefaultRouteForRole, getStoredRol, getStoredToken } from "../utils/authSession";
import { NAVIGATION_BY_ROLE } from "../config/rolePermissions.js";
import { Context } from "../store/appContext";

// ─── Campana de notificaciones ───────────────────────────────────────────────
const CampanaNotificaciones = ({ token, compact = false }) => {
  const [count, setCount] = useState(0);
  const [lista, setLista] = useState([]);
  const [abierto, setAbierto] = useState(false);
  const [ocultarLeidas, setOcultarLeidas] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  const WrapperTag = compact ? "div" : "li";

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
    if (n.tipo === "hoja_intervencion") {
      return n.ref_id ? `/acta-entrega/${n.ref_id}` : "/vehiculos";
    }
    if (n.tipo === "repaso") return "/repaso-entrega?tab=repaso";
    if (n.tipo === "parte_finalizado") return "/partes-trabajo-finalizados";
    if (n.tipo === "entrega") return "/entregados";
    if (n.tipo === "cita") return "/citas";
    return null;
  };

  const getIconoNotificacion = (tipo) => {
    if (tipo === "inspeccion") return "🚗";
    if (tipo === "hoja_intervencion") return "📝";
    if (tipo === "repaso") return "🔔";
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
    <WrapperTag className={compact ? "position-relative" : "nav-item position-relative"} ref={ref}>
      <button
        className={compact ? "btn p-0 sw-campana sw-mobile-header-action" : "btn p-0 sw-campana"}
        onClick={() => { setAbierto(o => !o); if (!abierto) cargar(); }}
        title="Notificaciones"
        aria-label="Notificaciones"
        type="button"
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
    </WrapperTag>
  );
};

// ─── Navbar principal ─────────────────────────────────────────────────────────
const NavbarSW = () => {
  const { store, actions } = useContext(Context);
  const navigate = useNavigate();
  const location = useLocation();
  const token = getStoredToken();
  const rol = getStoredRol();
  const isAdmin = rol === "administrador";
  const nombreUsuario = String(store?.user?.nombre || "").trim();
  const homeTarget = token ? getDefaultRouteForRole(rol) : "/";

  useEffect(() => {
    if (token && !store?.user) {
      actions.me?.().catch?.(() => {});
    }
  }, [token, store?.user, actions]);

  const isPathActive = (path = "") => {
    if (!path) return false;
    if (location.pathname === path) return true;
    return path !== "/" && location.pathname.startsWith(`${path}/`);
  };

  const closeCollapsedMenu = () => {
    const toggler = document.querySelector(".navbar-toggler");
    if (toggler && !window.matchMedia("(min-width: 1200px)").matches) {
      toggler.click();
    }
  };

  const roleNavItems = !token || isAdmin
    ? []
    : (NAVIGATION_BY_ROLE[rol] || []).flatMap((item) => Array.isArray(item?.items) ? item.items : [item]);

  const quickNavItems = (() => {
    if (!token || isAdmin) return [];

    if (rol === "calidad") {
      return [
        { label: "🚗 Seguimiento", to: "/partes-trabajo" },
        { label: "🔍 Inspección", to: "/inspeccion-recepcion" },
        { label: "✍️ Entrega", to: "/repaso-entrega?tab=firma" },
        { label: "🚙 Coches sustitución", to: "/coche-sustitucion" },
      ];
    }

    return roleNavItems.filter(
      (item, index, arr) => item?.to && arr.findIndex((candidate) => candidate.to === item.to) === index
    );
  })();

  const showQuickShortcuts = token && !isAdmin && quickNavItems.length > 0 && location.pathname !== "/" && location.pathname !== "/login" && !(rol === "calidad" && location.pathname === "/repaso-entrega");
  const canAccessCitas = Boolean(
    token &&
    (rol === "administrador" || rol === "calidad" || roleNavItems.some((item) => item?.to === "/citas"))
  );

  const renderMobileHeaderLink = (to, title, icon, extraClass = "") => (
    <NavLink
      to={to}
      className={({ isActive }) => `sw-mobile-header-action${isActive ? " active" : ""}${extraClass ? ` ${extraClass}` : ""}`}
      title={title}
      aria-label={title}
      onClick={closeCollapsedMenu}
    >
      <i className={`fas ${icon}`}></i>
    </NavLink>
  );

  const [theme, setTheme] = useState(
    () => localStorage.getItem("sw-theme") || document.documentElement.getAttribute("data-theme") || "dark"
  );
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("sw-theme", next);
  };

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
    <>
      <nav className="navbar navbar-expand-xl sw-navbar shadow-sm">
        <div className="container-fluid">
        {/* Sidebar toggle (admin) + Brand */}
        <div className="d-flex align-items-center gap-2 flex-grow-1">
          {/* Botón para abrir/colapsar el sidebar — solo admin */}
          {token && isAdmin && (
            <button
              className="sw-sidebar-nav-toggle"
              onClick={() => window.dispatchEvent(new Event("sw:sidebar-toggle"))}
              title="Mostrar / ocultar menú lateral"
              aria-label="Mostrar / ocultar menú lateral"
            >
              <i className="fas fa-bars" />
            </button>
          )}

          {/* Brand */}
          <Link
            className="navbar-brand d-flex align-items-center sw-brand"
            to={homeTarget}
            title="Ir a inicio"
          >
            <div className="sw-logo-wrap">
              <img src={logo} alt="SpecialWash" className="sw-logo-img" />
            </div>
            <div className="sw-brand-text d-none d-xl-flex flex-column">
              <span className="sw-brand-title">Special Wash Studio</span>
              <span className="sw-brand-subtitle">Internal Management System</span>
            </div>
          </Link>
        </div>

        {/* Acciones rápidas móviles */}
        <div className="d-flex align-items-center ms-auto gap-2">
          {token && (
            <div className="sw-mobile-header-actions d-xl-none">
              <span
                className="sw-role-pill"
                style={{
                  maxWidth: "170px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={nombreUsuario ? `${nombreUsuario} · ${rol}` : rol}
              >
                <i className="fas fa-user-circle me-1"></i>
                {nombreUsuario ? `${nombreUsuario} · ` : ""}
                {rol ? rol.charAt(0).toUpperCase() + rol.slice(1) : "—"}
              </span>
              {["administrador", "calidad"].includes(rol) && (
                <CampanaNotificaciones token={token} compact />
              )}
              {canAccessCitas && renderMobileHeaderLink("/citas", "Abrir citas", "fa-calendar")}
              {renderMobileHeaderLink("/fichar", "Abrir fichar", "fa-clock")}
              <button
                className="sw-theme-toggle sw-mobile-header-action"
                onClick={toggleTheme}
                title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
                aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
                type="button"
              >
                <i className={`fas ${theme === "dark" ? "fa-sun" : "fa-moon"}`}></i>
              </button>
              <button
                className="btn sw-btn-gold sw-mobile-header-action sw-mobile-header-action--logout"
                onClick={handleLogout}
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
                type="button"
              >
                <i className="fas fa-sign-out-alt"></i>
              </button>
            </div>
          )}
        </div>

        {/* Navegación de escritorio */}
        <div className="navbar-collapse d-none d-xl-flex" id="swNav">
          {/* Menú por rol — solo roles no-admin (admin usa el sidebar lateral) */}
          {token && !isAdmin && (
            <ul className="navbar-nav me-auto mt-3 mt-xl-0 sw-nav-left">
              {(() => {
                const navItems = NAVIGATION_BY_ROLE[rol];
                if (!navItems) return null;

                return navItems.map((item, idx) => {
                  if (Array.isArray(item?.items) && item.items.length > 0) {
                    const dropdownId = `sw-role-menu-${rol}-${idx}`;
                    const hasActiveChild = item.items.some((entry) => isPathActive(entry.to));

                    return (
                      <li key={dropdownId} className="nav-item dropdown">
                        <button
                          type="button"
                          className={`nav-link sw-navlink sw-nav-dropdown-toggle dropdown-toggle ${hasActiveChild ? "active" : ""}`}
                          data-bs-toggle="dropdown"
                          aria-expanded="false"
                        >
                          <span className="sw-nav-dropdown-title">{item.shortLabel || item.section || "Menú"}</span>
                        </button>
                        <ul className="dropdown-menu dropdown-menu-start sw-nav-dropdown-menu">
                          <li><h6 className="dropdown-header">{item.section}</h6></li>
                          {item.hint && (
                            <li>
                              <div className="sw-nav-dropdown-hint">{item.hint}</div>
                            </li>
                          )}
                          {item.items.map((entry) => (
                            <li key={entry.to}>
                              <NavLink
                                to={entry.to}
                                className={({ isActive }) => `dropdown-item ${isActive ? "active" : ""}`}
                                onClick={closeCollapsedMenu}
                              >
                                {entry.label}
                              </NavLink>
                            </li>
                          ))}
                        </ul>
                      </li>
                    );
                  }

                  return (
                    <li key={idx} className="nav-item">
                      <NavLink
                        to={item.to}
                        className={({ isActive }) =>
                          `nav-link sw-navlink ${isActive ? "active" : ""}`
                        }
                        onClick={() => {
                          closeCollapsedMenu();
                        }}
                      >
                        {item.label}
                      </NavLink>
                    </li>
                  );
                });
              })()}
            </ul>
          )}

          {/* Lado derecho */}
          <ul className="navbar-nav ms-xl-auto align-items-center gap-1 gap-xl-2 mt-3 mt-xl-0 sw-nav-right">
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
                {/* Campana: admin y calidad */}
                {["administrador", "calidad"].includes(rol) && (
                  <CampanaNotificaciones token={token} />
                )}

                {/* Rol del usuario - Solo en desktop */}
                <li className="nav-item d-none d-xl-flex align-items-center">
                  <span className="sw-role-pill">
                    <i className="fas fa-user-circle me-1"></i>
                    {nombreUsuario ? `${nombreUsuario} · ` : ""}
                    {rol ? rol.charAt(0).toUpperCase() + rol.slice(1) : "—"}
                  </span>
                </li>

                {/* Citas */}
                {canAccessCitas && (
                  <li className="nav-item d-none d-xl-block">
                    <NavLink
                      to="/citas"
                      className={({ isActive }) =>
                        `nav-link sw-navlink ${isActive ? "active" : ""}`
                      }
                      title="Ver citas"
                      onClick={() => {
                        closeCollapsedMenu();
                      }}
                    >
                      <i className="fas fa-calendar me-1 d-xl-none"></i>
                      <span className="d-xl-none">Citas</span>
                      <span className="d-none d-xl-inline">📅 Citas</span>
                    </NavLink>
                  </li>
                )}

                {/* Fichar */}
                <li className="nav-item d-none d-xl-block">
                  <NavLink
                    to="/fichar"
                    className={({ isActive }) =>
                      `nav-link sw-navlink ${isActive ? "active" : ""}`
                    }
                    title="Fichar entrada/salida"
                    onClick={() => {
                      closeCollapsedMenu();
                    }}
                  >
                    <i className="fas fa-clock me-1 d-xl-none"></i>
                    <span className="d-xl-none">Fichar</span>
                    <span className="d-none d-xl-inline">⏱️ Fichar</span>
                  </NavLink>
                </li>

                {/* Theme Toggle */}
                <li className="nav-item d-none d-xl-block">
                  <button
                    className="sw-theme-toggle"
                    onClick={toggleTheme}
                    title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
                  >
                    <i className={`fas ${theme === "dark" ? "fa-sun" : "fa-moon"}`}></i>
                  </button>
                </li>

                {/* Logout */}
                <li className="nav-item d-none d-xl-block">
                  <button
                    className="btn sw-btn-gold"
                    onClick={handleLogout}
                    title="Cerrar sesión"
                  >
                    <i className="fas fa-sign-out-alt me-1"></i>
                    <span className="d-xl-none">Salir</span>
                    <span className="d-none d-xl-inline">Salir</span>
                  </button>
                </li>
              </>
            )}
          </ul>
        </div>
      </div>
    </nav>

      {showQuickShortcuts && (
        <div className="sw-tablet-shortcuts d-xl-none" aria-label="Accesos rápidos">
          <div className="container-fluid">
            <div className="sw-tablet-shortcuts__label">Accesos rápidos</div>
            <div className="sw-tablet-shortcuts__scroller">
              {quickNavItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `sw-tablet-shortcut${isActive ? " sw-tablet-shortcut--active" : ""}`}
                  onClick={closeCollapsedMenu}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default NavbarSW;
