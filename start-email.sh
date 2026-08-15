#!/bin/sh
cd "$(dirname "$0")"
echo "Starting Elegancia site + Gmail SMTP mailer..."
echo "Open http://127.0.0.1:8787"
python3 mail-server.py
