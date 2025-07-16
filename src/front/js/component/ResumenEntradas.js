import React, { useEffect, useState, useContext } from "react";
import { Context } from "../store/appContext";
import { Button, Table, Form } from "react-bootstrap";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const ResumenEntradas = () => {
  const { store, actions } = useContext(Context);
  const [proveedorFiltro, setProveedorFiltro] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");

  useEffect(() => {
    actions.getEntradasProductos();
    actions.getProveedores();
  }, []);

  // Si los datos aún no llegaron, mostrar spinner
  if (!store.entradasProductos || !Array.isArray(store.entradasProductos)) {
    return (
      <div className="text-center mt-5">
        <div className="spinner-border text-primary" role="status"></div>
        <p className="mt-3">Cargando resumen de entradas...</p>
      </div>
    );
  }

  const entradasFiltradas = (store.entradasProductos || []).filter((entrada) => {
    const cumpleProveedor = proveedorFiltro
      ? entrada.proveedor?.nombre?.toLowerCase() === proveedorFiltro.toLowerCase()
      : true;

    const cumpleFecha =
      (!fechaInicio || new Date(entrada.fecha_entrada) >= new Date(fechaInicio)) &&
      (!fechaFin || new Date(entrada.fecha_entrada) <= new Date(fechaFin));

    return cumpleProveedor && cumpleFecha;
  });

  const totalSinIVA = entradasFiltradas.reduce(
    (acc, entrada) => acc + parseFloat(entrada.precio_sin_iva || 0) * parseFloat(entrada.cantidad || 0),
    0
  );

  const totalIVA = entradasFiltradas.reduce(
    (acc, entrada) => acc + parseFloat(entrada.valor_iva || 0),
    0
  );

  const totalConIVA = entradasFiltradas.reduce(
    (acc, entrada) => acc + parseFloat(entrada.precio_con_iva || 0),
    0
  );

  const exportarPDF = () => {
    const doc = new jsPDF();
    doc.text("Resumen de Entradas de Productos", 10, 10);

    autoTable(doc, {
      startY: 20,
      head: [["Producto", "Proveedor", "Fecha", "Cantidad", "P. sin IVA", "IVA", "P. con IVA"]],
      body: entradasFiltradas.map((e) => [
        e.producto?.detalle,
        e.proveedor?.nombre,
        e.fecha_entrada,
        e.cantidad,
        `€ ${e.precio_sin_iva}`,
        `€ ${e.valor_iva}`,
        `€ ${e.precio_con_iva}`,
      ]),
    });

    doc.text(`Total sin IVA: €${totalSinIVA.toFixed(2)}`, 10, doc.lastAutoTable.finalY + 10);
    doc.text(`Total IVA: €${totalIVA.toFixed(2)}`, 10, doc.lastAutoTable.finalY + 16);
    doc.text(`Total con IVA: €${totalConIVA.toFixed(2)}`, 10, doc.lastAutoTable.finalY + 22);

    doc.save("resumen_entradas.pdf");
  };

  return (
    <div className="container mt-4">
      <h2 className="mb-4">Resumen de Entradas de Productos</h2>

      <div className="d-flex flex-wrap gap-3 mb-4">
        <Form.Select
          value={proveedorFiltro}
          onChange={(e) => setProveedorFiltro(e.target.value)}
        >
          <option value="">Todos los proveedores</option>
          {(store.proveedores || []).map((p) => (
            <option key={p.id} value={p.nombre}>
              {p.nombre}
            </option>
          ))}
        </Form.Select>

        <Form.Control
          type="date"
          value={fechaInicio}
          onChange={(e) => setFechaInicio(e.target.value)}
        />
        <Form.Control
          type="date"
          value={fechaFin}
          onChange={(e) => setFechaFin(e.target.value)}
        />

        <Button variant="success" onClick={exportarPDF}>
          Exportar PDF
        </Button>
      </div>
<Table striped bordered hover responsive>
  <thead>
    <tr>
      <th>Producto</th>
      <th>Proveedor</th>
      <th>Fecha</th>
      <th>Albarán</th>
      <th>Cantidad</th>
      <th>Precio sin IVA</th>
      <th>IVA (%)</th>
      <th>IVA (€)</th>
       <th>Descuento (%)</th>
      <th>Precio con IVA</th>
      <th>Total pagado</th>
      
    </tr>
  </thead>
  <tbody>
    {entradasFiltradas.map((entrada, idx) => (
      <tr key={idx}>
        <td>{entrada.producto?.nombre}</td>
        <td>{entrada.proveedor?.nombre}</td>
        <td>{entrada.fecha_entrada?.slice(0, 10)}</td>
        <td>{entrada.numero_albaran}</td>
        <td>{entrada.cantidad}</td>
        <td>€ {entrada.precio_sin_iva}</td>
        <td>{entrada.porcentaje_iva} %</td>
        <td>€ {entrada.valor_iva}</td>
        <td>{entrada.descuento} %</td>
        <td>€ {entrada.precio_con_iva}</td>
        <td>€ {entrada.precio_final_pagado}</td>
        
      </tr>
    ))}
  </tbody>
</Table>


      <div className="mt-4">
        <p><strong>Total sin IVA:</strong> € {totalSinIVA.toFixed(2)}</p>
        <p><strong>Total IVA:</strong> € {totalIVA.toFixed(2)}</p>
        <p><strong>Total con IVA:</strong> € {totalConIVA.toFixed(2)}</p>
      </div>
    </div>
  );
};

export default ResumenEntradas;
