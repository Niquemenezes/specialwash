import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import logo from "../img/logo-specialwash-icon-black.png";
import { buildApiUrl } from "../utils/apiBase";
import { clearStoredSession, getStoredRol, getStoredToken, isEmployeeRole } from "../utils/authSession";

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
      <div className="container">
        {/* Brand */}
        <Link
          className="navbar-brand d-flex align-items-center gap-2 sw-brand"
          to="/"
        >
          <div className="sw-logo-wrap">
            <img src={logo} alt="SpecialWash" className="sw-logo-img" />
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
                  {/* Dropdown Flujo Vehículos */}
                  <li className="nav-item dropdown">
                    <button
                      className="nav-link dropdown-toggle sw-navlink btn btn-link"
                      id="navFlujoEntrega"
                      type="button"
                      data-bs-toggle="dropdown"
                      aria-expanded="false"
                    >
                      Flujo Vehículos
                    </button>
                    <ul className="dropdown-menu" aria-labelledby="navFlujoEntrega">
                      <li><h6 className="dropdown-header">Entrada de Vehículos</h6></li>
                      <li>
                        <NavLink to="/inspeccion-recepcion" className="dropdown-item">
                          1) Inspección previa
                        </NavLink>
                      </li>
                      <li>
                        <NavLink to="/partes-trabajo" className="dropdown-item">
                          2) Partes de trabajo
                        </NavLink>
                      </li>
                      <li>
                        <NavLink to="/inspecciones-guardadas" className="dropdown-item">
                          3) Inspecciones Pendientes
                        </NavLink>
                      </li>
                      <li><hr className="dropdown-divider" /></li>
                      <li><h6 className="dropdown-header">Entrega</h6></li>
                      <li>
                        <NavLink to="/partes-trabajo-finalizados" className="dropdown-item">
                          4) Partes finalizados
                        </NavLink>
                      </li>
                      <li>
                        <NavLink to="/repaso-entrega?tab=estado" className="dropdown-item">
                          5) Estado coches
                        </NavLink>
                      </li>
                      <li>
                        <NavLink to="/repaso-entrega" className="dropdown-item">
                          6) Repaso + Firma
                        </NavLink>
                      </li>
                      <li><hr className="dropdown-divider" /></li>
                      <li>
                        <NavLink to="/inspecciones-guardadas?tab=entregados" className="dropdown-item">
                          7) Coches entregados
                        </NavLink>
                      </li>
                    </ul>
                  </li>

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
                          📦 Productos
                        </NavLink>
                      </li>
                      <li>
                        <NavLink to="/entradas" className="dropdown-item">
                          <span className="me-2" aria-hidden="true">⤓</span>
                          Entradas
                        </NavLink>
                      </li>
                      <li>
                        <NavLink to="/salidas" className="dropdown-item">
                          <span className="me-2" aria-hidden="true">⤒</span>
                          Salidas
                        </NavLink>
                      </li>
                      <li><hr className="dropdown-divider" /></li>
                      <li>
                        <NavLink to="/resumen-entradas" className="dropdown-item">
                          🧾 Resumen Entradas
                        </NavLink>
                      </li>
                      <li>
                        <NavLink to="/historial-salidas" className="dropdown-item">
                          📚 Historial Salidas
                        </NavLink>
                      </li>
                    </ul>
                  </li>

                  {/* Dropdown Administración */}
                  <li className="nav-item dropdown">
                    <button
                      className="nav-link dropdown-toggle sw-navlink btn btn-link"
                      id="navAdministracion"
                      type="button"
                      data-bs-toggle="dropdown"
                      aria-expanded="false"
                    >
                      Administración
                    </button>
                    <ul className="dropdown-menu" aria-labelledby="navAdministracion">
                      <li>
                        <NavLink to="/dashboard" className="dropdown-item">
                          📊 Dashboard
                        </NavLink>
                      </li>
                      <li><hr className="dropdown-divider" /></li>
                      <li>
                        <NavLink to="/clientes" className="dropdown-item">
                          👥 Clientes
                        </NavLink>
                      </li>
                      <li>
                        <NavLink to="/coches" className="dropdown-item">
                          🚗 Coches
                        </NavLink>
                      </li>
                      <li>
                        <NavLink to="/resumen-clientes" className="dropdown-item">
                          📋 Resumen Clientes
                        </NavLink>
                      </li>
                      <li><hr className="dropdown-divider" /></li>
                      <li>
                        <NavLink to="/administracion/finanzas" className="dropdown-item">
                          💶 Finanzas
                        </NavLink>
                      </li>
                      <li>
                        <NavLink to="/administracion/cobros-profesionales" className="dropdown-item">
                          👥 Clientes Profesionales
                        </NavLink>
                      </li>
                      <li>
                        <NavLink to="/maquinaria" className="dropdown-item">
                          🏭 Maquinaria
                        </NavLink>
                      </li>
                      <li>
                        <NavLink to="/usuarios" className="dropdown-item">
                          👤 Usuarios
                        </NavLink>
                      </li>
                      <li>
                        <NavLink to="/proveedores" className="dropdown-item">
                          🚚 Proveedores
                        </NavLink>
                      </li>
                      <li>
                        <NavLink to="/catalogo-servicios" className="dropdown-item">
                          🛠️ Catálogo de servicios
                        </NavLink>
                      </li>
                      <li><hr className="dropdown-divider" /></li>
                      <li>
                        <NavLink to="/horarios" className="dropdown-item">
                          🕒 Horarios del personal
                        </NavLink>
                      </li>
                    </ul>
                  </li>

                </>
              )}

              {((rol === "encargado" || rol === "pintura" || rol === "tapicero") && rol !== "detailing") && (
                <>
                  {rol === "encargado" && (
                    <li className="nav-item dropdown">
                      <button
                        className="nav-link dropdown-toggle sw-navlink btn btn-link"
                        id="navFlujoEntregaOperativo"
                        type="button"
                        data-bs-toggle="dropdown"
                        aria-expanded="false"
                      >
                        Flujo Entrega
                      </button>
                      <ul className="dropdown-menu" aria-labelledby="navFlujoEntregaOperativo">
                        <li>
                          <NavLink to="/inspeccion-recepcion" className="dropdown-item">
                            1) Inspección recepción
                          </NavLink>
                        </li>
                        <li>
                          <NavLink to="/repaso-entrega" className="dropdown-item">
                            2) Repaso + Firma
                          </NavLink>
                        </li>
                      </ul>
                    </li>
                  )}

                  <li className="nav-item">
                    <NavLink to="/salidas" className="nav-link sw-navlink">
                      Registrar salida
                    </NavLink>
                  </li>
                  {isEmpleadoOperativo && (
                    <li className="nav-item">
                      <NavLink to={rol === "tapicero" ? "/flujo-trabajo-tapicero" : "/mis-partes-trabajo"} className="nav-link sw-navlink">
                        Mis partes
                      </NavLink>
                    </li>
                  )}
                 
                </>
              )}

              {rol === "detailing" && (
                <>
                  <li className="nav-item dropdown">
                    <button
                      className="nav-link dropdown-toggle sw-navlink btn btn-link"
                      id="navFlujoEntregaDetailing"
                      type="button"
                      data-bs-toggle="dropdown"
                      aria-expanded="false"
                    >
                      Flujo Entrega
                    </button>
                    <ul className="dropdown-menu" aria-labelledby="navFlujoEntregaDetailing">
                      <li>
                        <NavLink to="/inspeccion-recepcion" className="dropdown-item">
                          1) Inspección recepción
                        </NavLink>
                      </li>
                      <li>
                        <NavLink to="/flujo-trabajo" className="dropdown-item">
                          2) Mis partes
                        </NavLink>
                      </li>
                      <li>
                        <NavLink to="/repaso-entrega?tab=estado" className="dropdown-item">
                          3) Estado coches
                        </NavLink>
                      </li>
                      <li>
                        <NavLink to="/repaso-entrega" className="dropdown-item">
                          4) Repaso + Firma
                        </NavLink>
                      </li>
                    </ul>
                  </li>

                  <li className="nav-item">
                    <NavLink to="/salidas" className="nav-link sw-navlink">
                      Registrar salida
                    </NavLink>
                  </li>

                </>
              )}

              {rol === "calidad" && (
                <>
                  <li className="nav-item dropdown">
                    <button
                      className="nav-link dropdown-toggle sw-navlink btn btn-link"
                      id="navFlujoEntregaCalidad"
                      type="button"
                      data-bs-toggle="dropdown"
                      aria-expanded="false"
                    >
                      Flujo Entrega
                    </button>
                    <ul className="dropdown-menu" aria-labelledby="navFlujoEntregaCalidad">
                      <li>
                        <NavLink to="/inspeccion-recepcion" className="dropdown-item">
                          1) Inspección recepción
                        </NavLink>
                      </li>
                      <li>
                        <NavLink to="/partes-trabajo" className="dropdown-item">
                          2) Partes de trabajo
                        </NavLink>
                      </li>
                      <li>
                        <NavLink to="/repaso-entrega?tab=estado" className="dropdown-item">
                          3) Estado coches
                        </NavLink>
                      </li>
                      <li>
                        <NavLink to="/repaso-entrega" className="dropdown-item">
                          4) Repaso + Firma
                        </NavLink>
                      </li>
                    </ul>
                  </li>

                  <li className="nav-item dropdown">
                    <button
                      className="nav-link dropdown-toggle sw-navlink btn btn-link"
                      id="navInventarioCalidad"
                      type="button"
                      data-bs-toggle="dropdown"
                      aria-expanded="false"
                    >
                      Inventario
                    </button>
                    <ul className="dropdown-menu" aria-labelledby="navInventarioCalidad">
                      <li>
                        <NavLink to="/salidas" className="dropdown-item">
                          Salidas
                        </NavLink>
                      </li>
                    </ul>
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
                {/* Campana: solo admin y encargado */}
                {(rol === "administrador" || rol === "encargado") && (
                  <CampanaNotificaciones token={token} />
                )}
                <li className="nav-item d-flex align-items-center">
                  <span className="sw-role-pill">
                    Rol:&nbsp;
                    <strong>
                      {rol ? rol.charAt(0).toUpperCase() + rol.slice(1) : "—"}
                    </strong>
                  </span>
                </li>
                {(rol === "administrador" || rol === "encargado" || rol === "calidad" || rol === "detailing") && (
                  <li className="nav-item">
                    <NavLink to="/citas" className="nav-link sw-navlink">
                      Citas
                    </NavLink>
                  </li>
                )}
                <li className="nav-item">
                  <NavLink to="/fichar" className="nav-link sw-navlink">
                    Fichar
                  </NavLink>
                </li>
                <li className="nav-item">
                  <button
                    className="sw-theme-toggle"
                    onClick={toggleTheme}
                    title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
                  >
                    <i className={`fas ${theme === "dark" ? "fa-sun" : "fa-moon"}`}></i>
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    className="btn sw-btn-gold"
                    onClick={handleLogout}
                  >
                    <i className="fas fa-sign-out-alt me-1"></i>Salir
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
