import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatMinutes, reporteEmpleados } from "../utils/parteTrabajoApi";

const RANGE_OPTIONS = [
  { key: "hoy", label: "Hoy" },
  { key: "7d", label: "7 días" },
  { key: "30d", label: "30 días" },
];

const ROLE_LABELS = {
  detailing: "Detailing",
  pintura: "Pintura",
  tapicero: "Tapicería",
  tapiceria: "Tapicería",
  calidad: "Calidad",
  otro: "General",
  empleado: "General",
};

const TASK_TYPE_LABELS = {
  detailing: "Detailing / Lavado",
  pintura: "Pintura",
  tapicero: "Tapicería",
  tapiceria: "Tapicería",
  otro: "Trabajo general",
};

const ESTADO_STYLE = {
  en_proceso: { color: "#22c55e", bg: "rgba(34,197,94,0.10)", border: "rgba(34,197,94,0.30)", label: "Trabajando" },
  en_pausa: { color: "#f59e0b", bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.30)", label: "En pausa" },
  finalizado: { color: "#94a3b8", bg: "rgba(148,163,184,0.10)", border: "rgba(148,163,184,0.28)", label: "Finalizado" },
  pendiente: { color: "#818cf8", bg: "rgba(129,140,248,0.10)", border: "rgba(129,140,248,0.30)", label: "Pendiente" },
};

const fmtRol = (rol) => ROLE_LABELS[String(rol || "").toLowerCase()] || "General";
const fmtTipoTarea = (tipo) => TASK_TYPE_LABELS[String(tipo || "").toLowerCase()] || (String(tipo || "").trim() || "Trabajo general");

const fmtDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const fmtHour = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const fmtActividad = (parte) => {
  const obs = String(parte?.observaciones || "").trim();
  if (obs) return obs;
  return fmtTipoTarea(parte?.tipo_tarea);
};

const fmtRegistro = (parte) => {
  if (!parte) return "Sin registro";
  if (parte.es_tarea_interna) return `Trabajo interno · ${fmtTipoTarea(parte.tipo_tarea)}`;
  const descripcion = [parte.matricula, [parte.marca, parte.modelo].filter(Boolean).join(" ")].filter(Boolean).join(" · ");
  return descripcion || "Coche sin matrícula";
};

const fmtTramo = (inicio, fin) => {
  if (!inicio) return "Sin hora de inicio";
  const ini = fmtHour(inicio);
  if (!fin) return `Desde ${ini}`;
  return `${ini} → ${fmtHour(fin)}`;
};

const getRangeDates = (preset) => {
  const fin = new Date();
  const inicio = new Date(fin);
  if (preset === "30d") inicio.setDate(fin.getDate() - 29);
  else if (preset === "7d") inicio.setDate(fin.getDate() - 6);

  return {
    fecha_inicio: inicio.toISOString().slice(0, 10),
    fecha_fin: fin.toISOString().slice(0, 10),
  };
};

function EstadoChip({ estado }) {
  const cfg = ESTADO_STYLE[estado] || ESTADO_STYLE.finalizado;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.35rem",
        padding: "0.18rem 0.6rem",
        borderRadius: "999px",
        fontSize: "0.72rem",
        fontWeight: 700,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        color: cfg.color,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.color }} />
      {cfg.label}
    </span>
  );
}

function deviationView(real, estimado) {
  const diff = Number(real || 0) - Number(estimado || 0);
  let color = "#22c55e";
  if (diff > 30) color = "#ef4444";
  else if (diff > 10) color = "#f59e0b";
  return <span style={{ color, fontWeight: 700 }}>{`${diff > 0 ? "+" : ""}${diff} min`}</span>;
}

export default function ProductividadTrabajadoresPage() {
  const initialRange = useMemo(() => getRangeDates("hoy"), []);
  const [preset, setPreset] = useState("hoy");
  const [fechaInicio, setFechaInicio] = useState(initialRange.fecha_inicio);
  const [fechaFin, setFechaFin] = useState(initialRange.fecha_fin);
  const [empleadoFiltro, setEmpleadoFiltro] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reporte, setReporte] = useState([]);
  const [printWorkerId, setPrintWorkerId] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await reporteEmpleados({ fecha_inicio: fechaInicio, fecha_fin: fechaFin });
      setReporte(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || "No se pudo cargar la productividad del equipo.");
      setReporte([]);
    } finally {
      setLoading(false);
    }
  }, [fechaInicio, fechaFin]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    const cleanupPrint = () => {
      document.body.classList.remove("sw-print-productividad", "sw-print-productividad--single");
      setPrintWorkerId("");
    };

    window.addEventListener("afterprint", cleanupPrint);
    return () => window.removeEventListener("afterprint", cleanupPrint);
  }, []);

  const handlePrint = useCallback((workerId = "") => {
    const single = Boolean(workerId);
    setPrintWorkerId(single ? String(workerId) : "");

    window.setTimeout(() => {
      document.body.classList.add("sw-print-productividad");
      document.body.classList.toggle("sw-print-productividad--single", single);
      window.print();
    }, 80);
  }, []);

  const setQuickRange = (key) => {
    const range = getRangeDates(key);
    setPreset(key);
    setFechaInicio(range.fecha_inicio);
    setFechaFin(range.fecha_fin);
  };

  const opcionesEmpleados = useMemo(
    () =>
      [...reporte]
        .map((emp) => ({ value: String(emp?.empleado_id || ""), label: emp?.nombre || "Sin nombre" }))
        .filter((item) => item.value)
        .sort((a, b) => a.label.localeCompare(b.label, "es")),
    [reporte]
  );

  const empleados = useMemo(() => {
    const texto = search.trim().toLowerCase();
    return [...reporte]
      .map((emp) => {
        const partes = Array.isArray(emp?.partes) ? emp.partes : [];
        const partesOrdenadas = [...partes].sort(
          (a, b) => new Date(a?.fecha_inicio || 0) - new Date(b?.fecha_inicio || 0)
        );
        const parteActiva = [...partesOrdenadas].reverse().find((p) => ["en_proceso", "en_pausa"].includes(p?.estado)) || null;
        const ultimaParte = [...partesOrdenadas].sort((a, b) => new Date(b?.fecha_inicio || 0) - new Date(a?.fecha_inicio || 0))[0] || null;
        const desviacionTotal = partes.reduce(
          (sum, p) => sum + (Number(p?.duracion_minutos || 0) - Number(p?.tiempo_estimado_minutos || 0)),
          0
        );
        const cochesCount = partes.filter((p) => !p?.es_tarea_interna).length;
        const internasCount = partes.filter((p) => p?.es_tarea_interna).length;
        return { ...emp, partes, partesOrdenadas, parteActiva, ultimaParte, desviacionTotal, cochesCount, internasCount };
      })
      .filter((emp) => {
        if (empleadoFiltro && String(emp?.empleado_id || "") !== empleadoFiltro) return false;
        if (!texto) return true;
        const bag = [
          emp?.nombre,
          emp?.rol,
          ...(emp.partes || []).flatMap((p) => [p?.matricula, p?.marca, p?.modelo, p?.tipo_tarea, p?.observaciones]),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return bag.includes(texto);
      })
      .sort((a, b) => Number(b?.total_minutos || 0) - Number(a?.total_minutos || 0));
  }, [reporte, search, empleadoFiltro]);

  const stats = useMemo(() => {
    const activos = empleados.filter((emp) => emp?.parteActiva).length;
    const tiempoCoches = empleados.reduce((sum, emp) => sum + Number(emp?.total_minutos_coche || 0), 0);
    const tiempoInterno = empleados.reduce((sum, emp) => sum + Number(emp?.total_minutos_interno || 0), 0);
    const totalPartes = empleados.reduce((sum, emp) => sum + Number(emp?.total_partes || 0), 0);
    const top = empleados[0]?.nombre || "—";
    return { activos, tiempoCoches, tiempoInterno, totalPartes, top };
  }, [empleados]);

  return (
    <div className="sw-ent-wrapper">
      <style>{`
        .sw-print-only { display: none; }

        @media print {
          body.sw-print-productividad * {
            visibility: hidden !important;
          }

          body.sw-print-productividad .sw-prod-print-root,
          body.sw-print-productividad .sw-prod-print-root * {
            visibility: visible !important;
          }

          body.sw-print-productividad .sw-prod-print-root {
            position: absolute !important;
            inset: 0 !important;
            width: 100% !important;
            max-width: none !important;
            padding: 0 !important;
            margin: 0 !important;
            background: #fff !important;
            color: #111 !important;
          }

          body.sw-print-productividad .sw-no-print {
            display: none !important;
          }

          body.sw-print-productividad .sw-print-only {
            display: block !important;
          }

          body.sw-print-productividad .sw-worker-card {
            break-inside: avoid;
            page-break-inside: avoid;
            box-shadow: none !important;
            border: 1px solid #d1d5db !important;
            background: #fff !important;
          }

          body.sw-print-productividad.sw-print-productividad--single .sw-worker-card {
            display: none !important;
          }

          body.sw-print-productividad.sw-print-productividad--single .sw-worker-card[data-print-target="true"] {
            display: block !important;
          }
        }
      `}</style>

      <div className="sw-veh-hero sw-no-print">
        <div className="sw-veh-hero-inner container">
          <div className="sw-veh-hero-body">
            <div style={{ flex: 1 }}>
              <p className="sw-home-eyebrow" style={{ marginBottom: "0.2rem" }}>Equipo · Productividad</p>
              <h1 className="sw-veh-hero-title">Productividad por trabajador</h1>
              <p className="sw-veh-hero-sub">Para ver rápido qué ha hecho hoy cada trabajador y cuánto tardó en cada tarea</p>
            </div>
            <Link
              to="/partes-trabajo"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.6rem 1rem",
                borderRadius: "10px",
                textDecoration: "none",
                border: "1px solid var(--sw-border)",
                color: "var(--sw-muted)",
                background: "var(--sw-surface)",
                fontWeight: 600,
              }}
            >
              ← Volver a Estado de coches
            </Link>
          </div>
        </div>
      </div>

      <div className="container sw-ent-content sw-prod-print-root" style={{ maxWidth: 1200 }}>
        <div className="sw-print-only" style={{ marginBottom: "1rem" }}>
          <h1 style={{ fontSize: "1.3rem", margin: 0, color: "#111" }}>Productividad por trabajador</h1>
          <div style={{ marginTop: "0.3rem", color: "#374151", fontSize: "0.9rem" }}>
            Período: {fechaInicio || "—"} a {fechaFin || "—"}
            {empleadoFiltro ? ` · Trabajador seleccionado` : " · Todo el equipo"}
          </div>
        </div>

        <div className="sw-ent-card sw-no-print" style={{ marginBottom: "1rem" }}>
          <div className="sw-ent-card-body">
            <div className="sw-ent-grid">
              <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                <label className="sw-plbl">Desde</label>
                <input type="date" className="form-control sw-pinput" value={fechaInicio} onChange={(e) => { setFechaInicio(e.target.value); setPreset("custom"); }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                <label className="sw-plbl">Hasta</label>
                <input type="date" className="form-control sw-pinput" value={fechaFin} onChange={(e) => { setFechaFin(e.target.value); setPreset("custom"); }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                <label className="sw-plbl">Trabajador</label>
                <select className="form-control sw-pinput" value={empleadoFiltro} onChange={(e) => setEmpleadoFiltro(e.target.value)}>
                  <option value="">Todo el equipo</option>
                  {opcionesEmpleados.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                <label className="sw-plbl">Buscar trabajador o coche</label>
                <input className="form-control sw-pinput" placeholder="Nombre, tarea, matrícula..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.9rem" }}>
              {RANGE_OPTIONS.map((item) => {
                const active = preset === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setQuickRange(item.key)}
                    style={{
                      borderRadius: "999px",
                      padding: "0.35rem 0.8rem",
                      border: active ? "1px solid rgba(34,197,94,0.4)" : "1px solid var(--sw-border)",
                      background: active ? "rgba(34,197,94,0.08)" : "var(--sw-surface-2)",
                      color: active ? "#22c55e" : "var(--sw-muted)",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {item.label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => handlePrint("")}
                style={{
                  marginLeft: "auto",
                  padding: "0.5rem 0.9rem",
                  borderRadius: "10px",
                  border: "1px solid var(--sw-border)",
                  background: "var(--sw-surface)",
                  color: "var(--sw-text)",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                🖨 Imprimir vista / PDF
              </button>
              <button
                type="button"
                onClick={() => void cargar()}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "10px",
                  border: "none",
                  background: "linear-gradient(135deg, var(--sw-accent-2,#f5e19a), var(--sw-accent,#d4af37))",
                  color: "#111",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {loading ? "Actualizando…" : "Actualizar"}
              </button>
            </div>

            <div style={{ marginTop: "0.75rem", fontSize: "0.82rem", color: "var(--sw-muted)" }}>
              💡 Usa <strong style={{ color: "var(--sw-text)" }}>Hoy + trabajador</strong> para responder rápido: “¿qué hizo Fulanito hoy?”
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "0.85rem", marginBottom: "1rem" }}>
          {[
            { label: "Trabajadores", value: empleados.length, color: "var(--sw-accent,#d4af37)" },
            { label: "Activos ahora", value: stats.activos, color: "#22c55e" },
            { label: "Partes", value: stats.totalPartes, color: "#38bdf8" },
            { label: "Tiempo en coches", value: formatMinutes(stats.tiempoCoches), color: "#38bdf8" },
            { label: "Tiempo interno", value: formatMinutes(stats.tiempoInterno), color: "#f59e0b" },
            { label: "Top del período", value: stats.top, color: "var(--sw-text)" },
          ].map((item) => (
            <div key={item.label} style={{ background: "var(--sw-surface)", border: "1px solid var(--sw-border)", borderRadius: 14, padding: "0.95rem 1.05rem" }}>
              <div style={{ fontSize: "0.7rem", color: "var(--sw-muted)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>{item.label}</div>
              <div style={{ fontSize: "1.1rem", fontWeight: 800, color: item.color, marginTop: "0.2rem" }}>{item.value}</div>
            </div>
          ))}
        </div>

        {error && (
          <div style={{ marginBottom: "1rem", padding: "0.85rem 1rem", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5" }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "3rem 0", color: "var(--sw-muted)" }}>Cargando productividad…</div>
        ) : empleados.length === 0 ? (
          <div style={{ background: "var(--sw-surface)", border: "1px solid var(--sw-border)", borderRadius: 14, padding: "2rem", textAlign: "center", color: "var(--sw-muted)" }}>
            No hay actividad registrada para el período seleccionado.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
            {empleados.map((emp) => {
              const parteVisible = emp.parteActiva || emp.ultimaParte;
              return (
                <details
                  key={emp.empleado_id}
                  open
                  className="sw-worker-card"
                  data-print-target={String(emp.empleado_id) === String(printWorkerId) ? "true" : "false"}
                  style={{ background: "var(--sw-surface)", border: "1px solid var(--sw-border)", borderRadius: 16, overflow: "hidden" }}
                >
                  <summary style={{ listStyle: "none", cursor: "pointer", padding: "1rem 1.1rem", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "0.8rem", flexWrap: "wrap", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--sw-text)" }}>👤 {emp.nombre}</div>
                        <div style={{ fontSize: "0.8rem", color: "var(--sw-muted)" }}>{fmtRol(emp.rol)}</div>
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end" }}>
                        <button
                          type="button"
                          className="sw-no-print"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handlePrint(emp.empleado_id);
                          }}
                          style={{
                            padding: "0.38rem 0.7rem",
                            borderRadius: "10px",
                            border: "1px solid var(--sw-border)",
                            background: "var(--sw-surface-2)",
                            color: "var(--sw-text)",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          🖨 Imprimir
                        </button>
                        <EstadoChip estado={emp?.parteActiva?.estado || "finalizado"} />
                        <span style={{ background: "rgba(212,175,55,0.10)", border: "1px solid rgba(212,175,55,0.22)", color: "var(--sw-accent,#d4af37)", borderRadius: 999, padding: "0.22rem 0.65rem", fontSize: "0.74rem", fontWeight: 700 }}>
                          {Number(emp.total_partes || 0)} partes
                        </span>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.5rem", marginTop: "0.8rem" }}>
                      <div style={{ fontSize: "0.8rem", color: "var(--sw-muted)" }}>Total: <strong style={{ color: "var(--sw-text)" }}>{formatMinutes(emp.total_minutos)}</strong></div>
                      <div style={{ fontSize: "0.8rem", color: "var(--sw-muted)" }}>En coches: <strong style={{ color: "#38bdf8" }}>{formatMinutes(emp.total_minutos_coche)}</strong></div>
                      <div style={{ fontSize: "0.8rem", color: "var(--sw-muted)" }}>Interno: <strong style={{ color: "#f59e0b" }}>{formatMinutes(emp.total_minutos_interno)}</strong></div>
                      <div style={{ fontSize: "0.8rem", color: "var(--sw-muted)" }}>Desviación: {deviationView(emp.desviacionTotal, 0)}</div>
                    </div>

                    <div style={{ marginTop: "0.55rem", fontSize: "0.82rem", color: "var(--sw-text)" }}>
                      <strong style={{ color: "var(--sw-muted)" }}>{emp.parteActiva ? "Ahora:" : "Último trabajo:"}</strong>{" "}
                      {parteVisible ? `${fmtActividad(parteVisible)} · ${fmtRegistro(parteVisible)}` : "Sin registros"}
                    </div>
                  </summary>

                  <div style={{ padding: "0.2rem 1rem 1rem", display: "flex", flexDirection: "column", gap: "0.9rem" }}>
                    <div style={{ background: "var(--sw-surface-2)", border: "1px solid var(--sw-border)", borderRadius: 12, padding: "0.8rem 0.9rem" }}>
                      <div style={{ fontSize: "0.7rem", color: "var(--sw-muted)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>Resumen del día</div>
                      <div style={{ marginTop: "0.25rem", color: "var(--sw-text)", fontSize: "0.92rem" }}>
                        <strong>{emp.nombre}</strong> registró <strong>{emp.total_partes}</strong> trabajo(s): <strong>{emp.cochesCount}</strong> en coches y <strong>{emp.internasCount}</strong> internos, con un total de <strong>{formatMinutes(emp.total_minutos)}</strong>.
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: "0.75rem", color: "var(--sw-muted)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: "0.5rem" }}>
                        Qué hizo en el día
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                        {(emp.partesOrdenadas || []).map((p, idx) => (
                          <div
                            key={p.parte_id}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "minmax(0, 1fr) auto",
                              gap: "0.8rem",
                              alignItems: "start",
                              padding: "0.8rem 0.9rem",
                              borderRadius: 12,
                              border: "1px solid var(--sw-border)",
                              background: "rgba(255,255,255,0.02)",
                            }}
                          >
                            <div>
                              <div style={{ color: "var(--sw-text)", fontWeight: 700 }}>
                                {idx + 1}. {fmtActividad(p)}
                              </div>
                              <div style={{ marginTop: "0.18rem", color: "var(--sw-muted)", fontSize: "0.82rem" }}>
                                {fmtRegistro(p)}
                              </div>
                              <div style={{ marginTop: "0.25rem", color: "var(--sw-muted)", fontSize: "0.78rem" }}>
                                ⏰ {fmtTramo(p.fecha_inicio, p.fecha_fin)} · {fmtDate(p.fecha_inicio)}
                              </div>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.35rem", minWidth: 120 }}>
                              <div style={{ color: "var(--sw-accent,#d4af37)", fontWeight: 800 }}>{formatMinutes(p.duracion_minutos)}</div>
                              <EstadoChip estado={p.estado} />
                              <div style={{ color: "var(--sw-muted)", fontSize: "0.75rem" }}>Est.: {formatMinutes(p.tiempo_estimado_minutos)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                        <thead>
                          <tr style={{ background: "var(--sw-surface-2)" }}>
                            {[
                              "Actividad",
                              "Registro",
                              "Estado",
                              "Real",
                              "Est.",
                              "Desv.",
                              "Inicio",
                              "Fin",
                            ].map((h) => (
                              <th key={h} style={{ padding: "0.6rem 0.7rem", textAlign: "left", color: "var(--sw-muted)", fontWeight: 700, fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(emp.partesOrdenadas || []).map((p) => (
                            <tr key={p.parte_id} style={{ borderBottom: "1px solid var(--sw-border)" }}>
                              <td style={{ padding: "0.6rem 0.7rem", color: "var(--sw-text)", fontWeight: 600 }}>{fmtActividad(p)}</td>
                              <td style={{ padding: "0.6rem 0.7rem", color: "var(--sw-muted)" }}>{fmtRegistro(p)}</td>
                              <td style={{ padding: "0.6rem 0.7rem" }}><EstadoChip estado={p.estado} /></td>
                              <td style={{ padding: "0.6rem 0.7rem", color: "var(--sw-accent,#d4af37)", fontWeight: 700 }}>{formatMinutes(p.duracion_minutos)}</td>
                              <td style={{ padding: "0.6rem 0.7rem", color: "var(--sw-muted)" }}>{formatMinutes(p.tiempo_estimado_minutos)}</td>
                              <td style={{ padding: "0.6rem 0.7rem" }}>{deviationView(p.duracion_minutos, p.tiempo_estimado_minutos)}</td>
                              <td style={{ padding: "0.6rem 0.7rem", color: "var(--sw-muted)", whiteSpace: "nowrap" }}>{fmtDate(p.fecha_inicio)}</td>
                              <td style={{ padding: "0.6rem 0.7rem", color: "var(--sw-muted)", whiteSpace: "nowrap" }}>{fmtDate(p.fecha_fin)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
