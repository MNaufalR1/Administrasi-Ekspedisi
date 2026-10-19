alter table public.orders
  add column if not exists archived boolean not null default false;

grant update (archived) on public.orders to authenticated;

alter table public.workflow_audit_logs
  drop constraint if exists workflow_audit_logs_event_type_check;

alter table public.workflow_audit_logs
  add constraint workflow_audit_logs_event_type_check
  check (event_type in (
    'order_intake_verified',
    'order_cancelled',
    'order_archived',
    'order_unarchived',
    'shipment_manifest_created',
    'invoice_cancelled',
    'customer_created',
    'customer_updated',
    'customer_deleted',
    'staff_role_updated'
  ));

create or replace function public.protect_order_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.archived is distinct from new.archived
     and (to_jsonb(old) - 'archived') is not distinct from (to_jsonb(new) - 'archived') then
    return new;
  end if;

  if old.archived then
    raise exception 'Archived shipments must be restored before they can be changed';
  end if;
  if old.cancelled then
    raise exception 'Cancelled shipments cannot be changed';
  end if;
  if old.manifest_id is not null and (
    old.customer_name is distinct from new.customer_name
    or old.origin_city is distinct from new.origin_city
    or old.destination_city is distinct from new.destination_city
    or old.weight_kg is distinct from new.weight_kg
    or old.service_type is distinct from new.service_type
    or old.payment_type is distinct from new.payment_type
    or old.quoted_price is distinct from new.quoted_price
    or old.sender_description is distinct from new.sender_description
    or old.recipient_address is distinct from new.recipient_address
    or old.order_items is distinct from new.order_items
    or old.notes is distinct from new.notes
    or old.packing is distinct from new.packing
  ) then
    raise exception 'Shipment details cannot be changed after manifest assignment';
  end if;
  return new;
end;
$$;

create or replace function public.prevent_archiving_active_shipments()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.archived and old.archived is distinct from new.archived
     and (new.cancelled or new.manifest_id is not null) then
    raise exception 'Cancelled or manifested shipments cannot be archived';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_archiving_active_shipments on public.orders;
create trigger prevent_archiving_active_shipments
  before update of archived on public.orders
  for each row execute function public.prevent_archiving_active_shipments();

revoke all on function public.prevent_archiving_active_shipments() from public, anon, authenticated;

create or replace function public.log_order_archive_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.archived is distinct from new.archived then
    insert into public.workflow_audit_logs (event_type, entity_id, actor_id, details)
    values (
      case when new.archived then 'order_archived' else 'order_unarchived' end,
      new.resi::text,
      (select auth.uid()),
      jsonb_build_object('previous_status', old.status, 'archived', new.archived)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists log_order_archive_change on public.orders;
create trigger log_order_archive_change
  after update of archived on public.orders
  for each row execute function public.log_order_archive_change();

revoke all on function public.log_order_archive_change() from public, anon, authenticated;

notify pgrst, 'reload schema';
