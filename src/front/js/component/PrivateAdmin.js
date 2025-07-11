import React, { useEffect, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { Context } from "../store/appContext"; // ← Añadido para acceder a productos

const gestionItems = [
  { path: "/funcionarios", label: "Funcionarios", icon: "fas fa-users" },
  { path: "/maquinaria", label: "Maquinaria", icon: "fas fa-tools" },
  { path: "/proveedores", label: "Proveedores", icon: "fas fa-truck" },
  { path: "/almacen-stock", label: "Stock de Almacén", icon: "fas fa-boxes" },
  { path: "/stock/crear", label: "Crear Producto", icon: "fas fa-plus" },
  { path: "/registrar-salida", label: "Registrar Salida", icon: "fas fa-arrow-up-right-from-square" },
  { path: "/historial-salidas", label: "Historial Salidas", icon: "fas fa-clock-rotate-left" },
  { path: "/registrar-entrada", label: "Registrar entrada", icon: "fas fa-file-signature" },
  { path: "/resumen-entradas", label: "Resumen de Entradas", icon: "fas fa-clipboard-list" },
];

const PrivateAdmin = () => {
  const { store, actions } = useContext(Context); // ← Para acceder a productos
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [productosBajoStock, setProductosBajoStock] = useState([]);
  const user = JSON.parse(sessionStorage.getItem("user"));

  useEffect(() => {
    const token = sessionStorage.getItem("token");
    const rol = sessionStorage.getItem("rol");

    if (!token || rol !== "administrador") {
      navigate("/");
    } else {
      setLoading(false);
      actions.getProductos(); // Carga productos
    }
  }, []);

  useEffect(() => {
    const filtrados = store.productos.filter(
      (p) => p.cantidad_comprada <= p.stock_minimo
    );
    setProductosBajoStock(filtrados);
  }, [store.productos]);

  if (loading) {
    return (
      <div className="text-center mt-5">
        <div className="spinner-border text-primary" role="status"></div>
        <p className="mt-3">Cargando panel del administrador...</p>
      </div>
    );
  }

  return (
    <div className="container py-5">
      <div className="text-center mb-4">
        <h2 className="fw-bold">¡Bienvenido, {user?.nombre || "Administrador"}!</h2>
        <p className="text-muted">Gestiona cada sección desde las siguientes tarjetas:</p>
      </div>

      {/* 🔔 Alerta si hay productos con bajo stock */}
      {productosBajoStock.length > 0 && (
        <div className="alert alert-warning d-flex justify-content-between align-items-center">
          <div>
            ⚠️ <strong>{productosBajoStock.length}</strong> producto(s) están por debajo del <strong>StockMinimo</strong>
          </div>
          <button
            className="btn btn-sm btn-outline-dark"
            onClick={() => navigate("/resumen-stockminimo")}
          >
            Ver listado
          </button>
        </div>
      )}

      <div className="row justify-content-center g-4 mt-3">
        {gestionItems.map((item, i) => (
          <div className="col-12 col-sm-6 col-md-4 col-lg-3" key={i}>
            <div className="card h-100 shadow-sm border-0 text-center" style={{ borderRadius: "1rem" }}>
              <div className="card-body d-flex flex-column justify-content-between">
                <div>
                  <i className={`${item.icon} display-4 text-primary`}></i>
                  <h5 className="card-title mt-3">{item.label}</h5>
                  <p className="card-text text-muted">Gestionar {item.label.toLowerCase()}</p>
                </div>
                <button
                  className="btn btn-primary mt-3"
                  onClick={() => navigate(item.path)}
                >
                  Ir a {item.label}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PrivateAdmin;
