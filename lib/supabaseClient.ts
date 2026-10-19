import { createBrowserClient } from '@supabase/ssr'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const publishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = url && publishableKey ? createBrowserClient(url, publishableKey) : null

export type OrderRow = {
  id: string
  resi: string
  customer_name: string
  origin_city: string
  destination_city: string
  weight_kg: number
  service_type: 'Reguler' | 'Express' | 'Kargo'
  status: 'Diterima' | 'Digudang' | 'Transit' | 'Dalam perjalanan' | 'Out for delivery' | 'Terkirim' | 'Gagal'
  payment_type: 'COD' | 'Prepaid'
  created_at: string
  quoted_price: number | null
  order_items: { name: string; quantity: number; weight: number; packing?: string }[] | null
  sender_description: string | null
  recipient_address: string | null
  notes: string | null
  packing: string | null
  cancelled?: boolean
  cancelled_at?: string | null
  archived?: boolean
  intake_verified_at?: string | null
  manifest_id?: string | null
}

export type TradeRow = {
  id: string
  trade_type: 'Impor' | 'Ekspor'
  origin_country: string
  destination_country: string
  transport_mode: 'Laut' | 'Udara' | 'Darat'
  container_number: string | null
  hs_code: string
  weight_kg: number
  declared_value: string | null
  customs_status: 'Diproses' | 'Inspeksi' | 'Released'
}
