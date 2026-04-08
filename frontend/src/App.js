// src/App.jsx
import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import injectContext from "./store/appContext.js";
import { touchSessionActivity, getStoredRol, isEmployeeRole } from "./utils/authSession";
import { obtenerHoy } from "./utils/horarioApi";

import NavbarSW from "./component/NavbarSW.jsx";
import Footer from "./component/Footer.jsx";
import PrivateRoute from "./component/PrivateRoute.js";

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
import { AdminPartesTrabajo, EmpleadoPartesTrabajo } from "./pages/PartesTrabajo";
import { AdminPartesTrabajoFinalizados } from "./pages/PartesTrabajoFinalizados";
import CatalogoServiciosPage from "./pages/CatalogoServiciosPage";
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

const isLogged = () =>
  Boolean(sessionStorage.getItem("token") || localStorage.getItem("token"));

// Usa sessionStorage primero (sesión de pestaña), igual que token y rol
const getStoredUserId = () =>
  sessionStorage.getItem("userId") || localStorage.getItem("userId") || "";

const RedirectIfLogged = ({ children }) =>
  isLogged() ? <Navigate to="/" replace /> : children;

const App = () => {
  const [recordatorio, setRecordatorio] = useState("");

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
      if (registro.inicio_comida && !registro.fin_comida) return "Recuerda fichar el fin de comida.";
      if (!registro.salida) return "Recuerda fichar tu salida al finalizar.";
      return "";
    };

    const lanzarRecordatorioDiario = async () => {
      const token = sessionStorage.getItem("token") || localStorage.getItem("token");
      if (!token) return;

      const rol = getStoredRol();
      if (!isEmployeeRole(rol)) return;

      const userId = getStoredUserId() || "anon";
      const hoy = new Date().toISOString().slice(0, 10);
      const key = `sw_recordatorio_fichaje_${userId}_${hoy}`;
      const yaMostrado = sessionStorage.getItem(key) || localStorage.getItem(key);
      if (yaMostrado) return;

      try {
        const registro = await obtenerHoy();
        if (cancelado) return;

        const msg = getRecordatorioPendiente(registro);
        if (!msg) return;

        setRecordatorio(msg);
        sessionStorage.setItem(key, "1");
        localStorage.setItem(key, "1");
      } catch {
        // Silencioso para no romper carga inicial por fallo de red.
      }
    };

    lanzarRecordatorioDiario();
    return () => { cancelado = true; };
  }, []);

  return (
    <BrowserRouter>
      <div className="sw-app">
        <NavbarSW />

        {recordatorio && (
          <div className="alert alert-warning alert-dismissible mb-0 rounded-0" role="alert">
            {recordatorio}{" "}
            <a href="/fichar" className="alert-link">Abrir pantalla de Fichar.</a>
            <button
              type="button"
              className="btn-close"
              onClick={() => setRecordatorio("")}
              aria-label="Cerrar"
            />
          </div>
        )}

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
                <PrivateRoute allow={["administrador"]}>
                  <ProductosPage />
                </PrivateRoute>
              }
            />

            <Route
              path="/entradas"
              element={
                <PrivateRoute allow={["administrador"]}>
                  <RegistrarEntradaPage />
                </PrivateRoute>
              }
            />

            <Route
              path="/salidas"
              element={
                <PrivateRoute allow={["administrador", "encargado", "calidad", "detailing", "pintura", "tapicero"]}>
                  <RegistrarSalidaPage />
                </PrivateRoute>
              }
            />

            <Route
              path="/usuarios"
              element={
                <PrivateRoute allow={["administrador"]}>
                  <Usuarios />
                </PrivateRoute>
              }
            />

            <Route
              path="/proveedores"
              element={
                <PrivateRoute allow={["administrador"]}>
                  <Proveedores />
                </PrivateRoute>
              }
            />

            <Route
              path="/maquinaria"
              element={
                <PrivateRoute allow={["administrador"]}>
                  <Maquinaria />
                </PrivateRoute>
              }
            />

            <Route
              path="/resumen-entradas"
              element={
                <PrivateRoute allow={["administrador"]}>
                  <ResumenEntradas />
                </PrivateRoute>
              }
            />

            <Route
              path="/historial-salidas"
              element={
                <PrivateRoute allow={["administrador"]}>
                  <HistorialSalidas />
                </PrivateRoute>
              }
            />

            <Route
              path="/pedido-bajo-stock"
              element={
                <PrivateRoute allow={["administrador"]}>
                  <PedidoBajoStock />
                </PrivateRoute>
              }
            />

            <Route
              path="/pedido-bajo-stock/imprimir"
              element={
                <PrivateRoute allow={["administrador"]}>
                  <PedidoBajoStockPrint />
                </PrivateRoute>
              }
            />

            <Route
              path="/clientes"
              element={
                <PrivateRoute allow={["administrador"]}>
                  <ClientesPage />
                </PrivateRoute>
              }
            />

            <Route
              path="/coches"
              element={
                <PrivateRoute allow={["administrador"]}>
                  <CochesPage />
                </PrivateRoute>
              }
            />

            <Route
              path="/partes-trabajo"
              element={
                <PrivateRoute allow={["administrador", "calidad"]}>
                  <AdminPartesTrabajo />
                </PrivateRoute>
              }
            />

            <Route
              path="/mis-partes-trabajo"
              element={
                <PrivateRoute allow={["detailing", "pintura"]}>
                  <EmpleadoPartesTrabajo
                    empleadoId={getStoredUserId()}
                    userRol={getStoredRol()}
                  />
                </PrivateRoute>
              }
            />

            <Route
              path="/flujo-trabajo"
              element={
                <PrivateRoute allow={["detailing", "pintura"]}>
                  <EmpleadoPartesTrabajo
                    empleadoId={getStoredUserId()}
                    userRol={getStoredRol()}
                  />
                </PrivateRoute>
              }
            />

            <Route
              path="/flujo-trabajo-tapicero"
              element={
                <PrivateRoute allow={["tapicero"]}>
                  <EmpleadoPartesTrabajo
                    empleadoId={getStoredUserId()}
                    panelTitle="🪑 Mis Partes de Tapicería"
                    panelSubtitle="Gestiona el avance de los trabajos de tapicería asignados"
                    userRol={getStoredRol()}
                  />
                </PrivateRoute>
              }
            />

            <Route
              path="/partes-trabajo-finalizados"
              element={
                <PrivateRoute allow={["administrador"]}>
                  <AdminPartesTrabajoFinalizados />
                </PrivateRoute>
              }
            />

            <Route
              path="/catalogo-servicios"
              element={
                <PrivateRoute allow={["administrador"]}>
                  <CatalogoServiciosPage />
                </PrivateRoute>
              }
            />

            <Route
              path="/citas"
              element={
                <PrivateRoute allow={["administrador", "encargado", "calidad", "detailing"]}>
                  <CitasPage />
                </PrivateRoute>
              }
            />

            <Route
              path="/resumen-clientes"
              element={
                <PrivateRoute allow={["administrador"]}>
                  <ResumenClientesPage />
                </PrivateRoute>
              }
            />

            <Route
              path="/dashboard"
              element={
                <PrivateRoute allow={["administrador"]}>
                  <DashboardPage />
                </PrivateRoute>
              }
            />

            <Route
              path="/administracion/finanzas"
              element={
                <PrivateRoute allow={["administrador"]}>
                  <GastosEmpresaPage />
                </PrivateRoute>
              }
            />

            <Route
              path="/administracion/cobros-profesionales"
              element={
                <PrivateRoute allow={["administrador"]}>
                  <ProfesionalesPage />
                </PrivateRoute>
              }
            />

            <Route
              path="/pagos-profesionales"
              element={
                <PrivateRoute allow={["administrador", "detailing", "calidad"]}>
                  <Navigate to="/administracion/cobros-profesionales" replace />
                </PrivateRoute>
              }
            />

            <Route
              path="/vehiculos"
              element={
                <PrivateRoute allow={["administrador", "detailing", "calidad"]}>
                  <VehiculosPage />
                </PrivateRoute>
              }
            />

            <Route
              path="/inventario"
              element={
                <PrivateRoute allow={["administrador", "encargado", "calidad", "detailing", "pintura", "tapicero"]}>
                  <InventarioPage />
                </PrivateRoute>
              }
            />

            <Route
              path="/partes"
              element={
                <PrivateRoute allow={["administrador", "calidad", "detailing", "pintura", "tapicero"]}>
                  <PartesPage />
                </PrivateRoute>
              }
            />

            <Route
              path="/administracion"
              element={
                <PrivateRoute allow={["administrador"]}>
                  <AdminPage />
                </PrivateRoute>
              }
            />

            <Route
              path="/inspeccion-recepcion"
              element={
                <PrivateRoute allow={["administrador", "calidad"]}>
                  <InspeccionRecepcionPage />
                </PrivateRoute>
              }
            />

            <Route
              path="/vehiculo-detalle/:inspeccion_id"
              element={
                <PrivateRoute allow={["administrador", "calidad"]}>
                  <VehiculoDetallePage />
                </PrivateRoute>
              }
            />

            <Route
              path="/hoja-tecnica/:inspeccion_id"
              element={
                <PrivateRoute allow={["administrador"]}>
                  <HojaTecnicaPage />
                </PrivateRoute>
              }
            />

            <Route
              path="/entrega-cliente/:inspeccion_id"
              element={
                <PrivateRoute allow={["administrador", "calidad"]}>
                  <EntregaClientePage />
                </PrivateRoute>
              }
            />

            <Route
              path="/inspecciones-guardadas"
              element={
                <PrivateRoute allow={["administrador"]}>
                  <InspeccionesGuardadasPage />
                </PrivateRoute>
              }
            />

            <Route
              path="/acta-entrega/:id"
              element={
                <PrivateRoute allow={["administrador", "encargado", "detailing", "calidad"]}>
                  <ActaEntregaView />
                </PrivateRoute>
              }
            />

            <Route
              path="/acta-entrega-doc/:id"
              element={<ActaEntregaDocumento />}
            />

            <Route
              path="/pendientes-entrega"
              element={<Navigate to="/inspecciones-guardadas?tab=pendientes" replace />}
            />

            <Route
              path="/firma-entrega"
              element={<Navigate to="/repaso-entrega?tab=firma" replace />}
            />

            <Route
              path="/repaso-entrega"
              element={
                <PrivateRoute allow={["administrador", "detailing", "calidad"]}>
                  <RepasoEntregaPage />
                </PrivateRoute>
              }
            />

            <Route
              path="/estado-coches"
              element={<Navigate to="/repaso-entrega?tab=estado" replace />}
            />

            <Route
              path="/fichar"
              element={
                <PrivateRoute allow={["administrador", "encargado", "detailing", "calidad", "pintura", "tapicero"]}>
                  <FicharPage />
                </PrivateRoute>
              }
            />

            <Route
              path="/horarios"
              element={
                <PrivateRoute allow={["administrador", "encargado"]}>
                  <HorariosAdminPage />
                </PrivateRoute>
              }
            />

            <Route
              path="/entregados"
              element={<Navigate to="/inspecciones-guardadas?tab=entregados" replace />}
            />

            <Route
              path="/entregados-page"
              element={
                <PrivateRoute allow={["administrador"]}>
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

        <Footer />
      </div>
    </BrowserRouter>
  );
};

export default injectContext(App);
