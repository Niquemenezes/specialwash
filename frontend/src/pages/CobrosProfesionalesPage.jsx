import React, { useContext, useEffect, useMemo, useState } from "react";
import { Context } from "../store/appContext";
import { confirmar } from "../utils/confirmar";

const money = (n) => `${Number(n || 0).toFixed(2)} €`;
const COBRO_METODOS = ["transferencia", "efectivo", "bizum", "tarjeta"];

/* ── Iconos SVG ─────────────────────────────────────────────────── */
const ICONS = {
  cobros:   (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>),
  refresh:  (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>),
  check:    (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>),
  warning:  (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>),
  user:     (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>),
  car:      (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="11" width="20" height="9" rx="2"/><path d="M5 11V9a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2"/><circle cx="7" cy="20" r="1"/><circle cx="17" cy="20" r="1"/></svg>),
  close:    (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>),
};

export default function CobrosProfesionalesPage() {
  const { actions } = useContext(Context);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [actionError, setActionError] = useState("");
  const [soloPendientes, setSoloPendientes] = useState(true);
  const [clientes, setClientes] = useState([]);
  const [abonos, setAbonos] = useState({});
  const [cobroMeta, setCobroMeta] = useState({});

  const cargar = async (nextSoloPendientes = soloPendientes) => {
    setLoading(true);
    try {
      const data = await actions.getCobrosProfesionales({ soloPendientes: nextSoloPendientes });
      setClientes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("cargar cobros profesionales:", err);
      setClientes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar(soloPendientes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soloPendientes]);

  const resumen = useMemo(() => {
    return (clientes || []).reduce(
      (acc, c) => {
        acc.facturado += Number(c.total_facturado || 0);
        acc.pagado += Number(c.total_pagado || 0);
        acc.pendiente += Number(c.total_pendiente || 0);
        return acc;
      },
      { facturado: 0, pagado: 0, pendiente: 0 }
    );
  }, [clientes]);

  const onChangeAbono = (inspeccionId, value) => {
    setAbonos((prev) => ({ ...prev, [inspeccionId]: value }));
  };

  const onChangeCobroMeta = (inspeccionId, field, value) => {
    setCobroMeta((prev) => ({
      ...prev,
      [inspeccionId]: {
        metodo: prev[inspeccionId]?.metodo || "transferencia",
        referencia: prev[inspeccionId]?.referencia || "",
        [field]: value,
      },
    }));
  };

  const registrarAbono = async (inspeccionId) => {
    const importe = Number(abonos[inspeccionId]);
    if (!Number.isFinite(importe) || importe < 0) {
      setActionError("El importe debe ser válido y mayor o igual a 0");
      return;
    }
    setActionError("");

    setSavingId(inspeccionId);
    try {
      const metodo = cobroMeta[inspeccionId]?.metodo || "transferencia";
      const referencia = (cobroMeta[inspeccionId]?.referencia || "").trim();
      await actions.registrarCobroInspeccion(inspeccionId, {
        accion: "abono",
        importe,
        metodo,
        referencia,
      });
      setAbonos((prev) => ({ ...prev, [inspeccionId]: "" }));
      await cargar(soloPendientes);
    } catch (err) {
      setActionError(`No se pudo registrar el abono: ${err?.message || "error"}`);
    } finally {
      setSavingId(null);
    }
  };

  const marcarPagado = async (inspeccionId) => {
    if (!await confirmar("¿Marcar esta inspección como pagada al 100%?", { danger: false, labelConfirmar: "Sí, marcar pagada" })) return;

    setSavingId(inspeccionId);
    try {
      const metodo = cobroMeta[inspeccionId]?.metodo || "transferencia";
      const referencia = (cobroMeta[inspeccionId]?.referencia || "").trim();
      await actions.registrarCobroInspeccion(inspeccionId, {
        accion: "marcar_pagado_total",
        metodo,
        referencia,
      });
      await cargar(soloPendientes);
    } catch (err) {
      setActionError(`No se pudo marcar pagado: ${err?.message || "error"}`);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="sw-ent-wrapper">

      {/* ── Hero ──────────────────────────────────────────────────── */}
      <div className="sw-veh-hero">
        <div className="sw-veh-hero-inner container">
          <div className="sw-veh-hero-body">
            <div className="sw-veh-hero-icon">
              <span style={{ width: 24, height: 24, display: "flex" }}>{ICONS.cobros}</span>
            </div>
            <div style={{ flex: 1 }}>
              <p className="sw-home-eyebrow" style={{ marginBottom: "0.2rem" }}>Administración · Facturación</p>
              <h1 className="sw-veh-hero-title">Cobros Profesionales</h1>
              <p className="sw-veh-hero-sub">Gestión de cobros y abonos de clientes con cuenta profesional</p>
            </div>
            <button
              className="sw-ent-submit-btn"
              onClick={() => cargar(soloPendientes)}
              disabled={loading}
              style={{ padding: "0.6rem 1.4rem", display: "flex", alignItems: "center", gap: "0.45rem" }}
            >
              <span style={{ width: 15, height: 15, display: "inline-flex" }}>{ICONS.refresh}</span>
              {loading ? "Actualizando…" : "Actualizar"}
            </button>
          </div>
        </div>
      </div>

      <div className="container sw-ent-content" style={{ maxWidth: 1200 }}>

        {/* ── Error banner ──────────────────────────────────────── */}
        {actionError && (
          <div style={{
            background: "color-mix(in srgb,var(--sw-danger,#ef4444) 12%,transparent)",
            border: "1px solid color-mix(in srgb,var(--sw-danger,#ef4444) 30%,transparent)",
            color: "var(--sw-danger,#ef4444)", borderRadius: 12, padding: "0.75rem 1rem",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            fontSize: "0.9rem", marginBottom: "0.25rem",
          }}>
            <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ width: 16, height: 16, display: "inline-flex" }}>{ICONS.warning}</span>
              {actionError}
            </span>
            <button onClick={() => setActionError("")} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", display: "flex" }}>
              <span style={{ width: 18, height: 18, display: "flex" }}>{ICONS.close}</span>
            </button>
          </div>
        )}

        {/* ── Filtro + Stats ────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr 1fr", gap: "1rem", alignItems: "stretch" }}>

          {/* Toggle solo pendientes */}
          <div style={{
            background: "var(--sw-surface)", border: `2px solid ${soloPendientes ? "var(--sw-accent,#d4af37)" : "var(--sw-border)"}`,
            borderRadius: 14, padding: "1rem 1.25rem", display: "flex", flexDirection: "column",
            gap: "0.4rem", cursor: "pointer", transition: "border-color 0.2s",
            minWidth: 160,
          }} onClick={() => setSoloPendientes(v => !v)}>
            <span style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--sw-muted)" }}>Filtro</span>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <div style={{
                width: 36, height: 20, borderRadius: 10, transition: "background 0.2s",
                background: soloPendientes ? "var(--sw-accent,#d4af37)" : "var(--sw-border)",
                position: "relative", flexShrink: 0,
              }}>
                <div style={{
                  width: 14, height: 14, borderRadius: "50%", background: "#fff",
                  position: "absolute", top: 3, transition: "left 0.2s",
                  left: soloPendientes ? 19 : 3,
                }} />
              </div>
              <span style={{ fontSize: "0.82rem", fontWeight: 700, color: soloPendientes ? "var(--sw-accent,#d4af37)" : "var(--sw-muted)" }}>
                Solo pendientes
              </span>
            </div>
          </div>

          {[
            { label: "Facturado", value: money(resumen.facturado), color: "var(--sw-accent,#d4af37)" },
            { label: "Cobrado",   value: money(resumen.pagado),    color: "#22c55e" },
            { label: "Pendiente", value: money(resumen.pendiente), color: "var(--sw-danger,#ef4444)" },
          ].map((item) => (
            <div key={item.label} style={{
              background: "var(--sw-surface)", border: "1px solid var(--sw-border)",
              borderRadius: 14, padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.25rem",
            }}>
              <span style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--sw-muted)" }}>{item.label}</span>
              <span style={{ fontSize: "1.3rem", fontWeight: 800, color: item.color, lineHeight: 1.2 }}>{item.value}</span>
              <span style={{ fontSize: "0.7rem", color: "var(--sw-muted)" }}>{clientes.length} cliente{clientes.length !== 1 ? "s" : ""}</span>
            </div>
          ))}
        </div>

        {/* ── Contenido ─────────────────────────────────────────── */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "4rem 0" }}>
            <div className="spinner-border" style={{ color: "var(--sw-accent,#d4af37)" }} role="status">
              <span className="visually-hidden">Cargando…</span>
            </div>
          </div>
        ) : !clientes.length ? (
          <div style={{
            background: "color-mix(in srgb,#22c55e 10%,transparent)",
            border: "1px solid color-mix(in srgb,#22c55e 28%,transparent)",
            borderRadius: 14, padding: "2rem", textAlign: "center",
            color: "#22c55e", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.6rem",
          }}>
            <span style={{ width: 20, height: 20, display: "inline-flex" }}>{ICONS.check}</span>
            No hay deuda pendiente de clientes profesionales.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {clientes.map((cliente) => (
              <div key={cliente.cliente_id || cliente.cliente_nombre} style={{
                background: "var(--sw-surface)", border: "1px solid var(--sw-border)",
                borderRadius: 16, overflow: "hidden",
                boxShadow: "0 4px 20px rgba(0,0,0,0.18)",
              }}>

                {/* Cabecera cliente */}
                <div style={{
                  background: "var(--sw-surface-2)", padding: "0.9rem 1.25rem",
                  borderBottom: "2px solid var(--sw-border)",
                  display: "flex", flexWrap: "wrap", alignItems: "center",
                  justifyContent: "space-between", gap: "0.75rem",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                    <span style={{
                      width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                      background: "color-mix(in srgb,var(--sw-accent,#d4af37) 14%,transparent)",
                      border: "1px solid color-mix(in srgb,var(--sw-accent,#d4af37) 28%,transparent)",
                      color: "var(--sw-accent,#d4af37)", display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "0.85rem", fontWeight: 800,
                    }}>
                      {(cliente.cliente_nombre || "?")[0].toUpperCase()}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--sw-text)" }}>
                      {cliente.cliente_nombre}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
                    {[
                      { label: "Facturado", value: money(cliente.total_facturado), color: "var(--sw-muted)" },
                      { label: "Cobrado",   value: money(cliente.total_pagado),    color: "#22c55e" },
                      { label: "Pendiente", value: money(cliente.total_pendiente), color: "var(--sw-danger,#ef4444)" },
                    ].map(s => (
                      <div key={s.label} style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--sw-muted)" }}>{s.label}</div>
                        <div style={{ fontWeight: 800, fontSize: "0.92rem", color: s.color }}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tabla inspecciones */}
                <div className="table-responsive">
                  <table className="table align-middle mb-0" style={{ color: "var(--sw-text)" }}>
                    <thead>
                      <tr style={{ background: "var(--sw-surface-2)", borderBottom: "1px solid var(--sw-border)" }}>
                        {["#", "Fecha entrega", "Matrícula", "Total", "Pagado", "Pendiente", "Estado", "Registrar pago"].map((h) => (
                          <th key={h} style={{
                            padding: "0.65rem 0.9rem", fontSize: "0.65rem", fontWeight: 700,
                            letterSpacing: "0.07em", textTransform: "uppercase",
                            color: "var(--sw-muted)", border: "none",
                            whiteSpace: "nowrap",
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(cliente.inspecciones || []).map((insp) => {
                        const pendiente = Number(insp.cobro?.importe_pendiente || 0);
                        const esPagado = pendiente <= 0;
                        return (
                          <tr key={insp.id} style={{
                            borderBottom: "1px solid var(--sw-border)",
                            opacity: esPagado ? 0.6 : 1,
                          }}>
                            <td style={{ padding: "0.8rem 0.9rem", color: "var(--sw-muted)", fontSize: "0.82rem" }}>
                              <span style={{
                                background: "color-mix(in srgb,var(--sw-accent,#d4af37) 10%,transparent)",
                                border: "1px solid color-mix(in srgb,var(--sw-accent,#d4af37) 22%,transparent)",
                                color: "var(--sw-accent,#d4af37)", borderRadius: 6,
                                padding: "0.1rem 0.5rem", fontWeight: 700, fontSize: "0.72rem",
                              }}>#{insp.id}</span>
                            </td>
                            <td style={{ padding: "0.8rem 0.9rem", fontSize: "0.85rem", color: "var(--sw-muted)", whiteSpace: "nowrap" }}>
                              {insp.fecha_entrega ? new Date(insp.fecha_entrega).toLocaleDateString("es-ES") : "—"}
                            </td>
                            <td style={{ padding: "0.8rem 0.9rem" }}>
                              <span style={{
                                background: "color-mix(in srgb,#38bdf8 12%,transparent)",
                                border: "1px solid color-mix(in srgb,#38bdf8 28%,transparent)",
                                color: "#38bdf8", borderRadius: 6,
                                padding: "0.15rem 0.55rem", fontWeight: 700, fontSize: "0.78rem",
                                display: "inline-flex", alignItems: "center", gap: "0.3rem",
                              }}>
                                <span style={{ width: 11, height: 11, display: "inline-flex", opacity: 0.7 }}>{ICONS.car}</span>
                                {insp.matricula}
                              </span>
                            </td>
                            <td style={{ padding: "0.8rem 0.9rem", fontWeight: 600, fontSize: "0.88rem" }}>{money(insp.cobro?.importe_total)}</td>
                            <td style={{ padding: "0.8rem 0.9rem", color: "#22c55e", fontWeight: 600, fontSize: "0.88rem" }}>{money(insp.cobro?.importe_pagado)}</td>
                            <td style={{ padding: "0.8rem 0.9rem", color: esPagado ? "#22c55e" : "var(--sw-danger,#ef4444)", fontWeight: 700, fontSize: "0.88rem" }}>
                              {esPagado ? "✓ 0.00 €" : money(pendiente)}
                            </td>
                            <td style={{ padding: "0.8rem 0.9rem" }}>
                              <span style={{
                                background: `color-mix(in srgb,${insp.cobro?.color || "#6c757d"} 18%,transparent)`,
                                border: `1px solid color-mix(in srgb,${insp.cobro?.color || "#6c757d"} 35%,transparent)`,
                                color: insp.cobro?.color || "#aaa",
                                borderRadius: 6, padding: "0.15rem 0.6rem",
                                fontWeight: 700, fontSize: "0.72rem", whiteSpace: "nowrap",
                              }}>
                                {insp.cobro?.label || "Sin datos"}
                              </span>
                            </td>
                            <td style={{ padding: "0.8rem 0.9rem" }}>
                              {!esPagado && (
                                <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
                                  <select
                                    className="form-select sw-pinput"
                                    style={{ width: 130, padding: "0.3rem 0.6rem", fontSize: "0.8rem" }}
                                    value={cobroMeta[insp.id]?.metodo || "transferencia"}
                                    onChange={(e) => onChangeCobroMeta(insp.id, "metodo", e.target.value)}
                                  >
                                    {COBRO_METODOS.map((m) => (
                                      <option key={m} value={m}>{m}</option>
                                    ))}
                                  </select>
                                  <input
                                    type="number" min="0" step="0.01"
                                    className="form-control sw-pinput"
                                    style={{ width: 110, padding: "0.3rem 0.6rem", fontSize: "0.8rem" }}
                                    placeholder="Abono €"
                                    value={abonos[insp.id] ?? ""}
                                    onChange={(e) => onChangeAbono(insp.id, e.target.value)}
                                  />
                                  <input
                                    type="text"
                                    className="form-control sw-pinput"
                                    style={{ width: 130, padding: "0.3rem 0.6rem", fontSize: "0.8rem" }}
                                    placeholder="Referencia"
                                    value={cobroMeta[insp.id]?.referencia || ""}
                                    onChange={(e) => onChangeCobroMeta(insp.id, "referencia", e.target.value)}
                                  />
                                  <button
                                    onClick={() => registrarAbono(insp.id)}
                                    disabled={savingId === insp.id}
                                    style={{
                                      background: "color-mix(in srgb,var(--sw-accent,#d4af37) 15%,transparent)",
                                      border: "1px solid color-mix(in srgb,var(--sw-accent,#d4af37) 35%,transparent)",
                                      color: "var(--sw-accent,#d4af37)", borderRadius: 8,
                                      padding: "0.3rem 0.75rem", cursor: "pointer",
                                      fontWeight: 700, fontSize: "0.8rem", whiteSpace: "nowrap",
                                    }}
                                  >
                                    {savingId === insp.id ? "…" : "Abonar"}
                                  </button>
                                  <button
                                    onClick={() => marcarPagado(insp.id)}
                                    disabled={savingId === insp.id}
                                    style={{
                                      background: "color-mix(in srgb,#22c55e 15%,transparent)",
                                      border: "1px solid color-mix(in srgb,#22c55e 35%,transparent)",
                                      color: "#22c55e", borderRadius: 8,
                                      padding: "0.3rem 0.75rem", cursor: "pointer",
                                      fontWeight: 700, fontSize: "0.8rem", whiteSpace: "nowrap",
                                      display: "flex", alignItems: "center", gap: "0.3rem",
                                    }}
                                  >
                                    <span style={{ width: 13, height: 13, display: "inline-flex" }}>{ICONS.check}</span>
                                    {savingId === insp.id ? "…" : "Pagado"}
                                  </button>
                                </div>
                              )}
                              {esPagado && (
                                <span style={{ color: "#22c55e", fontWeight: 700, fontSize: "0.82rem", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                                  <span style={{ width: 14, height: 14, display: "inline-flex" }}>{ICONS.check}</span>
                                  Cobrado
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="mb-0">Cobros Profesionales</h2>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-dark" onClick={() => cargar(soloPendientes)} disabled={loading}>
            {loading ? "Actualizando..." : "Actualizar"}
          </button>
        </div>
      </div>

      <div className="d-flex align-items-center gap-3 mb-3">
        <div className="form-check">
          <input
            id="soloPendientes"
            type="checkbox"
            className="form-check-input"
            checked={soloPendientes}
            onChange={(e) => setSoloPendientes(e.target.checked)}
          />
          <label htmlFor="soloPendientes" className="form-check-label">
            Mostrar solo pendientes
          </label>
        </div>
        <span className="badge bg-secondary">Clientes: {clientes.length}</span>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <div className="card border-primary h-100">
            <div className="card-body">
              <div className="small text-muted">Facturado</div>
              <div className="fs-4 fw-bold text-primary">{money(resumen.facturado)}</div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card border-success h-100">
            <div className="card-body">
              <div className="small text-muted">Cobrado</div>
              <div className="fs-4 fw-bold text-success">{money(resumen.pagado)}</div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card border-danger h-100">
            <div className="card-body">
              <div className="small text-muted">Pendiente</div>
              <div className="fs-4 fw-bold text-danger">{money(resumen.pendiente)}</div>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="alert alert-info">Cargando cobros profesionales...</div>
      ) : !clientes.length ? (
        <div className="alert alert-success mb-0">No hay deuda pendiente de clientes profesionales.</div>
      ) : (
        clientes.map((cliente) => (
          <div key={`${cliente.cliente_id || cliente.cliente_nombre}`} className="card mb-3">
            <div className="card-header d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2">
              <div>
                <strong>{cliente.cliente_nombre}</strong>
              </div>
              <div className="small text-muted">
                Facturado {money(cliente.total_facturado)} | Cobrado {money(cliente.total_pagado)} | Pendiente {" "}
                <span className="fw-bold text-danger">{money(cliente.total_pendiente)}</span>
              </div>
            </div>
            <div className="table-responsive">
              <table className="table table-sm mb-0 align-middle">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Fecha entrega</th>
                    <th>Matrícula</th>
                    <th>Total</th>
                    <th>Pagado</th>
                    <th>Pendiente</th>
                    <th>Estado</th>
                    <th>Registrar pago</th>
                  </tr>
                </thead>
                <tbody>
                  {(cliente.inspecciones || []).map((insp) => (
                    <tr key={insp.id}>
                      <td>#{insp.id}</td>
                      <td>{insp.fecha_entrega ? new Date(insp.fecha_entrega).toLocaleDateString("es-ES") : "-"}</td>
                      <td><span className="badge bg-dark">{insp.matricula}</span></td>
                      <td>{money(insp.cobro?.importe_total)}</td>
                      <td>{money(insp.cobro?.importe_pagado)}</td>
                      <td className="fw-semibold text-danger">{money(insp.cobro?.importe_pendiente)}</td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            backgroundColor: insp.cobro?.color || "#6c757d",
                            color: "#fff",
                          }}
                        >
                          {insp.cobro?.label || "Sin datos"}
                        </span>
                      </td>
                      <td>
                        <div className="d-flex gap-2">
                          <select
                            className="form-select form-select-sm"
                            style={{ width: "130px" }}
                            value={cobroMeta[insp.id]?.metodo || "transferencia"}
                            onChange={(e) => onChangeCobroMeta(insp.id, "metodo", e.target.value)}
                          >
                            {COBRO_METODOS.map((m) => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="form-control form-control-sm"
                            style={{ width: "120px" }}
                            placeholder="Abono"
                            value={abonos[insp.id] ?? ""}
                            onChange={(e) => onChangeAbono(insp.id, e.target.value)}
                          />
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            style={{ width: "140px" }}
                            placeholder="Referencia"
                            value={cobroMeta[insp.id]?.referencia || ""}
                            onChange={(e) => onChangeCobroMeta(insp.id, "referencia", e.target.value)}
                          />
                          <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => registrarAbono(insp.id)}
                            disabled={savingId === insp.id}
                          >
                            Abonar
                          </button>
                          <button
                            className="btn btn-sm btn-success"
                            onClick={() => marcarPagado(insp.id)}
                            disabled={savingId === insp.id}
                          >
                            Pagado
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
