import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import logo from "../img/logospecialwash.jpg";
import { buildApiUrl } from "../utils/apiBase";
import { getStoredRol, getStoredToken, isEmployeeRole } from "../utils/authSession";

// ─── Campana de notificaciones ───────────────────────────────────────────────
const CampanaNotificaciones = ({ token }) => {
  const [count, setCount] = useState(0);
  const [lista, setLista] = useState([]);
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  const cargar = useCallback(async () => {
    if (!token) return;
    try {
      const t = sessionStorage.getItem("token") || localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${t}` };
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
      const t = sessionStorage.getItem("token") || localStorage.getItem("token");
      await fetch(buildApiUrl(`/api/notificaciones/${id}/leida`), {
        method: "PATCH", headers: { Authorization: `Bearer ${t}` }
      });
      await cargar();
    } catch { /* silencioso */ }
  };

  const marcarTodas = async () => {
    try {
      const t = sessionStorage.getItem("token") || localStorage.getItem("token");
      await fetch(buildApiUrl("/api/notificaciones/marcar-todas"), {
        method: "PATCH", headers: { Authorization: `Bearer ${t}` }
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

  return (
    <li className="nav-item position-relative" ref={ref}>
      <button
        className="btn p-0 sw-campana"
        onClick={() => { setAbierto(o => !o); if (!abierto) cargar(); }}
        title="Notificaciones"
        style={{ background: "none", border: "none", color: "#cfcfcf", fontSize: "1.1rem", lineHeight: 1, position: "relative" }}
      >
        🔔
        {count > 0 && (
          <span style={{
            position: "absolute", top: -4, right: -6,
            background: "#e63946", color: "#fff", borderRadius: "50%",
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
          background: "#1e2128", border: "1px solid #2e3340",
          borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
          zIndex: 9999,
        }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid #2e3340", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ color: "#e2c97e", fontWeight: 700, fontSize: "0.78rem" }}>Notificaciones</span>
            {count > 0 && (
              <button onClick={marcarTodas} style={{ background: "none", border: "none", color: "#aaa", fontSize: "0.68rem", cursor: "pointer", padding: 0 }}>
                Marcar todas leídas
              </button>
            )}
          </div>
          {lista.length === 0 ? (
            <div style={{ padding: 16, color: "#888", fontSize: "0.75rem", textAlign: "center" }}>Sin notificaciones</div>
          ) : lista.map(n => (
            <div
              key={n.id}
              onClick={() => onClickNotificacion(n)}
              style={{
                padding: "10px 14px",
                borderBottom: "1px solid #2a2d36",
                cursor: "pointer",
                background: n.leida ? "transparent" : "rgba(226,201,126,0.07)",
                transition: "background 0.15s",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
                <span style={{ color: n.leida ? "#888" : "#e2e2e2", fontSize: "0.74rem", fontWeight: n.leida ? 400 : 600 }}>
                  {getIconoNotificacion(n.tipo)} {n.titulo}
                </span>
                {!n.leida && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#e63946", flexShrink: 0, marginTop: 3 }} />}
              </div>
              {n.cuerpo && <div style={{ color: "#888", fontSize: "0.67rem", marginTop: 2 }}>{n.cuerpo}</div>}
              <div style={{ color: "#555", fontSize: "0.63rem", marginTop: 3 }}>{formatHora(n.created_at)}</div>
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
  const rolRaw = (
    sessionStorage.getItem("rol") ||
    localStorage.getItem("rol") ||
    ""
  ).toLowerCase().trim();
  const isPintura = rolRaw === "pintura";
  const isEmpleadoOperativo = isEmployeeRole(rol);
  const handleLogout = async () => {
    try {
      await fetch(buildApiUrl("/api/auth/logout"), {
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
                  {/* Dropdown Flujo Entrega */}
                  <li className="nav-item dropdown">
                    <button
                      className="nav-link dropdown-toggle sw-navlink btn btn-link"
                      id="navFlujoEntrega"
                      type="button"
                      data-bs-toggle="dropdown"
                      aria-expanded="false"
                    >
                      Flujo Entrega
                    </button>
                    <ul className="dropdown-menu" aria-labelledby="navFlujoEntrega">
                      <li><h6 className="dropdown-header">Pre-entrega</h6></li>
                      <li>
                        <NavLink to="/inspeccion-recepcion" className="dropdown-item">
                          1) Inspección recepción (todos)
                        </NavLink>
                      </li>
                      <li>
                        <NavLink to="/inspecciones-guardadas" className="dropdown-item">
                          2) Inspecciones + Pendientes (admin)
                        </NavLink>
                      </li>
                      <li><hr className="dropdown-divider" /></li>
                      <li><h6 className="dropdown-header">Entrega</h6></li>
                      <li>
                        <NavLink to="/repaso-entrega" className="dropdown-item">
                          3) Repaso + Firma
                        </NavLink>
                      </li>
                      <li><hr className="dropdown-divider" /></li>
                      <li>
                        <NavLink to="/entregados" className="dropdown-item">
                          4) Coches entregados
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
                        <NavLink to="/clientes" className="dropdown-item">
                          Clientes
                        </NavLink>
                      </li>
                      <li>
                        <NavLink to="/coches" className="dropdown-item">
                          Coches
                        </NavLink>
                      </li>
                      <li>
                        <NavLink to="/resumen-clientes" className="dropdown-item">
                          Resumen Clientes
                        </NavLink>
                      </li>
                      <li><hr className="dropdown-divider" /></li>
                      <li>
                        <NavLink to="/administracion/finanzas" className="dropdown-item">
                          Finanzas
                        </NavLink>
                      </li>
                      <li>
                        <NavLink to="/maquinaria" className="dropdown-item">
                          Maquinaria
                        </NavLink>
                      </li>
                      <li>
                        <NavLink to="/usuarios" className="dropdown-item">
                          Usuarios
                        </NavLink>
                      </li>
                      <li>
                        <NavLink to="/proveedores" className="dropdown-item">
                          Proveedores
                        </NavLink>
                      </li>
                    </ul>
                  </li>

                  {/* Dropdown Partes de trabajo */}
                  <li className="nav-item dropdown">
                    <button
                      className="nav-link dropdown-toggle sw-navlink btn btn-link"
                      id="navPartes"
                      type="button"
                      data-bs-toggle="dropdown"
                      aria-expanded="false"
                    >
                      Partes
                    </button>
                    <ul className="dropdown-menu" aria-labelledby="navPartes">
                      <li>
                        <NavLink to="/partes-trabajo" className="dropdown-item">
                          🧰 Partes activos
                        </NavLink>
                      </li>
                      <li>
                        <NavLink to="/partes-trabajo-finalizados" className="dropdown-item">
                          ✅ Partes finalizados
                        </NavLink>
                      </li>
                      <li><hr className="dropdown-divider" /></li>
                      <li>
                        <NavLink to="/catalogo-servicios" className="dropdown-item">
                          🛠️ Catálogo de servicios
                        </NavLink>
                      </li>
                    </ul>
                  </li>

                </>
              )}

              {((rol === "empleado" || rol === "encargado" || rol === "pintura") && rol !== "detailing") && (
                <>
                  {!isPintura && (
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
                      <NavLink to="/mis-partes-trabajo" className="nav-link sw-navlink">
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
                        <NavLink to="/repaso-entrega" className="dropdown-item">
                          2) Repaso + Firma
                        </NavLink>
                      </li>
                    </ul>
                  </li>

                  <li className="nav-item dropdown">
                    <button
                      className="nav-link dropdown-toggle sw-navlink btn btn-link"
                      id="navPartesDetailing"
                      type="button"
                      data-bs-toggle="dropdown"
                      aria-expanded="false"
                    >
                      Partes
                    </button>
                    <ul className="dropdown-menu" aria-labelledby="navPartesDetailing">
                      <li>
                        <NavLink to="/flujo-trabajo" className="dropdown-item">
                          👨‍🔧 Mis partes
                        </NavLink>
                      </li>
                    </ul>
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
                        <NavLink to="/repaso-entrega" className="dropdown-item">
                          2) Repaso + Firma
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

                  <li className="nav-item dropdown">
                    <button
                      className="nav-link dropdown-toggle sw-navlink btn btn-link"
                      id="navPartesCalidad"
                      type="button"
                      data-bs-toggle="dropdown"
                      aria-expanded="false"
                    >
                      Partes
                    </button>
                    <ul className="dropdown-menu" aria-labelledby="navPartesCalidad">
                      <li>
                        <NavLink to="/partes-trabajo" className="dropdown-item">
                          🧰 Partes activos
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
                {(rol === "administrador" || rol === "encargado" || rol === "tecnico_comercial" || rol === "calidad" || rol === "detailing") && (
                  <li className="nav-item">
                    <NavLink to="/citas" className="nav-link sw-navlink">
                      Citas
                    </NavLink>
                  </li>
                )}
                <li className="nav-item">
                  <button
                    className="btn sw-btn-gold"
                    onClick={handleLogout}
                  >
                    Salir
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
