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

import hashlib
import hmac
import json
import secrets
import smtplib
import ssl
import time
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


def send_patient_status(data: dict, sender: str, password: str) -> None:
    to = (data.get("to") or data.get("patientEmail") or data.get("email") or data.get("patient_email") or "").strip()
    if not to or "@" not in to:
        raise RuntimeError("This booking has no patient email to notify.")
    action = data.get("action") or data.get("status") or "update"
    patient = data.get("patientName") or "there"
    when = " · ".join(part for part in [data.get("date") or "", data.get("time") or ""] if part)
    treatment = data.get("treatmentName") or data.get("treatment") or "your visit"
    if action == "confirmed":
        heading = "Your appointment is confirmed"
        intro = f"Hi {patient}, Elegancia Dental has accepted your booking."
        footer = "Please arrive a few minutes early. Call 072340 01111 if you need to change it."
        subject = f"Your appointment is confirmed · {when}".strip()
    elif action == "rescheduled":
        heading = "Your appointment was moved"
        intro = f"Hi {patient}, the clinic has rescheduled {treatment} to a new time."
        footer = "Please use the new date and time below. Call 072340 01111 if this does not work."
        subject = f"Your appointment was rescheduled · {when}".strip()
    else:
        heading = "Your appointment was not accepted"
        intro = f"Hi {patient}, the clinic could not accept this booking."
        footer = "Call 072340 01111 or book another slot on the website."
        subject = "Your appointment request was not accepted · Elegancia Dental"
    rows = [
        ("Booking ID", data.get("id") or data.get("booking_id")),
        ("Treatment", treatment),
        ("Date", data.get("date")),
        ("Time", data.get("time")),
        ("Doctor", data.get("doctor")),
        ("Status", data.get("status") or action),
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
        f"<h2 style='margin:0 0 8px'>{html_escape(heading)}</h2>"
        f"<p style='margin:0 0 18px;color:#66727a'>{html_escape(intro)}</p>"
        f"<table style='width:100%;border-collapse:collapse;font-size:15px'>{table}</table>"
        f"<p style='margin:22px 0 0;color:#66727a;font-size:13px'>{html_escape(footer)}</p>"
        "</div>"
    )
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"Elegancia Dental <{sender}>"
    msg["To"] = to
    msg.attach(MIMEText(html, "html", "utf-8"))
    context = ssl.create_default_context()
    with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=context, timeout=30) as server:
        server.login(sender, password)
        server.sendmail(sender, [to], msg.as_string())


def send_gmail(data: dict) -> None:
    cfg = load_config()
    sender = (
        (data.get("smtpUser") or data.get("adminEmail") or "").strip()
        or cfg.get("email")
        or ""
    )
    password = (
        "".join((data.get("smtpPass") or data.get("appPassword") or "").split())
        or cfg.get("appPassword")
        or ""
    )
    if not sender or not password:
        raise RuntimeError("Save the clinic Gmail and App Password in Admin → Settings first.")
    action = (data.get("action") or "").lower()
    patient_to = (data.get("to") or data.get("patientEmail") or "").strip()
    if (
        data.get("kind") == "patient-status"
        or action in ("confirmed", "rejected", "rescheduled")
        or (patient_to and patient_to.lower() != sender.lower())
    ):
        send_patient_status(data, sender, password)
        return
    msg = build_email(data, sender)
    context = ssl.create_default_context()
    with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=context, timeout=30) as server:
        server.login(sender, password)
        server.sendmail(sender, [sender], msg.as_string())


def otp_secret() -> str:
    return (load_config().get("appPassword") or "elegancia-booking-otp")


def issue_otp_challenge(email: str, phone: str, code: str) -> str:
    phone_key = "".join(ch for ch in phone if ch.isdigit())[-10:]
    payload = json.dumps(
        {
            "email": email.strip().lower(),
            "phone": phone_key,
            "hash": hmac.new(otp_secret().encode(), code.encode(), hashlib.sha256).hexdigest(),
            "exp": int(time.time() * 1000) + 10 * 60 * 1000,
        },
        separators=(",", ":"),
    )
    body = __import__("base64").urlsafe_b64encode(payload.encode()).decode().rstrip("=")
    signature = hmac.new(otp_secret().encode(), body.encode(), hashlib.sha256).hexdigest()
    return body + "." + signature


def send_otp_mail(data: dict, code: str) -> None:
    cfg = load_config()
    sender = (
        (data.get("smtpUser") or "").strip()
        or cfg.get("email")
        or ""
    )
    password = (
        (data.get("smtpPass") or "").replace(" ", "")
        or cfg.get("appPassword")
        or ""
    )
    if not sender or not password:
        raise RuntimeError("Save the clinic Gmail and App Password in Admin → Settings first.")
    to = (data.get("email") or "").strip()
    patient = html_escape(data.get("patientName") or "there")
    html = (
        "<div style='font-family:Georgia,serif;color:#12202c;max-width:520px'>"
        "<h2 style='margin:0 0 8px'>Confirm your appointment</h2>"
        f"<p style='margin:0 0 16px;color:#66727a'>Hi {patient}, use this code to finish your booking. It expires in 10 minutes.</p>"
        f"<p style='font-size:32px;letter-spacing:8px;font-weight:700;margin:0 0 18px'>{html_escape(code)}</p>"
        f"<p style='margin:0;color:#66727a;font-size:14px'>{html_escape(data.get('treatmentName') or 'Appointment')} · {html_escape(data.get('date') or '')} · {html_escape(data.get('time') or '')}</p>"
        "</div>"
    )
    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Your Elegancia Dental booking code: {code}"
    msg["From"] = f"Elegancia Dental <{sender}>"
    msg["To"] = to
    msg.attach(MIMEText(html, "html", "utf-8"))
    context = ssl.create_default_context()
    with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=context, timeout=30) as server:
        server.login(sender, password)
        server.sendmail(sender, [to], msg.as_string())


def handle_otp(data: dict) -> dict:
    action = data.get("action") or "send"
    email = (data.get("email") or "").strip()
    phone = (data.get("phone") or "").strip()
    if action == "verify":
        challenge = data.get("challenge") or ""
        code = str(data.get("code") or "")
        parts = challenge.split(".")
        if len(parts) != 2:
            return {"ok": False, "error": "The verification code expired. Request a new one."}
        body, signature = parts
        expected = hmac.new(otp_secret().encode(), body.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, signature):
            return {"ok": False, "error": "That code is not valid."}
        pad = "=" * ((4 - len(body) % 4) % 4)
        payload = json.loads(__import__("base64").urlsafe_b64decode(body + pad).decode())
        if int(time.time() * 1000) > int(payload.get("exp") or 0):
            return {"ok": False, "error": "That code has expired. Request a new one."}
        phone_key = "".join(ch for ch in phone if ch.isdigit())[-10:]
        if payload.get("email") != email.lower() or payload.get("phone") != phone_key:
            return {"ok": False, "error": "That code does not match this booking."}
        hashed = hmac.new(otp_secret().encode(), code.encode(), hashlib.sha256).hexdigest()
        if hashed != payload.get("hash"):
            return {"ok": False, "error": "That code is not valid."}
        return {"ok": True, "verified": True}

    if "@" not in email:
        return {"ok": False, "error": "Enter a valid email address."}
    if len("".join(ch for ch in phone if ch.isdigit())) < 10:
        return {"ok": False, "error": "Enter a valid phone number."}
    code = f"{secrets.randbelow(900000) + 100000}"
    send_otp_mail(data, code)
    return {"ok": True, "challenge": issue_otp_challenge(email, phone, code), "expiresIn": 600}


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
        if path in ("/api/smtp-status", "/api/mail", "/api/health", "/api"):
            cfg = load_config()
            self._json(
                200,
                {
                    "ok": True,
                    "running": True,
                    "service": "elegancia-mail",
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
        path = urlparse(self.path).path.rstrip("/") or "/"
        try:
            length = int(self.headers.get("Content-Length") or 0)
            raw = self.rfile.read(length).decode("utf-8") if length else "{}"
            data = json.loads(raw or "{}")
        except (ValueError, json.JSONDecodeError):
            self._json(400, {"ok": False, "error": "Invalid JSON."})
            return

        route = (data.get("route") or "").lower()
        if path in ("/api/mail", "/api"):
            if route == "otp":
                path = "/api/booking-otp"
            elif route == "patient":
                path = "/api/notify-patient"
                data["kind"] = "patient-status"
            elif route == "notify":
                path = "/api/notify-appointment"
            elif route == "smtp-config":
                path = "/api/smtp-config"
            elif route == "status":
                cfg = load_config()
                self._json(
                    200,
                    {
                        "ok": True,
                        "running": True,
                        "configured": configured(cfg),
                        "email": cfg.get("email") or "",
                    },
                )
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

        if path == "/api/booking-otp":
            try:
                result = handle_otp(data)
            except smtplib.SMTPAuthenticationError:
                self._json(401, {"ok": False, "error": "Gmail rejected the login. Do not use your normal Gmail password. Turn on 2-Step Verification, create a 16-character App Password at https://myaccount.google.com/apppasswords, and save that in Admin → Settings."})
                return
            except Exception as exc:
                traceback.print_exc()
                self._json(500, {"ok": False, "error": str(exc)})
                return
            self._json(200 if result.get("ok") else 400, result)
            return

        if path in ("/api/notify-appointment", "/api/notify-patient"):
            if path == "/api/notify-patient":
                data["kind"] = "patient-status"
            try:
                send_gmail(data)
            except smtplib.SMTPAuthenticationError:
                self._json(
                    401,
                    {
                        "ok": False,
                        "error": "Gmail rejected the login. Do not use your normal Gmail password. Turn on 2-Step Verification, create a 16-character App Password at https://myaccount.google.com/apppasswords, and save that in Admin → Settings.",
                    },
                )
                return
            except Exception as exc:
                traceback.print_exc()
                self._json(500, {"ok": False, "error": str(exc)})
                return
            to = (data.get("to") or data.get("patientEmail") or "").strip()
            action = (data.get("action") or "").lower()
            kind = (
                "patient-status"
                if data.get("kind") == "patient-status"
                or action in ("confirmed", "rejected", "rescheduled")
                or to
                else "clinic"
            )
            self._json(200, {"ok": True, "to": to or None, "kind": kind})
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
