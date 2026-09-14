drop policy if exists "Admin administra mínimos mayoristas" on public.wholesale_order_policies;
create policy "Admin crea mínimos mayoristas" on public.wholesale_order_policies
  for insert to authenticated with check (public.is_poliplast_crm_admin());
create policy "Admin actualiza mínimos mayoristas" on public.wholesale_order_policies
  for update to authenticated using (public.is_poliplast_crm_admin()) with check (public.is_poliplast_crm_admin());
create policy "Admin elimina mínimos mayoristas" on public.wholesale_order_policies
  for delete to authenticated using (public.is_poliplast_crm_admin());
