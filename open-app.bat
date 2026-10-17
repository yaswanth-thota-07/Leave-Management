@echo off
title DLMS MERN Application
echo Starting DLMS Application...
cd /d "%~dp0"
start "" "http://localhost:5000"
node server.js
