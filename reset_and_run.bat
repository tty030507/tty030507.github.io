@echo off
echo ===================================================
echo [RESETTING SYSTEM] Destroying and rebuilding DB...
echo ===================================================

:: 1. Delete the old SQLite database file.
if exist db.sqlite3 del /f /q db.sqlite3

:: 2. Delete old migration files, keeping __init__.py.
del /f /q identity_core\migrations\0*.py

:: 3. Generate fresh migration files.
call python manage.py makemigrations identity_core

:: 4. Apply the database migrations.
call python manage.py migrate

:: 5. Run the updated seed_data command.
call python manage.py seed_data

echo ===================================================
echo [LAUNCHING SERVER] Starting Django Development...
echo ===================================================
call python manage.py runserver