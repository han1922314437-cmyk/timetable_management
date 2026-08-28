# Supabase Setup

1. Create a Supabase project.
2. Open the SQL Editor and run `supabase_schema.sql`.
3. Copy the database connection string from the project's `Connect` panel.
4. Set one of these environment variables in Vercel:
   - `POSTGRES_URL`
   - `DATABASE_URL`
5. Add `AUTH_SECRET` as a Vercel environment variable too, so login cookies stay signed.

Recommended connection choice:
- Use the Supabase Session Pooler connection string for Vercel if you want the most compatible option.
- If your setup supports it, a direct connection string also works.

What stays in this app:
- Usernames and passwords are still handled by the app's own login system.
- Supabase is used as the persistent Postgres database for users and bookings.
