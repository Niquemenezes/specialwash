// src/App.jsx
import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useMatch } from "react-router-dom";
import injectContext from "./store/appContext.js";
import { touchSessionActivity, getStoredRol, isEmployeeRole, getDefaultRouteForRole, normalizeRol } from "./utils/authSession";
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
import UniformesPage from "./pages/UniformesPage.jsx";
import CocheSustitucionPage from "./pages/CocheSustitucionPage.jsx";
import EstadoCochesPage from "./pages/EstadoCochesPage.jsx";

// Helper: obtener permisos para una ruta desde la configuración centralizada
const getRouteAllow = (routePath) => {
  const allowed = ROUTE_PERMISSIONS[routePath];
  return allowed ? (allowed.includes("*") ? [] : allowed) : [];
};

const isLogged = () => Boolean(localStorage.getItem("token"));

// Usa sessionStorage primero (sesión de pestaña), igual que token y rol
const getStoredUserId = () => localStorage.getItem("userId") || "";

const ADMIN_ROLE_QUEUE_META = {
  detailing: {
    role: "detailing",
    title: "Vista detailing",
    subtitle: "Supervisión administrativa de la cola de detailing.",
  },
  pintura: {
    role: "pintura",
    title: "Vista pintura",
    subtitle: "Supervisión administrativa de la cola de pintura.",
  },
  tapicero: {
    role: "tapicero",
    title: "Vista tapicería",
    subtitle: "Supervisión administrativa de la cola de tapicería.",
  },
};

const AdminRoleQueuePreview = () => {
  const location = useLocation();
  const roleParam = normalizeRol(new URLSearchParams(location.search).get("rol"));
  const config = ADMIN_ROLE_QUEUE_META[roleParam];

  if (!config) {
    return <Navigate to="/partes-trabajo" replace />;
  }

  return (
    <EmpleadoPartesTrabajo
      empleadoId={getStoredUserId()}
      userRol={config.role}
      panelTitle={config.title}
      panelSubtitle={config.subtitle}
    />
  );
};

const RedirectIfLogged = ({ children }) =>
  isLogged() ? <Navigate to={getDefaultRouteForRole(getStoredRol())} replace /> : children;

const HomeRoute = () => {
  const rol = getStoredRol();
  if (isEmployeeRole(rol)) {
    return <Navigate to="/mis-partes-trabajo" replace />;
  }
  return <Home />;
};

const useCocheSustitucionRouteMatch = () => {
  const matchCocheSustitucionBase = useMatch("/coche-sustitucion");
  const matchCocheSustitucionSlash = useMatch("/coche-sustitucion/");
  const matchCochesSustitucionBase = useMatch("/coches-sustitucion");
  const matchCochesSustitucionSlash = useMatch("/coches-sustitucion/");

  return (
    matchCocheSustitucionBase ||
    matchCocheSustitucionSlash ||
    matchCochesSustitucionBase ||
    matchCochesSustitucionSlash
  );
};

const AppContent = () => {
  const matchCocheSustitucion = useCocheSustitucionRouteMatch();

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

  return (
    <>
      <div className="sw-app">
        <NavbarSW />

        <div className="sw-layout">
          <SidebarSW />
          <main className="sw-main">
            {matchCocheSustitucion ? (
              <PrivateRoute allow={getRouteAllow("/coche-sustitucion")}>
                <CocheSustitucionPage />
              </PrivateRoute>
            ) : (
            <Routes>
            <Route path="/" element={<HomeRoute />} />

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
              path="/estado-coches"
              element={
                <PrivateRoute allow={getRouteAllow("/estado-coches")}>
                  <EstadoCochesPage />
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
              path="/vista-partes-rol"
              element={
                <PrivateRoute allow={getRouteAllow("/vista-partes-rol")}>
                  <AdminRoleQueuePreview />
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
              path="/uniformes"
              element={
                <PrivateRoute allow={getRouteAllow("/uniformes")}>
                  <UniformesPage />
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
            )}
          </main>
        </div>

        <Footer />
      </div>
      <ModalConfirmar />
      <ToastSW />
    </>
  );
};

const App = () => (
  <BrowserRouter>
    <AppContent />
  </BrowserRouter>
);

export default injectContext(App);
