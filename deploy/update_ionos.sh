#!/bin/bash

set -euo pipefail

APP_DIR="/var/www/specialwash/app"
BACKEND_DIR="$APP_DIR/backend"
VENV_DIR="$BACKEND_DIR/venv"

echo "SpecialWash IONOS update"
echo "========================"

if [[ ! -d "$APP_DIR/.git" ]]; then
  echo "ERROR: no encuentro el repositorio en $APP_DIR"
  exit 1
fi

cd "$APP_DIR"
echo "-> git pull"
git pull

cd "$BACKEND_DIR"

if [[ ! -d "$VENV_DIR" ]]; then
  echo "ERROR: no existe el entorno virtual en $VENV_DIR"
  exit 1
fi

source "$VENV_DIR/bin/activate"
echo "-> pip install -r requirements.txt"
pip install -r requirements.txt

echo "-> validando imports críticos"
python - <<'PY'
import importlib

for module_name in ["openpyxl", "gspread", "google.oauth2.service_account"]:
    importlib.import_module(module_name)

print("Imports OK")
PY

echo "-> reiniciando servicio"
systemctl restart specialwash-backend.service

echo "-> comprobando estado"
systemctl is-active --quiet specialwash-backend.service
echo "OK: backend reiniciado correctamente"
