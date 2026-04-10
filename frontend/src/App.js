// src/App.jsx
import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import injectContext from "./store/appContext.js";
import { touchSessionActivity, getStoredRol, isEmployeeRole } from "./utils/authSession";
import { obtenerHoy } from "./utils/horarioApi";
import { ROUTE_PERMISSIONS } from "./config/rolePermissions.js";

import NavbarSW from "./components/NavbarSW.jsx";
import SidebarSW from "./components/SidebarSW.jsx";
import Footer from "./components/Footer.jsx";
import PrivateRoute from "./components/PrivateRoute.js";
import ModalConfirmar from "./components/ModalConfirmar.jsx";
import ToastSW from "./components/ToastSW.jsx";

// Páginas
import Login from "./pages/login.js";
import Home from "./pages/Home.jsx";
import ProductosPage from "./pages/ProductosPage.jsx";
import RegistrarEntradaPage from "./pages/RegistrarEntradaPage.jsx";
import RegistrarSalidaPage from "./pages/RegistrarSalidaPage.jsx";
import Usuarios from "./pages/usuarios.js";
import Proveedores from "./pages/proveedores.js";
import Maquinaria from "./pages/maquinaria.js";
import ResumenEntradas from "./pages/ResumenEntradas.jsx";
import HistorialSalidas from "./pages/HistorialSalidas.jsx";
import PedidoBajoStock from "./pages/PedidoBajoStock.jsx";
import PedidoBajoStockPrint from "./pages/PedidoBajoStockPrint.jsx";
import ClientesPage from "./pages/ClientesPage.jsx";
import CochesPage from "./pages/CochesPage.jsx";
import ResumenClientesPage from "./pages/ResumenClientesPage.jsx";
import InspeccionRecepcionPage from "./pages/InspeccionRecepcionPage.jsx";
import ActaEntregaView from "./pages/ActaEntregaView.jsx";
import ActaEntregaDocumento from "./pages/ActaEntregaDocumento.jsx";
import CochesEntregadosPage from "./pages/CochesEntregadosPage.jsx";
import InspeccionesGuardadasPage from "./pages/InspeccionesGuardadasPage.jsx";
import { EmpleadoPartesTrabajo } from "./pages/PartesTrabajo";
import AdminPartesTrabajoListado from "./pages/AdminPartesTrabajoListado";
import AdminPartesTrabajoAcompanamiento from "./pages/AdminPartesTrabajoAcompanamiento";
import ProductividadTrabajadoresPage from "./pages/ProductividadTrabajadoresPage.jsx";
import { AdminPartesTrabajoFinalizados } from "./pages/PartesTrabajoFinalizados";
import CatalogoServiciosPage from "./pages/CatalogoServiciosPage";
import CalidadEntregaPage from "./pages/CalidadEntregaPage";
import CitasPage from "./pages/CitasPage";
import GastosEmpresaPage from "./pages/GastosEmpresaPage.jsx";
import ProfesionalesPage from "./pages/ProfesionalesPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import RepasoEntregaPage from "./pages/RepasoEntregaPage.jsx";
import FicharPage from "./pages/FicharPage.jsx";
import HorariosAdminPage from "./pages/HorariosAdminPage.jsx";
import VehiculosPage from "./pages/VehiculosPage.jsx";
import InventarioPage from "./pages/InventarioPage.jsx";
import PartesPage from "./pages/PartesPage.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import VehiculoDetallePage from "./pages/VehiculoDetallePage.jsx";
import HojaTecnicaPage from "./pages/HojaTecnicaPage.jsx";
import EntregaClientePage from "./pages/EntregaClientePage.jsx";

// Helper: obtener permisos para una ruta desde la configuración centralizada
const getRouteAllow = (routePath) => {
  const allowed = ROUTE_PERMISSIONS[routePath];
  return allowed ? (allowed.includes("*") ? [] : allowed) : [];
};

const isLogged = () => Boolean(localStorage.getItem("token"));

// Usa sessionStorage primero (sesión de pestaña), igual que token y rol
const getStoredUserId = () => localStorage.getItem("userId") || "";

const RedirectIfLogged = ({ children }) =>
  isLogged() ? <Navigate to="/" replace /> : children;

const App = () => {
  const [recordatorio, setRecordatorio] = useState("");
  const [mostrarModalRecordatorio, setMostrarModalRecordatorio] = useState(false);

  useEffect(() => {
    let lastTouch = 0;
    const onActivity = () => {
      const now = Date.now();
      // Evita escribir en storage en cada evento continuo
      if (now - lastTouch < 5000) return;
      lastTouch = now;
      touchSessionActivity();
    };

    const events = ["pointerdown", "keydown", "touchstart", "scroll", "mousemove"];
    events.forEach((evt) => window.addEventListener(evt, onActivity, { passive: true }));
    touchSessionActivity();

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, onActivity));
    };
  }, []);

  useEffect(() => {
    let cancelado = false;

    const getRecordatorioPendiente = (registro) => {
      if (!registro || !registro.entrada) return "Recuerda fichar tu entrada.";
      if (registro?.descanso_activo) return "Recuerda fichar el fin de descanso.";
      if (!registro.salida) return "Recuerda fichar tu salida al finalizar.";
      return "";
    };

    const lanzarRecordatorioDiario = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        if (!cancelado) {
          setRecordatorio("");
          setMostrarModalRecordatorio(false);
        }
        return;
      }

      const rol = getStoredRol();
      if (!isEmployeeRole(rol)) {
        if (!cancelado) {
          setRecordatorio("");
          setMostrarModalRecordatorio(false);
        }
        return;
      }

      try {
        const registro = await obtenerHoy();
        if (cancelado) return;

        const msg = getRecordatorioPendiente(registro);
        setRecordatorio(msg);
        setMostrarModalRecordatorio(Boolean(msg));
      } catch {
        // Silencioso para no romper carga inicial por fallo de red.
      }
    };

    const onLoginSuccess = () => {
      void lanzarRecordatorioDiario();
    };

    window.addEventListener("sw:login-success", onLoginSuccess);

    void lanzarRecordatorioDiario();
    return () => {
      cancelado = true;
      window.removeEventListener("sw:login-success", onLoginSuccess);
    };
  }, []);

  return (
    <BrowserRouter>
      <div className="sw-app">
        <NavbarSW />

        {recordatorio && mostrarModalRecordatorio && (
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="sw-recordatorio-title"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1200,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "1rem",
              background: "rgba(3, 7, 18, 0.68)",
              backdropFilter: "blur(2px)",
            }}
          >
            <div
              style={{
                width: "min(560px, 96vw)",
                borderRadius: "18px",
                border: "1px solid rgba(239,68,68,0.28)",
                background: "linear-gradient(180deg, rgba(24,10,10,0.98), rgba(15,23,42,0.98))",
                boxShadow: "0 24px 90px rgba(0,0,0,0.45)",
                overflow: "hidden",
              }}
            >
              <div style={{ padding: "1rem 1.15rem", borderBottom: "1px solid rgba(239,68,68,0.18)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
                <div style={{ color: "#fca5a5", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", fontSize: "0.76rem" }}>
                  Aviso importante
                </div>
                <button
                  type="button"
                  onClick={() => setMostrarModalRecordatorio(false)}
                  aria-label="Cerrar aviso"
                  style={{ background: "none", border: "none", color: "#fca5a5", fontSize: "1.2rem", cursor: "pointer", lineHeight: 1 }}
                >
                  ✕
                </button>
              </div>

              <div style={{ padding: "1.35rem 1.15rem 1.2rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", marginBottom: "0.85rem" }}>
                  <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(239,68,68,0.14)", border: "1px solid rgba(239,68,68,0.28)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem" }}>
                    ⏰
                  </div>
                  <div>
                    <div id="sw-recordatorio-title" style={{ color: "#fff", fontSize: "1.25rem", fontWeight: 800 }}>
                      Te has olvidado de fichar
                    </div>
                    <div style={{ color: "#cbd5e1", fontSize: "0.94rem", marginTop: "0.2rem" }}>
                      {recordatorio}
                    </div>
                  </div>
                </div>

                <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)", color: "#e5e7eb", borderRadius: "12px", padding: "0.9rem 1rem", fontSize: "0.92rem", lineHeight: 1.5 }}>
                  Este aviso aparecerá al iniciar sesión si tienes un fichaje pendiente. Puedes cerrarlo y seguir trabajando, pero conviene registrarlo cuanto antes.
                </div>

                <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", flexWrap: "wrap", marginTop: "1rem" }}>
                  <button
                    type="button"
                    onClick={() => setMostrarModalRecordatorio(false)}
                    style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.14)", color: "#e5e7eb", borderRadius: "10px", padding: "0.7rem 1rem", fontWeight: 700, cursor: "pointer" }}
                  >
                    Cerrar aviso
                  </button>
                  <a
                    href="/fichar"
                    style={{ background: "#ef4444", color: "#fff", borderRadius: "10px", padding: "0.72rem 1rem", fontWeight: 800, textDecoration: "none" }}
                  >
                    Ir a fichar ahora
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="sw-layout">
          <SidebarSW />
          <main className="sw-main">
            <Routes>
            <Route path="/" element={<Home />} />

            <Route
              path="/login"
              element={
                <RedirectIfLogged>
                  <Login />
                </RedirectIfLogged>
              }
            />

            <Route
              path="/productos"
              element={
                <PrivateRoute allow={getRouteAllow("/productos")}>
                  <ProductosPage />
                </PrivateRoute>
              }
            />

            <Route
              path="/entradas"
              element={
                <PrivateRoute allow={getRouteAllow("/entradas")}>
                  <RegistrarEntradaPage />
                </PrivateRoute>
              }
            />

            <Route
              path="/salidas"
              element={
                <PrivateRoute allow={getRouteAllow("/salidas")}>
                  <RegistrarSalidaPage />
                </PrivateRoute>
              }
            />

            <Route
              path="/usuarios"
              element={
                <PrivateRoute allow={getRouteAllow("/usuarios")}>
                  <Usuarios />
                </PrivateRoute>
              }
            />

            <Route
              path="/proveedores"
              element={
                <PrivateRoute allow={getRouteAllow("/proveedores")}>
                  <Proveedores />
                </PrivateRoute>
              }
            />

            <Route
              path="/maquinaria"
              element={
                <PrivateRoute allow={getRouteAllow("/maquinaria")}>
                  <Maquinaria />
                </PrivateRoute>
              }
            />

            <Route
              path="/resumen-entradas"
              element={
                <PrivateRoute allow={getRouteAllow("/resumen-entradas")}>
                  <ResumenEntradas />
                </PrivateRoute>
              }
            />

            <Route
              path="/historial-salidas"
              element={
                <PrivateRoute allow={getRouteAllow("/historial-salidas")}>
                  <HistorialSalidas />
                </PrivateRoute>
              }
            />

            <Route
              path="/pedido-bajo-stock"
              element={
                <PrivateRoute allow={getRouteAllow("/pedido-bajo-stock")}>
                  <PedidoBajoStock />
                </PrivateRoute>
              }
            />

            <Route
              path="/pedido-bajo-stock/imprimir"
              element={
                <PrivateRoute allow={getRouteAllow("/pedido-bajo-stock")}>
                  <PedidoBajoStockPrint />
                </PrivateRoute>
              }
            />

            <Route
              path="/clientes"
              element={
                <PrivateRoute allow={getRouteAllow("/clientes")}>
                  <ClientesPage />
                </PrivateRoute>
              }
            />

            <Route
              path="/coches"
              element={
                <PrivateRoute allow={getRouteAllow("/coches")}>
                  <CochesPage />
                </PrivateRoute>
              }
            />

            <Route
              path="/partes-trabajo"
              element={
                <PrivateRoute allow={getRouteAllow("/partes-trabajo")}>
                  <AdminPartesTrabajoAcompanamiento />
                </PrivateRoute>
              }
            />

            <Route
              path="/mis-partes-trabajo"
              element={
                <PrivateRoute allow={getRouteAllow("/mis-partes-trabajo")}>
                  <EmpleadoPartesTrabajo
                    empleadoId={getStoredUserId()}
                    userRol={getStoredRol()}
                  />
                </PrivateRoute>
              }
            />

            <Route
              path="/productividad-trabajadores"
              element={
                <PrivateRoute allow={getRouteAllow("/productividad-trabajadores")}>
                  <ProductividadTrabajadoresPage />
                </PrivateRoute>
              }
            />


            <Route
              path="/partes-trabajo-finalizados"
              element={
                <PrivateRoute allow={getRouteAllow("/partes-trabajo-finalizados")}>
                  <AdminPartesTrabajoFinalizados />
                </PrivateRoute>
              }
            />

            <Route
              path="/calidad-entrega"
              element={
                <PrivateRoute allow={getRouteAllow("/calidad-entrega")}>
                  <CalidadEntregaPage />
                </PrivateRoute>
              }
            />

            <Route
              path="/catalogo-servicios"
              element={
                <PrivateRoute allow={getRouteAllow("/catalogo-servicios")}>
                  <CatalogoServiciosPage />
                </PrivateRoute>
              }
            />

            <Route
              path="/citas"
              element={
                <PrivateRoute allow={getRouteAllow("/citas")}>
                  <CitasPage />
                </PrivateRoute>
              }
            />

            <Route
              path="/resumen-clientes"
              element={
                <PrivateRoute allow={getRouteAllow("/resumen-clientes")}>
                  <ResumenClientesPage />
                </PrivateRoute>
              }
            />

            <Route
              path="/dashboard"
              element={
                <PrivateRoute allow={getRouteAllow("/dashboard")}>
                  <DashboardPage />
                </PrivateRoute>
              }
            />

            <Route
              path="/administracion/finanzas"
              element={
                <PrivateRoute allow={getRouteAllow("/administracion/finanzas")}>
                  <GastosEmpresaPage />
                </PrivateRoute>
              }
            />

            <Route
              path="/administracion/cobros-profesionales"
              element={
                <PrivateRoute allow={getRouteAllow("/administracion/cobros-profesionales")}>
                  <ProfesionalesPage />
                </PrivateRoute>
              }
            />

            <Route
              path="/cobro-particulares"
              element={
                <PrivateRoute allow={getRouteAllow("/cobro-particulares")}>
                  <Navigate to="/repaso-entrega?tab=firma" replace />
                </PrivateRoute>
              }
            />

            <Route
              path="/vehiculos"
              element={
                <PrivateRoute allow={getRouteAllow("/vehiculos")}>
                  <VehiculosPage />
                </PrivateRoute>
              }
            />

            <Route
              path="/inventario"
              element={
                <PrivateRoute allow={getRouteAllow("/inventario")}>
                  <InventarioPage />
                </PrivateRoute>
              }
            />

            <Route
              path="/partes"
              element={
                <PrivateRoute allow={getRouteAllow("/partes")}>
                  <PartesPage />
                </PrivateRoute>
              }
            />

            <Route
              path="/administracion"
              element={
                <PrivateRoute allow={getRouteAllow("/administracion")}>
                  <AdminPage />
                </PrivateRoute>
              }
            />

            <Route
              path="/inspeccion-recepcion"
              element={
                <PrivateRoute allow={getRouteAllow("/inspeccion-recepcion")}>
                  <InspeccionRecepcionPage />
                </PrivateRoute>
              }
            />

            <Route
              path="/vehiculo-detalle/:inspeccion_id"
              element={
                <PrivateRoute allow={getRouteAllow("/vehiculo-detalle/:inspeccion_id")}>
                  <VehiculoDetallePage />
                </PrivateRoute>
              }
            />

            <Route
              path="/hoja-tecnica/:inspeccion_id"
              element={
                <PrivateRoute allow={getRouteAllow("/hoja-tecnica/:inspeccion_id")}>
                  <HojaTecnicaPage />
                </PrivateRoute>
              }
            />

            <Route
              path="/entrega-cliente/:inspeccion_id"
              element={
                <PrivateRoute allow={getRouteAllow("/entrega-cliente/:inspeccion_id")}>
                  <EntregaClientePage />
                </PrivateRoute>
              }
            />

            <Route
              path="/inspecciones-guardadas"
              element={
                <PrivateRoute allow={getRouteAllow("/inspecciones-guardadas")}>
                  <InspeccionesGuardadasPage />
                </PrivateRoute>
              }
            />

            <Route
              path="/acta-entrega/:id"
              element={
                <PrivateRoute allow={getRouteAllow("/acta-entrega/:id")}>
                  <ActaEntregaView />
                </PrivateRoute>
              }
            />

            <Route
              path="/acta-entrega-doc/:id"
              element={
                <PrivateRoute allow={getRouteAllow("/acta-entrega/:id")}>
                  <ActaEntregaDocumento />
                </PrivateRoute>
              }
            />

            <Route
              path="/repaso-entrega"
              element={
                <PrivateRoute allow={getRouteAllow("/repaso-entrega")}>
                  <RepasoEntregaPage />
                </PrivateRoute>
              }
            />

            <Route
              path="/fichar"
              element={
                <PrivateRoute allow={getRouteAllow("/fichar")}>
                  <FicharPage />
                </PrivateRoute>
              }
            />

            <Route
              path="/horarios"
              element={
                <PrivateRoute allow={getRouteAllow("/horarios")}>
                  <HorariosAdminPage />
                </PrivateRoute>
              }
            />

            <Route
              path="/entregados"
              element={
                <PrivateRoute allow={getRouteAllow("/entregados")}>
                  <CochesEntregadosPage />
                </PrivateRoute>
              }
            />

            <Route
              path="*"
              element={
                <h1 className="container mt-5 text-center">
                  Página no encontrada
                </h1>
              }
            />
          </Routes>
          </main>
        </div>

        <Footer />
      </div>
      <ModalConfirmar />
      <ToastSW />
    </BrowserRouter>
  );
};

export default injectContext(App);
