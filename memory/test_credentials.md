# AuraX — Test Credentials

## Admin Account (full platform control) — /admin
- Email: admin@aurax.io
- Password: AuraX@Admin2026
- Role: admin

## Regular user
- Register at /register (email verification code sent via Resend to the email).
- The 6-digit code is also logged in backend logs for testing: `grep "Verification code" /var/log/supervisor/backend.*.log`
- Google login available at /login (Emergent-managed OAuth).

## Auth endpoints
- POST /api/auth/register {name,email,password}
- POST /api/auth/verify {email,code}
- POST /api/auth/resend-code {email}
- POST /api/auth/login {email,password}
- POST /api/auth/google/session {session_id}
- GET  /api/auth/me   (Authorization: Bearer <token>)
- POST /api/auth/logout

Token is returned in JSON body and stored in localStorage as `aurax_token`; sent via Authorization: Bearer header.
