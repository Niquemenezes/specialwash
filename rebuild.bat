@echo off
echo ========================================
echo   SpecialWash - Rebuild para Ionos
echo ========================================
echo.

cd frontend

echo [1/3] Limpiando build anterior...
if exist build rmdir /s /q build

echo [2/3] Generando nuevo build...
call npm run build

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo   ✅ BUILD COMPLETADO EXITOSAMENTE
    echo ========================================
    echo.
    echo Archivos generados en: frontend\build\
    echo.
    echo Proximos pasos:
    echo 1. Conecta por FTP a Ionos
    echo 2. Sube el contenido de frontend\build\ a la raiz web
    echo 3. Verifica que el backend este corriendo
    echo.
    echo Presiona cualquier tecla para abrir la carpeta build...
    pause > nul
    start "" "%CD%\build"
) else (
    echo.
    echo ========================================
    echo   ❌ ERROR EN EL BUILD
    echo ========================================
    echo.
    echo Revisa los errores anteriores.
    echo.
    pause
)
