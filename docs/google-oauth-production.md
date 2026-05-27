# Google OAuth Production Setup

Use this checklist when enabling Google sign-in for `https://nk.friscodawah.org`.

## Required App Configuration

Production must run with:

```bash
APP_URL=https://nk.friscodawah.org
```

Do not use `localhost`, `0.0.0.0`, or an internal Docker host as the production app URL.

## Google Cloud Console

1. Open Google Cloud Console.
2. Go to **APIs & Services**.
3. Open **Credentials**.
4. Select the OAuth 2.0 Client ID used by NizamKitchen.
5. Add this Authorized JavaScript origin:

```text
https://nk.friscodawah.org
```

6. Add this Authorized redirect URI:

```text
https://nk.friscodawah.org/api/auth/oauth/google/callback
```

7. Save the Google OAuth client.
8. Restart or redeploy the NizamKitchen app after changing production environment settings.

## Local Development

Keep this redirect URI only for local testing:

```text
http://localhost:3000/api/auth/oauth/google/callback
```

Never use the local redirect URI for production.

## Platform Owner API Management

In NizamKitchen Admin > API Management > Google OAuth:

- Enable Google OAuth.
- Save the Google Client ID.
- Save the Google Client Secret.
- Use the generated callback URL shown on the page.
- For production, the generated callback must be:

```text
https://nk.friscodawah.org/api/auth/oauth/google/callback
```

If the page shows a callback URL with `localhost`, production `APP_URL` is misconfigured or the old callback setting needs to be re-saved from the generated production URL.
