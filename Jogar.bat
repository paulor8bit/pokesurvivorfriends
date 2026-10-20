@echo off
cd /d "%~dp0"
if exist "dist\desktop\PokeSurvivor-Online-1.0.0-x64.exe" (
  start "" "dist\desktop\PokeSurvivor-Online-1.0.0-x64.exe"
  exit /b 0
)
if exist "node_modules\electron\dist\electron.exe" (
  start "" "node_modules\electron\dist\electron.exe" .
  exit /b 0
)
echo Abra PokeSurvivor-Online-1.0.0-x64.exe na pasta dist\desktop.
echo Para desenvolvimento, instale as dependencias antes de usar este iniciador.
pause
