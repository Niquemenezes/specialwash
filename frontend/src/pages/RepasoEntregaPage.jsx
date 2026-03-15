import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Context } from "../store/appContext";
import FirmaEntregaPage from "./FirmaEntregaPage";

const CHECKLIST_ITEMS = [
  { key: "lavado_exterior", label: "Lavado exterior final" },
  { key: "aspirado_interior", label: "Aspirado y limpieza interior" },
  { key: "cristales", label: "Cristales limpios sin marcas" },
  { key: "llantas", label: "Llantas y neumáticos revisados" },
  { key: "niveles", label: "Niveles básicos revisados" },
  { key: "luces", label: "Luces y señales funcionando" },
  { key: "testigo_tablero", label: "Sin testigos de fallo en tablero" },
  { key: "documentacion", label: "Documentación y llaves listas" },
  { key: "revision_trabajos", label: "Trabajos solicitados verificados" },
  { key: "prueba_corta", label: "Prueba corta de validación" },
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

export default function RepasoEntregaPage() {
  const { actions } = useContext(Context);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "repaso";

  const switchTab = (tab) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    setSearchParams(next, { replace: true });
  };

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inspecciones, setInspecciones] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [checklistDraft, setChecklistDraft] = useState(defaultChecklistState().items);
  const [notasDraft, setNotasDraft] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await actions.getMisInspecciones();
      setInspecciones(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, [actions]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const pendientes = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    return (inspecciones || [])
      .filter((i) => !i.entregado)
      .filter((i) => {
        if (!term) return true;
        const txt = `${i.cliente_nombre || ""} ${i.coche_descripcion || ""} ${i.matricula || ""}`.toLowerCase();
        return txt.includes(term);
      })
      .sort((a, b) => new Date(b.fecha_inspeccion || 0).getTime() - new Date(a.fecha_inspeccion || 0).getTime());
  }, [inspecciones, busqueda]);

  const pendientesRepaso = useMemo(
    () => pendientes.filter((p) => !p.repaso_completado),
    [pendientes]
  );

  const listosEntrega = useMemo(
    () => pendientes.filter((p) => p.repaso_completado),
    [pendientes]
  );

  useEffect(() => {
    if (!pendientes.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !pendientes.some((p) => p.id === selectedId)) {
      setSelectedId(pendientes[0].id);
    }
  }, [pendientes, selectedId]);

  const selected = useMemo(
    () => pendientes.find((p) => p.id === selectedId) || null,
    [pendientes, selectedId]
  );

  useEffect(() => {
    if (!selected) {
      setChecklistDraft(defaultChecklistState().items);
      setNotasDraft("");
      return;
    }
    const savedItems = selected.repaso_checklist && typeof selected.repaso_checklist === "object"
      ? selected.repaso_checklist
      : {};
    setChecklistDraft({ ...defaultChecklistState().items, ...savedItems });
    setNotasDraft(selected.repaso_notas || "");
  }, [selected]);

  const progress = useMemo(() => {
    const total = CHECKLIST_ITEMS.length;
    const done = CHECKLIST_ITEMS.filter((it) => Boolean(checklistDraft[it.key])).length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    return { total, done, pct };
  }, [checklistDraft]);

  const toggleItem = (k, v) => {
    setChecklistDraft((prev) => ({ ...prev, [k]: v }));
  };

  const marcarTodo = () => {
    const all = {};
    CHECKLIST_ITEMS.forEach((it) => {
      all[it.key] = true;
    });
    setChecklistDraft(all);
  };

  const limpiarTodo = () => {
    setChecklistDraft(defaultChecklistState().items);
    setNotasDraft("");
  };

  const guardarRepaso = async (marcarListo = false) => {
    if (!selected) return;
    setSaving(true);
    try {
      await actions.guardarRepasoInspeccion(selected.id, {
        checklist: checklistDraft,
        notas: notasDraft,
        marcar_listo: marcarListo,
      });
      await cargar();
      alert(marcarListo ? "Checklist completado. Coche marcado como listo para entrega." : "Checklist guardado.");
    } catch (err) {
      alert(`No se pudo guardar el repaso: ${err?.message || "error"}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="mb-0">Repaso y Firma de Entrega</h2>
      </div>

      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${activeTab === "repaso" ? "active" : ""}`}
            onClick={() => switchTab("repaso")}
          >
            ✅ Repaso pre-entrega
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${activeTab === "firma" ? "active" : ""}`}
            onClick={() => switchTab("firma")}
          >
            ✍️ Firma entrega
          </button>
        </li>
      </ul>

      {activeTab === "repaso" && (
        <>
          <div className="d-flex justify-content-end mb-2">
            <button className="btn btn-outline-dark btn-sm" onClick={cargar} disabled={loading}>
              {loading ? "Actualizando..." : "Actualizar"}
            </button>
          </div>
          <div className="alert alert-info py-2">
            Checklist final antes de entregar el coche. Acceso habilitado para todos los roles.
          </div>
          <div className="row g-3">
        <div className="col-lg-4">
          <div className="card h-100">
            <div className="card-header fw-semibold">Coches por repasar</div>
            <div className="card-body">
              <input
                className="form-control mb-3"
                placeholder="Buscar cliente, coche o matrícula"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />

              {loading && <p className="text-muted mb-0">Cargando...</p>}

              {!loading && !pendientesRepaso.length && (
                <p className="text-muted mb-0">No hay coches pendientes de entrega.</p>
              )}

              {!loading && pendientesRepaso.length > 0 && (
                <div className="list-group" style={{ maxHeight: 520, overflow: "auto" }}>
                  {pendientesRepaso.map((p) => (
                    <button
                      key={p.id}
                      className={`list-group-item list-group-item-action ${selectedId === p.id ? "active" : ""}`}
                      onClick={() => setSelectedId(p.id)}
                    >
                      <div className="fw-semibold">#{p.id} - {p.matricula || "-"}</div>
                      <div className="small">{p.cliente_nombre || "-"}</div>
                      <div className="small text-muted">{p.coche_descripcion || "-"}</div>
                    </button>
                  ))}
                </div>
              )}

              {!loading && listosEntrega.length > 0 && (
                <>
                  <hr />
                  <div className="fw-semibold mb-2">Listos para entrega</div>
                  <div className="list-group" style={{ maxHeight: 220, overflow: "auto" }}>
                    {listosEntrega.map((p) => (
                      <button
                        key={`listo-${p.id}`}
                        className={`list-group-item list-group-item-action ${selectedId === p.id ? "active" : ""}`}
                        onClick={() => setSelectedId(p.id)}
                      >
                        <div className="fw-semibold">#{p.id} - {p.matricula || "-"}</div>
                        <div className="small">{p.cliente_nombre || "-"}</div>
                        <div className="small text-muted">
                          Listo por {p.repaso_completado_por_nombre || "usuario"} ({safeDate(p.repaso_completado_at)})
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="col-lg-8">
          <div className="card h-100">
            <div className="card-header d-flex justify-content-between align-items-center">
              <span className="fw-semibold">Checklist de repaso</span>
              {selected && (
                <span className="badge bg-dark">{progress.done}/{progress.total} ({progress.pct}%)</span>
              )}
            </div>
            <div className="card-body">
              {!selected && <p className="text-muted mb-0">Selecciona un coche para empezar el repaso.</p>}

              {selected && (
                <>
                  <div className="mb-3 p-2 rounded border bg-light">
                    <div><strong>Cliente:</strong> {selected.cliente_nombre || "-"}</div>
                    <div><strong>Vehículo:</strong> {selected.coche_descripcion || "-"}</div>
                    <div><strong>Matrícula:</strong> {selected.matricula || "-"}</div>
                    <div><strong>Fecha inspección:</strong> {safeDate(selected.fecha_inspeccion)}</div>
                    <div><strong>Estado:</strong> {selected.repaso_completado ? "Listo para entrega" : "Pendiente de repaso"}</div>
                    {selected.repaso_completado && (
                      <div>
                        <strong>Checklist hecho por:</strong> {selected.repaso_completado_por_nombre || "-"} ({safeDate(selected.repaso_completado_at)})
                      </div>
                    )}
                  </div>

                  <div className="row g-2 mb-3">
                    {CHECKLIST_ITEMS.map((item) => (
                      <div className="col-md-6" key={item.key}>
                        <div className="form-check border rounded p-2 h-100">
                          <input
                            id={`chk-${selected.id}-${item.key}`}
                            type="checkbox"
                            className="form-check-input"
                            checked={Boolean(checklistDraft[item.key])}
                            onChange={(e) => toggleItem(item.key, e.target.checked)}
                          />
                          <label className="form-check-label" htmlFor={`chk-${selected.id}-${item.key}`}>
                            {item.label}
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Notas de repaso</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      value={notasDraft || ""}
                      onChange={(e) => setNotasDraft(e.target.value)}
                      placeholder="Detalles detectados antes de la entrega"
                    />
                  </div>

                  <div className="d-flex flex-wrap gap-2">
                    <button type="button" className="btn btn-primary" onClick={() => guardarRepaso(false)} disabled={saving}>
                      {saving ? "Guardando..." : "Guardar checklist"}
                    </button>
                    <button type="button" className="btn btn-success" onClick={marcarTodo}>
                      Marcar todo OK
                    </button>
                    <button
                      type="button"
                      className="btn btn-success"
                      onClick={() => guardarRepaso(true)}
                      disabled={saving || progress.done < progress.total}
                    >
                      Marcar listo para entrega
                    </button>
                    <button type="button" className="btn btn-outline-secondary" onClick={limpiarTodo}>
                      Limpiar checklist
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => navigate(`/acta-entrega/${selected.id}`)}
                    >
                      Ir a Acta / Entrega
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
        </>
      )}

      {activeTab === "firma" && <FirmaEntregaPage />}
    </div>
  );
}
