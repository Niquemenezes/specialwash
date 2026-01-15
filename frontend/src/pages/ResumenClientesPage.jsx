import React, { useEffect, useState, useContext } from "react";
import { Context } from "../store/appContext";
import "../styles/print.css";

const ResumenClientesPage = () => {
  const { actions } = useContext(Context);
  const [reporte, setReporte] = useState({ clientes: [], fecha_desde: null, fecha_hasta: null });
  const [loading, setLoading] = useState(false);
  
  // Filtros
  const [mesSeleccionado, setMesSeleccionado] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [busquedaCliente, setBusquedaCliente] = useState("");

  useEffect(() => {
    // Cargar datos del mes actual por defecto
    const hoy = new Date();
    const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    
    const desde = primerDia.toISOString().split("T")[0];
    const hasta = ultimoDia.toISOString().split("T")[0];
    
    setFechaDesde(desde);
    setFechaHasta(hasta);
    setMesSeleccionado(`${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`);
    
    cargarReporte(desde, hasta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cargarReporte = async (desde, hasta) => {
    setLoading(true);
    try {
      const data = await actions.getReporteClientes(desde, hasta);
      setReporte(data || { clientes: [], fecha_desde: desde, fecha_hasta: hasta });
    } catch (err) {
      console.error("Error al cargar reporte:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleMesChange = (e) => {
    const mes = e.target.value;
    setMesSeleccionado(mes);
    
    if (mes) {
      const [year, month] = mes.split("-");
      const primerDia = new Date(year, month - 1, 1);
      const ultimoDia = new Date(year, month, 0);
      
      const desde = primerDia.toISOString().split("T")[0];
      const hasta = ultimoDia.toISOString().split("T")[0];
      
      setFechaDesde(desde);
      setFechaHasta(hasta);
      cargarReporte(desde, hasta);
    }
  };

  const handleFiltroPersonalizado = () => {
    if (fechaDesde && fechaHasta) {
      setMesSeleccionado("");
      cargarReporte(fechaDesde, fechaHasta);
    }
  };

  const totalGeneral = reporte.clientes.reduce((sum, c) => sum + c.total_cliente, 0);

  // Filtrar clientes por búsqueda
  const clientesFiltrados = reporte.clientes.filter((cliente) => {
    if (!busquedaCliente.trim()) return true;
    const term = busquedaCliente.toLowerCase();
    return (
      cliente.cliente_nombre?.toLowerCase().includes(term) ||
      cliente.cliente_cif?.toLowerCase().includes(term)
    );
  });

  const totalFiltrado = clientesFiltrados.reduce((sum, c) => sum + c.total_cliente, 0);

  const handleImprimir = () => {
    window.print();
  };

  return (
    <div className="container mt-4">
     
      <div className="d-flex justify-content-between align-items-center mb-4" style={{ borderBottom: '3px solid #d4af37', paddingBottom: '1rem' }}>
        <h2 style={{ color: '#0f0f0f', fontWeight: 'bold', margin: 0 }}>Resumen de Clientes</h2>
        <button 
          className="btn no-print"
          style={{ backgroundColor: '#d4af37', color: '#0f0f0f', fontWeight: 'bold', border: 'none' }}
          onClick={handleImprimir}
          disabled={loading || reporte.clientes.length === 0}
        >
          <i className="fas fa-print me-2"></i>Imprimir Resumen
        </button>
      </div>

      {/* Filtros */}
      <div className="card mb-4" style={{ border: '2px solid #d4af37', boxShadow: '0 4px 6px rgba(212, 175, 55, 0.1)' }}>
        <div className="card-body" style={{ backgroundColor: '#fafafa' }}>
          <div className="row g-3 mb-3">
            <div className="col-md-4">
              <label className="form-label fw-bold">Seleccionar Mes</label>
              <input
                type="month"
                className="form-control"
                value={mesSeleccionado}
                onChange={handleMesChange}
              />
            </div>
            
            <div className="col-md-3">
              <label className="form-label fw-bold">Desde</label>
              <input
                type="date"
                className="form-control"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
              />
            </div>
            
            <div className="col-md-3">
              <label className="form-label fw-bold">Hasta</label>
              <input
                type="date"
                className="form-control"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
              />
            </div>
            
            <div className="col-md-2 d-flex align-items-end">
              <button
                className="btn w-100"
                style={{ backgroundColor: '#0f0f0f', color: '#d4af37', fontWeight: 'bold', border: '2px solid #d4af37' }}
                onClick={handleFiltroPersonalizado}
                disabled={!fechaDesde || !fechaHasta}
              >
                Filtrar
              </button>
            </div>
          </div>

          {/* Filtro por nombre de cliente */}
          <div className="row g-3">
            <div className="col-md-12">
              <label className="form-label fw-bold">
                <i className="fas fa-search me-2"></i>Buscar Cliente
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="Buscar por nombre o CIF del cliente..."
                value={busquedaCliente}
                onChange={(e) => setBusquedaCliente(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Resumen total */}
      <div className="mb-4" style={{ border: '3px solid #d4af37', backgroundColor: '#0f0f0f', color: '#d4af37', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 4px 8px rgba(212, 175, 55, 0.2)' }}>
        <div className="row">
          <div className="col-md-3">
            <strong>Período:</strong>{" "}
            {fechaDesde && fechaHasta
              ? `${new Date(fechaDesde).toLocaleDateString("es-ES")} - ${new Date(fechaHasta).toLocaleDateString("es-ES")}`
              : "-"}
          </div>
          <div className="col-md-3">
            <strong>Clientes:</strong> {reporte.clientes.length}
            {busquedaCliente.trim() && (
              <span className="ms-2 badge" style={{ backgroundColor: '#d4af37', color: '#0f0f0f', fontWeight: 'bold' }}>
                {clientesFiltrados.length} filtrados
              </span>
            )}
          </div>
          <div className="col-md-3">
            <strong>Total Facturado:</strong>{" "}
            <span className="fs-5" style={{ color: '#d4af37', fontWeight: 'bold' }}>{totalGeneral.toFixed(2)}€</span>
          </div>
          {busquedaCliente.trim() && (
            <div className="col-md-3">
              <strong>Total Filtrado:</strong>{" "}
              <span className="fs-5" style={{ color: '#d4af37', fontWeight: 'bold' }}>{totalFiltrado.toFixed(2)}€</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabla de resultados */}
      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border" style={{ color: '#d4af37' }} role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
        </div>
      ) : reporte.clientes.length === 0 ? (
        <div className="alert alert-warning">
          No hay servicios registrados en el período seleccionado.
        </div>
      ) : clientesFiltrados.length === 0 ? (
        <div className="alert alert-warning">
          No se encontraron clientes que coincidan con la búsqueda.
        </div>
      ) : (
        <div className="accordion" id="acordeonClientes">
          {clientesFiltrados.map((cliente) => (
            <div className="accordion-item" key={cliente.cliente_id} style={{ border: '2px solid #d4af37', marginBottom: '1rem' }}>
              <h2 className="accordion-header">
                <button
                  className="accordion-button collapsed"
                  style={{ backgroundColor: '#0f0f0f', color: '#d4af37', fontWeight: 'bold', border: 'none' }}
                  type="button"
                  data-bs-toggle="collapse"
                  data-bs-target={`#cliente-${cliente.cliente_id}`}
                >
                  <div className="d-flex justify-content-between w-100 me-3">
                    <div>
                      <strong>{cliente.cliente_nombre}</strong>
                      {cliente.cliente_cif && (
                        <span className="ms-2 text-muted">({cliente.cliente_cif})</span>
                      )}
                      <span className="ms-3 badge" style={{ backgroundColor: '#d4af37', color: '#0f0f0f', fontWeight: 'bold' }}>
                        {cliente.coches.length} coche{cliente.coches.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div style={{ color: '#d4af37', fontWeight: 'bold' }}>
                      {cliente.total_cliente.toFixed(2)}€
                    </div>
                  </div>
                </button>
              </h2>
              <div
                id={`cliente-${cliente.cliente_id}`}
                className="accordion-collapse collapse"
                data-bs-parent="#acordeonClientes"
              >
                <div className="accordion-body" style={{ backgroundColor: '#fafafa' }}>
                  <table className="table table-sm table-hover mb-0">
                    <thead className="resumen-thead">
                      <tr>
                        <th>Matrícula</th>
                        <th>Marca/Modelo</th>
                        <th className="text-center">Servicios</th>
                        <th className="text-end">Total Pagado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cliente.coches.map((coche) => (
                        <tr key={coche.coche_id}>
                          <td><strong>{coche.matricula}</strong></td>
                          <td>{coche.marca} {coche.modelo}</td>
                          <td className="text-center">
                            <span className="badge" style={{ backgroundColor: '#d4af37', color: '#0f0f0f', fontWeight: 'bold' }}>{coche.total_servicios}</span>
                          </td>
                          <td className="text-end">{coche.total_pagado.toFixed(2)}€</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="resumen-tfoot">
                      <tr>
                        <td colSpan="3" className="text-end fw-bold">Total Cliente:</td>
                        <td className="text-end fw-bold" style={{ color: '#d4af37' }}>
                          {cliente.total_cliente.toFixed(2)}€
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ResumenClientesPage;
