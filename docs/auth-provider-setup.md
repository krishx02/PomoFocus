# Auth Provider Setup

Supabase Auth is the sole auth provider (ADR-002). This document describes how to configure each provider for both local development and production.

## Providers

| Provider       | Local Dev                          | Production                                  |
| -------------- | ---------------------------------- | ------------------------------------------- |
| Email/password | Enabled, no email confirmation     | Enabled, email confirmation required        |
| Google OAuth   | Enabled via env vars               | Enabled via Google Cloud Console            |
| Apple Sign-In  | Enabled via env vars               | Enabled via Apple Developer account         |

## OAuth Scopes (ADR-012)

Minimum scopes to comply with data minimization:

| Provider | Scopes                         | Data Stored                           |
| -------- | ------------------------------ | ------------------------------------- |
| Google   | `openid`, `email`, `profile`   | Provider `sub`, email, display name   |
| Apple    | `name`, `email`                | Provider `sub`, email, display name   |

## Local Development

### Email/Password

Already configured in `supabase/config.toml`. No additional setup needed.

- Email confirmations are **disabled** for local dev (`enable_confirmations = false`)
- Minimum password length: 8 characters
- Password requirements: letters and digits
- Inbucket (email testing UI) is available at `http://127.0.0.1:54324`

### Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new project (or select existing)
3. Navigate to **APIs & Services > Credentials**
4. Click **Create Credentials > OAuth client ID**
5. Application type: **Web application**
6. Add authorized redirect URIs:
   - Local: `http://127.0.0.1:54321/auth/v1/callback`
   - Production: `https://<project-ref>.supabase.co/auth/v1/callback`
7. Copy the **Client ID** and **Client Secret**

Set environment variables for local dev (in `.env` or shell):

```bash
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=<your-google-client-id>
SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=<your-google-client-secret>
```

### Apple Sign-In

1. Go to [Apple Developer > Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources)
2. Register an **App ID** with Sign in with Apple capability
3. Register a **Services ID** (this becomes the `client_id`)
   - Enable Sign in with Apple
   - Configure the domain and return URL:
     - Domain: `127.0.0.1` (local) or your production domain
     - Return URL: `http://127.0.0.1:54321/auth/v1/callback` (local) or `https://<project-ref>.supabase.co/auth/v1/callback` (production)
4. Create a **Key** with Sign in with Apple enabled
5. Download the key file (`.p8`) — you only get one download
6. Generate the client secret JWT using the key file, key ID, team ID, and service ID. Supabase expects a JWT secret, not the raw `.p8` file.

Generate the secret (using Ruby, Node, or the Supabase dashboard helper):

```bash
# Using Node.js (example — see Supabase docs for current approach)
# The secret is a JWT signed with the .p8 key, valid for up to 6 months
```

Set environment variables for local dev:

```bash
SUPABASE_AUTH_EXTERNAL_APPLE_CLIENT_ID=<your-services-id>
SUPABASE_AUTH_EXTERNAL_APPLE_SECRET=<your-generated-jwt-secret>
```

## Production Setup (Supabase Dashboard)

1. Go to **Supabase Dashboard > Authentication > Providers**
2. For each provider, enter the credentials obtained above
3. Verify redirect URLs match your production domain

### Required Dashboard Configuration

| Setting                  | Value                                                    |
| ------------------------ | -------------------------------------------------------- |
| Site URL                 | `https://pomofocus.app` (or your production URL)         |
| Redirect URLs            | Production app URL, deep link scheme (`pomofocus://auth/callback`) |
| Email confirmations      | **Enabled** (unlike local dev)                           |
| Minimum password length  | 8                                                        |
| Password requirements    | Letters and digits                                       |

### Google OAuth (Dashboard)

1. Navigate to **Authentication > Providers > Google**
2. Toggle **Enabled**
3. Enter the Google Client ID
4. Enter the Google Client Secret
5. Scopes are automatically set to `openid email profile` by Supabase

### Apple Sign-In (Dashboard)

1. Navigate to **Authentication > Providers > Apple**
2. Toggle **Enabled**
3. Enter the Services ID (client ID)
4. Enter the generated JWT secret
5. Supabase automatically requests `name` and `email` scopes

## Environment Variables Reference

| Variable                                     | Description                              | Where to set        |
| -------------------------------------------- | ---------------------------------------- | ------------------- |
| `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`    | Google OAuth client ID                   | `.env`, dashboard   |
| `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`       | Google OAuth client secret               | `.env`, dashboard   |
| `SUPABASE_AUTH_EXTERNAL_APPLE_CLIENT_ID`     | Apple Services ID                        | `.env`, dashboard   |
| `SUPABASE_AUTH_EXTERNAL_APPLE_SECRET`        | Apple JWT secret (generated from .p8)    | `.env`, dashboard   |

## Redirect URLs

### Local Development

Configured in `supabase/config.toml` under `additional_redirect_urls`:

- `https://127.0.0.1:3000` — web app (HTTPS)
- `http://127.0.0.1:8081` — Expo dev client
- `exp://127.0.0.1:8081` — Expo deep link
- `pomofocus://auth/callback` — custom deep link scheme

### Production

Set in the Supabase Dashboard under **Authentication > URL Configuration**:

- `https://pomofocus.app` (site URL)
- `https://pomofocus.app/auth/callback`
- `pomofocus://auth/callback` (mobile deep link)

## Verification Checklist

- [ ] `supabase start` succeeds with updated `config.toml`
- [ ] Email signup works via Supabase Studio (`http://127.0.0.1:54323`)
- [ ] Google OAuth redirect URL is set in Google Cloud Console
- [ ] Apple Sign-In return URL is set in Apple Developer Portal
- [ ] Production dashboard mirrors local provider configuration
