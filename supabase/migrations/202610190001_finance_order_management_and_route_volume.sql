alter table public.route_rates
  add column if not exists base_cost_per_m3 numeric(14, 2) not null default 0
  check (base_cost_per_m3 >= 0);

revoke delete on public.route_rates from public, anon, authenticated;
grant select, insert, update on public.route_rates to authenticated;

revoke insert on public.invoice_payments, public.cod_remittances from authenticated;
revoke execute on function public.finance_approve_invoice(uuid, boolean) from authenticated;
revoke execute on function public.finance_update_rejected_invoice_price(uuid, numeric) from authenticated;

drop policy if exists "Admins can insert orders" on public.orders;
create policy "Staff can insert orders"
  on public.orders
  as restrictive
  for insert
  to public
  with check ((select public.current_staff_role()) in ('Admin', 'Staf Keuangan'));

drop policy if exists "Admins can update orders" on public.orders;
create policy "Staff can update orders"
  on public.orders
  as restrictive
  for update
  to public
  using ((select public.current_staff_role()) in ('Admin', 'Staf Keuangan'))
  with check ((select public.current_staff_role()) in ('Admin', 'Staf Keuangan'));

grant insert on public.orders to authenticated;
grant update (
  customer_name,
  origin_city,
  destination_city,
  weight_kg,
  service_type,
  status,
  payment_type,
  quoted_price,
  sender_description,
  recipient_address,
  order_items,
  notes,
  packing
) on public.orders to authenticated;

create or replace function public.prevent_finance_order_status_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce((select public.current_staff_role()), '') = 'Staf Keuangan'
     and old.status is distinct from new.status then
    raise exception 'Finance staff cannot change shipment status';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_finance_order_status_change on public.orders;
create trigger prevent_finance_order_status_change
  before update on public.orders
  for each row execute function public.prevent_finance_order_status_change();

revoke all on function public.prevent_finance_order_status_change() from public, anon, authenticated;

create or replace function public.admin_cancel_order(p_resi text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.orders%rowtype;
begin
  if coalesce((select public.current_staff_role()), '') not in ('Admin', 'Staf Keuangan') then
    raise exception 'Only staff can cancel shipments';
  end if;

  select *
  into order_row
  from public.orders
  where upper(resi) = upper(trim(p_resi))
  for update;

  if not found then
    raise exception 'Shipment was not found';
  end if;
  if order_row.cancelled then
    raise exception 'Shipment is already cancelled';
  end if;
  if order_row.manifest_id is not null then
    raise exception 'Shipment cannot be cancelled after it has entered a manifest';
  end if;

  update public.orders
  set cancelled = true,
      cancelled_at = now(),
      cancelled_by = (select auth.uid())
  where id = order_row.id;

  insert into public.workflow_audit_logs (event_type, entity_id, actor_id, details)
  values (
    'order_cancelled',
    order_row.resi::text,
    (select auth.uid()),
    jsonb_build_object('previous_status', order_row.status, 'manifest_id', order_row.manifest_id)
  );
end;
$$;

revoke all on function public.admin_cancel_order(text) from public, anon;
grant execute on function public.admin_cancel_order(text) to authenticated;

notify pgrst, 'reload schema';
