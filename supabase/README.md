# Supabase analytics setup

This project uses Supabase for real visitor analytics, admin stats, and future account-backed favorites.

## 1. Login and link project

```bash
npx supabase login
npx supabase projects list
npx supabase link --project-ref YOUR_PROJECT_REF
```

Use the Supabase project named `Funding Dashboard`.

## 2. Apply schema

```bash
npx supabase db push
```

This creates:

- `profiles`
- `favorites`
- `visit_events`
- `admin_dashboard_stats(days_back integer)`
- RLS policies for members/admins

## 3. Deploy visit tracking function

Set a private hash salt and deploy the function:

```bash
npx supabase secrets set VISIT_HASH_SALT="$(openssl rand -hex 32)"
npx supabase functions deploy track-visit
```

Do not put `SUPABASE_SERVICE_ROLE_KEY` in frontend files. Supabase Edge Functions receive it as a secret/runtime env.

## 4. Configure frontend

Edit `supabase-config.js`:

```js
window.FUNDING_SUPABASE = {
  url: "https://YOUR_PROJECT_REF.supabase.co",
  anonKey: "YOUR_ANON_PUBLIC_KEY",
  functionsBaseUrl: "https://YOUR_PROJECT_REF.supabase.co/functions/v1",
};
```

`anonKey` is public. `service_role` is private and must never be committed.

## 5. Create first admin

After signing up the admin user through Supabase Auth, run:

```sql
update public.profiles
set role = 'admin'
where email = 'YOUR_ADMIN_EMAIL';
```

Then `admin.html` can show:

- Today visitors
- Total visitors
- Total pageviews
- Member count
- Daily visitors/pageviews
- Country visitors/pageviews
