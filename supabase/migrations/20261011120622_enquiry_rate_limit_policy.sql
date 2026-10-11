-- Keep the rate-limit records private even if table grants change later.
create policy "Rate limits are only accessible through trusted server code"
on private.enquiry_rate_limits for all to anon, authenticated
using (false) with check (false);

drop index if exists private.enquiry_rate_limits_window_idx;

