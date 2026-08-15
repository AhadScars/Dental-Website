# Elegancia Dental — Vercel

Static clinic site with Gmail SMTP booking emails.

## Deploy

1. In Vercel, **Import** this folder (`cosmic-dental`) as the project root.
2. Framework preset: **Other**. Build command empty. Output directory empty.
3. Project → **Settings → Environment Variables** (Production + Preview):

   | Name | Value |
   |---|---|
   | `GMAIL_USER` | clinic Gmail address |
   | `GMAIL_APP_PASSWORD` | 16-character Gmail App Password |

4. Deploy. Open the Vercel URL and send a test booking or **Admin → Settings → Send test email**.

Gmail: Google Account → Security → 2-Step Verification → App passwords.

Do not put the App Password in the website files.

## Local email (optional)

```bash
python mail-server.py
```

Then open http://127.0.0.1:8787
