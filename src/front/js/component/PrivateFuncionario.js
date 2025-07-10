import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const funcionarioItems = [
  { path: "/vehiculos", label: "Vehículos asignados", icon: "🚗" },
  { path: "/productos", label: "Productos disponibles", icon: "📦" },
  { path: "/almacen-productos", label: "Productos del Almacén", icon: "🏷️" }
];

const PrivateFuncionario = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const token = sessionStorage.getItem("token");
    const rol = sessionStorage.getItem("rol");

    const rolesPermitidos = [
      "Empleado",
      "Pintor",
      "Limpiador",
      "Mantenimiento",
      "Almacen"
    ];

    if (!token || !rolesPermitidos.includes(rol)) {
      navigate("/");
    }
  }, []);

  return (
    <div className="container mt-5">
      <h2 className="mb-4 text-center">Panel Privado del Funcionario</h2>
      <p className="text-center">Accede a tus herramientas de trabajo:</p>

      <div className="row row-cols-1 row-cols-md-2 g-4">
        {funcionarioItems.map((item, i) => (
          <div className="col" key={i}>
            <div className="card h-100 shadow-sm">
              <div className="card-body text-center">
                <h1 style={{ fontSize: "2.5rem" }}>{item.icon}</h1>
                <h5 className="card-title">{item.label}</h5>
                <button
                  className="btn btn-outline-success mt-2"
                  onClick={() => navigate(item.path)}
                >
                  Ver {item.label}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PrivateFuncionario;
