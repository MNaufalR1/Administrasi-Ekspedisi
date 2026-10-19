This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Supabase authentication and staff roles

The sign-in and sign-up screen uses Supabase Auth. Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (the legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` is also supported), then apply [`supabase/migrations/202610060001_auth_profiles_and_staff_roles.sql`](./supabase/migrations/202610060001_auth_profiles_and_staff_roles.sql), [`supabase/migrations/202610070001_ensure_staff_profile.sql`](./supabase/migrations/202610070001_ensure_staff_profile.sql), [`supabase/migrations/202610070002_finance_workspace.sql`](./supabase/migrations/202610070002_finance_workspace.sql), [`supabase/migrations/202610080001_operational_admin_features.sql`](./supabase/migrations/202610080001_operational_admin_features.sql), [`supabase/migrations/202610080002_order_details.sql`](./supabase/migrations/202610080002_order_details.sql), [`supabase/migrations/202610090001_flowchart_workflows.sql`](./supabase/migrations/202610090001_flowchart_workflows.sql), [`supabase/migrations/202610120002_fix_orders_status_check.sql`](./supabase/migrations/202610120002_fix_orders_status_check.sql), [`supabase/migrations/202610190001_finance_order_management_and_route_volume.sql`](./supabase/migrations/202610190001_finance_order_management_and_route_volume.sql), and [`supabase/migrations/202610190002_order_archiving.sql`](./supabase/migrations/202610190002_order_archiving.sql) in order in the Supabase Dashboard SQL Editor. The database role `Admin` is displayed in the app as **Staf Admin (Operasional)**. New sign-ups remain `Staf Keuangan` by default; promote a trusted account to `Admin` using the SQL below. Both Admin and Finance staff can create, edit, and cancel orders; only Admin can update shipment status, manage trade documents and staff, verify received goods, build shipment manifests, and export orders. Finance staff cannot edit shipment status and cannot cancel an order after it enters a manifest. Operational Admin can read but cannot edit route rates. Cancellations, archiving, receiving verification, manifest creation, and changes to staff/customer records are recorded in `workflow_audit_logs`.

After a user has signed up, promote a trusted staff account to Admin in the SQL Editor:

```sql
update public.profiles
set role = 'Admin'
where id = (
  select id
  from auth.users
  where email = 'admin@example.com'
);
```

Replace the example email with the account's email address. Do not let users choose Admin during sign-up. If email confirmation is enabled in Supabase Auth, the user must confirm their email before signing in.

## Finance workspace

The Finance workspace includes invoice management, route-cost setup, and monthly reports. Route rates have a cost per kilogram and a cost per cubic meter; the final `202610190001` migration adds the cubic-meter column and grants Finance staff CRUD access to orders while keeping status changes restricted to Admin. Finance staff can create and print invoices with a manually entered amount, mark invoices as sent, and cancel an invoice only when no payment or COD remittance has been recorded. Existing payment and COD records remain in the database for invoice balances and cancellation checks, but Finance can no longer record new payment/COD entries or use price-approval actions. Invoice cancellation preserves the invoice and writes an audit record. Sending email and payment-gateway processing are intentionally not integrated. Smart Pricing remains available only in the Admin order form; it is not part of the Finance workspace. Monthly reports export to CSV, which can be opened in Excel. Operational ETA warnings use service SLA estimates (Express 1 day, Reguler 3 days, Kargo 5 days) and are not a machine-learning or live-location prediction.

The flowchart workflow migration backfills customer master records from existing orders. Verify intake before creating a manifest; only shipments on the same route can be added, and a shipment cannot be cancelled after entering a manifest. Manifest creation advances those orders to **Dalam Perjalanan** and generates a printable surat jalan. Staff accounts are registered through Supabase Auth; the Admin screen can review staff and change roles, but cannot create Auth accounts or change its own role.

Archiving is separate from cancellation: it hides an eligible order from active order lists and operational totals without deleting its history. Use the **Diarsipkan** filter to restore it. Archived orders cannot be edited, verified, or added to a manifest until restored; cancelled or manifested orders cannot be archived.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
