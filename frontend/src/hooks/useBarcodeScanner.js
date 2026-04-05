import { useEffect, useRef, useCallback } from "react";

/**
 * Hook para capturar eventos del scanner de código de barras a nivel global.
 * Los scanners típicamente envían: [datos rápidos] + Enter
 * 
 * @param {Function} onBarcodeDetected - Callback cuando se detecta un código
 * @param {Object} options - Configuración
 * @param {number} options.debounceTime - Tiempo máximo para considerar entrada rápida (ms) - default 100
 * @param {boolean} options.enabled - Habilitar/deshabilitar - default true
 */
export function useBarcodeScanner(onBarcodeDetected, options = {}) {
  const {
    debounceTime = 100,
    enabled = true,
  } = options;

  const bufferRef = useRef("");
  const lastKeyTimeRef = useRef(0);
  const debounceTimerRef = useRef(null);

  const isEditableTarget = (target) => {
    if (!target || typeof target !== "object") return false;
    const tag = target.tagName;
    return (
      target.isContentEditable ||
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      tag === "SELECT"
    );
  };

  const handleKeyDown = useCallback(
    (e) => {
      if (!enabled || !onBarcodeDetected) return;

      // No interceptar escritura/Enter de formularios normales
      if (isEditableTarget(e.target)) return;

      const now = Date.now();
      const timeSinceLastKey = now - lastKeyTimeRef.current;

      // Si pasó mucho tiempo desde la última tecla, reinicia el buffer
      if (timeSinceLastKey > debounceTime * 3) {
        bufferRef.current = "";
      }

      lastKeyTimeRef.current = now;

      // Si presionan Enter
      if (e.key === "Enter") {
        const barcode = bufferRef.current.trim();
        
        if (barcode && barcode.length > 0) {
          e.preventDefault();
          onBarcodeDetected(barcode);
          bufferRef.current = "";
        }
        return;
      }

      // Ignorar teclas especiales, pero permitir números y caracteres
      if (
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.metaKey
      ) {
        bufferRef.current += e.key;

        // Clear debounce timer
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }

        // Si llevan mucho sin presionar nada, probablemente fue entrada manual
        debounceTimerRef.current = setTimeout(() => {
          bufferRef.current = "";
        }, debounceTime * 5);
      }
    },
    [enabled, onBarcodeDetected, debounceTime]
  );

  useEffect(() => {
    if (!enabled) {
      document.removeEventListener("keydown", handleKeyDown);
      return;
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [enabled, handleKeyDown]);

  /**
   * Función para limpiar el buffer manualmente
   */
  const clearBuffer = useCallback(() => {
    bufferRef.current = "";
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  }, []);

  return { clearBuffer };
}
