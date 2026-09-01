from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, EmailStr, field_validator
from dotenv import load_dotenv
import aiosmtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import os
import html as html_module

load_dotenv()

app = FastAPI(title="Virendra Chavan Portfolio")

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")


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
