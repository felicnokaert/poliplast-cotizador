alter function public.is_poliplast_crm_admin() security invoker;
revoke execute on function public.is_poliplast_crm_admin() from public, anon;
grant execute on function public.is_poliplast_crm_admin() to authenticated, service_role;
