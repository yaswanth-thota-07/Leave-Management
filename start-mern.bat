@echo off
title DLMS MERN Server
echo ========================================================
echo Starting DLMS MERN Server (MongoDB + Express + Node.js)
echo Connecting to local MongoDB at mongodb://127.0.0.1:27017/dlms
echo ========================================================
cd /d "%~dp0"
start "" "http://localhost:5000"
node server.js
pause
