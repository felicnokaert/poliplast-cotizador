alter table public.sales_quotes
  add column if not exists payment_term_days integer not null default 0
  check (payment_term_days >= 0 and payment_term_days <= 365);

insert into public.payment_policies (id, name, customer_text, discount_percent, surcharge_percent, active, sort_order)
values ('cheque', 'Cheque', 'Pago mediante cheque a plazo acordado.', 0, 0, true, 35)
on conflict (id) do update set
  name = excluded.name,
  customer_text = excluded.customer_text,
  active = true,
  sort_order = excluded.sort_order;
