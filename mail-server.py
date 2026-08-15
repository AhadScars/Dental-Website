#!/usr/bin/env python3
"""
Elegancia Dental — local Gmail SMTP mailer + static site.

A browser cannot speak SMTP. Run this file, then open:

    http://127.0.0.1:8787

Save the clinic Gmail and 16-character App Password in Admin → Settings.
New bookings POST to /api/notify-appointment and this process sends mail
through smtp.gmail.com.
"""

from __future__ import annotations

import json
import smtplib
import ssl
import traceback
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
CONFIG_PATH = ROOT / "smtp-config.json"
HOST = "127.0.0.1"
PORT = 8787
SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 465


def load_config() -> dict:
    if not CONFIG_PATH.exists():
        return {}
    try:
        return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def save_config(data: dict) -> dict:
    current = load_config()
    email = (data.get("email") or current.get("email") or "").strip()
    password = (data.get("appPassword") or "").strip().replace(" ", "")
    if not password:
        password = current.get("appPassword") or ""
    payload = {"email": email, "appPassword": password}
    CONFIG_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return payload


def configured(cfg: dict | None = None) -> bool:
    cfg = cfg or load_config()
    return bool(cfg.get("email") and cfg.get("appPassword"))


def html_escape(value) -> str:
    return (
        str(value or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def build_email(data: dict, clinic_from: str) -> MIMEMultipart:
    patient = data.get("patientName") or "Patient"
    date = data.get("date") or "—"
    time = data.get("time") or "—"
    subject = data.get("subject") or f"New appointment · {patient} · {date} {time}"

    rows = [
        ("Booking ID", data.get("id") or data.get("booking_id")),
        ("Patient", patient),
        ("Phone", data.get("phone") or data.get("patient_phone")),
        ("Email", data.get("email") or data.get("patient_email")),
        ("Treatment", data.get("treatmentName") or data.get("treatment")),
        ("Date", date),
        ("Time", time),
        ("Doctor", data.get("doctor")),
        ("Status", data.get("status") or "pending"),
        ("Message", data.get("message") or "—"),
    ]
    table = "".join(
        (
            "<tr>"
            f"<td style='padding:8px 12px 8px 0;color:#66727a;width:140px'>{html_escape(label)}</td>"
            f"<td style='padding:8px 0;border-bottom:1px solid #ebe7e1'><strong>{html_escape(value)}</strong></td>"
            "</tr>"
        )
        for label, value in rows
    )
    html = (
        "<div style='font-family:Georgia,serif;color:#12202c;max-width:560px'>"
        "<h2 style='margin:0 0 8px'>New appointment request</h2>"
        "<p style='margin:0 0 18px;color:#66727a'>Elegancia Dental, Implant &amp; Maxillofacial Centre</p>"
        f"<table style='width:100%;border-collapse:collapse;font-size:15px'>{table}</table>"
        "<p style='margin:22px 0 0;color:#66727a;font-size:13px'>"
        "Open the Elegancia admin desk to confirm or reschedule this visit.</p>"
        "</div>"
    )
    text = "\n".join(f"{label}: {value or '—'}" for label, value in rows)

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"Elegancia Dental <{clinic_from}>"
    msg["To"] = clinic_from
    msg.attach(MIMEText(text, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))
    return msg


def send_gmail(data: dict) -> None:
    cfg = load_config()
    if not configured(cfg):
        raise RuntimeError("Save the clinic Gmail and App Password in Admin → Settings first.")
    sender = cfg["email"]
    password = cfg["appPassword"]
    msg = build_email(data, sender)
    context = ssl.create_default_context()
    with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=context, timeout=30) as server:
        server.login(sender, password)
        server.sendmail(sender, [sender], msg.as_string())


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/smtp-status":
            cfg = load_config()
            self._json(
                200,
                {
                    "ok": True,
                    "running": True,
                    "configured": configured(cfg),
                    "email": cfg.get("email") or "",
                    "host": SMTP_HOST,
                    "port": SMTP_PORT,
                },
            )
            return
        if path in ("/", ""):
            self.path = "/index.html"
        return SimpleHTTPRequestHandler.do_GET(self)

    def do_POST(self):
        path = urlparse(self.path).path
        try:
            length = int(self.headers.get("Content-Length") or 0)
            raw = self.rfile.read(length).decode("utf-8") if length else "{}"
            data = json.loads(raw or "{}")
        except (ValueError, json.JSONDecodeError):
            self._json(400, {"ok": False, "error": "Invalid JSON."})
            return

        if path == "/api/smtp-config":
            email = (data.get("email") or "").strip()
            password = (data.get("appPassword") or "").replace(" ", "")
            if not email or "@" not in email:
                self._json(400, {"ok": False, "error": "Enter the clinic Gmail address."})
                return
            if password and len(password) < 8:
                self._json(400, {"ok": False, "error": "Enter the 16-character Gmail App Password."})
                return
            if not password and not load_config().get("appPassword"):
                self._json(400, {"ok": False, "error": "Enter the Gmail App Password."})
                return
            saved = save_config({"email": email, "appPassword": password})
            self._json(200, {"ok": True, "email": saved["email"], "configured": configured(saved)})
            return

        if path == "/api/notify-appointment":
            try:
                send_gmail(data)
            except smtplib.SMTPAuthenticationError:
                self._json(
                    401,
                    {
                        "ok": False,
                        "error": "Gmail rejected the login. Check the address and App Password.",
                    },
                )
                return
            except Exception as exc:
                traceback.print_exc()
                self._json(500, {"ok": False, "error": str(exc)})
                return
            self._json(200, {"ok": True})
            return

        self._json(404, {"ok": False, "error": "Unknown endpoint."})

    def _json(self, status: int, payload: dict):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        print("[%s] %s" % (self.log_date_time_string(), fmt % args))


def main():
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print("Elegancia mail + site server")
    print(f"Open  http://{HOST}:{PORT}")
    print("Gmail SMTP  smtp.gmail.com:465")
    print("Save the App Password in Admin → Settings")
    print("Ctrl+C to stop")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
        server.server_close()


if __name__ == "__main__":
    main()
