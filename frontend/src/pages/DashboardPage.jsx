import React, { useContext, useEffect, useState } from "react";
import { Context } from "../store/appContext";

const money = (n) => `${Number(n || 0).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

const KpiCard = ({ label, value, sub, color = "var(--sw-accent)", icon }) => (
  <div className="col-6 col-md-4 col-xl-2">
    <div
      className="p-3 h-100 rounded"
      style={{ background: "var(--sw-surface-2)", border: "1.5px solid var(--sw-accent)" }}
    >
      <div className="small mb-1" style={{ color: "rgba(var(--sw-accent-rgb), 0.7)" }}>
        {icon} {label}
      </div>
      <div className="fw-bold fs-5" style={{ color }}>
        {value}
      </div>
      {sub && (
        <div className="small mt-1" style={{ color: "var(--sw-muted)" }}>
          {sub}
        </div>
      )}
    </div>
  </div>
);

const SectionTitle = ({ children }) => (
  <h5
    className="fw-bold mb-3 pb-2 sw-accent-text"
    style={{ borderBottom: "2px solid var(--sw-accent)" }}
  >
    {children}
  </h5>
);

const BAR_COLORS = [
  "var(--sw-accent)","#c9a227","#be9517","#b38807","#a87b00",
  "#9d6e00","#926100","#875400","#7c4700","#713a00",
  "#663d00","#5b3000",
];

const MiniBar = ({ label, value, max, index }) => {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="mb-2">
      <div className="d-flex justify-content-between small mb-1" style={{ color: "var(--sw-muted)" }}>
        <span>{label}</span>
        <span style={{ color: "var(--sw-accent)" }}>{money(value)}</span>
      </div>
      <div style={{ background: "var(--sw-surface-light)", borderRadius: 4, height: 8 }}>
        <div
          style={{
            width: `${pct}%`,
            height: 8,
            borderRadius: 4,
            background: BAR_COLORS[index % BAR_COLORS.length],
            transition: "width 0.6s ease",
          }}
        />
      </div>
    </div>
  );
};

export default function DashboardPage() {
  const { actions } = useContext(Context);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [anio, setAnio] = useState(new Date().getFullYear());

  const [exporting, setExporting] = useState(false);

  const exportarExcel = async () => {
    setExporting(true);
    try {
      const { getApiBase } = await import("../utils/apiBase");
      const token =
        sessionStorage.getItem("token") || localStorage.getItem("token");
      const res = await fetch(
        `${getApiBase()}/api/export/excel?anio=${anio}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
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

  const maxMes = data
    ? Math.max(...data.facturacion_mensual.map((m) => m.total), 1)
    : 1;
  const maxCliente = data
    ? Math.max(...data.top_clientes.map((c) => c.total), 1)
    : 1;

  return (
    <div className="container-fluid py-4" style={{ background: "var(--sw-bg)", minHeight: "100vh" }}>
      {/* ── Cabecera ── */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4 px-2">
        <div>
          <div className="small text-uppercase mb-1" style={{ color: "rgba(var(--sw-accent-rgb), 0.7)", letterSpacing: "0.08em" }}>
            Panel interno · SpecialWash
          </div>
          <h2 className="fw-bold mb-0 sw-accent-text">
            Dashboard
          </h2>
        </div>
        <div className="d-flex align-items-center gap-2">
          <label className="small mb-0" style={{ color: "var(--sw-accent)" }}>Año</label>
          <select
            className="form-select form-select-sm"
            style={{ width: 100, background: "var(--sw-surface-2)", color: "var(--sw-accent)", border: "1px solid var(--sw-accent)" }}
            value={anio}
            onChange={(e) => setAnio(Number(e.target.value))}
          >
            {[2024, 2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            className="btn btn-sm sw-btn-accent-gold"
            onClick={() => cargar(anio)}
            disabled={loading}
          >
            {loading ? "..." : "↺ Actualizar"}
          </button>
          <button
            className="btn btn-sm"
            style={{ background: "var(--sw-success)", color: "var(--sw-text-on-accent)", fontWeight: "bold" }}
            onClick={exportarExcel}
            disabled={exporting || loading}
          >
            <i className="fas fa-file-excel me-1"></i>{exporting ? "Generando..." : "Excel"}
          </button>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="alert alert-danger mx-2">{error}</div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="text-center py-5">
          <div className="spinner-border" style={{ color: "var(--sw-accent)" }} />
          <div className="mt-2 small" style={{ color: "var(--sw-accent)" }}>Cargando datos...</div>
        </div>
      )}

      {/* ── Contenido ── */}
      {!loading && data && (
        <>
          {/* KPIs */}
          <div className="row g-2 mb-4 px-2">
            <KpiCard
              label="Total año"
              value={money(data.kpis.total_anio)}
              sub={`${data.kpis.trabajos_anio} trabajos`}
              icon="💰"
            />
            <KpiCard
              label={data.kpis.mes_actual_label}
              value={money(data.kpis.total_mes_actual)}
              sub={
                data.kpis.variacion_vs_mes_anterior >= 0
                  ? `▲ ${data.kpis.variacion_vs_mes_anterior}% vs mes anterior`
                  : `▼ ${Math.abs(data.kpis.variacion_vs_mes_anterior)}% vs mes anterior`
              }
              color={data.kpis.variacion_vs_mes_anterior >= 0 ? "var(--sw-success)" : "var(--sw-danger)"}
              icon="📅"
            />
            <KpiCard
              label="Gastos año"
              value={money(data.kpis.total_gastos_anio)}
              icon="📤"
              color="var(--sw-danger)"
            />
            <KpiCard
              label="Beneficio estimado"
              value={money(data.kpis.beneficio_estimado)}
              icon="📈"
              color={data.kpis.beneficio_estimado >= 0 ? "var(--sw-success)" : "var(--sw-danger)"}
            />
            <KpiCard
              label="Pendiente cobro"
              value={money(data.kpis.total_pendiente_cobro)}
              sub={`${data.cobros_pendientes.length} facturas`}
              color={data.kpis.total_pendiente_cobro > 0 ? "var(--sw-warning)" : "var(--sw-success)"}
              icon="⏳"
            />
            <KpiCard
              label="Alertas entrega"
              value={`${data.kpis.alertas_entrega_count} coches`}
              sub="En taller +3 días"
              color={data.kpis.alertas_entrega_count > 0 ? "var(--sw-danger)" : "var(--sw-success)"}
              icon="🚨"
            />
          </div>

          {/* Facturación mensual + Top clientes */}
          <div className="row g-3 mb-4 px-2">
            {/* Gráfico mensual */}
            <div className="col-12 col-lg-7">
              <div
                className="p-3 rounded h-100"
                style={{ background: "var(--sw-surface-2)", border: "1.5px solid var(--sw-accent)" }}
              >
                <SectionTitle>📊 Facturación mensual {anio}</SectionTitle>
                <div className="d-flex align-items-end gap-1" style={{ height: 140 }}>
                  {data.facturacion_mensual.map((m) => {
                    const pct = maxMes > 0 ? (m.total / maxMes) * 100 : 0;
                    const isCurrentMonth = m.mes === new Date().getMonth() + 1;
                    return (
                      <div
                        key={m.mes}
                        className="d-flex flex-column align-items-center flex-fill"
                        title={`${m.mes_label}: ${money(m.total)}`}
                      >
                        <div
                          className="w-100"
                          style={{
                            height: `${Math.max(pct, m.total > 0 ? 4 : 0)}%`,
                            background: isCurrentMonth ? "#fff" : "var(--sw-accent)",
                            borderRadius: "3px 3px 0 0",
                            opacity: m.total > 0 ? 1 : 0.15,
                            minHeight: m.total > 0 ? 4 : 0,
                            transition: "height 0.5s ease",
                          }}
                        />
                        <div
                          className="small mt-1 text-center"
                          style={{
                            color: isCurrentMonth ? "#fff" : "rgba(var(--sw-accent-rgb), 0.6)",
                            fontSize: 9,
                            lineHeight: 1.2,
                          }}
                        >
                          {m.mes_label.slice(0, 3)}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Leyenda importe */}
                <div className="d-flex justify-content-between mt-2">
                  <span className="small" style={{ color: "rgba(255,255,255,0.3)", fontSize: 10 }}>0 €</span>
                  <span className="small" style={{ color: "rgba(var(--sw-accent-rgb), 0.5)", fontSize: 10 }}>
                    máx {money(maxMes)}
                  </span>
                </div>
              </div>
            </div>

            {/* Top clientes */}
            <div className="col-12 col-lg-5">
              <div
                className="p-3 rounded h-100"
                style={{ background: "var(--sw-surface-2)", border: "1.5px solid var(--sw-accent)" }}
              >
                <SectionTitle>🏆 Top clientes</SectionTitle>
                {data.top_clientes.length === 0 ? (
                  <p className="small" style={{ color: "var(--sw-muted)" }}>Sin datos</p>
                ) : (
                  data.top_clientes.map((c, i) => (
                    <MiniBar
                      key={c.cliente_id}
                      label={c.nombre}
                      value={c.total}
                      max={maxCliente}
                      index={i}
                    />
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Top servicios + Cobros pendientes */}
          <div className="row g-3 mb-4 px-2">
            {/* Top servicios */}
            <div className="col-12 col-lg-5">
              <div
                className="p-3 rounded h-100"
                style={{ background: "var(--sw-surface-2)", border: "1.5px solid var(--sw-accent)" }}
              >
                <SectionTitle>🛠️ Top servicios</SectionTitle>
                {data.top_servicios.length === 0 ? (
                  <p className="small" style={{ color: "var(--sw-muted)" }}>Sin datos</p>
                ) : (
                  <table className="table table-sm mb-0" style={{ color: "var(--sw-text)" }}>
                    <thead>
                      <tr style={{ borderColor: "var(--sw-border)" }}>
                        <th style={{ color: "var(--sw-accent)", fontWeight: 500, fontSize: 12 }}>Servicio</th>
                        <th className="text-center" style={{ color: "var(--sw-accent)", fontWeight: 500, fontSize: 12 }}>Veces</th>
                        <th className="text-end" style={{ color: "var(--sw-accent)", fontWeight: 500, fontSize: 12 }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.top_servicios.map((s, i) => (
                        <tr key={i} style={{ borderColor: "var(--sw-border)", fontSize: 12 }}>
                          <td style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {s.tipo_servicio}
                          </td>
                          <td className="text-center">
                            <span
                              className="badge sw-btn-accent-gold"
                            >
                              {s.count}
                            </span>
                          </td>
                          <td className="text-end sw-accent-text">
                            {money(s.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Cobros pendientes */}
            <div className="col-12 col-lg-7">
              <div
                className="p-3 rounded h-100"
                style={{ background: "var(--sw-surface-2)", border: "1.5px solid var(--sw-danger)" }}
              >
                <SectionTitle>⏳ Cobros pendientes</SectionTitle>
                {data.cobros_pendientes.length === 0 ? (
                  <div className="d-flex align-items-center gap-2" style={{ color: "var(--sw-success)" }}>
                    <span>✅</span>
                    <span className="small">Todo cobrado. Sin pendientes.</span>
                  </div>
                ) : (
                  <div style={{ maxHeight: 220, overflowY: "auto" }}>
                    <table className="table table-sm mb-0" style={{ color: "var(--sw-text)" }}>
                      <thead>
                        <tr style={{ borderColor: "var(--sw-border)" }}>
                          <th style={{ color: "var(--sw-accent)", fontWeight: 500, fontSize: 12 }}>Cliente</th>
                          <th style={{ color: "var(--sw-accent)", fontWeight: 500, fontSize: 12 }}>Matrícula</th>
                          <th className="text-end" style={{ color: "var(--sw-accent)", fontWeight: 500, fontSize: 12 }}>Pendiente</th>
                          <th style={{ color: "var(--sw-accent)", fontWeight: 500, fontSize: 12 }}>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.cobros_pendientes.map((c) => (
                          <tr key={c.inspeccion_id} style={{ borderColor: "var(--sw-border)", fontSize: 12 }}>
                            <td style={{ maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {c.cliente_nombre}
                            </td>
                            <td>
                      <span className="badge" style={{ background: "var(--sw-surface-light)", color: "var(--sw-text)", border: "1px solid var(--sw-border)" }}>
                                {c.matricula}
                              </span>
                            </td>
                      <td className="text-end fw-bold" style={{ color: "var(--sw-danger)" }}>
                              {money(c.importe_pendiente)}
                            </td>
                            <td>
                              <span
                                className="badge"
                                style={{
                                  background: c.cobro_estado === "parcial" ? "var(--sw-warning)" : "var(--sw-danger)",
                                  color: "var(--sw-text-on-accent)",
                                  fontSize: 10,
                                }}
                              >
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
          </div>

          {/* Alertas entrega */}
          {data.alertas_entrega.length > 0 && (
            <div className="px-2 mb-4">
              <div
                className="p-3 rounded"
                style={{ background: "var(--sw-surface-2)", border: "1.5px solid var(--sw-warning)" }}
              >
                <SectionTitle>🚨 Coches en taller +3 días sin entregar</SectionTitle>
                <div className="row g-2">
                  {data.alertas_entrega.map((a) => (
                    <div key={a.inspeccion_id} className="col-12 col-md-6 col-xl-4">
                      <div
                        className="p-2 rounded d-flex justify-content-between align-items-center"
                        style={{ background: "var(--sw-surface-light)", border: "1px solid var(--sw-warning)" }}
                      >
                        <div>
                          <div className="fw-bold small" style={{ color: "#fff" }}>
                            {a.cliente_nombre}
                          </div>
                          <div className="small" style={{ color: "var(--sw-muted)" }}>
                            {a.coche_descripcion}
                          </div>
                        </div>
                        <div className="text-end">
                          <span className="badge" style={{ background: "var(--sw-surface-light)", color: "var(--sw-text)", border: "1px solid var(--sw-border)" }}>
                            {a.matricula}
                          </span>
                          <div
                            className="small mt-1 fw-bold"
                            style={{ color: a.dias_en_taller > 7 ? "var(--sw-danger)" : "var(--sw-warning)" }}
                          >
                            {a.dias_en_taller}d en taller
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}