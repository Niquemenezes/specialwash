#!/usr/bin/env bash
set -euo pipefail

DB_PATH="${1:-instance/specialwash.db}"

if [[ ! -f "$DB_PATH" ]]; then
  echo "ERROR: no existe la base de datos en $DB_PATH"
  exit 1
fi

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "ERROR: sqlite3 no esta instalado en este entorno"
  exit 1
fi

pass_count=0
fail_count=0

ok() {
  echo "OK   - $1"
  pass_count=$((pass_count + 1))
}

fail() {
  echo "FAIL - $1"
  fail_count=$((fail_count + 1))
}

has_column() {
  local table="$1"
  local column="$2"
  sqlite3 "$DB_PATH" "PRAGMA table_info($table);" | awk -F'|' '{print $2}' | grep -qx "$column"
}

check_column() {
  local table="$1"
  local column="$2"
  if has_column "$table" "$column"; then
    ok "$table.$column"
  else
    fail "$table.$column"
  fi
}

echo "Verificando esquema en: $DB_PATH"
echo ""

# inspeccion_recepcion (entrega/cobro/repaso)
check_column "inspeccion_recepcion" "trabajos_realizados"
check_column "inspeccion_recepcion" "entrega_observaciones"
check_column "inspeccion_recepcion" "es_concesionario"
check_column "inspeccion_recepcion" "cobro_estado"
check_column "inspeccion_recepcion" "cobro_importe_pagado"
check_column "inspeccion_recepcion" "cobro_fecha_ultimo_pago"
check_column "inspeccion_recepcion" "cobro_metodo"
check_column "inspeccion_recepcion" "cobro_referencia"
check_column "inspeccion_recepcion" "cobro_observaciones"
check_column "inspeccion_recepcion" "repaso_checklist"
check_column "inspeccion_recepcion" "repaso_notas"
check_column "inspeccion_recepcion" "repaso_completado"

# parte_trabajo
check_column "parte_trabajo" "pausas"
check_column "parte_trabajo" "tiempo_estimado_minutos"

# acta_entrega
check_column "acta_entrega" "inspeccion_id"
check_column "acta_entrega" "trabajos_realizados"
check_column "acta_entrega" "firma_cliente_entrega"
check_column "acta_entrega" "fecha_entrega"

echo ""
echo "Resumen: $pass_count OK / $fail_count FAIL"

if [[ "$fail_count" -gt 0 ]]; then
  echo ""
  echo "Sugerencia: ejecuta los scripts de actualizacion en backend:"
  echo "  ./venv/bin/python update_inspeccion_schema.py"
  echo "  ./venv/bin/python update_parte_trabajo_schema.py"
  echo "  ./venv/bin/python update_acta_entrega_schema.py"
  exit 2
fi

echo "Esquema listo."
