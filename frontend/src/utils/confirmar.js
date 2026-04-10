/**
 * confirmar() — reemplaza window.confirm con un modal visual.
 *
 * Uso:
 *   const ok = await confirmar("¿Eliminar este producto?");
 *   if (!ok) return;
 *
 * Opcional, para acciones no destructivas:
 *   await confirmar("¿Marcar como pagado?", { labelConfirmar: "Sí, marcar", danger: false });
 */

const _state = { resolver: null, setVisible: null };

/** Llamado internamente por <ModalConfirmar> al montarse. */
export function _registrarSetter(fn) {
  _state.setVisible = fn;
}

/** Llamado internamente por <ModalConfirmar> al pulsar un botón. */
export function _resolver(result) {
  const r = _state.resolver;
  _state.resolver = null;
  _state.setVisible?.({ show: false });
  r?.(result);
}

/**
 * @param {string} mensaje  — texto principal del modal
 * @param {object} [opts]
 * @param {string} [opts.titulo]          — título del modal (por defecto "Confirmar")
 * @param {string} [opts.labelConfirmar]  — texto del botón positivo (por defecto "Eliminar")
 * @param {string} [opts.labelCancelar]   — texto del botón negativo (por defecto "Cancelar")
 * @param {boolean} [opts.danger]         — true=botón rojo, false=botón dorado (por defecto true)
 * @returns {Promise<boolean>}
 */
export function confirmar(mensaje, opts = {}) {
  return new Promise((resolve) => {
    _state.resolver = resolve;
    _state.setVisible?.({
      show: true,
      mensaje,
      titulo: opts.titulo ?? "Confirmar",
      labelConfirmar: opts.labelConfirmar ?? "Eliminar",
      labelCancelar: opts.labelCancelar ?? "Cancelar",
      danger: opts.danger ?? true,
    });
  });
}
