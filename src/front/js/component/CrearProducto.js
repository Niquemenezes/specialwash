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
        cantidad_comprada: "",
        stock_minimo: "",
        unidad: ""
    });

    useEffect(() => {
        actions.getProveedores();
    }, []);

    const handleChange = (e) => {
        let { name, value } = e.target;
        if (name === "precio_unitario" || name === "cantidad_comprada") {
            value = value.replace(",", ".");
        }
        setFormData({ ...formData, [name]: value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const parsedData = {
            ...formData,
            precio_unitario: parseFloat(formData.precio_unitario),
            cantidad_comprada: parseFloat(formData.cantidad_comprada),
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
                <input
                    className="form-control my-2"
                    type="text"
                    name="detalle"
                    placeholder="Detalle del producto"
                    onChange={handleChange}
                />
                <input
                    className="form-control my-2"
                    type="text"
                    name="categoria"
                    placeholder="Categoría"
                    onChange={handleChange}
                />
                <select
                    className="form-control my-2"
                    name="proveedor_id"
                    onChange={handleChange}
                    value={formData.proveedor_id}
                >
                    <option value="">Selecciona un proveedor</option>
                    {proveedoresOrdenados.map((p) => (
                        <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                </select>
                <input
                    className="form-control my-2"
                    type="text"
                    name="precio_unitario"
                    placeholder="Precio unitario (€)"
                    onChange={handleChange}
                />
                <input
                    className="form-control my-2"
                    type="number"
                    name="cantidad_comprada"
                    placeholder="Cantidad comprada"
                    onChange={handleChange}
                    step="any"
                />
                <input
                    className="form-control my-2"
                    type="number"
                    name="stock_minimo"
                    placeholder="Stock mínimo recomendado"
                    onChange={handleChange}
                />
                <input
                    className="form-control my-2"
                    type="text"
                    name="unidad"
                    placeholder="Unidad (ej. litros, unidades...)"
                    onChange={handleChange}
                />
                <button className="btn btn-primary mt-2" type="submit">
                    Guardar producto
                </button>
            </form>
        </div>
    );
};

export default CrearProducto;
