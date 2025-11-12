@echo off
echo.
echo =================================================
echo    SCRIPT DE RESTAURACAO E DEPLOY - AUTOPOST APP
echo =================================================
echo.
echo Este script fara o deploy da versao estavel para o Firebase e Vercel.
echo.
pause
echo.

echo --- PASSO 1: FAZENDO DEPLOY DO FRONTEND (VERCEL) ---
git push
IF %ERRORLEVEL% NEQ 0 (
    echo.
    echo X ERRO: Falha ao fazer o deploy do frontend. Verifique o git.
    pause
    exit /b
)
echo.
echo >> Frontend (Vercel) atualizado com sucesso!
echo.

echo --- PASSO 2: FAZENDO DEPLOY DO BACKEND (FIREBASE) ---
firebase deploy --only functions
IF %ERRORLEVEL% NEQ 0 (
    echo.
    echo X ERRO: Falha ao fazer o deploy do backend. Verifique o Firebase.
    pause
    exit /b
)
echo.
echo >> Backend (Firebase) atualizado com sucesso!
echo.

echo =================================================
echo      RESTAURACAO CONCLUIDA COM SUCESSO!
echo =================================================
echo.
pause
