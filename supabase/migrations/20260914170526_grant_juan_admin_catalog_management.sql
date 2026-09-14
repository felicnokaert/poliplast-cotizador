create or replace function public.is_poliplast_crm_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'felipecnokaert@gmail.com',
    'felipe@grupopoliplast.com.ar',
    'juan@grupopoliplast.com.ar'
  );
$$;
