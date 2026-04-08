import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Context } from "../store/appContext";
import FirmaEntregaPage from "./FirmaEntregaPage";
import EstadoCochesPage from "./EstadoCochesPage";
import "../styles/inspeccion-responsive.css";

const CHECKLIST_ITEMS = [
  { key: "lavado_exterior", label: "Detallado exterior y interior" },
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

const isProfesional = (item) => {
  if (!item || typeof item !== "object") return false;
  if (Boolean(item.es_concesionario)) return true;
  if (Boolean(item?.cobro?.es_concesionario)) return true;
  return Boolean((item?.cliente?.cif || "").trim());
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
  const [feedback, setFeedback] = useState(null); // { type, msg }
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

      // Flujo directo para profesionales: al dejarlo listo, se entrega sin firma.
      if (marcarListo && isProfesional(selected)) {
        await actions.registrarEntregaInspeccion(selected.id, {
          trabajos_realizados: String(selected.trabajos_realizados || "").trim() || "Entrega profesional cerrada desde repaso.",
          entrega_observaciones: String(notasDraft || "").trim(),
          registrar_cobro: false,
        });
      }

      await cargar();
      setFeedback({
        type: "success",
        msg: marcarListo
          ? (isProfesional(selected)
              ? "✅ Profesional: repaso completado y entrega cerrada (facturar después)."
              : "✅ Coche marcado como listo para entrega.")
          : "💾 Checklist guardado correctamente.",
      });
    } catch (err) {
      setFeedback({ type: "danger", msg: `No se pudo guardar el repaso: ${err?.message || "error"}` });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sw-page-bg sw-repaso-page" style={{ minHeight: "100vh" }}>
      {/* PREMIUM HEADER + TABS */}
      <div style={{
        borderBottom: "1px solid color-mix(in srgb, var(--sw-accent) 15%, var(--sw-border))",
        animation: "sw-fade-up 0.4s ease both",
      }}>
        <div className="container" style={{ maxWidth: "1200px", paddingTop: "1.5rem" }}>
          <p style={{ fontSize: "0.73rem", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--sw-accent)", opacity: 0.85, marginBottom: "0.3rem" }}>
            Gestión de entregas · SpecialWash
          </p>
          <h2 style={{ fontSize: "clamp(1.3rem, 2.5vw, 1.8rem)", fontWeight: 700, color: "var(--sw-text)", margin: "0 0 1.2rem", letterSpacing: "-0.01em" }}>
            Repaso y Entrega
          </h2>
          {/* Pill tabs */}
          <div style={{ display: "flex", gap: 0, marginBottom: "-1px" }}>
            {[
              { key: "estado", icon: "🚗", label: "Estado" },
              { key: "repaso", icon: "✅", label: "Repaso" },
              { key: "firma", icon: "✍️", label: "Firma" },
            ].map(({ key, icon, label }) => {
              const active = activeTab === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => switchTab(key)}
                  style={{
                    padding: "0.65rem 1.4rem",
                    fontSize: "0.9rem", fontWeight: active ? 700 : 500,
                    border: "none", background: "transparent",
                    color: active ? "var(--sw-accent)" : "var(--sw-muted)",
                    cursor: "pointer", transition: "color 0.15s",
                    borderBottom: active ? "2px solid var(--sw-accent)" : "2px solid transparent",
                    display: "flex", alignItems: "center", gap: "0.45rem",
                    whiteSpace: "nowrap", minHeight: "48px",
                  }}
                >
                  {icon} {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {feedback && (
        <div className="container mt-3" style={{ maxWidth: "1200px" }}>
          <div style={{
            background: feedback.type === "success" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
            border: `1px solid ${feedback.type === "success" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
            borderRadius: "10px", padding: "0.75rem 1rem",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            color: feedback.type === "success" ? "#86efac" : "#fca5a5",
            animation: "sw-fade-up 0.3s ease both",
          }}>
            <span>{feedback.msg}</span>
            <button type="button" className="btn-close btn-close-white btn-sm" onClick={() => setFeedback(null)} />
          </div>
        </div>
      )}

      {activeTab === "repaso" && (
        <div className="container py-3 py-md-4" style={{ maxWidth: "1200px" }}>
        <>
          <div className="d-flex justify-content-end mb-2">
            <button className="btn btn-outline-dark btn-sm sw-action-btn" onClick={cargar} disabled={loading}>
              {loading ? "Actualizando..." : "🔄 Actualizar"}
            </button>
          </div>

          {/* Layout tablet: lista arriba en móvil/tablet portrait, lado a lado en landscape/desktop */}
          <div className="row g-3">
            <div className="col-12 col-lg-4">
              <div className="card h-100">
                <div className="card-header fw-semibold d-flex justify-content-between align-items-center">
                  <span>Coches ({pendientesRepaso.length + listosEntrega.length})</span>
                  {selectedId && (
                    <button className="btn btn-outline-secondary btn-sm" onClick={() => setSelectedId(null)}>✕ Cerrar</button>
                  )}
                </div>
                <div className="card-body p-2">
                  <input
                    className="form-control mb-2"
                    style={{ fontSize: "1rem", minHeight: 44 }}
                    placeholder="Buscar matrícula o cliente..."
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                  />

                  {loading && <p className="text-muted mb-0 px-2">Cargando...</p>}

                  {!loading && !pendientesRepaso.length && !listosEntrega.length && (
                    <p className="text-muted mb-0 px-2">No hay coches pendientes.</p>
                  )}

                  {!loading && pendientesRepaso.length > 0 && (
                    <div style={{ maxHeight: 420, overflowY: "auto" }}>
                      {pendientesRepaso.map((p) => (
                        <div
                          key={p.id}
                          className={`sw-coche-item ${selectedId === p.id ? "activo" : ""}`}
                          onClick={() => setSelectedId(p.id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => e.key === "Enter" && setSelectedId(p.id)}
                        >
                          <div className="fw-semibold">{p.matricula || "-"} <span className="fw-normal text-muted small">#{p.id}</span></div>
                          <div className="small">{p.cliente_nombre || "-"}</div>
                          <div className="small opacity-75">{p.coche_descripcion || "-"}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {!loading && listosEntrega.length > 0 && (
                    <>
                      <div className="px-2 pt-2 pb-1 fw-semibold small text-success">✅ Listos para entrega</div>
                      <div style={{ maxHeight: 260, overflowY: "auto" }}>
                        {listosEntrega.map((p) => (
                          <div
                            key={`listo-${p.id}`}
                            className={`sw-coche-item ${selectedId === p.id ? "activo" : ""}`}
                            onClick={() => setSelectedId(p.id)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => e.key === "Enter" && setSelectedId(p.id)}
                          >
                            <div className="fw-semibold">{p.matricula || "-"} <span className="fw-normal text-muted small">#{p.id}</span></div>
                            <div className="small">{p.cliente_nombre || "-"}</div>
                            <div className="small opacity-75">Por {p.repaso_completado_por_nombre || "-"}</div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="col-12 col-lg-8">
              <div className="card h-100">
                <div className="card-header d-flex justify-content-between align-items-center">
                  <span className="fw-semibold">
                    {selected ? `${selected.matricula || "Coche"} — Checklist` : "Checklist de repaso"}
                  </span>
                  {selected && (
                    <span className={`badge ${progress.pct === 100 ? "bg-success" : "bg-dark"}`}>
                      {progress.done}/{progress.total} ({progress.pct}%)
                    </span>
                  )}
                </div>
                <div className="card-body">
                  {!selected && (
                    <div className="text-center text-muted py-5">
                      <div style={{ fontSize: "2.5rem" }}>👆</div>
                      <div>Selecciona un coche de la lista</div>
                    </div>
                  )}

                  {selected && (
                    <>
                      <div className="mb-3 p-3 rounded border sw-repaso-resumen" style={{ fontSize: "0.95rem" }}>
                        <div><strong>Cliente:</strong> {selected.cliente_nombre || "-"}</div>
                        <div><strong>Vehículo:</strong> {selected.coche_descripcion || "-"}</div>
                        <div><strong>Matrícula:</strong> {selected.matricula || "-"}</div>
                        {selected.repaso_completado && (
                          <div className="text-success fw-semibold mt-1">
                            ✅ Listo por {selected.repaso_completado_por_nombre || "-"}
                          </div>
                        )}
                      </div>

                      <div className="row g-2 mb-3">
                        {CHECKLIST_ITEMS.map((item) => (
                          <div className="col-12 col-sm-6" key={item.key}>
                            <div
                              className={`sw-check-item ${checklistDraft[item.key] ? "checked" : ""}`}
                              onClick={() => toggleItem(item.key, !checklistDraft[item.key])}
                            >
                              <input
                                id={`chk-${selected.id}-${item.key}`}
                                type="checkbox"
                                className="form-check-input"
                                checked={Boolean(checklistDraft[item.key])}
                                onChange={(e) => toggleItem(item.key, e.target.checked)}
                                onClick={(e) => e.stopPropagation()}
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
                          style={{ fontSize: "1rem" }}
                          rows={3}
                          value={notasDraft || ""}
                          onChange={(e) => setNotasDraft(e.target.value)}
                          placeholder="Detalles detectados antes de la entrega"
                        />
                      </div>

                      <div className="d-flex flex-column flex-sm-row flex-wrap gap-2">
                        <button type="button" className="btn btn-outline-secondary sw-action-btn" onClick={() => guardarRepaso(false)} disabled={saving}>
                          {saving ? "Guardando..." : "💾 Guardar"}
                        </button>
                        <button type="button" className="btn btn-outline-dark sw-action-btn" onClick={marcarTodo}>
                          ✅ Marcar todo
                        </button>
                        <button type="button" className="btn btn-outline-secondary sw-action-btn" onClick={limpiarTodo}>
                          🗑 Limpiar
                        </button>
                        <button
                          type="button"
                          className="btn btn-success sw-action-btn"
                          onClick={() => guardarRepaso(true)}
                          disabled={saving || progress.done < progress.total}
                        >
                          {selected && isProfesional(selected) ? "🏁 Listo y entregar (profesional)" : "🏁 Listo para entrega"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary sw-action-btn"
                          onClick={() => navigate(`/acta-entrega/${selected.id}`)}
                        >
                          📋 Ir a Hoja de intervencion / Entrega
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
        </div>
      )}

      {activeTab === "estado" && <EstadoCochesPage />}
      {activeTab === "firma" && (
        <div className="container py-3" style={{ maxWidth: "1200px" }}>
          <FirmaEntregaPage />
        </div>
      )}
    </div>
  );
}
