import React, { useContext, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import SignaturePad from "../components/SignaturePad.jsx";
import { Context } from "../store/appContext";
import { isEmployeeRole, normalizeRol } from "../utils/authSession";

const safeDate = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("es-ES");
};

const safeNumber = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString("es-ES");
};

const SIGNER_PREFIX = "[firmante_entrega]:";
const COBRO_METODOS = ["efectivo", "bizum", "tarjeta", "transferencia"];

const splitObservaciones = (texto = "") => {
  const lines = String(texto || "").split("\n");
  let firmante = "";
  const clean = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.toLowerCase().startsWith(SIGNER_PREFIX)) {
      firmante = trimmed.slice(SIGNER_PREFIX.length).trim();
      continue;
    }
    clean.push(line);
  }

  return {
    firmante,
    observaciones: clean.join("\n").trim(),
  };
};

const mergeObservacionesConFirmante = (observaciones = "", firmante = "") => {
  const obs = String(observaciones || "").trim();
  const nom = String(firmante || "").trim();
  const lines = [];
  if (nom) lines.push(`${SIGNER_PREFIX} ${nom}`);
  if (obs) lines.push(obs);
  return lines.join("\n");
};

const parseActa = (texto = "") => {
  const lines = texto.split("\n");
  const obsPrefix = "Observaciones de entrega:";
  const obsLine = lines.find((line) => line.trim().startsWith(obsPrefix));
  const observaciones = obsLine ? obsLine.replace(obsPrefix, "").trim() : "";
  const contenido = lines.filter((line) => !line.trim().startsWith(obsPrefix)).join("\n").trim();
  return { contenido, observaciones };
};

const normalizeTechnicalContent = (contenido = "") => {
  const original = String(contenido || "").trim();
  if (!original) return "";

  const lines = original.split("\n");
  let i = 0;

  while (i < lines.length && !lines[i].trim()) i += 1;
  if (
    i < lines.length &&
    /(informe tecnico|acta tecnica|informe de intervencion)/i.test(lines[i].trim())
  ) {
    i += 1;
  }

  const duplicatedMeta = /^(cliente|vehiculo|vehículo|matricula|matrícula|kilometros|kilómetros|fecha\s*de\s*inspeccion|fecha\s*inspeccion|telefono|teléfono)\s*:/i;
  while (i < lines.length && duplicatedMeta.test(lines[i].trim())) {
    i += 1;
  }

  while (i < lines.length && !lines[i].trim()) i += 1;
  const cleaned = lines.slice(i).join("\n").trim();
  return cleaned || original;
};

const getStored = (k) =>
  (typeof sessionStorage !== "undefined" && sessionStorage.getItem(k)) ||
  (typeof localStorage !== "undefined" && localStorage.getItem(k)) || "";

const isProfesional = (inspeccion) => {
  if (!inspeccion || typeof inspeccion !== "object") return false;
  if (Boolean(inspeccion.es_concesionario)) return true;
  if (Boolean(inspeccion?.cobro?.es_concesionario)) return true;
  return Boolean((inspeccion?.cliente?.cif || "").trim());
};

const ActaEntregaView = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { actions } = useContext(Context);

  const [inspeccion, setInspeccion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const [firmaCliente, setFirmaCliente] = useState("");
  const [nombreFirmante, setNombreFirmante] = useState("");
  const [consentimiento, setConsentimiento] = useState(false);
  const [conformidad, setConformidad] = useState(false);
  const [printTriggered, setPrintTriggered] = useState(false);
  const [registrarCobroEntrega, setRegistrarCobroEntrega] = useState(true);
  const [cobroAccion, setCobroAccion] = useState("marcar_pagado_total");
  const [cobroImporte, setCobroImporte] = useState("");
  const [cobroMetodo, setCobroMetodo] = useState("efectivo");
  const [cobroReferencia, setCobroReferencia] = useState("");
  const [cobroObservaciones, setCobroObservaciones] = useState("");
  const [entregaFlash, setEntregaFlash] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Hoja de intervencion tecnica de entrega - Special Wash";
    return () => {
      document.title = previousTitle;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await actions.getInspeccion(id);
        if (!active) return;
        setInspeccion(data);
        const parsedObs = splitObservaciones(data?.entrega_observaciones || "");
        setFirmaCliente(data?.firma_cliente_entrega || "");
        setNombreFirmante(parsedObs.firmante || data?.cliente_nombre || "");
        setConsentimiento(Boolean(data?.consentimiento_datos_entrega));
        setConformidad(Boolean(data?.conformidad_revision_entrega));
        setCobroMetodo(data?.cobro_metodo || data?.cobro?.metodo || "efectivo");
        setCobroReferencia(data?.cobro_referencia || data?.cobro?.referencia || "");
        setCobroObservaciones(data?.cobro_observaciones || data?.cobro?.observaciones || "");
        // Precarga el importe total automáticamente
        const importeTotal = data?.cobro?.importe_total || 0;
        if (importeTotal > 0) {
          setCobroImporte(String(Number(importeTotal).toFixed(2)));
        }
      } catch (err) {
        if (active) setError(err.message || "No se pudo cargar la hoja de intervencion");
      } finally {
        if (active) setLoading(false);
      }
    };

    if (id) load();

    return () => {
      active = false;
    };
  }, [actions, id]);

  const acta = useMemo(() => parseActa(inspeccion?.trabajos_realizados || ""), [inspeccion?.trabajos_realizados]);
  const observacionesLimpias = useMemo(() => {
    const parsed = splitObservaciones(inspeccion?.entrega_observaciones || "");
    return parsed.observaciones || acta.observaciones || "-";
  }, [inspeccion?.entrega_observaciones, acta.observaciones]);
  const contenidoTecnico = useMemo(() => normalizeTechnicalContent(acta.contenido), [acta.contenido]);
  const isEntregado = Boolean(inspeccion?.entregado);
  const esConcesionario = isProfesional(inspeccion);
  const rol = normalizeRol(getStored("rol"));

  const volver = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    if (isEntregado) {
      navigate("/entregados", { replace: true });
      return;
    }
    navigate(isEmployeeRole(rol) ? "/repaso-entrega?tab=firma" : "/inspecciones-guardadas?tab=pendientes", { replace: true });
  };

  useEffect(() => {
    if (!inspeccion || printTriggered) return;
    const params = new URLSearchParams(location.search);
    if (params.get("print") === "1") {
      setPrintTriggered(true);
      setTimeout(() => window.print(), 200);
    }
  }, [inspeccion, location.search, printTriggered]);

  const finalizarEntrega = async () => {
    if (!inspeccion) return;
    setFormError("");
    if (!nombreFirmante.trim()) {
      setFormError("Debes indicar el nombre de la persona que firma la recepcion del vehiculo.");
      return;
    }
    if (!esConcesionario && !firmaCliente) {
      setFormError("La firma del cliente es obligatoria para finalizar la entrega.");
      return;
    }
    if (!esConcesionario && !consentimiento) {
      setFormError("Debes confirmar la proteccion de datos.");
      return;
    }
    if (!esConcesionario && registrarCobroEntrega && cobroAccion === "abono") {
      const importe = Number(cobroImporte);
      if (!Number.isFinite(importe) || importe <= 0) {
        setFormError("Debes indicar un importe de abono válido.");
        return;
      }
    }

    setGuardando(true);
    try {
      const updated = await actions.registrarEntregaInspeccion(inspeccion.id, {
        trabajos_realizados: esConcesionario
          ? String(inspeccion.trabajos_realizados || "").trim()
          : inspeccion.trabajos_realizados,
        entrega_observaciones: mergeObservacionesConFirmante(
          observacionesLimpias === "-" ? "" : observacionesLimpias,
          nombreFirmante
        ),
        firma_cliente_entrega: esConcesionario ? null : firmaCliente,
        consentimiento_datos_entrega: esConcesionario ? false : consentimiento,
        conformidad_revision_entrega: esConcesionario ? false : conformidad,
        registrar_cobro: !esConcesionario && registrarCobroEntrega,
        cobro_accion: !esConcesionario && registrarCobroEntrega ? cobroAccion : undefined,
        cobro_importe:
          !esConcesionario && registrarCobroEntrega && cobroAccion === "abono"
            ? Number(cobroImporte)
            : undefined,
        cobro_metodo: !esConcesionario && registrarCobroEntrega ? cobroMetodo : undefined,
        cobro_referencia: !esConcesionario && registrarCobroEntrega ? cobroReferencia : undefined,
        cobro_observaciones: !esConcesionario && registrarCobroEntrega ? cobroObservaciones : undefined,
      });
      setInspeccion(updated || inspeccion);

      if (updated?.cobro_entrega_registrado) {
        setEntregaFlash("Entrada en finanzas creada correctamente por el cobro de entrega.");
      } else {
        setEntregaFlash("Entrega finalizada correctamente.");
      }

      setTimeout(() => {
        navigate(rol === "empleado" ? "/" : "/entregados", { replace: true });
      }, 1400);
    } catch (err) {
      setFormError(`Error al finalizar entrega: ${err.message}`);
    } finally {
      setGuardando(false);
    }
  };

  if (loading) return <div className="container py-4">Cargando acta...</div>;
  if (error) return <div className="container py-4"><div className="alert alert-danger">{error}</div></div>;
  if (!inspeccion) return <div className="container py-4">No se encontro la inspeccion.</div>;

  return (
    <div className="container py-4 print-acta-page" style={{ maxWidth: "1000px" }}>
      <style>
        {`
          .delivery-doc {
            background: #fff;
            border: 1px solid #d8d2c6;
            border-radius: 14px;
            padding: 30px;
            color: #1e1b16;
            font-family: "Georgia", "Times New Roman", serif;
            background-image: none;
          }
          .delivery-doc .text-muted,
          .delivery-doc .form-text {
            color: #5f574a !important;
          }
          .delivery-doc .form-label,
          .delivery-doc .form-check-label,
          .delivery-doc label {
            color: #2b241b;
          }
          .delivery-doc .form-control,
          .delivery-doc .form-select {
            background: #fff;
            color: #1e1b16;
            border-color: #cfc5b3;
          }
          .delivery-doc .form-control::placeholder {
            color: #7a7266;
          }
          .delivery-doc .form-check-input {
            background-color: #fff;
            border-color: #bfb6a6;
          }
          .delivery-doc .btn-outline-secondary {
            color: #5c5447 !important;
            border-color: #bbb09e !important;
            background: #fff !important;
          }
          .delivery-doc .btn-outline-secondary:hover,
          .delivery-doc .btn-outline-secondary:focus {
            color: #2a231b !important;
            border-color: #9f937f !important;
            background: #f7f2e8 !important;
          }
          .delivery-doc .btn-outline-secondary:disabled {
            color: #8f8678 !important;
            border-color: #d5cdbc !important;
            background: #faf8f3 !important;
          }
          .delivery-doc .single-header {
            border-bottom: 1px solid #ded6c7;
            padding-bottom: 12px;
            margin-bottom: 14px;
            text-align: center;
          }
          .delivery-doc .line { border-top: 1px solid #d9d2c7; margin: 18px 0; }
          .delivery-doc .box {
            border: 1px solid #ddd3c2;
            border-radius: 10px;
            padding: 18px;
            background: #fffdf8;
            position: relative;
            overflow: hidden;
          }
          .delivery-doc .meta-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
            margin-bottom: 14px;
          }
          .delivery-doc .meta-item {
            border: 1px solid #ddd3c2;
            border-radius: 8px;
            padding: 9px 10px;
            background: #fff;
            font-size: 14px;
          }
          .delivery-doc .meta-item strong {
            display: block;
            font-size: 11px;
            letter-spacing: 0.5px;
            color: #5f574a;
            margin-bottom: 2px;
            text-transform: uppercase;
          }
          .delivery-doc .content { white-space: pre-wrap; line-height: 1.55; font-size: 15px; }
          .delivery-doc .section-title {
            font-size: 14px;
            letter-spacing: 0.9px;
            color: #685f50;
            text-transform: uppercase;
            margin-bottom: 8px;
            font-weight: 700;
          }
          .delivery-doc .legal-note {
            border: 1px solid #d7d0c2;
            border-radius: 10px;
            padding: 12px 14px;
            background: #fff;
            font-size: 12px;
            line-height: 1.55;
            color: #3d372e;
          }
          .delivery-doc .legal-note strong {
            display: inline-block;
            margin-bottom: 4px;
            letter-spacing: 0.3px;
          }
          .delivery-doc .single-title {
            margin: 0;
            font-weight: 700;
            letter-spacing: 1px;
            font-size: 34px;
            color: #2e271d;
            text-transform: uppercase;
          }
          .delivery-doc .single-subtitle {
            margin-top: 8px;
            font-size: 22px;
            font-weight: 600;
            color: #443b2f;
          }
          .delivery-doc .single-tagline {
            margin-top: 4px;
            font-size: 14px;
            letter-spacing: 0.4px;
            color: #6b6354;
          }
          .final-stamp {
            display: inline-block;
            border: 2px solid #198754;
            color: #198754;
            border-radius: 999px;
            padding: 3px 12px;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.8px;
          }
          .header-wrap {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 8px;
          }
          @media print {
            body * { visibility: hidden !important; }
            .print-acta-page, .print-acta-page * { visibility: visible !important; }
            .print-acta-page {
              position: absolute !important;
              top: 0 !important;
              left: 0 !important;
              width: 100% !important;
              max-width: none !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            .no-print { display: none !important; }
            .delivery-doc { border: 0 !important; box-shadow: none !important; margin: 0 !important; }
            .delivery-doc,
            .delivery-doc .single-header,
            .delivery-doc .box,
            .delivery-doc .line {
              border-color: #000 !important;
              color: #000 !important;
            }
            .delivery-doc .single-title,
            .delivery-doc .single-subtitle,
            .delivery-doc .single-tagline,
            .delivery-doc .content {
              color: #000 !important;
            }
            .delivery-doc .legal-note {
              border-color: #000 !important;
              color: #000 !important;
            }
            .delivery-doc .content {
              font-size: 16px !important;
              line-height: 1.6 !important;
            }
            .avoid-break {
              break-inside: avoid-page !important;
              page-break-inside: avoid !important;
            }
            @page { size: A4; margin: 14mm; }
          }
          @media (max-width: 768px) {
            .delivery-doc .single-title { font-size: 26px; }
            .delivery-doc .single-subtitle { font-size: 18px; }
            .delivery-doc .single-tagline { font-size: 12px; }
            .delivery-doc .meta-grid { grid-template-columns: 1fr; }
          }
        `}
      </style>

     

      <div className="delivery-doc print-acta-document mb-4">
        {entregaFlash && (
          <div className="alert alert-success no-print" role="alert">
            {entregaFlash}
          </div>
        )}
        <div className="single-header avoid-break">
          <div className="header-wrap">
            <div>
              <h3 className="single-title">INFORME TECNICO DE INTERVENCION</h3>
              <div className="single-subtitle">Special Wash Studio</div>
              <div className="single-tagline">Detailing · Paint Lab · Restauracion de Interiores</div>
            </div>
            {inspeccion.entregado && <span className="final-stamp">ENTREGA FINALIZADA</span>}
          </div>
        </div>

        <div className="meta-grid avoid-break">
          <div className="meta-item"><strong>Cliente</strong>{inspeccion.cliente_nombre || "-"}</div>
          <div className="meta-item"><strong>Persona firmante</strong>{nombreFirmante || "-"}</div>
          <div className="meta-item"><strong>Vehiculo</strong>{inspeccion.coche_descripcion || "-"}</div>
          <div className="meta-item"><strong>Matricula</strong>{inspeccion.matricula || "-"}</div>
          <div className="meta-item"><strong>Kilometraje</strong>{safeNumber(inspeccion.kilometros)} km</div>
          <div className="meta-item"><strong>Fecha inspeccion</strong>{safeDate(inspeccion.fecha_inspeccion)}</div>
          <div className="meta-item"><strong>Fecha entrega</strong>{safeDate(inspeccion.fecha_entrega)}</div>
        </div>

        <div className="box mb-3 avoid-break">
          <div className="section-title">Informe Tecnico de Intervencion</div>
          <div className="content">
            {esConcesionario
              ? "Vehiculo de concesionario/profesional: cierre de entrega interno sin firma de cliente ni acta tecnica obligatoria."
              : (contenidoTecnico || "(Acta sin contenido)")}
          </div>
        </div>

        <div className="legal-note avoid-break mb-3">
          <strong>Proteccion de datos</strong>
          <div>
            Los datos personales facilitados seran tratados por Special Wash Studio como responsable del tratamiento,
            con la finalidad de gestionar el servicio, la entrega del vehiculo y las obligaciones administrativas o
            legales derivadas. La base juridica es la ejecucion del servicio y, en su caso, el consentimiento otorgado.
            Los datos se conservaran durante los plazos legalmente exigibles. Puede ejercer sus derechos de acceso,
            rectificacion, supresion, oposicion, limitacion y portabilidad solicitandolo a su canal de contacto habitual.
          </div>
        </div>

        <div className="line" />

        <div className="mb-3">
          <label className="form-label fw-bold">Nombre de la persona que firma la entrega</label>
          <input
            type="text"
            className="form-control"
            placeholder="Ejemplo: Laura Perez"
            value={nombreFirmante}
            disabled={isEntregado}
            onChange={(e) => setNombreFirmante(e.target.value)}
          />
          <div className="form-text">Puede ser distinto al titular si otra persona recoge el vehiculo.</div>
        </div>

        {!esConcesionario && (
          <>
            <div className="mb-2 fw-bold">Revision con cliente</div>
            <div className="form-check mb-2">
              <input
                className="form-check-input"
                type="checkbox"
                id="conformidad"
                checked={conformidad}
                disabled={isEntregado}
                onChange={(e) => setConformidad(e.target.checked)}
              />
              <label className="form-check-label" htmlFor="conformidad">
                Cliente confirma revision visual del coche y del trabajo realizado.
              </label>
            </div>

            <div className="form-check mb-3">
              <input
                className="form-check-input"
                type="checkbox"
                id="consentimiento"
                checked={consentimiento}
                disabled={isEntregado}
                onChange={(e) => setConsentimiento(e.target.checked)}
              />
              <label className="form-check-label" htmlFor="consentimiento">
                Cliente acepta proteccion de datos en el proceso de entrega.
              </label>
            </div>

            {isEntregado ? (
              <div className="mb-3">
                <label className="form-label fw-bold d-block">Firma cliente (entrega)</label>
                <div className="border rounded p-3 text-center" style={{ background: "#fff" }}>
                  {firmaCliente ? (
                    <img
                      src={firmaCliente}
                      alt="Firma cliente entrega"
                      style={{ maxWidth: "100%", maxHeight: "180px", objectFit: "contain" }}
                    />
                  ) : (
                    <span className="text-muted">Sin firma registrada</span>
                  )}
                </div>
              </div>
            ) : (
              <SignaturePad title="Firma cliente (entrega)" value={firmaCliente} onChange={setFirmaCliente} />
            )}

            {!isEntregado && (
              <div className="border rounded p-3 mt-3 no-print" style={{ background: "#fffdf8", borderColor: "#ddd3c2" }}>
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2 mb-2">
                  <div>
                    <div className="fw-bold">Cobro en entrega</div>
                    {(inspeccion?.cobro?.importe_total || 0) > 0 && (
                      <div className="small text-muted mt-1">
                        Importe total a pagar: <strong style={{ color: "#d4af37", fontSize: "1.1em" }}>{Number(inspeccion.cobro.importe_total).toFixed(2)} €</strong>
                      </div>
                    )}
                  </div>
                  <div className="form-check mb-0">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="registrar-cobro-entrega"
                      checked={registrarCobroEntrega}
                      onChange={(e) => setRegistrarCobroEntrega(e.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="registrar-cobro-entrega">
                      Registrar cobro ahora
                    </label>
                  </div>
                </div>

                {registrarCobroEntrega && (
                  <div className="row g-2">
                    <div className="col-12 col-md-3">
                      <label className="form-label small mb-1">Tipo de cobro</label>
                      <select
                        className="form-select form-select-sm"
                        value={cobroAccion}
                        onChange={(e) => setCobroAccion(e.target.value)}
                      >
                        <option value="marcar_pagado_total">Pagado total</option>
                        <option value="abono">Abono parcial</option>
                      </select>
                    </div>
                    <div className="col-12 col-md-3">
                      <label className="form-label small mb-1">Metodo</label>
                      <select
                        className="form-select form-select-sm"
                        value={cobroMetodo}
                        onChange={(e) => setCobroMetodo(e.target.value)}
                      >
                        {COBRO_METODOS.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-12 col-md-3">
                      <label className="form-label small mb-1">
                        Importe {cobroAccion === "abono" ? "(abono)" : "(total)"}
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="form-control form-control-sm"
                        value={cobroImporte}
                        onChange={(e) => setCobroImporte(e.target.value)}
                        placeholder={(inspeccion?.cobro?.importe_total || 0) > 0 ? String(Number(inspeccion.cobro.importe_total).toFixed(2)) : "0.00"}
                      />
                    </div>
                    <div className="col-12 col-md-3">
                      <label className="form-label small mb-1">Referencia</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={cobroReferencia}
                        onChange={(e) => setCobroReferencia(e.target.value)}
                        placeholder="Operacion / ticket"
                      />
                    </div>
                    <div className="col-12">
                      <label className="form-label small mb-1">Observaciones de cobro</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={cobroObservaciones}
                        onChange={(e) => setCobroObservaciones(e.target.value)}
                        placeholder="Nota interna del cobro"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {formError && (
          <div className="alert alert-danger d-flex justify-content-between align-items-start py-2 mt-3 no-print">
            <span>{formError}</span>
            <button className="btn-close ms-3" onClick={() => setFormError("")} />
          </div>
        )}

        <div className="d-flex gap-2 justify-content-end mt-3 no-print">
          <button className="btn btn-outline-secondary" onClick={volver}>
            Volver
          </button>
          {inspeccion?.requiere_hoja_intervencion && !isEntregado && (
            <button className="btn btn-outline-secondary" onClick={() => window.print()}>
              🖨 Imprimir hoja de intervención
            </button>
          )}
          {!isEntregado && (
            <button className="btn btn-success" onClick={finalizarEntrega} disabled={guardando}>
              {guardando ? "Finalizando..." : "Finalizar entrega"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActaEntregaView;
