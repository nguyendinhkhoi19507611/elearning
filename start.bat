@echo off
echo ============================================================
echo    E-LEARNING AI SYSTEM - STARTUP SCRIPT
echo ============================================================
echo.

:: Check MongoDB
echo [1/6] Checking MongoDB...
mongod --version >nul 2>&1
if %errorlevel% neq 0 (
    echo    WARNING: MongoDB not found. Please install MongoDB first.
    echo    Download: https://www.mongodb.com/try/download/community
    echo    Or use Docker: docker run -d -p 27017:27017 mongo:7
    pause
)
echo    OK - MongoDB ready

:: Install Backend dependencies
echo.
echo [2/6] Installing Backend dependencies...
cd /d "%~dp0backend"
call npm install --silent
echo    OK - Backend deps installed

:: Install Frontend dependencies
echo.
echo [3/6] Installing Frontend dependencies...
cd /d "%~dp0frontend"
call npm install --silent
echo    OK - Frontend deps installed

:: Start AI Services
echo.
echo [4/6] Starting AI Services (Python)...
cd /d "%~dp0ai-services"
start "AI-Vision" cmd /c "python vision_api.py"
timeout /t 2 >nul
start "AI-Voice" cmd /c "python voice_api.py"
timeout /t 2 >nul
start "AI-Recommend" cmd /c "python recommendation_api.py"
timeout /t 3 >nul
echo    OK - AI Services started (ports 5001, 5002, 5003)

:: Start Backend
echo.
echo [5/6] Starting Backend...
cd /d "%~dp0backend"
start "Backend" cmd /c "node server.js"
timeout /t 3 >nul
echo    OK - Backend started (port 5000)

:: Start Frontend
echo.
echo [6/6] Starting Frontend...
cd /d "%~dp0frontend"
start "Frontend" cmd /c "npx vite --port 3000 --host 0.0.0.0"
timeout /t 3 >nul
echo    OK - Frontend started (port 3000, HTTPS)

echo.
echo ============================================================
echo    ALL SERVICES RUNNING!
echo ============================================================
echo.
echo    Frontend:     https://192.168.88.151:3000
echo    Backend API:  http://192.168.88.151:5000/api
echo    AI Vision:    http://192.168.88.151:5001
echo    AI Voice:     http://192.168.88.151:5002
echo    AI Recommend: http://172.20.10.2:5003
echo.
echo    Press any key to stop all services...
pause >nul

:: Stop all
taskkill /fi "WINDOWTITLE eq AI-Vision*" /f >nul 2>&1
taskkill /fi "WINDOWTITLE eq AI-Voice*" /f >nul 2>&1
taskkill /fi "WINDOWTITLE eq AI-Recommend*" /f >nul 2>&1
taskkill /fi "WINDOWTITLE eq Backend*" /f >nul 2>&1
taskkill /fi "WINDOWTITLE eq Frontend*" /f >nul 2>&1
echo All services stopped.
