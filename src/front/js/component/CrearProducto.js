import React, { useState, useContext, useEffect } from "react";
import { Context } from "../store/appContext";
import { useNavigate } from "react-router-dom";

const CrearProducto = () => {
    const { store, actions } = useContext(Context);
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        detalle: "",
        categoria: "",
        proveedor_id: "",
        precio_unitario: "",
        stock_minimo: "",
        unidad: ""
    });

    useEffect(() => {
        actions.getProveedores();
    }, []);

    const handleChange = (e) => {
        let { name, value } = e.target;
        if (name === "precio_unitario") {
            value = value.replace(",", ".");
        }
        setFormData({ ...formData, [name]: value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const parsedData = {
            ...formData,
            precio_unitario: parseFloat(formData.precio_unitario),
            stock_minimo: parseInt(formData.stock_minimo),
            proveedor_id: parseInt(formData.proveedor_id)
        };

        console.log("Enviando producto:", parsedData);

        const exito = await actions.crearProducto(parsedData);
        if (exito) {
            navigate("/almacen-stock");
        } else {
            alert("Error al crear el producto.");
        }
    };

    const proveedoresOrdenados = [...store.proveedores].sort((a, b) =>
        a.nombre.localeCompare(b.nombre)
    );

    return (
        <div className="container mt-4">
            <h2>Crear Nuevo Producto</h2>
            <form onSubmit={handleSubmit}>
                 <div className="mb-3">
                    <label htmlFor="detalle" className="form-label">Detalle del producto</label>
                    <input
                        id="detalle"
                        className="form-control"
                        type="text"
                        name="detalle"
                        onChange={handleChange}
                    />
                </div>
                <div className="mb-3">
                    <label htmlFor="categoria" className="form-label">Categoría</label>
                    <input
                        id="categoria"
                        className="form-control"
                        type="text"
                        name="categoria"
                        onChange={handleChange}
                    />
                </div>
                <div className="mb-3">
                    <label htmlFor="proveedor_id" className="form-label">Proveedor</label>
                    <select
                        id="proveedor_id"
                        className="form-control"
                        name="proveedor_id"
                        onChange={handleChange}
                        value={formData.proveedor_id}
                    >
                        <option value="">Selecciona un proveedor</option>
                        {proveedoresOrdenados.map((p) => (
                            <option key={p.id} value={p.id}>{p.nombre}</option>
                        ))}
                    </select>
                </div>
                <div className="mb-3">
                    <label htmlFor="precio_unitario" className="form-label">Precio unitario (€)</label>
                    <input
                        id="precio_unitario"
                        className="form-control"
                        type="text"
                        name="precio_unitario"
                        onChange={handleChange}
                    />
                </div>
               
                <div className="mb-3">
                    <label htmlFor="stock_minimo" className="form-label">Stock mínimo recomendado</label>
                    <input
                        id="stock_minimo"
                        className="form-control"
                        type="number"
                        name="stock_minimo"
                        onChange={handleChange}
                    />
                </div>
                <div className="mb-3">
                    <label htmlFor="unidad" className="form-label">Unidad (ej. litros, unidades...)</label>
                    <input
                        id="unidad"
                        className="form-control"
                        type="text"
                        name="unidad"
                        onChange={handleChange}
                    />
                </div>
                <button className="btn btn-primary mt-2" type="submit">
                    Guardar producto
                </button>
            </form>
        </div>
    );
};

export default CrearProducto;
