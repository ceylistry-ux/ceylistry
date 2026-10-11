# Supabase setup status

Ceylistry is configured to use a Supabase URL and publishable key through the variables in `.env.example`. Do not place a secret or service-role key in a `VITE_*` variable.

Connected project: `knwzeqiofncldelqvsvt` (Singapore region, project is healthy).

The initial schema is deployed to this project. It creates artist profiles and artwork listings with review states, a private enquiries table, an images bucket with access policies, and explicit Data API grants. The current connection account is the Ceylistry Supabase account. The local `.env.local` holds only the public publishable key and is ignored by Git.

## Initial schema outline

- `public.artists`: artist-owned profile and review state (`draft`, `pending`, `approved`, `rejected`). Public reads are limited to approved artists; artists can edit their own profile, but cannot approve it.
- `public.artworks`: artist-owned listing, LKR price, artwork type, commission availability, image reference and review state. Public reads require both the listing and artist to be approved.
- `private.enquiries`: visitor contact details and enquiry text, inaccessible through the public Data API. Enquiries are accepted through a server-side function with validation, spam protection and rate limiting; no direct anonymous table insert.
- Artwork uploads use a private Storage bucket. Public image delivery will be mediated by approved listing checks or short-lived signed URLs.

All exposed tables will have RLS. Because Supabase is changing default Data API exposure for new tables, grants will be explicit and least-privilege. Admin approval is performed through a controlled server-side/admin workflow, never by trusting editable user metadata or a client-provided role.

`schema.sql` documents the consolidated deployed schema. The files in `migrations/` match the three migration versions already applied to the project. The Supabase CLI could not be installed in this environment, so future migrations have not been pushed through the CLI here; use the Supabase CLI once available, and keep new timestamped files in `migrations/` under source control.

The artist studio uses passwordless email links and redirects to `/studio`. Add the local Vite origin (for example `http://localhost:5173/**`) to Supabase Auth's redirect URL allowlist before testing sign-in. Add the eventual production URL after choosing a domain.

