#!/bin/sh

python manage.py migrate --noinput

python manage.py seed_data

exec gunicorn backend.wsgi:application --bind 0.0.0.0:10000