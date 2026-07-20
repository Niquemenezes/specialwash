import { useCallback, useContext, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Context } from "../store/appContext";
import "../styles/inspeccion-responsive.css";

const TIPO_COLORES = {
  detailing: "#6366f1",
  preparacion: "#38bdf8",
  pintura:   "#f87171",
  tapicero:  "#fbbf24",
  calidad:   "#22d3ee",
  otro:      "#a78bfa",
};

const formatTipoLabel = (value) => {
  if (!value) return "Trabajo";
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const cleanParteDetalle = (value, fase, tipoTarea) => {
  const text = String(value || "").trim();
  if (!text) return "Sin detalle";

  const prefixes = [
    fase === "preparacion" ? "preparacion" : null,
    fase === "pintura" ? "pintura" : null,
    tipoTarea || null,
  ].filter(Boolean);

  let cleaned = text;
  prefixes.forEach((prefix) => {
    const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    cleaned = cleaned.replace(new RegExp(`^${escaped}\\s+`, "i"), "");
  });

  return cleaned.trim() || text;
};

const getParteRepasoLabel = (parte) => {
  if (parte?.fase === "preparacion") return "Preparación";
  if (parte?.fase === "pintura") return "Pintura";
  return formatTipoLabel(parte?.tipo_tarea);
};

const buildChecklistItems = (selected) => {
  const partes = selected?.estado_coche?.partes_finalizados_detalle || [];
  return partes.map((p) => ({
    key: `parte_${p.id}`,
    label: `${getParteRepasoLabel(p)} — ${cleanParteDetalle(p.observaciones, p.fase, p.tipo_tarea)}`,
    tipo: p.fase === "preparacion" ? "preparacion" : p.tipo_tarea,
    observaciones: p.empleado_nombre || "Sin asignar",
  }));
};

const isProfesional = (item) => {
  if (!item || typeof item !== "object") return false;
  if (Boolean(item.es_concesionario)) return true;
  if (Boolean(item?.cobro?.es_concesionario)) return true;
  return Boolean((item?.cliente?.cif || "").trim());
};

export default function RepasoCoachePage() {
  const { actions } = useContext(Context);
  const navigate = useNavigate();
  const { id } = useParams();
  const inspeccionId = Number(id);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [inspeccion, setInspeccion] = useState(null);
  const [checklistDraft, setChecklistDraft] = useState({});
  const [notasDraft, setNotasDraft] = useState("");
  const [hojaIntervencionDraft, setHojaIntervencionDraft] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await actions.getPendientesEntrega();
      const found = (Array.isArray(data) ? data : []).find((i) => i.id === inspeccionId);
      if (found) {
        setInspeccion(found);
        const saved = found.repaso_checklist && typeof found.repaso_checklist === "object"
          ? found.repaso_checklist : {};
        const checklistItems = buildChecklistItems(found);
        const base = {};
        checklistItems.forEach((it) => { base[it.key] = false; });
        setChecklistDraft({ ...base, ...saved });
        setNotasDraft(found.repaso_notas || "");
        setHojaIntervencionDraft(Boolean(found.requiere_hoja_intervencion));
      }
    } finally {
      setLoading(false);
    }
  }, [actions, inspeccionId]);

  useEffect(() => { cargar(); }, [cargar]);

  const checklistItems = buildChecklistItems(inspeccion);
  const progress = {
    total: checklistItems.length,
    done: checklistItems.filter((it) => Boolean(checklistDraft[it.key])).length,
    pct: checklistItems.length ? Math.round((checklistItems.filter((it) => Boolean(checklistDraft[it.key])).length / checklistItems.length) * 100) : 0,
  };

  const toggleItem = (k, v) => setChecklistDraft((prev) => ({ ...prev, [k]: v }));

  const marcarTodo = () => {
    const all = {};
    checklistItems.forEach((it) => { all[it.key] = true; });
    setChecklistDraft(all);
  };

  const limpiarTodo = () => {
    const empty = {};
    checklistItems.forEach((it) => { empty[it.key] = false; });
    setChecklistDraft(empty);
    setNotasDraft("");
  };

  const guardarRepaso = async (marcarListo = false) => {
    if (!inspeccion) return;
    setSaving(true);
    try {
      await actions.guardarRepasoInspeccion(inspeccion.id, {
        checklist: checklistDraft,
        notas: notasDraft,
        marcar_listo: marcarListo,
        requiere_hoja_intervencion: hojaIntervencionDraft,
      });

      if (marcarListo && isProfesional(inspeccion)) {
        await actions.registrarEntregaInspeccion(inspeccion.id, {
          trabajos_realizados: String(inspeccion.trabajos_realizados || "").trim() || "Entrega profesional cerrada desde repaso.",
          entrega_observaciones: String(notasDraft || "").trim(),
          registrar_cobro: false,
        });
      }

      await cargar();
      setFeedback({
        type: "success",
        msg: marcarListo
          ? (isProfesional(inspeccion)
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

  if (loading) {
    return (
      <div className="sw-page-bg" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: "var(--sw-muted)" }}>
          <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>⏳</div>
          <div>Cargando repaso...</div>
        </div>
      </div>
    );
  }

  if (!inspeccion) {
    return (
      <div className="sw-page-bg" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: "var(--sw-muted)" }}>
          <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>❌</div>
          <div>Coche no encontrado</div>
          <button className="btn btn-primary mt-3" onClick={() => navigate("/repaso-entrega?tab=repaso")}>
            Volver a lista
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sw-page-bg sw-repaso-page" style={{ minHeight: "100vh" }}>
      {/* HEADER */}
      <div style={{
        borderBottom: "1px solid color-mix(in srgb, var(--sw-accent) 15%, var(--sw-border))",
        animation: "sw-fade-up 0.4s ease both",
      }}>
        <div className="container" style={{ maxWidth: "1200px", paddingTop: "1.5rem" }}>
          <p style={{ fontSize: "0.73rem", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--sw-accent)", opacity: 0.85, marginBottom: "0.3rem" }}>
            Repaso de coche · SW Studio
          </p>
          <h2 style={{ fontSize: "clamp(1.3rem, 2.5vw, 1.8rem)", fontWeight: 700, color: "var(--sw-text)", margin: "0 0 1.2rem", letterSpacing: "-0.01em" }}>
            {inspeccion.matricula || "Coche"} — Verificación antes de entrega
          </h2>
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

      <div className="container py-3 py-md-4" style={{ maxWidth: "1200px" }}>
        <div className="card">
          <div className="card-header d-flex justify-content-between align-items-center">
            <span className="fw-semibold">
              Verificación de trabajos
            </span>
            {checklistItems.length > 0 && (
              <span className={`badge ${progress.pct === 100 ? "bg-success" : "bg-dark"}`}>
                {progress.done}/{progress.total} ({progress.pct}%)
              </span>
            )}
          </div>
          <div className="card-body">
            {/* Resumen del coche */}
            <div className="mb-3 p-3 rounded border sw-repaso-resumen" style={{ fontSize: "0.95rem" }}>
              <div className="row g-1">
                <div className="col-12 col-sm-4"><strong>Cliente:</strong> {inspeccion.cliente_nombre || "-"}</div>
                <div className="col-12 col-sm-4"><strong>Vehículo:</strong> {inspeccion.coche_descripcion || "-"}</div>
                <div className="col-12 col-sm-4"><strong>Matrícula:</strong> {inspeccion.matricula || "-"}</div>
              </div>
              {inspeccion.repaso_completado && (
                <div className="text-success fw-semibold mt-2">
                  ✅ Listo por {inspeccion.repaso_completado_por_nombre || "-"}
                </div>
              )}
            </div>

            {/* Checklist */}
            {checklistItems.length === 0 ? (
              <div className="text-muted py-3 text-center">
                Sin partes de trabajo finalizados registrados para este coche.
              </div>
            ) : (
              <div className="row g-2 mb-3">
                {checklistItems.map((item) => {
                  const color = TIPO_COLORES[item.tipo] || "#6c757d";
                  return (
                    <div className="col-12 col-sm-6" key={item.key}>
                      <div
                        className={`sw-check-item ${checklistDraft[item.key] ? "checked" : ""}`}
                        onClick={() => toggleItem(item.key, !checklistDraft[item.key])}
                        style={{ borderLeft: `3px solid ${color}` }}
                      >
                        <input
                          id={`chk-${inspeccion.id}-${item.key}`}
                          type="checkbox"
                          className="form-check-input"
                          checked={Boolean(checklistDraft[item.key])}
                          onChange={(e) => toggleItem(item.key, e.target.checked)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div>
                          <label className="form-check-label fw-semibold d-block" htmlFor={`chk-${inspeccion.id}-${item.key}`} style={{ color, cursor: "pointer" }}>
                            {item.label}
                          </label>
                          {item.observaciones && (
                            <span className="text-muted" style={{ fontSize: "0.78rem" }}>{item.observaciones}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Notas */}
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

            {/* Hoja de intervención */}
            <div className="form-check mb-3 p-3 border rounded">
              <input
                className="form-check-input"
                type="checkbox"
                id="requiere_hoja_intervencion"
                checked={hojaIntervencionDraft}
                onChange={(e) => setHojaIntervencionDraft(e.target.checked)}
                disabled={saving}
              />
              <label className="form-check-label" htmlFor="requiere_hoja_intervencion">
                <strong>Generar hoja de intervención técnica</strong>
                <span className="text-muted d-block small">Márcala si este coche necesita informe o acta de intervención.</span>
              </label>
            </div>

            {/* Botones */}
            <div className="d-flex flex-column flex-sm-row flex-wrap gap-2">
              <button type="button" className="btn btn-outline-secondary btn-sm sw-action-btn" onClick={() => guardarRepaso(false)} disabled={saving}>
                {saving ? "Guardando..." : "💾 Guardar"}
              </button>
              {checklistItems.length > 0 && (
                <>
                  <button type="button" className="btn btn-outline-dark btn-sm sw-action-btn" onClick={marcarTodo}>
                    ✅ Marcar todo
                  </button>
                  <button type="button" className="btn btn-outline-secondary btn-sm sw-action-btn" onClick={limpiarTodo}>
                    🗑 Limpiar
                  </button>
                </>
              )}
              <button
                type="button"
                className="btn btn-success btn-sm sw-action-btn"
                onClick={() => guardarRepaso(true)}
                disabled={saving || (checklistItems.length > 0 && progress.done < progress.total)}
              >
                {isProfesional(inspeccion) ? "🏁 Listo y entregar (profesional)" : "🏁 Listo para entrega"}
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm sw-action-btn"
                onClick={() => navigate(`/acta-entrega/${inspeccion.id}`)}
              >
                📋 Hoja de entrega
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm sw-action-btn"
                onClick={() => navigate("/repaso-entrega?tab=repaso")}
              >
                ← Volver a lista
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
