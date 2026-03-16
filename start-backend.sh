#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$REPO_ROOT/backend"

if [[ ! -d "$BACKEND_DIR" ]]; then
  echo "No se encontro la carpeta backend en: $BACKEND_DIR" >&2
  exit 1
fi

cd "$BACKEND_DIR"

if [[ ! -d "venv" ]]; then
  echo "[1/4] Creando entorno virtual..."
  python3 -m venv venv
fi

# shellcheck disable=SC1091
source venv/bin/activate

echo "[2/4] Liberando puerto 5000 si esta ocupado..."
lsof -ti tcp:5000 -sTCP:LISTEN | xargs -r kill
sleep 1

echo "[3/4] Instalando dependencias..."
pip install -r requirements.txt

echo "[4/4] Iniciando backend en http://localhost:5000 ..."
export DEV_AUTH_BYPASS="${DEV_AUTH_BYPASS:-1}"
python app.py
