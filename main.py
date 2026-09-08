from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, FileResponse, RedirectResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, EmailStr, field_validator
from dotenv import load_dotenv
import aiosmtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import os
import html as html_module
import asyncio
import urllib.request
from contextlib import asynccontextmanager
import logging

load_dotenv()

logger = logging.getLogger("keep_alive")


async def _self_ping(url: str, interval: int = 30) -> None:
    """Ping own /health endpoint every `interval` seconds to prevent Render free-tier sleep."""
    await asyncio.sleep(10)  # short delay so server is fully ready before first ping
    while True:
        try:
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None,
                lambda: urllib.request.urlopen(url, timeout=10).read()
            )
            logger.debug("Keep-alive ping sent to %s", url)
        except Exception as exc:
            logger.warning("Keep-alive ping failed: %s", exc)
        await asyncio.sleep(interval)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Render sets RENDER_EXTERNAL_URL automatically; fallback to localhost for local dev
    base_url = os.getenv("RENDER_EXTERNAL_URL", "http://127.0.0.1:8000").rstrip("/")
    ping_url = f"{base_url}/health"
    task = asyncio.create_task(_self_ping(ping_url))
    logger.info("Keep-alive task started — pinging %s every 30 s", ping_url)
    try:
        yield
    finally:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


app = FastAPI(title="Virendra Chavan Portfolio", lifespan=lifespan)

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")


# ── Root-level well-known files (crawlers and browsers require exact paths) ──

@app.get("/health", include_in_schema=False)
async def health():
    """Lightweight health check — used by the keep-alive self-ping task."""
    return JSONResponse({"status": "ok"})


@app.get("/robots.txt", include_in_schema=False)
async def robots():
    return FileResponse("static/robots.txt", media_type="text/plain")


@app.get("/sitemap.xml", include_in_schema=False)
async def sitemap():
    return FileResponse("static/sitemap.xml", media_type="application/xml")


@app.get("/site.webmanifest", include_in_schema=False)
async def webmanifest():
    return FileResponse("static/site.webmanifest", media_type="application/manifest+json")


@app.get("/favicon.ico", include_in_schema=False)
async def favicon_ico():
    # Redirect legacy browsers that request /favicon.ico to the SVG favicon
    return RedirectResponse(url="/static/favicon.svg", status_code=301)


class ContactForm(BaseModel):
    name: str
    email: EmailStr
    subject: str
    message: str

    @field_validator("name", "subject", "message", mode="before")
    @classmethod
    def must_not_be_empty(cls, v: str) -> str:
        v = str(v).strip()
        if not v:
            raise ValueError("Field must not be empty")
        if len(v) > 2000:
            raise ValueError("Field value is too long (max 2000 chars)")
        return v


@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse(request=request, name="index.html")


@app.get("/projects", response_class=HTMLResponse)
async def projects_page(request: Request):
    return templates.TemplateResponse(request=request, name="projects.html")


@app.post("/contact")
async def contact(form: ContactForm):
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", 587))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASS", "")
    dest_email = os.getenv("DEST_EMAIL", "chavanvirendra11@gmail.com")

    if not smtp_user or not smtp_pass:
        return {"status": "error", "detail": "Mail server not configured on this server."}

    # Sanitise for HTML email body
    safe_name = html_module.escape(form.name)
    safe_email = html_module.escape(str(form.email))
    safe_subject = html_module.escape(form.subject)
    safe_message = html_module.escape(form.message).replace("\n", "<br>")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Portfolio Contact: {form.subject}"
    msg["From"] = f"Portfolio Site <{smtp_user}>"
    msg["To"] = dest_email
    msg["Reply-To"] = str(form.email)

    plain_body = (
        f"New message from your portfolio contact form.\n\n"
        f"Name:    {form.name}\n"
        f"Email:   {form.email}\n"
        f"Subject: {form.subject}\n\n"
        f"Message:\n{form.message}\n"
    )

    html_body = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F4F4F2;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:48px 24px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#FFFFFF;border-top:4px solid #E4002B;max-width:600px;width:100%;">
        <tr><td style="padding:40px 48px 0;">
          <p style="font-family:'Courier New',monospace;font-size:11px;letter-spacing:0.1em;
                    text-transform:uppercase;color:#E4002B;margin:0 0 8px;">
            New Enquiry via Portfolio
          </p>
          <h1 style="font-size:28px;color:#0E0D0C;margin:0 0 32px;font-weight:700;">
            {safe_subject}
          </h1>
          <table width="100%" cellpadding="0" cellspacing="0"
                 style="border-collapse:collapse;margin-bottom:32px;">
            <tr>
              <td style="padding:12px 0;border-bottom:1px solid #eee;
                          color:#6E6C69;width:90px;font-size:13px;">Name</td>
              <td style="padding:12px 0;border-bottom:1px solid #eee;
                          font-weight:600;color:#0E0D0C;">{safe_name}</td>
            </tr>
            <tr>
              <td style="padding:12px 0;border-bottom:1px solid #eee;
                          color:#6E6C69;font-size:13px;">Email</td>
              <td style="padding:12px 0;border-bottom:1px solid #eee;">
                <a href="mailto:{safe_email}"
                   style="color:#E4002B;text-decoration:none;">{safe_email}</a>
              </td>
            </tr>
          </table>
          <p style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;
                    color:#6E6C69;margin:0 0 12px;font-family:'Courier New',monospace;">
            Message
          </p>
          <p style="line-height:1.7;color:#0E0D0C;font-size:15px;
                    margin:0;white-space:pre-line;">{safe_message}</p>
        </td></tr>
        <tr><td style="padding:32px 48px;border-top:1px solid #eee;margin-top:32px;">
          <p style="font-family:'Courier New',monospace;font-size:11px;
                    color:#9C9A97;margin:0;letter-spacing:0.06em;">
            &copy; 2026 Virendra Chavan &mdash; virendrachavan.in
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""

    msg.attach(MIMEText(plain_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        await aiosmtplib.send(
            msg,
            hostname=smtp_host,
            port=smtp_port,
            start_tls=True,
            username=smtp_user,
            password=smtp_pass,
        )
        return {"status": "ok"}
    except aiosmtplib.SMTPAuthenticationError:
        return {"status": "error", "detail": "SMTP authentication failed. Check your credentials."}
    except Exception as exc:
        return {"status": "error", "detail": f"Failed to send: {exc}"}
