// src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import injectContext from "./store/appContext.js";

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
import ClientesPage from "./pages/ClientesPage.jsx";
import CochesPage from "./pages/CochesPage.jsx";
import ServiciosPage from "./pages/ServiciosPage.jsx";
import ResumenClientesPage from "./pages/ResumenClientesPage.jsx";

const isLogged = () =>
  Boolean(sessionStorage.getItem("token") || localStorage.getItem("token"));

const RedirectIfLogged = ({ children }) =>
  isLogged() ? <Navigate to="/" replace /> : children;

const App = () => {
  return (
    <BrowserRouter>
      <div className="sw-app">
        <NavbarSW />

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
                <PrivateRoute allow={["administrador", "empleado", "encargado"]}>
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
              path="/servicios"
              element={
                <PrivateRoute allow={["administrador", "encargado", "empleado"]}>
                  <ServiciosPage />
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
