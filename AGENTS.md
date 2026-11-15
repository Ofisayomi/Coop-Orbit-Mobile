# AGENTS.md — coop-assist-mobile (React Native)

> Read this before making any change. Also read the workspace root [agent.md](../agent.md) for cross-project rules (Keycloak/OIDC, secure storage, cooperative domain, definition of done).

## What this is

The member-facing mobile app for **Coop Assist / Coop Orbit**, branded in-store as **Pacesetter Cooperative** (`app.json` name/scheme `com.onersofties.coopassistmobile`). Members view account balances and dashboard stats, browse transaction/loan history, request loans (with guarantor selection), respond to guarantor requests, make split payment requests with receipts, and manage settings/theme. Admin back-office work lives in the web app — this client is intentionally member-scoped. Backend is [coop-assist-api](../coop-assist-api/AGENTS.md); identity is Keycloak.

- Stack: Expo SDK 58 + React Native 0.88 (New Architecture) + React 19.3, Expo Router (file-based, typed routes), `expo-secure-store`, `expo-auth-session`, `expo-local-authentication` (biometrics), `expo-web-browser`, Reanimated/Gesture Handler. TypeScript strict (`tsconfig` extends `expo/tsconfig.base`, `@/*` → repo root).
- Package manager in repo: both `package-lock.json` and `pnpm-lock.yaml` exist — check which your team currently uses before installing; don't commit a rewritten foreign lockfile.

## Layout

| Path | Contents |
|---|---|
| `app/` | Expo Router routes. `_layout.tsx` (root Stack + theme), `index.tsx` (redirects to `/login`), `login.tsx` (native OIDC + WebView + biometrics), `login.browser.tsx` (web variant), `oauth.tsx` (deep-link callback landing), `(tabs)/` (`index` home, `history`, `settings`; `explore`/`guarantor-requests` hidden from tab bar), plus stack screens: `loans`, `loan-details`, `request-loan`, `make-payment`, `payment-requests`, `guarantor-requests`, `modal`. |
| `services/` | `authService.ts` (SecureStore tokens, refresh, logout, `trySilentRefresh`), `httpClient.ts` (`apiClient` fetch wrapper with 401-retry), `accountService.ts` (all API DTOs + calls — accounts, loans, guarantors, payment requests, dashboard). |
| `context/ThemeContext.tsx` | `AppThemeProvider`/`useAppTheme`: system/light/dark, persisted as `theme_preference` in SecureStore. |
| `components/`, `hooks/`, `constants/` | Themed primitives, `use-color-scheme`, `constants/theme.ts`. `constants/auth.ts` is legacy — see Pitfalls. |

There is no global state library and no data-fetching cache: screens call `AccountService` in `useEffect` with local loading/error state and pull-to-refresh. Match that pattern unless a change explicitly introduces a shared layer.

## Run & check

```bash
pnpm install        # or npm install — see lockfile note above
npx expo start      # then: a (Android) / i (iOS) / w (web)
pnpm lint           # expo lint (eslint-config-expo)
npx tsc --noEmit    # strict type-check — keep at zero
```

Native folders (`android/`) and `expo-dev-client` are present — prefer a development build over Expo Go for auth/biometrics work. Env is `EXPO_PUBLIC_*` in `.env` (inlined at build time; changing it requires a restart/rebuild): `EXPO_PUBLIC_KEYCLOAK_URL`, `EXPO_PUBLIC_KEYCLOAK_REALM` (`coop-assist-backend`), `EXPO_PUBLIC_KEYCLOAK_CLIENT_ID` (`coop-assist-mobile`), `EXPO_PUBLIC_API_BASE_URL` (must end in `/api`). `EXPO_PUBLIC_*` values are public — never put secrets in them.

## Auth (critical — how it actually works)

- OIDC authorization-code + PKCE (S256) against Keycloak. The live flow is hand-rolled in `app/login.tsx`: builds the auth URL, presents Keycloak in an in-app `WebView` (`login.browser.tsx` is the web counterpart), intercepts the `com.onersofties.coopassistmobile://oauth` redirect, validates `state`, exchanges the code with `exchangeCodeAsync`, stores `access_token`/`refresh_token` in **SecureStore only** (never AsyncStorage, never logs).
- `oauth.tsx` is just a spinner that bounces back to `/login` — the callback is processed by the login screen's navigation handler. Don't add a second callback handler.
- `authService.getValidAccessToken()` refreshes when the JWT is within 30 s of expiry; `httpClient` retries once on 401 after a forced refresh, then logs out and `router.replace('/login')`. Biometric unlock (`expo-local-authentication`) only gates `trySilentRefresh()` — it never stores passwords.
- No client secret in the app, ever. Realm roles are enforced by the API; this client currently does **not** gate screens by role — don't assume a hidden screen is protected.

## API contract

- `apiClient` base URL already ends in `/api`; call paths omit it (`/accounts`, `/accounts/loan-request`, `/loans/{id}`, `/paymentrequests`, `/users/guarantor/requests`). It strips a duplicated `/api` prefix defensively — keep new paths consistent anyway.
- DTOs live inline in `services/accountService.ts` and duplicate the web app's `models/` by hand. Any backend DTO/route/status change must be mirrored in both clients in the same work item. Pagination is cursor-based (`?lastId=`, `hasNextPage`/`nextCursor`).
- Errors: `httpClient` throws on auth failure; `AccountService` throws `Error(message)` from the response body. Some legacy calls swallow errors and return fallbacks (`getPaymentAccounts`, `searchMembers`) — don't copy that pattern; surface a retryable error state instead.

## Conventions

- File-based routing: new screens go in `app/`, register titled Stack screens in `app/_layout.tsx`, tabs in `app/(tabs)/_layout.tsx` (use `href: null` to hide). Respect the `@/*` import alias.
- Theme every visual through `useAppTheme()`/`constants/theme.ts`; support light + dark. Screens are large by history (several 500–1,100 lines) — extract shared UI into `components/` when you touch one rather than growing it further.
- Design for poor networks: keep payloads small, show loading + retry, never lose a half-filled loan/payment form on failure. Currency is NGN via the API's numeric values — format, don't recalculate money on device.
- Platform code: keep Android/iOS/web behaviour explicit (`.web.ts` / `.browser.tsx` variants exist); test the platform you changed.

## Testing

Standing user instruction: after making a fix, do NOT run anything to verify it yourself — no `pnpm lint`, `npx tsc --noEmit`, `npx expo start`, dev builds, or package installs. Leave the tree with only the fix and hand over the exact commands and screens for the user to run (cold start → login → biometric re-entry, token-expiry refresh, each touched screen's loading/empty/error states, logout). There is **no test suite** in this repo yet. State plainly which screens and states the user should exercise.

## Pitfalls

- `.env` is committed with ephemeral ngrok tunnel URLs — they rot quickly and leak your dev endpoints. Replace with stable dev URLs locally; never commit personal tunnels.
- Three competing auth configs exist: `.env`, `constants/auth.ts` (hardcoded `localhost:8080` issuer + `exp://` redirect — dead), and inline env reads in `login.tsx`. The env + `login.tsx` path is live; don't wire `constants/auth.ts` back in. Both `expo-auth-session` and `react-native-app-auth` are installed — the app-auth path is unused; don't mix them.
- PKCE `code_verifier`/`state` in `login.tsx` are currently generated with `Math.random()` — if you touch that code, switch to `expo-crypto` random bytes; don't weaken the existing S256/state checks.
- Expo template leftovers remain (`app/(tabs)/explore.tsx`, `components/hello-wave.tsx`, `parallax-scroll-view.tsx`, `scripts/reset-project.js`, stock `README.md`) — don't build product features on them.
- Duplicate Android permissions in `app.json` and experimental `reactCompiler`/typed routes are on — expect occasional route-type regeneration (`.expo/types`); don't hand-edit generated types.

## Definition of done (this project)

Handover lists the lint, type-check, and manual checks for the user to run (login/refresh/logout and every touched screen on a stated platform); tokens only in SecureStore; DTOs mirrored with web/backend when the contract changed; no committed tunnels, secrets, or personal env values.
