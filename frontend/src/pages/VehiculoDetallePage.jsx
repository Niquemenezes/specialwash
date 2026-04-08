import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Context } from "../store/appContext";
import "../styles/inspeccion-responsive.css";

// ==================== CONSTANTES ====================

const CHECKLIST_ITEMS = [
  { key: "lavado_exterior", label: "Detallado exterior e interior" },
  { key: "aspirado_interior", label: "Aspirado y limpieza interior" },
  { key: "cristales", label: "Cristales limpios sin marcas" },
  { key: "llantas", label: "Llantas y neumáticos revisados" },
  { key: "luces", label: "Luces y señales funcionando" },
  { key: "testigo_tablero", label: "Sin testigos de fallo en tablero" },
  { key: "documentacion", label: "Documentación y llaves listas" },
  { key: "revision_trabajos", label: "Trabajos solicitados verificados" },
];

const safeDate = (value) => {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleString("es-ES");
};

const defaultChecklistState = () => {
  const items = {};
  CHECKLIST_ITEMS.forEach((it) => {
    items[it.key] = false;
  });
  return { items, notas: "" };
};

const estadoColor = (estado) => {
  const colors = {
    pendiente: "#6f42c1",
    en_proceso: "#fd7e14",
    en_pausa: "#ffc107",
    finalizado: "#198754",
  };
  return colors[estado] || "#6c757d";
};

// ==================== COMPONENTE PRINCIPAL ====================

export default function VehiculoDetallePage() {
  const { inspeccion_id } = useParams();
  const { actions, store } = useContext(Context);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "partes";

  const switchTab = (tab) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    setSearchParams(next, { replace: true });
  };

  // STATE
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [inspeccion, setInspeccion] = useState(null);
  const [partes, setPartes] = useState([]);
  const [checklistDraft, setChecklistDraft] = useState(defaultChecklistState().items);
  const [notasDraft, setNotasDraft] = useState("");

  // LOAD INSPECCION & PARTES
  const cargar = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const insp = await actions.getInspeccion(inspeccion_id);
      setInspeccion(insp);

      // Cargar partes de trabajo del coche
      if (insp?.coche_id) {
        const response = await fetch(
          `${process.env.REACT_APP_BACKEND_URL || "http://localhost:5001/api"}/parte_trabajo?coche_id=${insp.coche_id}`,
          {
            headers: {
              Authorization: `Bearer ${sessionStorage.getItem("token") || localStorage.getItem("token")}`,
            },
          }
        );
        if (response.ok) {
          const data = await response.json();
          setPartes(Array.isArray(data) ? data : []);
        }
      }

      // Pre-cargar checklist si ya existe
      if (insp?.repaso_checklist) {
        try {
          const checklist = JSON.parse(insp.repaso_checklist);
          setChecklistDraft(checklist);
        } catch (e) {
          console.warn("Error al parsear checklist", e);
        }
      }
      if (insp?.repaso_notas) {
        setNotasDraft(insp.repaso_notas);
      }
    } catch (err) {
      console.error("Error cargando inspección", err);
      setFeedback({ type: "error", msg: "Error al cargar inspección" });
    } finally {
      setLoading(false);
    }
  }, [inspeccion_id, actions]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // LÓGICA PARA VALIDAR SI PUEDE AVANZAR
  const todosPartesFinalizados = useMemo(() => {
    if (!partes.length) return false;
    return partes.every((p) => p.estado === "finalizado");
  }, [partes]);

  const repasoCompletado = inspeccion?.repaso_completado || false;
  const esConcesionario = inspeccion?.es_concesionario || false;

  // GUARDAR REPASO
  const guardarRepaso = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      await actions.guardarRepasoInspeccion(inspeccion_id, {
        checklist: checklistDraft,
        notas: notasDraft,
        marcar_listo: true,
      });
      setFeedback({ type: "success", msg: "Repaso guardado. Listo para entrega." });
      setTimeout(() => {
        cargar(); // Recargar para ver repaso_completado
      }, 500);
    } catch (err) {
      console.error("Error guardar repaso", err);
      setFeedback({ type: "error", msg: "Error al guardar repaso: " + err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleChecklistChange = (key) => {
    setChecklistDraft((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleNotasChange = (e) => {
    setNotasDraft(e.target.value);
  };

  // NAVEGACIÓN
  if (loading) {
    return (
      <div className="container mt-5 text-center">
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
      </div>
    );
  }

  if (!inspeccion) {
    return (
      <div className="container mt-5">
        <div className="alert alert-danger">Inspección no encontrada</div>
        <button className="btn btn-secondary" onClick={() => navigate("/vehiculos")}>
          Volver a Vehículos
        </button>
      </div>
    );
  }

  // ==================== RENDER TABS ====================

  return (
    <div className="container-fluid mt-4">
      {/* BREADCRUMB & HEADER */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <button className="btn btn-sm btn-outline-secondary me-2" onClick={() => navigate("/vehiculos")}>
            ← Volver
          </button>
          <h2 className="d-inline">
            {inspeccion.matricula || "Coche"} · {inspeccion.cliente_nombre}
          </h2>
        </div>
        <div className="text-muted">
          <small>ID: {inspeccion.id}</small>
        </div>
      </div>

      {/* INFO DEL COCHE (READ-ONLY) */}
      <div className="row mb-4">
        <div className="col-md-6">
          <div className="card">
            <div className="card-body">
              <h6 className="card-title">Cliente</h6>
              <p className="mb-1">
                <strong>{inspeccion.cliente_nombre}</strong>
              </p>
              <p className="text-muted mb-0">{inspeccion.cliente_telefono}</p>
            </div>
          </div>
        </div>
        <div className="col-md-6">
          <div className="card">
            <div className="card-body">
              <h6 className="card-title">Coche</h6>
              <p className="mb-1">
                <strong>{inspeccion.coche_descripcion}</strong>
              </p>
              <p className="text-muted mb-0">
                {inspeccion.matricula} · {inspeccion.kilometros} km
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* FEEDBACK */}
      {feedback && (
        <div className={`alert alert-${feedback.type === "error" ? "danger" : "success"} alert-dismissible mb-3`} role="alert">
          {feedback.msg}
          <button type="button" className="btn-close" onClick={() => setFeedback(null)}></button>
        </div>
      )}

      {/* TABS */}
      <div className="mb-4">
        <ul className="nav nav-tabs" role="tablist">
          <li className="nav-item" role="presentation">
            <button
              className={`nav-link ${activeTab === "partes" ? "active" : ""}`}
              onClick={() => switchTab("partes")}
            >
              Estado Partes
            </button>
          </li>
          <li className="nav-item" role="presentation">
            <button
              className={`nav-link ${activeTab === "repaso" ? "active" : ""}`}
              onClick={() => switchTab("repaso")}
            >
              Repaso Pre-entrega
            </button>
          </li>
        </ul>
      </div>

      {/* TAB 1: ESTADO PARTES */}
      {activeTab === "partes" && (
        <div className="tab-pane fade show active">
          <div className="card">
            <div className="card-header">
              <h6 className="mb-0">
                Partes de Trabajo ({partes.length})
              </h6>
            </div>
            <div className="card-body">
              {partes.length === 0 ? (
                <p className="text-muted">No hay partes de trabajo</p>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover mb-0">
                    <thead>
                      <tr>
                        <th>Tipo</th>
                        <th>Descripción</th>
                        <th>Empleado</th>
                        <th>Estado</th>
                        <th>Duración</th>
                      </tr>
                    </thead>
                    <tbody>
                      {partes.map((p) => (
                        <tr key={p.id}>
                          <td>
                            <span
                              className="badge"
                              style={{ backgroundColor: estadoColor(p.estado) }}
                            >
                              {p.tipo_tarea || "—"}
                            </span>
                          </td>
                          <td>{p.observaciones || "Sin descripción"}</td>
                          <td>{p.empleado_nombre || "Sin asignar"}</td>
                          <td>
                            <span
                              className="badge"
                              style={{
                                backgroundColor: estadoColor(p.estado),
                                opacity: 0.7,
                              }}
                            >
                              {p.estado}
                            </span>
                          </td>
                          <td className="text-muted small">
                            {p.duracion_horas?.toFixed(1) || "—"} h
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* INDICADOR DE ESTADO */}
              <div className="mt-4 p-3 bg-light rounded">
                {todosPartesFinalizados ? (
                  <div className="alert alert-success mb-0">
                    ✓ Todos los partes están finalizados. Puedes proceder al repaso.
                  </div>
                ) : (
                  <div className="alert alert-warning mb-0">
                    ⏳ Esperando finalización de partes. {partes.filter((p) => p.estado !== "finalizado").length} pendientes.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: REPASO PRE-ENTREGA */}
      {activeTab === "repaso" && (
        <div className="tab-pane fade show active">
          <div className="card">
            <div className="card-header">
              <h6 className="mb-0">Checklist Pre-entrega</h6>
            </div>
            <div className="card-body">
              {!todosPartesFinalizados ? (
                <div className="alert alert-warning mb-3">
                  ⚠️ No puedes completar el repaso hasta que todos los partes estén finalizados.
                </div>
              ) : (
                <>
                  <h6>Verificaciones:</h6>
                  <div className="mb-4">
                    {CHECKLIST_ITEMS.map((item) => (
                      <div className="form-check mb-2" key={item.key}>
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id={item.key}
                          checked={checklistDraft[item.key] || false}
                          onChange={() => handleChecklistChange(item.key)}
                          disabled={!todosPartesFinalizados || (repasoCompletado && !saving)}
                        />
                        <label className="form-check-label" htmlFor={item.key}>
                          {item.label}
                        </label>
                      </div>
                    ))}
                  </div>

                  <hr />

                  <h6>Notas del técnico:</h6>
                  <textarea
                    className="form-control mb-4"
                    rows="4"
                    placeholder="Observaciones or notas de la reparación..."
                    value={notasDraft}
                    onChange={handleNotasChange}
                    disabled={repasoCompletado && !saving}
                  />

                  {/* BOTÓN GUARDAR/COMPLETADO */}
                  {!repasoCompletado && todosPartesFinalizados ? (
                    <button
                      className="btn btn-primary btn-lg w-100"
                      onClick={guardarRepaso}
                      disabled={saving}
                    >
                      {saving ? "Guardando..." : "✓ Guardar Repaso y Marcar Listo"}
                    </button>
                  ) : repasoCompletado ? (
                    <div className="alert alert-success mb-0">
                      ✓ Repaso completado por {inspeccion.repaso_completado_por_nombre} el{" "}
                      {safeDate(inspeccion.repaso_completado_at)}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* NAVEGACIÓN FOOTER */}
      <div className="mt-4 pb-5">
        <div className="row">
          <div className="col-6">
            <button className="btn btn-outline-secondary w-100" onClick={() => navigate("/vehiculos")}>
              ← Atrás
            </button>
          </div>
          <div className="col-6">
            <button
              className="btn btn-primary w-100"
              disabled={!repasoCompletado}
              onClick={() => {
                if (esConcesionario) {
                  navigate(`/entrega-cliente/${inspeccion_id}`);
                } else {
                  navigate(`/hoja-tecnica/${inspeccion_id}`);
                }
              }}
            >
              Siguiente →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
