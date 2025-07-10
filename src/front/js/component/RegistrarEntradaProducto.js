import React, { useEffect, useState, useContext } from "react";
import { Context } from "../store/appContext";

const RegistrarEntradaProducto = () => {
  const { store, actions } = useContext(Context);

  const [formulario, setFormulario] = useState({
    producto_id: "",
    proveedor_id: "",
    numero_albaran: "",
    fecha_entrada: new Date().toISOString().split("T")[0],
    cantidad: "",
    precio_sin_iva: "",
    porcentaje_iva: "21",
    descuento: "",
    observaciones: "",
  });

  const [nuevoProducto, setNuevoProducto] = useState("");
  const [stockMinimo, setStockMinimo] = useState(0);
  const [categoriaProducto, setCategoriaProducto] = useState("general");

  useEffect(() => {
    actions.getProductos();
    actions.getProveedores();
  }, []);

  const handleChange = (e) => {
    setFormulario({ ...formulario, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const datos = {
      ...formulario,
      producto_id: parseInt(formulario.producto_id),
      proveedor_id: parseInt(formulario.proveedor_id),
      cantidad: parseFloat(formulario.cantidad),
      precio_sin_iva: parseFloat(formulario.precio_sin_iva),
      porcentaje_iva: parseFloat(formulario.porcentaje_iva),
      descuento: parseFloat(formulario.descuento || 0),
    };

    console.log("🟡 Enviando al backend:", datos);

    if (
      !datos.producto_id ||
      !datos.proveedor_id ||
      !datos.numero_albaran ||
      isNaN(datos.cantidad) ||
      isNaN(datos.precio_sin_iva) ||
      isNaN(datos.porcentaje_iva)
    ) {
      alert("⚠️ Por favor, completa todos los campos obligatorios.");
      return;
    }

    const res = await fetch(
      `${process.env.REACT_APP_BACKEND_URL}/api/registro-entrada`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionStorage.getItem("token")}`,
        },
        body: JSON.stringify(datos),
      }
    );

    if (res.ok) {
      alert("✅ Entrada registrada correctamente");
      setFormulario({
        producto_id: "",
        proveedor_id: "",
        numero_albaran: "",
        fecha_entrada: new Date().toISOString().split("T")[0],
        cantidad: "",
        precio_sin_iva: "",
        porcentaje_iva: "21",
        descuento: "",
        observaciones: "",
      });
      actions.getProductos(); // actualiza productos en StockDashboard
    } else {
      const err = await res.json();
      alert(`❌ Error: ${err.msg || "Error al registrar la entrada"}`);
      console.error("🔴 Detalle del error:", err.error || err);
    }
  };

  const calcularPrecioFinal = () => {
    const base = parseFloat(formulario.precio_sin_iva) || 0;
    const iva = (base * (parseFloat(formulario.porcentaje_iva) || 0)) / 100;
    const conIva = base + iva;
    const desc = (conIva * (parseFloat(formulario.descuento) || 0)) / 100;
    return (conIva - desc).toFixed(2);
  };

  const handleCrearProducto = async () => {
    if (!nuevoProducto.trim()) return alert("⚠️ Debes escribir un nombre o detalle");

    const res = await fetch(
      `${process.env.REACT_APP_BACKEND_URL}/api/productos`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          detalle: nuevoProducto,
          nombre: nuevoProducto,
          precio_unitario: 0,
          proveedor_id: 1,
          cantidad_comprada: 0,
          unidad: "",
          categoria: categoriaProducto,
          stock_minimo: parseInt(stockMinimo),
        }),
      }
    );

    if (res.ok) {
      alert("✅ Producto creado con éxito");
      setNuevoProducto("");
      setStockMinimo(0);
      setCategoriaProducto("general");
      await actions.getProductos();
      document.querySelector("#crearProductoModal .btn-close")?.click();
    } else {
      const err = await res.json();
      alert(err.msg || "Error al crear producto");
    }
  };

  return (
    <div className="container mt-4">
      <h2>Registrar entrada de producto</h2>
      <form onSubmit={handleSubmit}>
        <div className="mb-2">
          <div className="d-flex justify-content-between align-items-center">
            <label className="form-label">Producto</label>
            <button
              type="button"
              className="btn btn-sm btn-success"
              data-bs-toggle="modal"
              data-bs-target="#crearProductoModal"
            >
              ➕ Crear producto
            </button>
          </div>
          <select
            name="producto_id"
            value={formulario.producto_id}
            onChange={handleChange}
            className="form-select"
          >
            <option value="">-- Selecciona --</option>
            {store.productos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.detalle}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-2">
          <label className="form-label">Proveedor</label>
          <select
            name="proveedor_id"
            value={formulario.proveedor_id}
            onChange={handleChange}
            className="form-select"
          >
            <option value="">-- Selecciona --</option>
            {store.proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-2">
          <label className="form-label">Número de albarán o factura</label>
          <input
            type="text"
            name="numero_albaran"
            value={formulario.numero_albaran}
            onChange={handleChange}
            className="form-control"
          />
        </div>

        <div className="mb-2">
          <label className="form-label">Fecha de entrada</label>
          <input
            type="date"
            name="fecha_entrada"
            value={formulario.fecha_entrada}
            onChange={handleChange}
            className="form-control"
          />
        </div>

        <div className="row">
          <div className="col-md-4 mb-2">
            <label className="form-label">Cantidad</label>
            <input
              type="number"
              step="0.01"
              name="cantidad"
              value={formulario.cantidad}
              onChange={handleChange}
              className="form-control"
            />
          </div>
          <div className="col-md-4 mb-2">
            <label className="form-label">Precio sin IVA</label>
            <input
              type="number"
              step="0.01"
              name="precio_sin_iva"
              value={formulario.precio_sin_iva}
              onChange={handleChange}
              className="form-control"
            />
          </div>
          <div className="col-md-4 mb-2">
            <label className="form-label">IVA %</label>
            <input
              type="number"
              step="0.01"
              name="porcentaje_iva"
              value={formulario.porcentaje_iva}
              onChange={handleChange}
              className="form-control"
            />
          </div>
        </div>

        <div className="mb-2">
          <label className="form-label">Descuento % (opcional)</label>
          <input
            type="number"
            step="0.01"
            name="descuento"
            value={formulario.descuento}
            onChange={handleChange}
            className="form-control"
          />
        </div>

        <div className="mb-2">
          <label className="form-label">💶 Precio final (con IVA y descuento)</label>
          <input
            type="text"
            className="form-control"
            value={calcularPrecioFinal()}
            readOnly
          />
        </div>

        <div className="mb-2">
          <label className="form-label">Observaciones</label>
          <textarea
            name="observaciones"
            value={formulario.observaciones}
            onChange={handleChange}
            className="form-control"
          />
        </div>

        <button type="submit" className="btn btn-primary mt-2">
          Registrar entrada
        </button>
      </form>

      {/* Modal para crear producto */}
      <div
        className="modal fade"
        id="crearProductoModal"
        tabIndex="-1"
        aria-labelledby="crearProductoModalLabel"
        aria-hidden="true"
      >
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="crearProductoModalLabel">
                Crear nuevo producto
              </h5>
              <button
                type="button"
                className="btn-close"
                data-bs-dismiss="modal"
                aria-label="Cerrar"
              ></button>
            </div>
            <div className="modal-body">
              <input
                type="text"
                className="form-control mb-2"
                placeholder="Nombre o detalle del producto"
                value={nuevoProducto}
                onChange={(e) => setNuevoProducto(e.target.value)}
              />
              <input
                type="number"
                className="form-control mb-2"
                placeholder="Stock mínimo"
                value={stockMinimo}
                onChange={(e) => setStockMinimo(e.target.value)}
              />
              <select
                className="form-select"
                value={categoriaProducto}
                onChange={(e) => setCategoriaProducto(e.target.value)}
              >
                <option value="general">General</option>
                <option value="lavado">Lavado</option>
                <option value="pintura">Pintura</option>
              </select>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                data-bs-dismiss="modal"
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCrearProducto}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegistrarEntradaProducto;
