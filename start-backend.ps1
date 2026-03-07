$ErrorActionPreference = "Stop"

$repoRoot = $PSScriptRoot
$backendPath = Join-Path $repoRoot "backend"

if (-not (Test-Path $backendPath)) {
    throw "No se encontro la carpeta backend en: $backendPath"
}

Set-Location $backendPath

# Busca Python en Windows (primero py launcher, luego python).
$pythonCmd = $null
$pythonArgs = @()

if (Get-Command py -ErrorAction SilentlyContinue) {
    $pythonCmd = "py"
    $pythonArgs = @("-3")
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    $pythonCmd = "python"
    $pythonArgs = @()
} else {
    throw "Python no esta disponible en PATH. Instala Python 3 y vuelve a intentarlo."
}

$venvPython = Join-Path $backendPath "venv\Scripts\python.exe"

if (-not (Test-Path $venvPython)) {
    Write-Host "[1/3] Creando entorno virtual..."
    & $pythonCmd @pythonArgs -m venv venv
}

Write-Host "[2/3] Instalando dependencias..."
& $venvPython -m pip install -r requirements.txt

Write-Host "[3/3] Iniciando backend en http://localhost:5000 ..."
& $venvPython app.py
