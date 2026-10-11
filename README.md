# Ceylistry

An art-first marketplace foundation for independent Sri Lankan artists. The app is a React, TypeScript and Vite frontend backed by Supabase Auth, Postgres and private Storage.

## Run locally

1. Install Node.js 20 or later.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env.local` and add the Ceylistry Supabase project URL and publishable key.
4. Run `npm run dev` and open the local URL Vite prints.

The browser only uses the Supabase publishable key. Never put a Supabase secret or service-role key in a `VITE_*` variable.

## Current prototype

- Responsive public discovery pages for artwork and artists.
- Demo artwork uses original local SVG illustrations and fictional profiles, clearly labelled as examples.
- Approved profiles and artwork load from Supabase; the local demo collection appears when the project has no approved content.
- Artist sign-in uses Supabase passwordless email links at `/studio`.
- Signed-in artists can submit a profile and artwork image for review. New or edited submissions are not public until approved.
- Artists can correct and resubmit profiles and artwork after review; edits to approved content return it to review.
- Approved commission listings can accept private, spam-protected buyer enquiries. No checkout, payment, or payout is enabled.

## Supabase

Project ref: `knwzeqiofncldelqvsvt` (Singapore).

The tracked SQL migrations in `supabase/migrations` match the migrations deployed to that project. `supabase/schema.sql` is the consolidated current schema reference. Before using email-link sign-in, add the local development URL to Supabase Auth's redirect URL allowlist. Add the production origin there after selecting a real domain.

Security uses explicit API grants, row-level security, review-state guards, and owner-scoped Storage policies. Artist identity and listing edits cannot self-approve. Enquiry records and hashed rate-limit identifiers stay private. The `submit-enquiry` Edge Function uses Turnstile verification, strict origin allowlisting, validation, and a five-per-hour IP limit.

### Enable local and hosted enquiries

1. Create a Cloudflare Turnstile widget for the origins you intend to use and add its site key to `.env.local` as `VITE_TURNSTILE_SITE_KEY`.
2. In Supabase **Edge Functions → Secrets**, set `TURNSTILE_SECRET_KEY`, `RATE_LIMIT_HASH_SECRET` (a long random secret), and `APP_ORIGINS` (comma-separated exact origins, e.g. `http://localhost:5173`). Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to the function.
3. Add each origin to the Turnstile widget's allowed hostnames. When hosting is selected, add the final origin to both `APP_ORIGINS` and the widget, then rebuild the frontend with the public site key.
4. Restart the local Vite server after changing `.env.local`. Enquiries appear only on approved live commission listings; demo content never submits data.

## Useful commands

- `npm run dev` — start local development
- `npm run build` — TypeScript check and production bundle
- `npm run preview` — preview the production bundle locally

## Next milestone

Configure the Turnstile and Edge Function secrets, verify a commission enquiry end to end, and then build an artist inbox with authenticated access. Payments remain a later milestone.

