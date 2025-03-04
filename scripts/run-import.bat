@echo off
setlocal

rem Change to the scripts directory
cd /d "%~dp0"

rem Install dependencies
echo Installing dependencies...
call npm install

rem Check if Supabase credentials are provided
if "%SUPABASE_URL%"=="" (
  echo Please provide Supabase credentials:
  set /p SUPABASE_URL=Enter your Supabase URL: 
)

if "%SUPABASE_ANON_KEY%"=="" (
  set /p SUPABASE_ANON_KEY=Enter your Supabase Anon Key: 
)

rem Run the import script
echo Running import script...
call npm run import

echo Import process completed.
endlocal
