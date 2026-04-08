import React, { useEffect, useState, useContext } from "react";
import { Context } from "../store/appContext";
import "../styles/print.css";

/* ── Iconos SVG ─────────────────────────────────────────────────── */
const ICONS = {
  clientes: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>),
  filter:   (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>),
  print:    (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>),
  search:   (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>),
  chevron:  (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>),
  car:      (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="11" width="20" height="9" rx="2"/><path d="M5 11V9a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2"/><circle cx="7" cy="20" r="1"/><circle cx="17" cy="20" r="1"/></svg>),
};

const ResumenClientesPage = () => {
  const { actions } = useContext(Context);
  const [reporte, setReporte] = useState({ clientes: [], fecha_desde: null, fecha_hasta: null });
  const [loading, setLoading] = useState(false);

  const [mesSeleccionado, setMesSeleccionado] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [busquedaCliente, setBusquedaCliente] = useState("");
  const [expandidos, setExpandidos] = useState({});

  useEffect(() => {
    const hoy = new Date();
    const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    const desde = primerDia.toISOString().split("T")[0];
    const hasta = ultimoDia.toISOString().split("T")[0];
    setFechaDesde(desde);
    setFechaHasta(hasta);
    setMesSeleccionado(`${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`);
    cargarReporte(desde, hasta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cargarReporte = async (desde, hasta) => {
    setLoading(true);
    try {
      const data = await actions.getReporteClientes(desde, hasta);
      setReporte(data || { clientes: [], fecha_desde: desde, fecha_hasta: hasta });
    } catch {
      setReporte({ clientes: [], fecha_desde: desde, fecha_hasta: hasta });
    } finally {
      setLoading(false);
    }
  };

  const handleMesChange = (e) => {
    const mes = e.target.value;
    setMesSeleccionado(mes);
    if (mes) {
      const [year, month] = mes.split("-");
      const primerDia = new Date(year, month - 1, 1);
      const ultimoDia = new Date(year, month, 0);
      const desde = primerDia.toISOString().split("T")[0];
      const hasta = ultimoDia.toISOString().split("T")[0];
      setFechaDesde(desde);
      setFechaHasta(hasta);
      cargarReporte(desde, hasta);
    }
  };

  const handleFiltroPersonalizado = () => {
    if (fechaDesde && fechaHasta) {
      setMesSeleccionado("");
      cargarReporte(fechaDesde, fechaHasta);
    }
  };

  const toggleExpandido = (id) => setExpandidos((prev) => ({ ...prev, [id]: !prev[id] }));

  const totalGeneral = reporte.clientes.reduce((sum, c) => sum + c.total_cliente, 0);

  const clientesFiltrados = reporte.clientes.filter((cliente) => {
    if (!busquedaCliente.trim()) return true;
    const term = busquedaCliente.toLowerCase();
    return (
      cliente.cliente_nombre?.toLowerCase().includes(term) ||
      cliente.cliente_cif?.toLowerCase().includes(term)
    );
  });

  const totalFiltrado = clientesFiltrados.reduce((sum, c) => sum + c.total_cliente, 0);

  return (
    <div className="sw-ent-wrapper">
      {/* ── Hero ──────────────────────────────────────────────────── */}
      <style>{`@media print { .no-print { display: none !important; } body { margin: 0; padding: 16px; } }`}</style>

      <div className="sw-veh-hero no-print">
        <div className="sw-veh-hero-inner container">
          <div className="sw-veh-hero-body">
            <div className="sw-veh-hero-icon">
              <span style={{ width: 24, height: 24, display: "flex" }}>{ICONS.clientes}</span>
            </div>
            <div style={{ flex: 1 }}>
              <p className="sw-home-eyebrow" style={{ marginBottom: "0.2rem" }}>Clientes · Facturación</p>
              <h1 className="sw-veh-hero-title">Resumen de Clientes</h1>
              <p className="sw-veh-hero-sub">Facturación desglosada por cliente y vehículo en el período seleccionado</p>
            </div>
            <button
              className="sw-ent-submit-btn no-print"
              onClick={() => window.print()}
              disabled={loading || reporte.clientes.length === 0}
              style={{ padding: "0.6rem 1.4rem" }}
            >
              <span style={{ width: 16, height: 16, display: "inline-flex" }}>{ICONS.print}</span>
              Imprimir
            </button>
          </div>
        </div>
      </div>

      <div className="container sw-ent-content" style={{ maxWidth: 1100 }}>

        {/* ── Filtros ────────────────────────────────────────────── */}
        <div className="sw-ent-card no-print">
          <div className="sw-ent-card-header">
            <div className="sw-ent-card-header-icon" style={{ background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.22)", color: "var(--sw-accent,#d4af37)" }}>
              <span style={{ width: 18, height: 18, display: "flex" }}>{ICONS.filter}</span>
            </div>
            <div>
              <p className="sw-ent-card-eyebrow">Período</p>
              <h2 className="sw-ent-card-title">Filtrar por fechas</h2>
            </div>
          </div>
          <div className="sw-ent-card-body">
            <div className="sw-ent-grid">
              <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                <label className="sw-plbl">Mes rápido</label>
                <input type="month" className="form-control sw-pinput" value={mesSeleccionado} onChange={handleMesChange} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                <label className="sw-plbl">Desde</label>
                <input type="date" className="form-control sw-pinput" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                <label className="sw-plbl">Hasta</label>
                <input type="date" className="form-control sw-pinput" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center", marginTop: "0.25rem" }}>
              <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
                <span style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", width: 16, height: 16, color: "var(--sw-muted)", display: "flex", pointerEvents: "none" }}>{ICONS.search}</span>
                <input
                  className="form-control sw-pinput"
                  style={{ paddingLeft: "2.2rem" }}
                  placeholder="Buscar por nombre o CIF…"
                  value={busquedaCliente}
                  onChange={(e) => setBusquedaCliente(e.target.value)}
                />
              </div>
              <button
                className="sw-ent-submit-btn"
                onClick={handleFiltroPersonalizado}
                disabled={!fechaDesde || !fechaHasta}
                style={{ padding: "0.6rem 1.5rem" }}
              >
                Filtrar
              </button>
            </div>
          </div>
        </div>

        {/* ── Tarjetas resumen ───────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem" }} className="no-print">
          {[
            { label: "Período", value: fechaDesde && fechaHasta ? `${new Date(fechaDesde).toLocaleDateString("es-ES")} – ${new Date(fechaHasta).toLocaleDateString("es-ES")}` : "—", color: "var(--sw-accent,#d4af37)", small: true },
            { label: "Clientes", value: reporte.clientes.length, color: "#38bdf8" },
            { label: busquedaCliente.trim() ? "Clientes filtrados" : "Total facturado", value: busquedaCliente.trim() ? clientesFiltrados.length : totalGeneral.toFixed(2) + " €", color: "var(--sw-accent,#d4af37)" },
            ...(busquedaCliente.trim() ? [{ label: "Facturado filtrado", value: totalFiltrado.toFixed(2) + " €", color: "#22c55e" }] : []),
          ].map((item) => (
            <div key={item.label} style={{
              background: "var(--sw-surface)", border: "1px solid var(--sw-border)",
              borderRadius: 14, padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.25rem",
              animation: "sw-fade-up 0.4s ease both",
            }}>
              <span style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--sw-muted)" }}>{item.label}</span>
              <span style={{ fontSize: item.small ? "0.85rem" : "1.4rem", fontWeight: item.small ? 600 : 800, color: item.color, lineHeight: 1.2 }}>{item.value}</span>
            </div>
          ))}
        </div>

        {/* ── Contenido ───────────────────────────────────────────── */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "4rem 0" }}>
            <div className="spinner-border" style={{ color: "var(--sw-accent,#d4af37)" }} role="status">
              <span className="visually-hidden">Cargando…</span>
            </div>
          </div>
        ) : reporte.clientes.length === 0 ? (
          <div style={{
            padding: "2rem", borderRadius: 14, textAlign: "center",
            background: "var(--sw-surface)", border: "1px solid var(--sw-border)",
            color: "var(--sw-muted)", fontSize: "0.9rem",
          }}>
            No hay servicios registrados en el período seleccionado.
          </div>
        ) : clientesFiltrados.length === 0 ? (
          <div style={{
            padding: "2rem", borderRadius: 14, textAlign: "center",
            background: "var(--sw-surface)", border: "1px solid var(--sw-border)",
            color: "var(--sw-muted)", fontSize: "0.9rem",
          }}>
            No se encontraron clientes que coincidan con la búsqueda.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {clientesFiltrados.map((cliente) => {
              const abierto = !!expandidos[cliente.cliente_id];
              return (
                <div key={cliente.cliente_id} style={{
                  background: "var(--sw-surface)", border: "1px solid var(--sw-border)",
                  borderRadius: 16, overflow: "hidden", animation: "sw-fade-up 0.4s ease both",
                  borderLeft: "3px solid var(--sw-accent,#d4af37)",
                }}>
                  {/* Cabecera acordeón */}
                  <button
                    onClick={() => toggleExpandido(cliente.cliente_id)}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                      gap: "1rem", padding: "1rem 1.25rem", background: "transparent", border: "none",
                      cursor: "pointer", textAlign: "left",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", flex: 1, minWidth: 0 }}>
                      <div style={{
                        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                        background: "color-mix(in srgb, var(--sw-accent,#d4af37) 12%, transparent)",
                        border: "1px solid color-mix(in srgb, var(--sw-accent,#d4af37) 28%, transparent)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "var(--sw-accent,#d4af37)",
                      }}>
                        <span style={{ width: 18, height: 18, display: "flex" }}>{ICONS.clientes}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--sw-text)" }}>
                          {cliente.cliente_nombre}
                          {cliente.cliente_cif && (
                            <span style={{ marginLeft: "0.5rem", fontSize: "0.75rem", color: "var(--sw-muted)", fontWeight: 400 }}>({cliente.cliente_cif})</span>
                          )}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--sw-muted)", marginTop: 2 }}>
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: "0.3rem",
                            padding: "0.15rem 0.55rem", borderRadius: 999, fontSize: "0.7rem", fontWeight: 700,
                            background: "color-mix(in srgb, #38bdf8 12%, transparent)",
                            border: "1px solid color-mix(in srgb, #38bdf8 28%, transparent)",
                            color: "#38bdf8",
                          }}>
                            <span style={{ width: 12, height: 12, display: "flex" }}>{ICONS.car}</span>
                            {cliente.coches.length} coche{cliente.coches.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexShrink: 0 }}>
                      <span style={{ fontWeight: 800, fontSize: "1.1rem", color: "var(--sw-accent,#d4af37)" }}>
                        {cliente.total_cliente.toFixed(2)} €
                      </span>
                      <span style={{ width: 20, height: 20, color: "var(--sw-muted)", display: "flex", transition: "transform 0.2s", transform: abierto ? "rotate(180deg)" : "rotate(0deg)" }}>
                        {ICONS.chevron}
                      </span>
                    </div>
                  </button>

                  {/* Tabla coches */}
                  {abierto && (
                    <div style={{ borderTop: "1px solid var(--sw-border)" }}>
                      <div className="table-responsive">
                        <table className="table mb-0 sw-ent-table">
                          <thead>
                            <tr>
                              <th>Matrícula</th>
                              <th>Marca / Modelo</th>
                              <th className="text-center">Servicios</th>
                              <th className="text-end">Total pagado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cliente.coches.map((coche) => (
                              <tr key={coche.coche_id}>
                                <td style={{ fontWeight: 700, fontSize: "0.88rem" }}>{coche.matricula}</td>
                                <td style={{ fontSize: "0.82rem", color: "var(--sw-muted)" }}>{coche.marca} {coche.modelo}</td>
                                <td className="text-center">
                                  <span style={{
                                    display: "inline-block", padding: "0.15rem 0.6rem", borderRadius: 999,
                                    fontSize: "0.75rem", fontWeight: 700,
                                    background: "color-mix(in srgb, var(--sw-accent,#d4af37) 12%, transparent)",
                                    border: "1px solid color-mix(in srgb, var(--sw-accent,#d4af37) 28%, transparent)",
                                    color: "var(--sw-accent,#d4af37)",
                                  }}>{coche.total_servicios}</span>
                                </td>
                                <td className="text-end" style={{ fontWeight: 700, color: "var(--sw-accent,#d4af37)" }}>{coche.total_pagado.toFixed(2)} €</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr style={{ borderTop: "2px solid var(--sw-border)" }}>
                              <td colSpan={3} style={{ textAlign: "right", fontWeight: 700, fontSize: "0.8rem", color: "var(--sw-muted)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "0.75rem 0.9rem" }}>Total cliente</td>
                              <td style={{ textAlign: "right", fontWeight: 800, color: "var(--sw-accent,#d4af37)", fontSize: "1rem", padding: "0.75rem 0.9rem" }}>{cliente.total_cliente.toFixed(2)} €</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ResumenClientesPage;
