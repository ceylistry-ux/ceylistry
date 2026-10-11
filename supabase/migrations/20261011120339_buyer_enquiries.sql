-- Enquiry submissions are written only by the submit-enquiry Edge Function.
create table private.enquiry_rate_limits (
  ip_hash text primary key check (char_length(ip_hash) = 64),
  window_started_at timestamptz not null default now(),
  request_count integer not null default 1 check (request_count between 1 and 5)
);
alter table private.enquiry_rate_limits enable row level security;
revoke all on private.enquiry_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on private.enquiry_rate_limits to service_role;

create function public.consume_enquiry_rate_limit(p_ip_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.enquiry_rate_limits (ip_hash)
  values (p_ip_hash)
  on conflict (ip_hash) do update
    set window_started_at = case
          when private.enquiry_rate_limits.window_started_at < now() - interval '1 hour' then now()
          else private.enquiry_rate_limits.window_started_at
        end,
        request_count = case
          when private.enquiry_rate_limits.window_started_at < now() - interval '1 hour' then 1
          else private.enquiry_rate_limits.request_count + 1
        end
    where private.enquiry_rate_limits.window_started_at < now() - interval '1 hour'
       or private.enquiry_rate_limits.request_count < 5;
  return found;
end;
$$;

create function public.create_buyer_enquiry(
  p_artist_id uuid,
  p_artwork_id uuid,
  p_name text,
  p_email text,
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  enquiry_id uuid;
begin
  if char_length(btrim(p_name)) not between 1 and 120
    or char_length(btrim(p_email)) not between 3 and 254
    or char_length(btrim(p_message)) not between 10 and 4000 then
    raise exception 'Invalid enquiry fields' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.artists a
    where a.id = p_artist_id and a.status = 'approved'
  ) then
    raise exception 'Artist is unavailable' using errcode = '22023';
  end if;

  if p_artwork_id is not null and not exists (
    select 1 from public.artworks w
    where w.id = p_artwork_id and w.artist_id = p_artist_id
      and w.status = 'approved' and w.commission = true
  ) then
    raise exception 'Artwork enquiry is unavailable' using errcode = '22023';
  end if;

  insert into private.enquiries (artist_id, artwork_id, visitor_name, visitor_email, message)
  values (p_artist_id, p_artwork_id, btrim(p_name), btrim(p_email), btrim(p_message))
  returning id into enquiry_id;
  return enquiry_id;
end;
$$;

revoke all on function public.consume_enquiry_rate_limit(text) from public, anon, authenticated;
revoke all on function public.create_buyer_enquiry(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.consume_enquiry_rate_limit(text) to service_role;
grant execute on function public.create_buyer_enquiry(uuid, uuid, text, text, text) to service_role;

create index enquiry_rate_limits_window_idx on private.enquiry_rate_limits (window_started_at);

