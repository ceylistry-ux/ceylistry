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
- No checkout, payment, payout, or buyer enquiry submission is enabled.

## Supabase

Project ref: `knwzeqiofncldelqvsvt` (Singapore).

The tracked SQL migrations in `supabase/migrations` match the three migrations deployed to that project. `supabase/schema.sql` is the consolidated current schema reference. Before using email-link sign-in, add the local development URL to Supabase Auth's redirect URL allowlist. Add the production origin there after selecting a real domain.

Security uses explicit API grants, row-level security, review-state guards, and owner-scoped Storage policies. Artist identity and listing edits cannot self-approve. Visitor enquiries stay private and are not accepted until a server-side spam-protected endpoint is configured.

## Useful commands

- `npm run dev` — start local development
- `npm run build` — TypeScript check and production bundle
- `npm run preview` — preview the production bundle locally

## Next milestone

Configure and test the Auth redirect URLs, complete an artist submission end to end, then add a moderated buyer-enquiry endpoint with rate limiting and CAPTCHA verification. Payments remain a later milestone.

