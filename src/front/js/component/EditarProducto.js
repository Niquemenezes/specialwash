import React, { useEffect, useState, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Context } from "../store/appContext";

const EditarProducto = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { store, actions } = useContext(Context);

    const [formData, setFormData] = useState({
        detalle: "",
        categoria: "",
        proveedor_id: "",
        precio_unitario: "",
        cantidad_comprada: "",
        stock_minimo: "",
    });

    useEffect(() => {
        actions.getProveedores();
        const producto = store.productos.find(p => p.id === parseInt(id));
        if (producto) {
            setFormData(producto);
        }
    }, [id, store.productos]);

    const handleChange = (e) => {
        let { name, value } = e.target;
        if (name === "precio_unitario") value = value.replace(",", ".");
        setFormData({ ...formData, [name]: value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const success = await actions.editarProducto(id, formData);
        if (success) navigate("/almacen-stock");

    };
    return (
        <div className="container mt-4">
            <h2>Editar Producto</h2>
            <form onSubmit={handleSubmit}>
                <input className="form-control my-2" type="text" name="detalle" value={formData.detalle} onChange={handleChange} placeholder="Detalle del producto" />
                <input className="form-control my-2" type="text" name="categoria" value={formData.categoria} onChange={handleChange} placeholder="Categoría" />

                <select className="form-control my-2" name="proveedor_id" value={formData.proveedor_id || ""} onChange={handleChange}>
                    <option value="">Selecciona un proveedor</option>
                    {store.proveedores?.map((p) => (
                        <option key={p.id} value={p.id}>
                            {p.nombre}
                        </option>
                    ))}
                </select>

                <input className="form-control my-2" type="text" name="precio_unitario" value={formData.precio_unitario} onChange={handleChange} placeholder="Precio unitario (€)" />
                <input className="form-control my-2" type="number" name="cantidad_comprada" value={formData.cantidad_comprada} onChange={handleChange} placeholder="Cantidad comprada" />
                <input className="form-control my-2" type="number" name="stock_minimo" value={formData.stock_minimo} onChange={handleChange} placeholder="Stock mínimo recomendado" />
                <button className="btn btn-primary mt-2" type="submit">Guardar cambios</button>
            </form>
        </div>
    );
};

export default EditarProducto;
