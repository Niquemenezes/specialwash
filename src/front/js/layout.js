import React from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import ScrollToTop from "./component/scrollToTop";
import { BackendURL } from "./component/backendURL";
import Home from "./pages/home";
import injectContext from "./store/appContext";
import Empleados from "./component/Empleados";
import Maquinaria from "./component/Maquinaria";
import Proveedores from "./component/Proveedores";
import Navbar from "./component/navbar";
import { Footer } from "./component/footer";
import SignupAdmin from "./pages/SignupAdmin";
import PrivateAdmin from "./component/PrivateAdmin";
import PrivateFuncionario from "./component/PrivateFuncionario";
import StockDashboard from "./pages/StockDashboard";
import EditarProducto from "./component/EditarProducto";
import RegistrarSalidaProducto from "./component/RegistrarSalidaProducto";
import RegistrarEntradaProducto from "./component/RegistrarEntradaProducto";
import ResumenEntradas from "./component/ResumenEntradas";
import HistorialSalidas from "./component/HistorialSalidas";
import ResumenStockMinimo from "./component/ResumenStockMinimo";
import "bootstrap/dist/css/bootstrap.min.css";

const Layout = () => {
  const basename = process.env.BASENAME || "";

  if (!process.env.BACKEND_URL || process.env.BACKEND_URL === "")
    return <BackendURL />;

  return (
    <div className="d-flex flex-column min-vh-100">
      <BrowserRouter basename={basename}>
        <ScrollToTop />
        <Navbar />
        <div className="flex-grow-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/funcionario" element={<PrivateFuncionario />} />
            <Route path="/empleados" element={<Empleados />} />
            <Route path="/maquinaria" element={<Maquinaria />} />
            <Route path="/proveedores" element={<Proveedores />} />
            <Route path="/signup-admin" element={<SignupAdmin />} />
            <Route path="/almacen-stock" element={<StockDashboard />} />
            <Route path="/stock/editar/:id" element={<EditarProducto />} />
            <Route path="/privateadmin" element={<PrivateAdmin />} />
            <Route path="/registrar-salida" element={<RegistrarSalidaProducto />} />
            <Route path="/historial-salidas" element={<HistorialSalidas />} />
            <Route path="/registrar-entrada" element={<RegistrarEntradaProducto />} />
            <Route path="/resumen-entradas" element={<ResumenEntradas />} />
            <Route path="/resumen-stockminimo" element={<ResumenStockMinimo />} />
            <Route path="*" element={<h1>Not found!</h1>} />
          </Routes>
        </div>
        <Footer />
      </BrowserRouter>
    </div>
  );
};

export default injectContext(Layout);
