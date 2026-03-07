import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Context } from "../store/appContext";

const parseActaDesdeTexto = (texto = "") => {
  const lines = texto.split("\n");
  const obsPrefix = "Observaciones de entrega:";
  const obsLine = lines.find((line) => line.trim().startsWith(obsPrefix));
  const observaciones = obsLine ? obsLine.replace(obsPrefix, "").trim() : "";

  const contenido = lines
    .filter((line) => !line.trim().startsWith(obsPrefix))
    .join("\n")
    .trim();

  return { contenido, observaciones };
};

const buildActaTexto = (contenido, observaciones) => {
  const bloques = [];
  if ((contenido || "").trim()) bloques.push((contenido || "").trim());
  if ((observaciones || "").trim()) {
    bloques.push(`Observaciones de entrega: ${(observaciones || "").trim()}`);
  }
  return bloques.join("\n\n").trim();
};

const formatFecha = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("es-ES");
};

const EntregaCochePage = () => {
  const { actions } = useContext(Context);
  const location = useLocation();
  const navigate = useNavigate();

  const [inspecciones, setInspecciones] = useState([]);
  const [loadingLista, setLoadingLista] = useState(true);
  const [inspeccion, setInspeccion] = useState(null);
  const [loadingActa, setLoadingActa] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [contenidoActa, setContenidoActa] = useState("");
  const [observaciones, setObservaciones] = useState("");

  const idDesdeQuery = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const raw = params.get("id");
    return raw ? Number(raw) : null;
  }, [location.search]);

  const cargarPendientes = useCallback(async () => {
    setLoadingLista(true);
    const data = await actions.getMisInspecciones();
    setInspecciones(Array.isArray(data) ? data : []);
    setLoadingLista(false);
  }, [actions]);

  useEffect(() => {
    cargarPendientes();
  }, [cargarPendientes]);

  const pendientes = useMemo(() => {
    return inspecciones
      .filter((item) => !item.entregado)
      .sort((a, b) => new Date(b.fecha_inspeccion || 0) - new Date(a.fecha_inspeccion || 0));
  }, [inspecciones]);

  const abrirInspeccion = useCallback(
    async (id) => {
      setLoadingActa(true);
      try {
        const detalle = await actions.getInspeccion(id);
        setInspeccion(detalle);
        const parsed = parseActaDesdeTexto(detalle?.trabajos_realizados || "");
        setContenidoActa(parsed.contenido || detalle?.trabajos_realizados || "");
        setObservaciones(detalle?.entrega_observaciones || parsed.observaciones || "");
      } catch (error) {
        alert(`No se pudo cargar la inspeccion: ${error.message}`);
      } finally {
        setLoadingActa(false);
      }
    },
    [actions]
  );

  useEffect(() => {
    if (!idDesdeQuery || loadingLista) return;
    const existe = pendientes.find((p) => Number(p.id) === Number(idDesdeQuery));
    if (existe) {
      abrirInspeccion(existe.id);
    }
  }, [idDesdeQuery, loadingLista, pendientes, abrirInspeccion]);

  const guardarActa = async () => {
    if (!inspeccion) return;
    const texto = buildActaTexto(contenidoActa, observaciones);
    if (!texto.trim()) {
      alert("Debes rellenar el contenido del acta antes de guardar.");
      return;
    }

    setGuardando(true);
    try {
      await actions.guardarActaInspeccion(inspeccion.id, {
        trabajos_realizados: texto,
        entrega_observaciones: observaciones,
      });
      alert("Acta guardada correctamente");
      navigate(`/pendientes-entrega?id=${inspeccion.id}`, { replace: true });
    } catch (error) {
      alert(`Error al guardar acta: ${error.message}`);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="container py-4" style={{ maxWidth: "1000px" }}>
      <div
        className="d-flex justify-content-center align-items-center mb-4 p-3 rounded shadow-sm"
        style={{ background: "#0f0f0f", color: "#d4af37" }}
      >
        <h2 className="fw-bold mb-0 text-center">Preparar Acta de Entrega</h2>
      </div>

      <div className="card shadow-sm border-0 mb-4">
        <div className="card-header py-3" style={{ background: "#d4af37", fontWeight: 600 }}>
          Seleccionar coche pendiente
        </div>
        <div className="card-body p-3">
          {loadingLista && <p className="text-muted mb-0">Cargando pendientes...</p>}

          {!loadingLista && pendientes.length === 0 && (
            <p className="text-muted mb-0">No hay coches pendientes de entrega.</p>
          )}

          {!loadingLista && pendientes.length > 0 && (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>#</th>
                    <th>Cliente</th>
                    <th>Coche</th>
                    <th>Matrícula</th>
                    <th>Fecha inspección</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pendientes.map((item) => (
                    <tr key={item.id}>
                      <td>{item.id}</td>
                      <td>{item.cliente_nombre || "-"}</td>
                      <td>{item.coche_descripcion || "-"}</td>
                      <td>{item.matricula || "-"}</td>
                      <td>{formatFecha(item.fecha_inspeccion)}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm"
                          onClick={() => abrirInspeccion(item.id)}
                        >
                          Preparar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="card shadow-sm border-0">
        <div className="card-header py-3" style={{ background: "#d4af37", fontWeight: 600 }}>
          Documento de acta
        </div>
        <div className="card-body p-4">
          {!inspeccion && !loadingActa && (
            <p className="text-muted mb-0">Selecciona un coche pendiente para preparar su acta.</p>
          )}

          {loadingActa && <p className="text-muted mb-0">Cargando datos de inspección...</p>}

          {inspeccion && !loadingActa && (
            <>
              <div className="mb-3">
                <p className="mb-1"><strong>Cliente:</strong> {inspeccion.cliente_nombre || "-"}</p>
                <p className="mb-1"><strong>Coche:</strong> {inspeccion.coche_descripcion || "-"}</p>
                <p className="mb-0"><strong>Matrícula:</strong> {inspeccion.matricula || "-"}</p>
              </div>

              <div className="mb-3">
                <label className="form-label fw-bold">Contenido del acta</label>
                <textarea
                  className="form-control"
                  rows="10"
                  value={contenidoActa}
                  onChange={(e) => setContenidoActa(e.target.value)}
                  placeholder="Describe trabajos realizados y detalle técnico..."
                />
              </div>

              <div className="mb-3">
                <label className="form-label fw-bold">Observaciones de entrega</label>
                <textarea
                  className="form-control"
                  rows="4"
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Observaciones adicionales..."
                />
              </div>

              <div className="d-flex justify-content-end">
                <div className="d-flex gap-2">
                  <a
                    className={`btn btn-outline-secondary ${!inspeccion?.id ? "disabled" : ""}`}
                    href={inspeccion?.id ? `/acta-entrega-doc/${inspeccion.id}` : "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Ver/Imprimir borrador
                  </a>
                  <a
                    className={`btn btn-outline-success ${!inspeccion?.id ? "disabled" : ""}`}
                    href={inspeccion?.id ? `/acta-entrega/${inspeccion.id}` : "#"}
                  >
                    Ir a firma de entrega
                  </a>
                  <button type="button" className="btn btn-primary" onClick={guardarActa} disabled={guardando}>
                    {guardando ? "Guardando..." : "Guardar acta"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default EntregaCochePage;
