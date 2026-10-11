create index enquiries_artist_id_idx on private.enquiries (artist_id, created_at desc);
create index enquiries_artwork_id_idx on private.enquiries (artwork_id);
create policy "Enquiries are only accessible through trusted server code"
on private.enquiries for all to anon, authenticated
using (false) with check (false);
