/**
 * toast — notificaciones no bloqueantes para SpecialWash.
 * Uso: import { toast } from "../utils/toast";
 *      toast.success("Guardado correctamente");
 *      toast.error("Error al eliminar");
 *      toast.info("Operación completada");
 */

let _addToast = null;

export function _registrarAddToast(fn) {
  _addToast = fn;
}

function show(mensaje, tipo = "success", duracion = 3500) {
  if (!_addToast) {
    // Fallback si el componente no está montado aún
    console.info(`[toast:${tipo}]`, mensaje);
    return;
  }
  _addToast({ mensaje, tipo, id: Date.now() + Math.random(), duracion });
}

export const toast = {
  success: (msg, dur) => show(msg, "success", dur),
  error:   (msg, dur) => show(msg, "error",   dur ?? 5000),
  info:    (msg, dur) => show(msg, "info",    dur),
};
