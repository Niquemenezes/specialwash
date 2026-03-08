import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Context } from "../store/appContext";

const toDateInputValue = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatFecha = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("es-ES");
};

const parseKm = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const CochesEntregadosPage = () => {
  const { actions } = useContext(Context);
  const navigate = useNavigate();
  const [inspecciones, setInspecciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [busqueda, setBusqueda] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  const cargarInspecciones = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await actions.getMisInspecciones();
      setInspecciones(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "No se pudieron cargar los coches entregados");
    } finally {
      setLoading(false);
    }
  }, [actions]);

  useEffect(() => {
    cargarInspecciones();
  }, [cargarInspecciones]);

  const entregados = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    const from = fechaDesde ? new Date(`${fechaDesde}T00:00:00`) : null;
    const to = fechaHasta ? new Date(`${fechaHasta}T23:59:59`) : null;

    return inspecciones
      .filter((item) => item.entregado)
      .filter((item) => {
        const texto = `${item.cliente_nombre || ""} ${item.coche_descripcion || ""} ${item.matricula || ""}`.toLowerCase();
        return term ? texto.includes(term) : true;
      })
      .filter((item) => {
        if (!from && !to) return true;
        const fecha = new Date(item.fecha_entrega || item.updated_at || item.fecha_inspeccion || 0);
        if (Number.isNaN(fecha.getTime())) return false;
        if (from && fecha < from) return false;
        if (to && fecha > to) return false;
        return true;
      })
      .sort((a, b) => new Date(b.fecha_entrega || b.updated_at || 0) - new Date(a.fecha_entrega || a.updated_at || 0));
  }, [inspecciones, busqueda, fechaDesde, fechaHasta]);

  const stats = useMemo(() => {
    const total = entregados.length;
    const kmValues = entregados.map((item) => parseKm(item.kilometros)).filter((v) => v !== null);
    const kmPromedio = kmValues.length > 0
      ? Math.round(kmValues.reduce((acc, n) => acc + n, 0) / kmValues.length)
      : 0;

    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const entregadosMes = entregados.filter((item) => {
      const fecha = new Date(item.fecha_entrega || item.updated_at || 0);
      return !Number.isNaN(fecha.getTime()) && fecha >= inicioMes;
    }).length;

    return { total, kmPromedio, entregadosMes };
  }, [entregados]);

  const limpiarFiltros = () => {
    setBusqueda("");
    setFechaDesde("");
    setFechaHasta("");
  };

  const usarMesActual = () => {
    const hoy = new Date();
    setFechaDesde(toDateInputValue(new Date(hoy.getFullYear(), hoy.getMonth(), 1)));
    setFechaHasta(toDateInputValue(hoy));
  };

  const volver = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/", { replace: true });
  };

  const editarInspeccion = (id) => {
    navigate(`/inspeccion-recepcion?editId=${id}`);
  };

  const eliminarInspeccion = async (item) => {
    const confirmado = window.confirm(
      `Vas a eliminar la inspeccion #${item.id} de ${item.cliente_nombre || "cliente"}.\n\nEsta accion no se puede deshacer.\n\n¿Deseas continuar?`
    );
    if (!confirmado) return;

    try {
      await actions.eliminarInspeccion(item.id);
      await cargarInspecciones();
      alert("Inspeccion eliminada correctamente.");
    } catch (err) {
      alert(err?.message || "No se pudo eliminar la inspeccion.");
    }
  };

  return (
    <div className="container py-4" style={{ maxWidth: "1000px" }}>
      <div className="d-flex justify-content-center align-items-center mb-4 p-3 rounded shadow-sm" style={{ background: "#0f0f0f", color: "#d4af37" }}>
        <div className="w-100 d-flex justify-content-between align-items-center gap-2">
          <h2 className="fw-bold mb-0 text-center">Coches Entregados</h2>
          <button type="button" className="btn btn-outline-light btn-sm" onClick={volver}>
            Volver
          </button>
        </div>
      </div>

      <div className="card shadow-sm border-0 mb-4">
        <div className="card-header py-3" style={{ background: "#d4af37", fontWeight: 600 }}>
          Filtros
        </div>
        <div className="card-body p-3">
          <div className="row g-3 align-items-end">
            <div className="col-12 col-md-4">
              <label className="form-label">Buscar (cliente, coche o matrícula)</label>
              <input
                type="text"
                className="form-control"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Ej: Juan, BMW, 1234ABC"
              />
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label">Desde</label>
              <input
                type="date"
                className="form-control"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
              />
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label">Hasta</label>
              <input
                type="date"
                className="form-control"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
              />
            </div>
            <div className="col-12 col-md-2 d-grid gap-2">
              <button className="btn btn-outline-primary btn-sm" onClick={usarMesActual}>
                Mes actual
              </button>
              <button className="btn btn-outline-secondary btn-sm" onClick={limpiarFiltros}>
                Limpiar
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-12 col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <p className="text-muted mb-1">Total entregados (filtro actual)</p>
              <h4 className="mb-0">{stats.total}</h4>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <p className="text-muted mb-1">Entregados este mes</p>
              <h4 className="mb-0">{stats.entregadosMes}</h4>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <p className="text-muted mb-1">Kilómetros promedio</p>
              <h4 className="mb-0">{stats.kmPromedio.toLocaleString("es-ES")} km</h4>
            </div>
          </div>
        </div>
      </div>

      <div className="card shadow-sm border-0">
        <div className="card-header py-3 d-flex justify-content-between align-items-center" style={{ background: "#d4af37", fontWeight: 600 }}>
          <span>Listado de coches entregados</span>
          <button className="btn btn-outline-dark btn-sm" onClick={cargarInspecciones}>
            Actualizar
          </button>
        </div>
        <div className="card-body p-3">
          {loading && <p className="text-muted mb-0">Cargando...</p>}
          {error && <div className="alert alert-danger mb-0">{error}</div>}

          {!loading && !error && entregados.length === 0 && (
            <p className="text-muted mb-0">No hay coches entregados con esos filtros.</p>
          )}

          {!loading && !error && entregados.length > 0 && (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>#</th>
                    <th>Fecha entrega</th>
                    <th>Cliente</th>
                    <th>Coche</th>
                    <th>Matrícula</th>
                    <th>Kilómetros</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {entregados.map((item) => (
                    <tr key={item.id}>
                      <td>{item.id}</td>
                      <td>{formatFecha(item.fecha_entrega || item.updated_at)}</td>
                      <td>{item.cliente_nombre || "-"}</td>
                      <td>{item.coche_descripcion || "-"}</td>
                      <td>{item.matricula || "-"}</td>
                      <td>{parseKm(item.kilometros)?.toLocaleString("es-ES") || "-"}</td>
                      <td>
                        <div className="d-flex gap-2">
                          <Link className="btn btn-outline-success btn-sm" to={`/acta-entrega/${item.id}`}>
                            Ver acta firmada
                          </Link>
                          <a
                            className="btn btn-outline-secondary btn-sm"
                            href={`/acta-entrega/${item.id}?print=1`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Descargar PDF
                          </a>
                          <button
                            type="button"
                            className="btn btn-outline-primary btn-sm"
                            onClick={() => editarInspeccion(item.id)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline-danger btn-sm"
                            onClick={() => eliminarInspeccion(item)}
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CochesEntregadosPage;
