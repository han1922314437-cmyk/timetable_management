-- Run this in the Supabase SQL Editor after creating a new project.

create table if not exists public.users (
  id bigserial primary key,
  username text not null unique,
  password_salt text not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id bigserial primary key,
  user_id bigint not null references public.users(id) on delete cascade,
  date text not null,
  room_id integer not null,
  activity text not null default '',
  customer text not null default '',
  phone text not null,
  start_time text not null,
  end_time text not null,
  pax integer not null,
  status text not null,
  created_at timestamptz not null default now()
);

alter table public.bookings
  add column if not exists activity text not null default '';

create index if not exists idx_bookings_user_date
  on public.bookings (user_id, date);

create index if not exists idx_bookings_user_date_room_time
  on public.bookings (user_id, date, room_id, start_time, end_time);
