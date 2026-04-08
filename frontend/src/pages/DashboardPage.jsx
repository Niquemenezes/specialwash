import React, { useContext, useEffect, useState } from "react";
import { Context } from "../store/appContext";

const money = (n) => `${Number(n || 0).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

/* ── Iconos SVG ─────────────────────────────────────────────────── */
const ICONS = {
  dashboard: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>),
  refresh:   (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>),
  excel:     (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>),
  money:     (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>),
  calendar:  (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>),
  expenses:  (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M22 17H2a3 3 0 0 0 3-3V5a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v12a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3z"/><path d="M18 8h2a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><circle cx="13" cy="12" r="2"/></svg>),
  trending:  (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>),
  clock:     (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>),
  alert:     (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>),
  trophy:    (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="8 21 12 17 16 21"/><line x1="12" y1="17" x2="12" y2="11"/><path d="M7 4H4a1 1 0 0 0-1 1v3a4 4 0 0 0 4 4h10a4 4 0 0 0 4-4V5a1 1 0 0 0-1-1h-3"/><path d="M7 4h10a2 2 0 0 1 2 2v1H5V6a2 2 0 0 1 2-2z"/></svg>),
  tools:     (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>),
  car:       (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="11" width="20" height="9" rx="2"/><path d="M5 11V9a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2"/><circle cx="7" cy="20" r="1"/><circle cx="17" cy="20" r="1"/></svg>),
  check:     (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>),
  close:     (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>),
};

const BAR_COLORS = [
  "var(--sw-accent)","#c9a227","#be9517","#b38807","#a87b00",
  "#9d6e00","#926100","#875400","#7c4700","#713a00",
];

export default function DashboardPage() {
  const { actions } = useContext(Context);
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [anio, setAnio]         = useState(new Date().getFullYear());
  const [exporting, setExporting] = useState(false);

  const exportarExcel = async () => {
    setExporting(true);
    try {
      const { getApiBase } = await import("../utils/apiBase");
      const token = sessionStorage.getItem("token") || localStorage.getItem("token");
      const res = await fetch(`${getApiBase()}/api/export/excel?anio=${anio}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Error al generar el Excel");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `SpecialWash_${anio}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err?.message || "No se pudo descargar el Excel");
    } finally {
      setExporting(false);
    }
  };

  const cargar = async (year) => {
    setLoading(true);
    setError(null);
    try {
      const res = await actions.getDashboard(year);
      setData(res);
    } catch (err) {
      setError(err?.message || "Error al cargar el dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar(anio);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anio]);

  const maxMes     = data ? Math.max(...data.facturacion_mensual.map((m) => m.total), 1) : 1;
  const maxCliente = data ? Math.max(...data.top_clientes.map((c) => c.total), 1) : 1;

  return (
    <div className="sw-ent-wrapper">

      {/* ── Hero ──────────────────────────────────────────────────── */}
      <div className="sw-veh-hero">
        <div className="sw-veh-hero-inner container">
          <div className="sw-veh-hero-body">
            <div className="sw-veh-hero-icon">
              <span style={{ width: 24, height: 24, display: "flex" }}>{ICONS.dashboard}</span>
            </div>
            <div style={{ flex: 1 }}>
              <p className="sw-home-eyebrow" style={{ marginBottom: "0.2rem" }}>Panel interno · SpecialWash</p>
              <h1 className="sw-veh-hero-title">Dashboard</h1>
              <p className="sw-veh-hero-sub">Resumen de facturación, cobros y actividad del taller</p>
            </div>
            {/* Selector año + botones */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <label style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--sw-accent,#d4af37)", letterSpacing: "0.05em" }}>AÑO</label>
                <select
                  className="form-select sw-pinput"
                  style={{ width: 90, padding: "0.4rem 0.6rem", fontSize: "0.88rem", fontWeight: 700 }}
                  value={anio}
                  onChange={(e) => setAnio(Number(e.target.value))}
                >
                  {[2024, 2025, 2026, 2027].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <button
                className="sw-ent-submit-btn"
                onClick={() => cargar(anio)}
                disabled={loading}
                style={{ padding: "0.5rem 1rem", display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.85rem" }}
              >
                <span style={{ width: 14, height: 14, display: "inline-flex" }}>{ICONS.refresh}</span>
                {loading ? "…" : "Actualizar"}
              </button>
              <button
                onClick={exportarExcel}
                disabled={exporting || loading}
                style={{
                  background: "color-mix(in srgb,#22c55e 14%,transparent)",
                  border: "1px solid color-mix(in srgb,#22c55e 35%,transparent)",
                  color: "#22c55e", borderRadius: 10,
                  padding: "0.5rem 1rem", cursor: "pointer",
                  fontWeight: 700, fontSize: "0.85rem",
                  display: "flex", alignItems: "center", gap: "0.4rem",
                }}
              >
                <span style={{ width: 14, height: 14, display: "inline-flex" }}>{ICONS.excel}</span>
                {exporting ? "Generando…" : "Excel"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container sw-ent-content" style={{ maxWidth: 1200 }}>

        {/* ── Error ─────────────────────────────────────────────── */}
        {error && (
          <div style={{
            background: "color-mix(in srgb,var(--sw-danger,#ef4444) 12%,transparent)",
            border: "1px solid color-mix(in srgb,var(--sw-danger,#ef4444) 30%,transparent)",
            color: "var(--sw-danger,#ef4444)", borderRadius: 12, padding: "0.75rem 1rem",
            display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.9rem",
          }}>
            {error}
            <button onClick={() => setError(null)} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", display: "flex" }}>
              <span style={{ width: 18, height: 18, display: "flex" }}>{ICONS.close}</span>
            </button>
          </div>
        )}

        {/* ── Loading ───────────────────────────────────────────── */}
        {loading && (
          <div style={{ textAlign: "center", padding: "5rem 0" }}>
            <div className="spinner-border" style={{ color: "var(--sw-accent,#d4af37)" }} role="status">
              <span className="visually-hidden">Cargando…</span>
            </div>
            <p style={{ color: "var(--sw-muted)", marginTop: "1rem", fontSize: "0.88rem" }}>Cargando datos del dashboard…</p>
          </div>
        )}

        {/* ── Contenido ─────────────────────────────────────────── */}
        {!loading && data && (
          <>
            {/* ── KPIs ──────────────────────────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: "1rem" }}>
              {[
                {
                  label: "Total año",
                  value: money(data.kpis.total_anio),
                  sub: `${data.kpis.trabajos_anio} trabajos`,
                  color: "var(--sw-accent,#d4af37)",
                  icon: ICONS.money,
                  iconColor: "var(--sw-accent,#d4af37)",
                },
                {
                  label: data.kpis.mes_actual_label,
                  value: money(data.kpis.total_mes_actual),
                  sub: data.kpis.variacion_vs_mes_anterior >= 0
                    ? `▲ ${data.kpis.variacion_vs_mes_anterior}% vs anterior`
                    : `▼ ${Math.abs(data.kpis.variacion_vs_mes_anterior)}% vs anterior`,
                  color: data.kpis.variacion_vs_mes_anterior >= 0 ? "#22c55e" : "var(--sw-danger,#ef4444)",
                  icon: ICONS.calendar,
                  iconColor: "#38bdf8",
                },
                {
                  label: "Gastos año",
                  value: money(data.kpis.total_gastos_anio),
                  sub: null,
                  color: "var(--sw-danger,#ef4444)",
                  icon: ICONS.expenses,
                  iconColor: "var(--sw-danger,#ef4444)",
                },
                {
                  label: "Beneficio estimado",
                  value: money(data.kpis.beneficio_estimado),
                  sub: null,
                  color: data.kpis.beneficio_estimado >= 0 ? "#22c55e" : "var(--sw-danger,#ef4444)",
                  icon: ICONS.trending,
                  iconColor: "#22c55e",
                },
                {
                  label: "Pendiente cobro",
                  value: money(data.kpis.total_pendiente_cobro),
                  sub: `${data.cobros_pendientes.length} facturas`,
                  color: data.kpis.total_pendiente_cobro > 0 ? "#f59e0b" : "#22c55e",
                  icon: ICONS.clock,
                  iconColor: "#f59e0b",
                },
                {
                  label: "Alertas entrega",
                  value: `${data.kpis.alertas_entrega_count} coches`,
                  sub: "En taller +3 días",
                  color: data.kpis.alertas_entrega_count > 0 ? "var(--sw-danger,#ef4444)" : "#22c55e",
                  icon: ICONS.alert,
                  iconColor: data.kpis.alertas_entrega_count > 0 ? "var(--sw-danger,#ef4444)" : "#22c55e",
                },
              ].map((kpi) => (
                <div key={kpi.label} style={{
                  background: "var(--sw-surface)", border: "1px solid var(--sw-border)",
                  borderRadius: 16, padding: "1.1rem 1.25rem",
                  display: "flex", flexDirection: "column", gap: "0.5rem",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.14)",
                  transition: "transform 0.15s, box-shadow 0.15s",
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.22)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.14)"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--sw-muted)" }}>{kpi.label}</span>
                    <span style={{ width: 16, height: 16, display: "flex", color: kpi.iconColor, opacity: 0.75 }}>{kpi.icon}</span>
                  </div>
                  <span style={{ fontSize: "1.35rem", fontWeight: 800, color: kpi.color, lineHeight: 1.1 }}>{kpi.value}</span>
                  {kpi.sub && <span style={{ fontSize: "0.72rem", color: "var(--sw-muted)" }}>{kpi.sub}</span>}
                </div>
              ))}
            </div>

            {/* ── Gráfico mensual + Top clientes ────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>

              {/* Barras mensuales */}
              <div style={{
                background: "var(--sw-surface)", border: "1px solid var(--sw-border)",
                borderRadius: 16, padding: "1.5rem",
                boxShadow: "0 2px 12px rgba(0,0,0,0.14)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem" }}>
                  <span style={{ width: 18, height: 18, display: "flex", color: "var(--sw-accent,#d4af37)" }}>{ICONS.money}</span>
                  <h3 style={{ margin: 0, fontSize: "0.92rem", fontWeight: 700, color: "var(--sw-text)" }}>
                    Facturación mensual <span style={{ color: "var(--sw-accent,#d4af37)" }}>{anio}</span>
                  </h3>
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: "0.35rem", height: 130 }}>
                  {data.facturacion_mensual.map((m) => {
                    const pct = maxMes > 0 ? (m.total / maxMes) * 100 : 0;
                    const esMesActual = m.mes === new Date().getMonth() + 1 && anio === new Date().getFullYear();
                    return (
                      <div key={m.mes} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }} title={`${m.mes_label}: ${money(m.total)}`}>
                        <div style={{
                          width: "100%",
                          height: `${Math.max(pct, m.total > 0 ? 5 : 0)}%`,
                          background: esMesActual
                            ? "linear-gradient(180deg,#fff 0%,var(--sw-accent,#d4af37) 100%)"
                            : `linear-gradient(180deg,var(--sw-accent,#d4af37) 0%,color-mix(in srgb,var(--sw-accent,#d4af37) 55%,transparent) 100%)`,
                          borderRadius: "4px 4px 0 0",
                          opacity: m.total > 0 ? 1 : 0.12,
                          minHeight: m.total > 0 ? 4 : 0,
                          transition: "height 0.5s ease",
                        }} />
                        <div style={{
                          fontSize: 9, marginTop: 4, lineHeight: 1.2, textAlign: "center",
                          color: esMesActual ? "var(--sw-accent,#d4af37)" : "var(--sw-muted)",
                          fontWeight: esMesActual ? 700 : 400,
                        }}>
                          {m.mes_label.slice(0, 3)}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.5rem" }}>
                  <span style={{ fontSize: "0.65rem", color: "var(--sw-muted)" }}>0 €</span>
                  <span style={{ fontSize: "0.65rem", color: "var(--sw-muted)" }}>máx {money(maxMes)}</span>
                </div>
              </div>

              {/* Top clientes */}
              <div style={{
                background: "var(--sw-surface)", border: "1px solid var(--sw-border)",
                borderRadius: 16, padding: "1.5rem",
                boxShadow: "0 2px 12px rgba(0,0,0,0.14)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem" }}>
                  <span style={{ width: 18, height: 18, display: "flex", color: "var(--sw-accent,#d4af37)" }}>{ICONS.trophy}</span>
                  <h3 style={{ margin: 0, fontSize: "0.92rem", fontWeight: 700, color: "var(--sw-text)" }}>
                    Top clientes
                  </h3>
                </div>
                {data.top_clientes.length === 0 ? (
                  <p style={{ color: "var(--sw-muted)", fontSize: "0.85rem" }}>Sin datos</p>
                ) : (
                  data.top_clientes.map((c, i) => {
                    const pct = maxCliente > 0 ? (c.total / maxCliente) * 100 : 0;
                    return (
                      <div key={c.cliente_id} style={{ marginBottom: "0.75rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
                          <span style={{ fontSize: "0.82rem", color: "var(--sw-text)", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "65%" }}>{c.nombre}</span>
                          <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--sw-accent,#d4af37)" }}>{money(c.total)}</span>
                        </div>
                        <div style={{ background: "var(--sw-surface-2)", borderRadius: 4, height: 7 }}>
                          <div style={{
                            width: `${pct}%`, height: 7, borderRadius: 4,
                            background: BAR_COLORS[i % BAR_COLORS.length],
                            transition: "width 0.6s ease",
                          }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* ── Top servicios + Cobros pendientes ─────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "1.25rem" }}>

              {/* Top servicios */}
              <div style={{
                background: "var(--sw-surface)", border: "1px solid var(--sw-border)",
                borderRadius: 16, padding: "1.5rem",
                boxShadow: "0 2px 12px rgba(0,0,0,0.14)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem" }}>
                  <span style={{ width: 18, height: 18, display: "flex", color: "var(--sw-accent,#d4af37)" }}>{ICONS.tools}</span>
                  <h3 style={{ margin: 0, fontSize: "0.92rem", fontWeight: 700, color: "var(--sw-text)" }}>Top servicios</h3>
                </div>
                {data.top_servicios.length === 0 ? (
                  <p style={{ color: "var(--sw-muted)", fontSize: "0.85rem" }}>Sin datos</p>
                ) : (
                  <table className="table align-middle mb-0" style={{ color: "var(--sw-text)" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--sw-border)" }}>
                        {["Servicio", "Veces", "Total"].map((h, i) => (
                          <th key={h} style={{ padding: "0.5rem 0.6rem", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--sw-muted)", border: "none", textAlign: i === 2 ? "right" : i === 1 ? "center" : "left" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.top_servicios.map((s, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid var(--sw-border)" }}>
                          <td style={{ padding: "0.55rem 0.6rem", fontSize: "0.82rem", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {s.tipo_servicio}
                          </td>
                          <td style={{ padding: "0.55rem 0.6rem", textAlign: "center" }}>
                            <span style={{
                              background: "color-mix(in srgb,var(--sw-accent,#d4af37) 14%,transparent)",
                              border: "1px solid color-mix(in srgb,var(--sw-accent,#d4af37) 28%,transparent)",
                              color: "var(--sw-accent,#d4af37)", borderRadius: 6,
                              padding: "0.1rem 0.5rem", fontWeight: 700, fontSize: "0.72rem",
                            }}>{s.count}</span>
                          </td>
                          <td style={{ padding: "0.55rem 0.6rem", textAlign: "right", fontWeight: 700, color: "var(--sw-accent,#d4af37)", fontSize: "0.82rem" }}>
                            {money(s.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Cobros pendientes */}
              <div style={{
                background: "var(--sw-surface)",
                border: "1px solid color-mix(in srgb,var(--sw-danger,#ef4444) 35%,var(--sw-border))",
                borderRadius: 16, padding: "1.5rem",
                boxShadow: "0 2px 12px rgba(0,0,0,0.14)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem" }}>
                  <span style={{ width: 18, height: 18, display: "flex", color: "var(--sw-danger,#ef4444)" }}>{ICONS.clock}</span>
                  <h3 style={{ margin: 0, fontSize: "0.92rem", fontWeight: 700, color: "var(--sw-text)" }}>Cobros pendientes</h3>
                </div>
                {data.cobros_pendientes.length === 0 ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", color: "#22c55e", fontSize: "0.88rem" }}>
                    <span style={{ width: 18, height: 18, display: "flex" }}>{ICONS.check}</span>
                    Todo cobrado. Sin pendientes.
                  </div>
                ) : (
                  <div style={{ maxHeight: 240, overflowY: "auto" }}>
                    <table className="table align-middle mb-0" style={{ color: "var(--sw-text)" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid var(--sw-border)" }}>
                          {["Cliente", "Matrícula", "Pendiente", "Estado"].map((h, i) => (
                            <th key={h} style={{ padding: "0.5rem 0.6rem", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--sw-muted)", border: "none", textAlign: i === 2 ? "right" : "left" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.cobros_pendientes.map((c) => (
                          <tr key={c.inspeccion_id} style={{ borderBottom: "1px solid var(--sw-border)" }}>
                            <td style={{ padding: "0.6rem 0.6rem", fontSize: "0.82rem", maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {c.cliente_nombre}
                            </td>
                            <td style={{ padding: "0.6rem 0.6rem" }}>
                              <span style={{
                                background: "color-mix(in srgb,#38bdf8 12%,transparent)",
                                border: "1px solid color-mix(in srgb,#38bdf8 28%,transparent)",
                                color: "#38bdf8", borderRadius: 6,
                                padding: "0.1rem 0.5rem", fontWeight: 700, fontSize: "0.72rem",
                                display: "inline-flex", alignItems: "center", gap: "0.25rem",
                              }}>
                                <span style={{ width: 10, height: 10, display: "inline-flex", opacity: 0.7 }}>{ICONS.car}</span>
                                {c.matricula}
                              </span>
                            </td>
                            <td style={{ padding: "0.6rem 0.6rem", textAlign: "right", fontWeight: 800, color: "var(--sw-danger,#ef4444)", fontSize: "0.85rem" }}>
                              {money(c.importe_pendiente)}
                            </td>
                            <td style={{ padding: "0.6rem 0.6rem" }}>
                              <span style={{
                                background: c.cobro_estado === "parcial"
                                  ? "color-mix(in srgb,#f59e0b 14%,transparent)"
                                  : "color-mix(in srgb,var(--sw-danger,#ef4444) 14%,transparent)",
                                border: c.cobro_estado === "parcial"
                                  ? "1px solid color-mix(in srgb,#f59e0b 30%,transparent)"
                                  : "1px solid color-mix(in srgb,var(--sw-danger,#ef4444) 30%,transparent)",
                                color: c.cobro_estado === "parcial" ? "#f59e0b" : "var(--sw-danger,#ef4444)",
                                borderRadius: 6, padding: "0.1rem 0.5rem",
                                fontWeight: 700, fontSize: "0.7rem", textTransform: "capitalize",
                              }}>
                                {c.cobro_estado}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* ── Alertas entrega ───────────────────────────────── */}
            {data.alertas_entrega.length > 0 && (
              <div style={{
                background: "var(--sw-surface)",
                border: "1px solid color-mix(in srgb,#f59e0b 35%,var(--sw-border))",
                borderRadius: 16, padding: "1.5rem",
                boxShadow: "0 2px 12px rgba(0,0,0,0.14)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem" }}>
                  <span style={{ width: 18, height: 18, display: "flex", color: "#f59e0b" }}>{ICONS.alert}</span>
                  <h3 style={{ margin: 0, fontSize: "0.92rem", fontWeight: 700, color: "var(--sw-text)" }}>
                    Coches en taller +3 días sin entregar
                    <span style={{
                      marginLeft: "0.6rem", background: "color-mix(in srgb,var(--sw-danger,#ef4444) 14%,transparent)",
                      border: "1px solid color-mix(in srgb,var(--sw-danger,#ef4444) 30%,transparent)",
                      color: "var(--sw-danger,#ef4444)", borderRadius: 6,
                      padding: "0.1rem 0.55rem", fontWeight: 700, fontSize: "0.72rem",
                    }}>{data.alertas_entrega.length}</span>
                  </h3>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: "0.75rem" }}>
                  {data.alertas_entrega.map((a) => (
                    <div key={a.inspeccion_id} style={{
                      background: "var(--sw-surface-2)",
                      border: `1px solid color-mix(in srgb,${a.dias_en_taller > 7 ? "var(--sw-danger,#ef4444)" : "#f59e0b"} 28%,var(--sw-border))`,
                      borderRadius: 12, padding: "0.9rem 1rem",
                      display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem",
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--sw-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {a.cliente_nombre}
                        </div>
                        <div style={{ fontSize: "0.78rem", color: "var(--sw-muted)", marginTop: "0.15rem" }}>
                          {a.coche_descripcion}
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <span style={{
                          background: "color-mix(in srgb,#38bdf8 12%,transparent)",
                          border: "1px solid color-mix(in srgb,#38bdf8 28%,transparent)",
                          color: "#38bdf8", borderRadius: 6,
                          padding: "0.1rem 0.5rem", fontWeight: 700, fontSize: "0.72rem",
                        }}>{a.matricula}</span>
                        <div style={{
                          fontSize: "0.78rem", fontWeight: 800, marginTop: "0.3rem",
                          color: a.dias_en_taller > 7 ? "var(--sw-danger,#ef4444)" : "#f59e0b",
                        }}>
                          {a.dias_en_taller}d en taller
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </>
        )}
      </div>
    </div>
  );
}
