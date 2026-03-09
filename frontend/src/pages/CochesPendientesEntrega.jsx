import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Context } from "../store/appContext";

const formatFecha = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("es-ES");
};

const parseActaDesdeTexto = (texto = "") => {
  const lines = texto.split("\n");
  const obsPrefix = "Observaciones de entrega:";
  const obsLine = lines.find((line) => line.trim().startsWith(obsPrefix));
  const observaciones = obsLine ? obsLine.replace(obsPrefix, "").trim() : "";

  const contenido = lines
    .filter((line) => !line.trim().startsWith(obsPrefix))
    .join("\n")
    .trim();

  return { contenido, observaciones };
};

const buildActaTexto = (contenido, observaciones) => {
  const bloques = [];
  if ((contenido || "").trim()) bloques.push((contenido || "").trim());
  if ((observaciones || "").trim()) {
    bloques.push(`Observaciones de entrega: ${(observaciones || "").trim()}`);
  }
  return bloques.join("\n\n").trim();
};

const DEFAULT_SECTION_TITLES = [
  "Estado del vehiculo a la recepcion",
  "Trabajos realizados",
  "Observaciones tecnicas",
  "Posibles efectos derivados",
  "Conclusion",
];

const extractSectionByNumber = (text, number) => {
  const next = number + 1;
  const regex = new RegExp(
    `(?:^|\\n)\\s*${number}[\\)\\.]\\s*[^\\n]*\\n([\\s\\S]*?)(?=\\n\\s*${next}[\\)\\.]\\s|$)`,
    "i"
  );
  const match = String(text || "").match(regex);
  return match ? match[1].trim() : "";
};

const parseCamposInforme = (contenido = "") => {
  const estadoRecepcion = extractSectionByNumber(contenido, 1);
  const trabajosRealizados = extractSectionByNumber(contenido, 2);
  const observacionesTecnicas = extractSectionByNumber(contenido, 3);
  const posiblesEfectos = extractSectionByNumber(contenido, 4);
  const conclusion = extractSectionByNumber(contenido, 5);

  const hasStructured = [
    estadoRecepcion,
    trabajosRealizados,
    observacionesTecnicas,
    posiblesEfectos,
    conclusion,
  ].some((v) => (v || "").trim());

  return {
    estadoRecepcion,
    trabajosRealizados: hasStructured ? trabajosRealizados : String(contenido || "").trim(),
    observacionesTecnicas,
    posiblesEfectos,
    conclusion,
  };
};

const createSectionsFromData = (campos, estadoDesdeInspeccion) => {
  const values = [
    estadoDesdeInspeccion || campos.estadoRecepcion || "",
    campos.trabajosRealizados || "",
    campos.observacionesTecnicas || "",
    campos.posiblesEfectos || "",
    campos.conclusion || "",
  ];

  return DEFAULT_SECTION_TITLES.map((title, idx) => ({
    id: `sec-${idx + 1}`,
    title,
    content: values[idx],
    fromInspection: idx === 0 && Boolean(estadoDesdeInspeccion),
  }));
};

const buildInformeTecnicoFromSections = (sections = []) => {
  const norm = (v) => (String(v || "").trim() ? String(v || "").trim() : "-");
  return sections
    .map((section, idx) => `${idx + 1}) ${section.title || "Punto"}\n${norm(section.content)}`)
    .join("\n\n");
};

const cleanSectionDraft = (text = "", title = "") => {
  const raw = String(text || "").trim();
  if (!raw) return "";

  const noNumeric = raw.replace(/^\s*\d+[).]\s*[\s\S]*?\n/, "").trim();
  const titleRegex = new RegExp(`^${String(title || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[:.-]?\\s*`, "i");
  return noNumeric.replace(titleRegex, "").trim() || raw;
};

const PREMIUM_TONE_RULES = [
  "Usa un tono profesional, tecnico y objetivo.",
  "Escribe frases cortas, directas y verificables.",
  "Evita lenguaje comercial o adjetivos grandilocuentes.",
  "Sin exageraciones, sin promesas y sin florituras.",
].join(" ");

const CochesPendientesEntrega = () => {
  const { actions } = useContext(Context);
  const navigate = useNavigate();
  const [inspecciones, setInspecciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showActaModal, setShowActaModal] = useState(false);
  const [inspeccionActa, setInspeccionActa] = useState(null);
  const [observacionesActa, setObservacionesActa] = useState("");
  const [guardandoActa, setGuardandoActa] = useState(false);
  const [aiObservacionesLoading, setAiObservacionesLoading] = useState(false);
  const [sections, setSections] = useState(() =>
    DEFAULT_SECTION_TITLES.map((title, idx) => ({ id: `sec-${idx + 1}`, title, content: "", fromInspection: false }))
  );
  const [aiBySection, setAiBySection] = useState({});

  const cargarPendientes = useCallback(async () => {
    setLoading(true);
    const data = await actions.getMisInspecciones();
    setInspecciones(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [actions]);

  useEffect(() => {
    cargarPendientes();
  }, [cargarPendientes]);

  const pendientes = useMemo(() => {
    return inspecciones
      .filter((inspeccion) => !inspeccion.entregado)
      .sort((a, b) => new Date(b.fecha_inspeccion || 0) - new Date(a.fecha_inspeccion || 0));
  }, [inspecciones]);

  const abrirPrepararActa = async (inspeccionId) => {
    try {
      const detalle = await actions.getInspeccion(inspeccionId);
      const parsed = parseActaDesdeTexto(detalle?.trabajos_realizados || "");
      const campos = parseCamposInforme(parsed.contenido || "");
      const estadoDesdeInspeccion = (detalle?.averias_notas || "").trim();
      setInspeccionActa(detalle);
      setObservacionesActa(detalle?.entrega_observaciones || parsed.observaciones || "");
      setSections(createSectionsFromData(campos, estadoDesdeInspeccion));
      setAiBySection({});
      setShowActaModal(true);
    } catch (err) {
      alert(`No se pudo abrir el acta: ${err.message}`);
    }
  };

  const cerrarPrepararActa = () => {
    setShowActaModal(false);
    setInspeccionActa(null);
    setObservacionesActa("");
    setGuardandoActa(false);
    setAiObservacionesLoading(false);
    setSections(DEFAULT_SECTION_TITLES.map((title, idx) => ({ id: `sec-${idx + 1}`, title, content: "", fromInspection: false })));
    setAiBySection({});
  };

  const actualizarSeccion = (id, patch) => {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const agregarSeccion = () => {
    setSections((prev) => [
      ...prev,
      {
        id: `sec-${Date.now()}`,
        title: "Nuevo punto",
        content: "",
        fromInspection: false,
      },
    ]);
  };

  const eliminarSeccion = (id) => {
    setSections((prev) => (prev.length > 1 ? prev.filter((s) => s.id !== id) : prev));
  };

  const redactarSeccionConAI = async (section, index) => {
    if (!inspeccionActa) return;
    setAiBySection((prev) => ({ ...prev, [section.id]: true }));
    try {
      const contextoActual = buildInformeTecnicoFromSections(sections);
      const promptSeccion = [
        `Redacta solo el punto ${index + 1}: ${section.title}.`,
        PREMIUM_TONE_RULES,
        "Maximo 70 palabras. Solo hechos tecnicos y resultados observables.",
        "No repitas todo el informe, responde solo con el texto del punto.",
        `Texto base del punto: ${section.content || "(vacio)"}`,
        "",
        "Contexto del informe completo:",
        contextoActual,
      ].join("\n");

      const data = await actions.sugerirActaInspeccion(inspeccionActa.id, {
        borrador: promptSeccion,
        averias_notas: inspeccionActa?.averias_notas || "",
      });

      const texto = (data?.texto || "").trim();
      if (!texto) {
        alert("La AI no devolvio texto para esta seccion.");
        return;
      }

      const maybeByNumber = extractSectionByNumber(texto, index + 1);
      const finalText = cleanSectionDraft(maybeByNumber || texto, section.title);
      actualizarSeccion(section.id, { content: finalText || section.content });
    } catch (err) {
      alert(`No se pudo generar esta seccion con AI: ${err.message}`);
    } finally {
      setAiBySection((prev) => ({ ...prev, [section.id]: false }));
    }
  };

  const redactarObservacionesConAI = async () => {
    if (!inspeccionActa) return;
    setAiObservacionesLoading(true);
    try {
      const contextoActual = buildInformeTecnicoFromSections(sections);
      const promptObservaciones = [
        "Redacta solo el bloque 'Observaciones de entrega'.",
        PREMIUM_TONE_RULES,
        "Maximo 45 palabras. Cierre sobrio, tecnico y sin promocion.",
        "No repitas todo el informe tecnico, responde unicamente con las observaciones finales.",
        `Texto base actual: ${observacionesActa || "(vacio)"}`,
        "",
        "Contexto del informe tecnico:",
        contextoActual,
      ].join("\n");

      const data = await actions.sugerirActaInspeccion(inspeccionActa.id, {
        borrador: promptObservaciones,
        averias_notas: inspeccionActa?.averias_notas || "",
      });

      const texto = String(data?.texto || "").trim();
      if (!texto) {
        alert("La AI no devolvio texto para las observaciones finales.");
        return;
      }

      // Si el modelo devuelve prefijos o titulo, los limpiamos para guardar solo el contenido.
      const cleaned = texto
        .replace(/^\s*observaciones\s*(de\s*entrega)?\s*[:.-]?\s*/i, "")
        .trim();

      setObservacionesActa(cleaned || texto);
    } catch (err) {
      alert(`No se pudo generar observaciones con AI: ${err.message}`);
    } finally {
      setAiObservacionesLoading(false);
    }
  };

  const guardarActa = async () => {
    if (!inspeccionActa) return;

    const informeTecnico = buildInformeTecnicoFromSections(sections);

    const hayContenido = sections.some((s) => String(s.content || "").trim());
    if (!hayContenido) {
      alert("Debes rellenar al menos un punto del informe tecnico antes de guardar.");
      return;
    }

    const texto = buildActaTexto(informeTecnico, observacionesActa);
    if (!texto.trim()) {
      alert("Debes rellenar el contenido del acta antes de guardar.");
      return;
    }

    setGuardandoActa(true);
    try {
      await actions.guardarActaInspeccion(inspeccionActa.id, {
        trabajos_realizados: texto,
        entrega_observaciones: observacionesActa,
      });
      await cargarPendientes();
      alert("Acta guardada correctamente.");
      cerrarPrepararActa();
    } catch (err) {
      alert(`Error al guardar acta: ${err.message}`);
      setGuardandoActa(false);
    }
  };

  const volver = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/", { replace: true });
  };

  return (
    <div className="container py-4" style={{ maxWidth: "900px" }}>
      <div className="card shadow-sm border-0">
        <div className="card-header py-3" style={{ background: "#d4af37", fontWeight: 600 }}>
          <div className="d-flex justify-content-between align-items-center">
            <span>Coches Pendientes de Entrega</span>
            <div className="d-flex gap-2">
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={volver}>
                Volver
              </button>
              <Link className="btn btn-outline-success btn-sm" to="/firma-entrega">
                Firma de entrega
              </Link>
              <Link className="btn btn-outline-dark btn-sm" to="/entregados">
                Ver entregados
              </Link>
            </div>
          </div>
        </div>
        <div className="card-body p-4">
          <div className="d-flex justify-content-end mb-3">
            <button className="btn btn-outline-secondary btn-sm" onClick={cargarPendientes}>
              Actualizar
            </button>
          </div>

          {loading && <p className="text-muted mb-0">Cargando pendientes...</p>}

          {!loading && pendientes.length === 0 && (
            <p className="text-muted mb-0">No hay coches pendientes de entrega.</p>
          )}

          {!loading && pendientes.length > 0 && (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>#</th>
                    <th>Cliente</th>
                    <th>Coche</th>
                    <th>Matricula</th>
                    <th>Fecha inspeccion</th>
                    <th>Estado acta</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pendientes.map((inspeccion) => (
                    <tr key={inspeccion.id}>
                      <td>{inspeccion.id}</td>
                      <td>{inspeccion.cliente_nombre || "-"}</td>
                      <td>{inspeccion.coche_descripcion || "-"}</td>
                      <td>{inspeccion.matricula || "-"}</td>
                      <td>{formatFecha(inspeccion.fecha_inspeccion)}</td>
                      <td>
                        {(inspeccion.trabajos_realizados || "").trim() ? (
                          <div className="d-flex flex-column gap-2">
                            <span className="badge bg-success align-self-start">Acta guardada</span>
                            <div className="d-flex gap-2 flex-wrap">
                              <a
                                className="btn btn-outline-secondary btn-sm"
                                href={`/acta-entrega-doc/${inspeccion.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Imprimir borrador
                              </a>
                              <a
                                className="btn btn-outline-dark btn-sm"
                                href={`/acta-entrega-doc/${inspeccion.id}?print=1`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Descargar PDF
                              </a>
                            </div>
                          </div>
                        ) : (
                          <span className="badge bg-secondary">Sin acta</span>
                        )}
                      </td>
                      <td>
                        <div className="d-flex gap-2">
                          <button
                            type="button"
                            className="btn btn-outline-primary btn-sm"
                            onClick={() => abrirPrepararActa(inspeccion.id)}
                          >
                            Preparar acta
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showActaModal && inspeccionActa && (
        <div className="modal d-block" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
          <div className="modal-dialog modal-lg modal-dialog-scrollable modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header" style={{ background: "linear-gradient(120deg, #f8f2e6 0%, #fffdfa 55%, #f4ead8 100%)" }}>
                <h5 className="modal-title fw-bold">Preparar acta #{inspeccionActa.id}</h5>
                <button type="button" className="btn-close" onClick={cerrarPrepararActa}></button>
              </div>

              <div className="modal-body">
                <div className="mb-3 p-3 rounded" style={{ border: "1px solid #e6dece", background: "#fffdf9" }}>
                  <div className="d-flex flex-wrap justify-content-between gap-2 mb-2">
                    <div><strong>Cliente:</strong> {inspeccionActa.cliente_nombre || "-"}</div>
                    <div><strong>Telefono:</strong> {inspeccionActa.cliente_telefono || "-"}</div>
                  </div>
                  <div className="d-flex flex-wrap justify-content-between gap-2 mb-2">
                    <div><strong>Vehiculo:</strong> {inspeccionActa.coche_descripcion || "-"}</div>
                    <div><strong>Matricula:</strong> {inspeccionActa.matricula || "-"}</div>
                  </div>
                  <div><strong>Kilometraje:</strong> {Number(inspeccionActa.kilometros || 0).toLocaleString("es-ES")} km</div>
                </div>

                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h6 className="mb-0 fw-bold">Informe tecnico de intervencion</h6>
                  <button type="button" className="btn btn-outline-dark btn-sm" onClick={agregarSeccion}>
                    + Agregar punto
                  </button>
                </div>

                {sections.map((section, idx) => (
                  <div key={section.id} className="mb-3 p-3 rounded" style={{ border: "1px solid #e6dece", background: "#fff" }}>
                    <div className="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-2">
                      <div className="d-flex align-items-center gap-2 flex-grow-1">
                        <span className="badge text-bg-light border">{idx + 1}</span>
                        <input
                          className="form-control form-control-sm"
                          value={section.title}
                          onChange={(e) => actualizarSeccion(section.id, { title: e.target.value })}
                          placeholder="Titulo del punto"
                        />
                      </div>
                      <div className="d-flex gap-2">
                        <button
                          type="button"
                          className="btn btn-dark btn-sm"
                          onClick={() => redactarSeccionConAI(section, idx)}
                          disabled={Boolean(aiBySection[section.id]) || guardandoActa}
                        >
                          {aiBySection[section.id] ? "AI..." : "AI en este punto"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-danger btn-sm"
                          onClick={() => eliminarSeccion(section.id)}
                          disabled={sections.length === 1}
                        >
                          Quitar
                        </button>
                      </div>
                    </div>

                    <textarea
                      className="form-control"
                      rows="3"
                      value={section.content}
                      onChange={(e) => actualizarSeccion(section.id, { content: e.target.value })}
                      placeholder="Describe este punto en lenguaje tecnico y valor percibido premium..."
                      style={section.fromInspection ? { backgroundColor: "#f8f9fa" } : undefined}
                    />
                    {section.fromInspection && (
                      <div className="form-text">Texto precargado desde la inspeccion de recepcion.</div>
                    )}
                  </div>
                ))}

                <div className="mb-3">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <label className="form-label fw-bold mb-0">Observaciones de entrega</label>
                    <button
                      type="button"
                      className="btn btn-dark btn-sm"
                      onClick={redactarObservacionesConAI}
                      disabled={aiObservacionesLoading || guardandoActa}
                    >
                      {aiObservacionesLoading ? "AI..." : "AI observaciones"}
                    </button>
                  </div>
                  <textarea
                    className="form-control"
                    rows="3"
                    value={observacionesActa}
                    onChange={(e) => setObservacionesActa(e.target.value)}
                    placeholder="Cierre profesional premium: valor entregado, nivel de detalle y confianza al cliente..."
                  />
                </div>
              </div>

              <div className="modal-footer d-flex justify-content-end">
                <div className="d-flex gap-2">
                  <button type="button" className="btn btn-outline-secondary" onClick={cerrarPrepararActa}>
                    Cancelar
                  </button>
                  <button type="button" className="btn btn-primary" onClick={guardarActa} disabled={guardandoActa}>
                    {guardandoActa ? "Guardando..." : "Guardar acta"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CochesPendientesEntrega;
