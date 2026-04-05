import React, { useContext, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Context } from "../store/appContext";

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

const parseActa = (texto = "") => {
  const lines = texto.split("\n");
  const obsPrefix = "Observaciones de entrega:";
  const obsLine = lines.find((line) => line.trim().startsWith(obsPrefix));
  const observacionesRaw = obsLine ? obsLine.replace(obsPrefix, "").trim() : "";
  const contenido = lines.filter((line) => !line.trim().startsWith(obsPrefix)).join("\n").trim();
  const { observaciones, firmante } = splitObservaciones(observacionesRaw);
  return { contenido, observaciones, firmante };
};

const normalizeTechnicalContent = (contenido = "") => {
  const original = String(contenido || "").trim();
  if (!original) return "";

  const lines = original.split("\n");
  let i = 0;

  while (i < lines.length && !lines[i].trim()) i += 1;

  // Quitar encabezado duplicado si viene dentro del cuerpo del acta.
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

const ActaEntregaDocumento = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { actions } = useContext(Context);
  const [inspeccion, setInspeccion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [printTriggered, setPrintTriggered] = useState(false);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Informe Tecnico de Intervencion - Special Wash";
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
        if (active) setInspeccion(data);
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
  const contenidoTecnico = useMemo(() => normalizeTechnicalContent(acta.contenido), [acta.contenido]);
    const volver = () => {
      if (window.history.length > 1) {
        navigate(-1);
        return;
      }
      navigate("/pendientes-entrega", { replace: true });
    };

  const observacionesEntrega = useMemo(() => {
    const obs = splitObservaciones(inspeccion?.entrega_observaciones || "");
    return obs.observaciones || acta.observaciones || "-";
  }, [inspeccion?.entrega_observaciones, acta.observaciones]);

  useEffect(() => {
    if (!inspeccion || printTriggered) return;
    const params = new URLSearchParams(location.search);
    if (params.get("print") === "1") {
      setPrintTriggered(true);
      setTimeout(() => window.print(), 200);
    }
  }, [inspeccion, location.search, printTriggered]);

  if (loading) return <div className="container py-4">Cargando hoja de intervencion...</div>;
  if (error) return <div className="container py-4"><div className="alert alert-danger">{error}</div></div>;
  if (!inspeccion) return <div className="container py-4">No se encontro la inspeccion.</div>;

  return (
    <div className="container py-4 print-acta-page" style={{ maxWidth: "1000px" }}>
      <style>
        {`
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
            .print-wrap { box-shadow: none !important; border: 0 !important; margin: 0 !important; }
            .print-doc { border: 0 !important; padding: 0 !important; }
            body { background: #fff !important; }
            .premium-doc,
            .single-header,
            .doc-box,
            .doc-line {
              border-color: #000 !important;
              color: #000 !important;
            }
            .single-title,
            .single-subtitle,
            .single-tagline,
            .doc-content,
            .footer-note {
              color: #000 !important;
            }
            .doc-content {
              font-size: 16px !important;
              line-height: 1.6 !important;
            }
            .avoid-break {
              break-inside: avoid-page !important;
              page-break-inside: avoid !important;
            }
            @page { size: A4; margin: 14mm; }
          }
          .premium-doc {
            background: #fff;
            border: 1px solid #d8d2c6;
            border-radius: 14px;
            padding: 30px 34px;
            color: #1e1b16;
            font-family: "Georgia", "Times New Roman", serif;
            background-image: none;
          }
          .single-header {
            border-bottom: 1px solid #ded6c7;
            padding-bottom: 12px;
            margin-bottom: 14px;
            text-align: center;
          }
          .single-title {
            margin: 0;
            font-weight: 700;
            letter-spacing: 1px;
            font-size: 34px;
            color: #2e271d;
            text-transform: uppercase;
          }
          .single-subtitle {
            margin-top: 8px;
            font-size: 22px;
            font-weight: 600;
            color: #443b2f;
          }
          .single-tagline {
            margin-top: 4px;
            font-size: 14px;
            letter-spacing: 0.4px;
            color: #6b6354;
          }
          .print-acta-page .btn-outline-secondary {
            color: #5c5447 !important;
            border-color: #bbb09e !important;
            background: #fff !important;
          }
          .print-acta-page .btn-outline-secondary:hover,
          .print-acta-page .btn-outline-secondary:focus {
            color: #2a231b !important;
            border-color: #9f937f !important;
            background: #f7f2e8 !important;
          }
          .print-acta-page .btn-outline-secondary:disabled {
            color: #8f8678 !important;
            border-color: #d5cdbc !important;
            background: #faf8f3 !important;
          }
          .doc-subtle { color: #6a665f; }
          .doc-line { border-top: 1px solid #d9d2c7; margin: 18px 0; }
          .doc-box {
            border: 1px solid #ddd3c2;
            border-radius: 10px;
            padding: 18px;
            background: #fffdf8;
            position: relative;
            overflow: hidden;
          }
          .meta-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
            margin-bottom: 14px;
          }
          .meta-item {
            border: 1px solid #ddd3c2;
            border-radius: 8px;
            padding: 9px 10px;
            background: #fff;
            font-size: 14px;
          }
          .meta-item strong {
            display: block;
            font-size: 11px;
            letter-spacing: 0.5px;
            color: #5f574a;
            margin-bottom: 2px;
            text-transform: uppercase;
          }
          .doc-content { white-space: pre-wrap; line-height: 1.55; font-size: 15px; }
          .section-title {
            font-size: 14px;
            letter-spacing: 0.9px;
            color: #685f50;
            text-transform: uppercase;
            margin-bottom: 8px;
            font-weight: 700;
          }
          .footer-note {
            font-size: 12px;
            color: #6f6759;
            margin-top: 12px;
          }
          @media (max-width: 768px) {
            .premium-doc { padding: 22px 16px; }
            .single-title { font-size: 26px; }
            .single-subtitle { font-size: 18px; }
            .single-tagline { font-size: 12px; }
            .meta-grid { grid-template-columns: 1fr; }
          }
        `}
      </style>

      <div className="d-flex justify-content-between align-items-center mb-3 no-print gap-2 flex-wrap">
        <small className="text-muted">
          Para ocultar fecha/URL al imprimir: desactiva "Headers and footers" en el dialogo de impresion del navegador.
        </small>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-secondary" onClick={volver}>
            Volver
          </button>
          <button className="btn btn-outline-secondary" onClick={() => window.print()}>
            Imprimir borrador
          </button>
        </div>
      </div>

      <div className="print-wrap premium-doc print-acta-document">
        <div className="single-header avoid-break">
          <div>
            <h3 className="single-title">INFORME TECNICO DE INTERVENCION</h3>
            <div className="single-subtitle">Special Wash Studio</div>
            <div className="single-tagline">Detailing · Paint Lab · Restauracion de Interiores</div>
          </div>
        </div>

        <div className="meta-grid avoid-break">
          <div className="meta-item"><strong>Cliente</strong>{inspeccion.cliente_nombre || "-"}</div>
          <div className="meta-item"><strong>Vehiculo</strong>{inspeccion.coche_descripcion || "-"}</div>
          <div className="meta-item"><strong>Matricula</strong>{inspeccion.matricula || "-"}</div>
          <div className="meta-item"><strong>Kilometraje</strong>{safeNumber(inspeccion.kilometros)} km</div>
          <div className="meta-item"><strong>Fecha inspeccion</strong>{safeDate(inspeccion.fecha_inspeccion)}</div>
        </div>

        <div className="doc-box mb-3 avoid-break">
          <div className="doc-content">{contenidoTecnico || "(Sin contenido en acta)"}</div>
        </div>

        <div className="doc-box mb-3 avoid-break">
          <div className="section-title">Observaciones de entrega</div>
          <div className="doc-content">{observacionesEntrega}</div>
        </div>

        <div className="doc-line" />
        <p className="footer-note mb-0 avoid-break">
          Este documento no incluye firma ni datos de recepcion final. Es un borrador tecnico para validacion interna.
        </p>
      </div>
    </div>
  );
};

export default ActaEntregaDocumento;
