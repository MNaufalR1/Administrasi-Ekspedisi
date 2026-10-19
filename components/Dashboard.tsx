'use client'

import Image from 'next/image'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  Truck, LayoutDashboard, Package, MapPin, Bell, LogOut, Menu,
  Search, Headphones, Plus, CheckCircle, AlertCircle, AlertTriangle, Printer, Pencil, Trash2, MoreHorizontal, Archive, ArchiveRestore,
  Wallet, FileText, Settings2, FileSpreadsheet, Mail, Phone,
  Users, ClipboardList, History, Navigation,
  type LucideIcon,
} from 'lucide-react'
import { supabase, type OrderRow, type TradeRow } from '@/lib/supabaseClient'
import ReceiptDocument from '@/components/ReceiptDocument'
import AuthScreen from '@/components/ui/auth-screen'
import FinanceWorkspace, { type FinancePage } from '@/components/FinanceWorkspace'
import OperationsWorkspace, { type Waybill } from '@/components/OperationsWorkspace'
import DriverWorkspace from '@/components/DriverWorkspace'
import CargoManifestDocument from '@/components/CargoManifestDocument'

type Order = {
  resi: string
  cust: string
  namaBarang?: string
  items?: OrderItem[]
  senderDescription?: string
  recipientAddress?: string
  notes?: string
  packing?: string
  asal: string
  tujuan: string
  berat: number
  layanan: string
  status: string
  cod: string
  createdAt?: string
  quotedPrice?: number | null
  cancelled?: boolean
  archived?: boolean
  intakeVerifiedAt?: string | null
  manifestId?: string | null
}

type OrderItem = {
  name: string
  quantity: number
  weight: number
  packing?: string
}

type OrderItemDraft = {
  name: string
  quantity: string
  weight: string
  packing: string
}

type OrderDraft = {
  resi: string
  cust: string
  senderDescription: string
  recipientAddress: string
  asal: string
  tujuan: string
  items: OrderItemDraft[]
  layanan: string
  cod: string
  notes: string
  packing: string
}

type Trade = {
  id: string
  tipe: string
  asal: string
  tujuan: string
  moda: string
  kont: string
  hs: string
  kg: number
  nilai: number
  cc: string
}

type TradeDraft = {
  tipe: 'Impor' | 'Ekspor'
  asal: string
  tujuan: string
  moda: 'Laut' | 'Udara' | 'Darat'
  kont: string
  hs: string
  kg: string
  nilai: string
  cc: 'Diproses' | 'Inspeksi' | 'Released'
}

type Role = 'Admin' | 'Staf Keuangan'
type Page = 'dashboard' | 'orders' | 'drivers' | 'pengiriman' | 'tracking' | 'customers' | 'staff' | 'manifests' | 'audit' | 'receipt' | FinancePage
type ToastMsg = { id: number; text: string; type: 'success' | 'error' }
type PricingRules = {
  rates: { origin_city: string; destination_city: string; base_cost_per_kg: number }[]
  multipliers: { service_type: string; multiplier: number }[]
  minimumMargin: number
}

const STATUS_COLOR: Record<string, string> = {
  Diterima: 'info', Digudang: 'warning', Transit: 'info', 'Dalam perjalanan': 'warning',
  'Out for delivery': 'info', Terkirim: 'success', Gagal: 'danger', 'Sedang Diantar': 'info',
  'Dalam Perjalanan': 'warning',
  Dibatalkan: 'danger',
}

const STATUSES = ['Diterima', 'Dalam Perjalanan', 'Sedang Diantar', 'Digudang', 'Terkirim', 'Gagal']
const USD_TO_IDR = 16000
const SLA_DAYS: Record<string, number> = { Express: 1, Reguler: 3, Kargo: 5 }
const emptyOrderItem = (): OrderItemDraft => ({ name: '', quantity: '1', weight: '', packing: '' })
const emptyOrderDraft = (): OrderDraft => ({
  resi: '', cust: '', senderDescription: '', recipientAddress: '', asal: '', tujuan: '',
  items: [emptyOrderItem()], layanan: 'Reguler', cod: 'COD', notes: '', packing: '',
})
const KOTA = ['Jakarta', 'Surabaya', 'Bandung', 'Semarang', 'Medan', 'Makassar', 'Denpasar', 'Yogyakarta', 'Malang', 'Balikpapan']
const NAMA = ['PT Sinar Jaya', 'CV Maju Bersama', 'Toko Berkah', 'PT Global Tekstil', 'UD Sumber Rejeki', 'PT Mitra Elektronik', 'CV Anugerah', 'Toko Harapan']

function formatIdr(value: number) {
  return `Rp ${Math.round(value).toLocaleString('id-ID')}`
}

function parseTradeValue(value: string | null | undefined) {
  const amount = Number(String(value || '').replace(/[^\d]/g, ''))
  if (!Number.isFinite(amount)) return 0
  return /(?:US\$|USD|\$)/i.test(String(value)) ? amount * USD_TO_IDR : amount
}

function emptyTradeDraft(): TradeDraft {
  return { tipe: 'Ekspor', asal: '', tujuan: '', moda: 'Laut', kont: '', hs: '', kg: '', nilai: '', cc: 'Diproses' }
}

function isStaffRole(role: unknown): role is Role {
  return role === 'Admin' || role === 'Staf Keuangan'
}

function getErrorMessage(error: unknown) {
  if (error instanceof TypeError && /fetch/i.test(error.message)) {
    return 'Tidak dapat terhubung ke layanan autentikasi. Periksa koneksi internet dan konfigurasi Supabase, lalu coba lagi.'
  }
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String(error.message)
  }
  return 'Terjadi kesalahan. Silakan coba lagi.'
}

function getStaffRoleErrorMessage(error: { message: string; code?: string }) {
  if (error.code === 'PGRST202' || /could not find the function public\.ensure_staff_profile/i.test(error.message)) {
    return 'Fungsi ensure_staff_profile belum tersedia di Supabase. Jalankan migrasi supabase/migrations/202610070001_ensure_staff_profile.sql di SQL Editor, lalu tunggu cache skema diperbarui.'
  }
  return `Gagal memuat peran akun: ${error.message}`
}

function estimatedArrival(order: Order) {
  if (!order.createdAt) return null
  const createdAt = new Date(order.createdAt)
  if (Number.isNaN(createdAt.getTime())) return null
  createdAt.setDate(createdAt.getDate() + (SLA_DAYS[order.layanan] ?? 3))
  return createdAt
}

function isActiveOrder(order: Order) {
  return !order.cancelled && !['Terkirim', 'Gagal'].includes(normalizeStatus(order.status))
}

function isAtRisk(order: Order, now = new Date()) {
  const eta = estimatedArrival(order)
  return Boolean(eta && isActiveOrder(order) && eta.getTime() < now.getTime())
}

function formatDate(date: Date | null) {
  return date ? date.toLocaleDateString('id-ID', { dateStyle: 'medium' }) : 'Belum tersedia'
}

function downloadOrdersCsv(orders: Order[]) {
  const escape = (value: string | number) => {
    const text = String(value)
    const safe = /^[\t\r ]*[=+\-@]/.test(text) ? `'${text}` : text
    return `"${safe.replaceAll('"', '""')}"`
  }
  const rows = [
    ['Resi', 'Pelanggan', 'Pengirim', 'Alamat penerima', 'Asal', 'Tujuan', 'Barang', 'Berat (kg)', 'Packing', 'Keterangan', 'Layanan', 'Status', 'Pembayaran', 'Estimasi tiba', 'Harga rekomendasi (IDR)'],
    ...orders.map(order => [
      order.resi, order.cust, order.senderDescription || '', order.recipientAddress || '',
      order.asal, order.tujuan,
      order.items?.map(item => `${item.name} (${item.quantity} x ${item.weight} kg${item.packing ? `, pack: ${item.packing}` : ''})`).join('; ') || order.namaBarang || '',
      order.berat, order.items?.map(item => item.packing).filter(Boolean).join(', ') || order.packing || '', order.notes || '', order.layanan,
      normalizeStatus(order.cancelled ? 'Dibatalkan' : order.status), order.cod, formatDate(estimatedArrival(order)), order.quotedPrice ?? '',
    ]),
  ]
  const csv = `\uFEFF${rows.map(row => row.map(escape).join(',')).join('\r\n')}`
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `daftar-order-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function totalOrderWeight(items: OrderItemDraft[]) {
  return items.reduce((total, item) => total + Number(item.quantity) * Number(item.weight), 0)
}

function recommendedOrderPrice(draft: OrderDraft, rules: PricingRules | null) {
  const weight = totalOrderWeight(draft.items)
  if (!rules || !draft.asal.trim() || !draft.tujuan.trim() || !Number.isFinite(weight) || weight <= 0) return null
  const route = rules.rates.find(rate =>
    rate.origin_city.trim().toLocaleLowerCase() === draft.asal.trim().toLocaleLowerCase() &&
    rate.destination_city.trim().toLocaleLowerCase() === draft.tujuan.trim().toLocaleLowerCase()
  )
  const multiplier = rules.multipliers.find(item => item.service_type === draft.layanan)
  if (!route || !multiplier) return null
  const cost = Number(route.base_cost_per_kg) * weight * Number(multiplier.multiplier)
  return Number.isFinite(cost) ? Math.ceil(cost * (1 + rules.minimumMargin / 100)) : null
}

function isSupabaseAccessDenied(error: unknown) {
  if (!error) return false
  const details = typeof error === 'object' ? (error as { status?: number; message?: string; code?: string }) : {}
  const status = Number(details.status ?? 0)
  const message = String(details.message || '')
  return status === 401 || status === 403 || details.code === '42501' || /row-level security|rls|not authenticated|permission denied/i.test(message)
}

let seed = 7
const rnd = (n: number) => ((seed = (seed * 9301 + 49297) % 233280) / 233280) * n | 0

function dummyOrders(): Order[] {
  return Array.from({ length: 42 }, (_, i) => ({
    resi: 'NX26092800' + String(i + 1).padStart(2, '0') + String(rnd(90) + 10),
    cust: NAMA[rnd(8)], asal: KOTA[rnd(10)], tujuan: KOTA[rnd(10)],
    berat: (rnd(400) + 5) / 10, layanan: ['Reguler', 'Express', 'Kargo'][rnd(3)],
    status: STATUSES[rnd(STATUSES.length)], cod: rnd(2) ? 'COD' : 'Prepaid',
    createdAt: new Date(Date.now() - ((i % 8) + 1) * 24 * 60 * 60 * 1000).toISOString(),
  }))
}

function dummyTrade(): Trade[] {
  const raw: [string, string, string, string, string, string, number, number][] = [
    ['Ekspor', 'Indonesia', 'Jepang', 'Laut', 'MSKU7412093', '1511.90.90', 12400, 297600000],
    ['Impor', 'Tiongkok', 'Indonesia', 'Laut', 'TGHU5520187', '8517.13.00', 8200, 1542400000],
    ['Ekspor', 'Indonesia', 'Singapura', 'Udara', '—', '0306.17.90', 640, 126400000],
    ['Impor', 'Korea Selatan', 'Indonesia', 'Udara', '—', '3304.99.30', 310, 196000000],
    ['Ekspor', 'Indonesia', 'Jerman', 'Laut', 'CMAU3389021', '6403.99.90', 5300, 656000000],
    ['Impor', 'Jepang', 'Indonesia', 'Laut', 'OOLU8873310', '8708.29.90', 9700, 1019200000],
  ]
  return raw.map((r, i) => ({ id: `demo-trade-${i}`, tipe: r[0], asal: r[1], tujuan: r[2], moda: r[3], kont: r[4], hs: r[5], kg: r[6], nilai: r[7], cc: ['Diproses', 'Inspeksi', 'Released'][i % 3] }))
}

function generateResi(existing: Order[]) {
  let resi = 'NX' + Date.now().toString().slice(-10)
  let counter = 1

  while (existing.some(x => x.resi === resi)) {
    resi = 'NX' + (Number(Date.now().toString().slice(-10)) + counter).toString().padStart(10, '0')
    counter += 1
  }

  return resi
}

const menus: Record<Role, [Page, LucideIcon, string][]> = {
  Admin: [
    ['dashboard', LayoutDashboard, 'Dashboard'],
    ['orders', Package, 'Daftar Order'],
    ['drivers', Truck, 'Data Sopir'],
    ['pengiriman', Navigation, 'Pengiriman'],
    ['manifests', ClipboardList, 'Manajemen Manifest'],
    ['customers', Headphones, 'Data Pelanggan'],
    ['staff', Users, 'Pengelolaan Pengguna'],
    ['tracking', MapPin, 'Tracking'],
    ['audit', History, 'Log Aktivitas'],
  ],
  'Staf Keuangan': [
    ['finance-dashboard', Wallet, 'Dashboard Keuangan'],
    ['finance-invoices', FileText, 'Invoice & Tagihan'],
    ['finance-rates', Settings2, 'Pengaturan Tarif'],
    ['finance-reports', FileSpreadsheet, 'Laporan Keuangan'],
    ['orders', Package, 'Daftar Order'],
    ['tracking', MapPin, 'Tracking'],
    ['audit', History, 'Log Aktivitas'],
  ],
}

function isFinancePage(page: Page): page is FinancePage {
  return page.startsWith('finance-')
}

function normalizeStatus(status: string) {
  const map: Record<string, string> = {
    Diterima: 'Diterima',
    Digudang: 'Digudang',
    Transit: 'Dalam Perjalanan',
    'Dalam perjalanan': 'Dalam Perjalanan',
    'Out for delivery': 'Sedang Diantar',
    'Sedang Diantar': 'Sedang Diantar',
    Dibatalkan: 'Dibatalkan',
    Terkirim: 'Terkirim',
    Gagal: 'Gagal',
    Diproses: 'Diproses',
    Inspeksi: 'Inspeksi',
    Released: 'Released',
  }

  return map[status] || status
}

function StatusBadge({ status }: { status: string }) {
  const normalized = normalizeStatus(status)
  const config: Record<string, string> = {
    Diterima: 'status-info',
    Dibatalkan: 'status-danger',
    Diarsipkan: 'status-neutral',
    'Dalam Perjalanan': 'status-warning',
    'Sedang Diantar': 'status-info',
    Digudang: 'status-warning',
    Terkirim: 'status-success',
    Gagal: 'status-danger',
    Diproses: 'status-neutral',
    Inspeksi: 'status-warning',
    Released: 'status-success',
  }

  const tone = config[normalized] || 'status-neutral'

  return (
    <span className={`status-badge ${tone}`}>
      <span className="dot" />
      {normalized}
    </span>
  )
}

function PageHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight text-[var(--text)]">{title}</h1>
        <p className="mt-1 text-sm text-[var(--text-soft)]">{subtitle}</p>
      </div>
      {action}
    </div>
  )
}

function DashboardPage({ orders, onOpenOrders }: { orders: Order[]; onOpenOrders: () => void }) {
  const activeOrders = orders.filter(order => !order.archived)
  const count = (statuses: string[]) => activeOrders.filter(x => statuses.includes(normalizeStatus(x.status))).length
  const total = activeOrders.length
  const inTransit = count(['Dalam Perjalanan', 'Sedang Diantar'])
  const delivered = count(['Terkirim'])
  const riskyOrders = activeOrders.filter(order => isAtRisk(order)).sort((a, b) =>
    (estimatedArrival(a)?.getTime() ?? 0) - (estimatedArrival(b)?.getTime() ?? 0)
  )
  const needsAttention = count(['Gagal']) + riskyOrders.length

  return (
    <>
      <PageHeader title="Ringkasan operasional" subtitle="Pantau order, estimasi tiba, dan pengiriman yang melewati SLA layanan." />

      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={Package} label="Total order" value={String(total)} change="tercatat" tone="info" />
        <KpiCard icon={Truck} label="Sedang dikirim" value={String(inTransit)} change="aktif" tone="warning" />
        <KpiCard icon={CheckCircle} label="Terkirim" value={String(delivered)} change="selesai" tone="success" />
        <KpiCard icon={AlertTriangle} label="Perlu perhatian" value={String(needsAttention)} change="gagal / lewat SLA" tone="danger" />
      </div>

      <section className="utility-card mb-6 p-0">
        <div className="border-b border-[var(--border)] px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">Peringatan ETA</p>
          <h3 className="mt-1 text-lg font-semibold text-[var(--text)]">Order berisiko terlambat</h3>
        </div>
        {riskyOrders.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead className="bg-[var(--panel-soft)]"><tr>
                {['Resi', 'Pelanggan', 'Rute', 'Status', 'Estimasi tiba'].map(label => <th key={label} className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-soft)]">{label}</th>)}
              </tr></thead>
              <tbody>{riskyOrders.slice(0, 8).map(order => (
                <tr key={order.resi} className="border-t border-[var(--border)]">
                  <td className="px-5 py-3 mono-tabular text-sm font-semibold">{order.resi}</td>
                  <td className="px-5 py-3 text-sm">{order.cust}</td>
                  <td className="px-5 py-3 text-sm">{order.asal} → {order.tujuan}</td>
                  <td className="px-5 py-3"><StatusBadge status={order.status} /></td>
                  <td className="px-5 py-3 text-sm text-[var(--danger)]">{formatDate(estimatedArrival(order))}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <p className="px-5 py-6 text-sm text-[var(--text-soft)]">Tidak ada order aktif yang melewati estimasi SLA.</p>}
        <p className="border-t border-[var(--border)] px-5 py-3 text-xs text-[var(--text-soft)]">ETA indikatif dihitung dari tanggal order dan SLA layanan (Express 1 hari, Reguler 3 hari, Kargo 5 hari); bukan prediksi ML berbasis lokasi real-time.</p>
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.6fr_0.9fr]">
        <section className="utility-card p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">Volume pengiriman</p>
              <h3 className="mt-1 text-lg font-semibold text-[var(--text)]">7 hari terakhir</h3>
            </div>
            <span className="rounded-full bg-[var(--info-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--info)]">+18.4%</span>
          </div>

          <div className="flex h-44 items-end gap-2 rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] p-4">
            {[42, 56, 48, 63, 80, 70, 94].map((height, idx) => (
              <div key={idx} className="flex h-full flex-1 flex-col items-center gap-2">
                <div className="flex w-full flex-1 items-end">
                  <div className="w-full rounded-t-md bg-[var(--brand-600)] opacity-90" style={{ height: `${height}%` }} />
                </div>
                <span className="text-[10px] font-medium text-[var(--text-soft)]">{['M','S','S','R','K','J','S'][idx]}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="utility-card p-5">
          <div className="mb-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">Distribusi status</p>
            <h3 className="mt-1 text-lg font-semibold text-[var(--text)]">Order aktif</h3>
          </div>
          <div className="space-y-4">
            {[
              { label: 'Diterima', value: count(['Diterima']), color: 'bg-[var(--info)]' },
              { label: 'Dalam Perjalanan', value: inTransit, color: 'bg-[var(--warning)]' },
              { label: 'Terkirim', value: delivered, color: 'bg-[var(--success)]' },
              { label: 'Gagal', value: count(['Gagal']), color: 'bg-[var(--danger)]' },
            ].map(item => (
              <div key={item.label}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="text-[var(--text-soft)]">{item.label}</span>
                  <span className="font-semibold text-[var(--text)]">{item.value}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-[var(--panel-soft)]">
                  <div className={`${item.color} h-full rounded-full`} style={{ width: `${Math.max(12, (item.value / Math.max(1, total)) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="utility-card mt-6 p-0">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">Monitoring</p>
            <h3 className="mt-1 text-lg font-semibold text-[var(--text)]">Order terbaru</h3>
          </div>
          <button onClick={onOpenOrders} className="text-sm font-semibold text-[var(--brand-600)] hover:text-[var(--brand-700)]">Lihat semua</button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] table-auto">
            <thead className="bg-[var(--panel-soft)]">
              <tr>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">Resi</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">Rute</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">Pelanggan</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">Status</th>
                <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">Update</th>
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 5).map(x => (
                <tr key={x.resi} className="border-t border-[var(--border)] hover:bg-[var(--panel-soft)]">
                  <td className="px-5 py-3 mono-tabular text-sm font-semibold text-[var(--text)]">{x.resi}</td>
                  <td className="px-5 py-3 text-sm text-[var(--text)]">{x.asal} → {x.tujuan}</td>
                  <td className="px-5 py-3 text-sm text-[var(--text-soft)]">{x.cust}</td>
                  <td className="px-5 py-3"><StatusBadge status={x.status} /></td>
                  <td className="px-5 py-3 text-right text-sm text-[var(--text-soft)]">{Math.max(1, Math.min(9, x.berat % 9))} jam lalu</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

function OrdersPage({ orders, role, canManageOrders, query, statusFilter, setStatusFilter, setQuery, pg, setPg, onAdd, onExport, onRowClick, onPrintReceipt, onEdit, onArchive, onDelete }: {
  orders: Order[]; role: Role; query: string; statusFilter: string; setStatusFilter: (s: string) => void
  setQuery: (s: string) => void; pg: number; setPg: (n: number) => void; onAdd: () => void; onRowClick: (resi: string) => void
  onExport: () => void
  onPrintReceipt: (order: Order) => void
  canManageOrders: boolean
  onEdit: (order: Order) => void; onArchive: (order: Order, archived: boolean) => void; onDelete: (order: Order) => void
}) {
  const per = 8
  const filtered = orders.filter(x =>
    (statusFilter === 'Diarsipkan' ? x.archived : !x.archived) &&
    (x.resi + x.cust + x.tujuan + x.asal).toLowerCase().includes(query.toLowerCase()) &&
    (!statusFilter || statusFilter === 'Diarsipkan' || normalizeStatus(x.cancelled ? 'Dibatalkan' : x.status) === statusFilter)
  )
  const pages = Math.max(1, Math.ceil(filtered.length / per))
  const shown = filtered.slice((pg - 1) * per, pg * per)

  return (
    <>
      <PageHeader title="Daftar order" subtitle={`${filtered.length} pengiriman ditemukan`} action={
        <div className="flex flex-wrap gap-2">
          {role === 'Admin' && <button onClick={onExport} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-4 py-2.5 font-semibold text-[var(--text)] hover:bg-[var(--panel-soft)]">
            <FileSpreadsheet className="h-4 w-4" />Ekspor CSV
          </button>}
          {canManageOrders && <button onClick={onAdd} className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand-600)] px-4 py-2.5 font-semibold text-white hover:bg-[var(--brand-700)]">
            <Plus className="h-4 w-4" />Order baru
          </button>}
        </div>
      } />

      <section className="table-shell">
        <div className="flex flex-col gap-3 border-b border-[var(--border)] bg-[var(--panel)] p-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-soft)]" />
            <input value={query} onChange={e => { setQuery(e.target.value); setPg(1) }} placeholder="Filter cepat..."
              className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] pl-10 pr-3 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--brand-600)]" />
          </div>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPg(1) }} className="h-10 rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] px-3 text-sm text-[var(--text)] outline-none focus:border-[var(--brand-600)]">
            <option value="">Semua status</option>
            {[...STATUSES, 'Dibatalkan', 'Diarsipkan'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          {shown.length ? (
            <table className="resizable-table w-full min-w-[980px]">
              <thead>
                <tr>
                  <th className="text-left">Resi</th>
                  <th className="text-left">Pelanggan</th>
                  <th className="text-left">Rute</th>
                  <th className="text-left">Berat</th>
                  <th className="text-left">Layanan</th>
                  <th className="text-left">Status</th>
                  <th className="text-right">Bayar</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(x => (
                  <tr key={x.resi} className="hover:bg-[var(--panel-soft)]" onClick={() => onRowClick(x.resi)}>
                    <td className="mono-tabular font-semibold text-[var(--text)]">{x.resi}</td>
                    <td className="text-[var(--text)]">{x.cust}</td>
                    <td className="text-[var(--text)]">{x.asal} → {x.tujuan}</td>
                    <td className="mono-tabular text-right text-[var(--text)]">{Number(x.berat).toLocaleString('id-ID', { maximumFractionDigits: 1 })} kg</td>
                    <td className="text-[var(--text)]">{x.layanan}</td>
                    <td><StatusBadge status={x.archived ? 'Diarsipkan' : x.cancelled ? 'Dibatalkan' : x.status} /></td>
                    <td className="mono-tabular text-right text-[var(--text)]">{x.cod}</td>
                    <td className="text-right">
                      <details className="group relative inline-block text-left">
                        <summary
                          aria-label={`Aksi untuk order ${x.resi}`}
                          onClick={event => event.stopPropagation()}
                          className="inline-flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg border border-[var(--border)] bg-white text-[var(--text)] hover:bg-[var(--panel-soft)] [&::-webkit-details-marker]:hidden"
                        >
                          <MoreHorizontal className="h-5 w-5" />
                        </summary>
                        <div className="absolute right-0 z-40 mt-1 w-52 rounded-xl border border-[var(--border)] bg-white p-1.5 text-left shadow-lg">
                          <button type="button"
                            onClick={event => { event.stopPropagation(); event.currentTarget.closest('details')?.removeAttribute('open'); onPrintReceipt(x) }}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--panel-soft)]">
                            <Printer className="h-4 w-4" />Cetak tanda terima
                          </button>
                          {canManageOrders && <>
                            {!x.archived && <button type="button" disabled={Boolean(x.manifestId || x.cancelled)}
                              title={x.manifestId ? 'Order sudah masuk manifest' : x.cancelled ? 'Order sudah dibatalkan' : 'Ubah order'}
                              onClick={event => { event.stopPropagation(); event.currentTarget.closest('details')?.removeAttribute('open'); onEdit(x) }}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--panel-soft)] disabled:cursor-not-allowed disabled:opacity-40">
                              <Pencil className="h-4 w-4" />Ubah order
                            </button>}
                            <button type="button" disabled={Boolean(!x.archived && (x.manifestId || x.cancelled))}
                              title={x.archived ? 'Pulihkan order dari arsip' : x.manifestId ? 'Order sudah masuk manifest' : x.cancelled ? 'Order dibatalkan' : 'Arsipkan order'}
                              onClick={event => { event.stopPropagation(); event.currentTarget.closest('details')?.removeAttribute('open'); onArchive(x, !x.archived) }}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--panel-soft)] disabled:cursor-not-allowed disabled:opacity-40">
                              {x.archived ? <><ArchiveRestore className="h-4 w-4" />Pulihkan dari arsip</> : <><Archive className="h-4 w-4" />Arsipkan order</>}
                            </button>
                            {!x.cancelled && <button type="button" disabled={Boolean(x.manifestId)}
                              title={x.manifestId ? 'Pengiriman sudah masuk manifest' : 'Batalkan order'}
                              onClick={event => { event.stopPropagation(); event.currentTarget.closest('details')?.removeAttribute('open'); onDelete(x) }}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[var(--danger)] hover:bg-[var(--danger-soft)] disabled:cursor-not-allowed disabled:opacity-40">
                              <Trash2 className="h-4 w-4" />Batalkan order
                            </button>}
                          </>}
                        </div>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div className="p-10 text-center text-sm text-[var(--text-soft)]">Belum ada order yang cocok. Ubah kata kunci atau hapus filter status.</div>}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--panel-soft)] px-4 py-3 text-sm text-[var(--text-soft)]">
          <div>Menampilkan {shown.length} dari {filtered.length} data</div>
          <div className="flex items-center gap-2">
            <button className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 font-medium text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-40" disabled={pg < 2} onClick={() => setPg(pg - 1)}>Sebelumnya</button>
            <span className="mono-tabular text-sm font-semibold text-[var(--text)]">{pg}-{Math.min(pg * per, filtered.length)} dari {filtered.length}</span>
            <button className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 font-medium text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-40" disabled={pg >= pages} onClick={() => setPg(pg + 1)}>Berikutnya</button>
          </div>
        </div>
      </section>
    </>
  )
}

function TradePage({ trade, role, onAdd, onEdit, onDelete }: {
  trade: Trade[]
  role: Role
  onAdd: () => void
  onEdit: (record: Trade) => void
  onDelete: (record: Trade) => void
}) {
  const [tf, setTf] = useState('')
  const cc2status: Record<string, string> = { Diproses: 'Diproses', Inspeksi: 'Inspeksi', Released: 'Released' }
  const rows = trade.filter(r => !tf || r.tipe === tf)
  const totalKg = rows.reduce((sum, row) => sum + row.kg, 0)
  const totalValue = rows.reduce((sum, row) => sum + row.nilai, 0)

  return (
    <>
      <PageHeader title="Data impor/ekspor" subtitle="Status customs clearance per dokumen."
        action={role === 'Admin' ? <button onClick={onAdd} className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand-600)] px-4 py-2.5 font-semibold text-white hover:bg-[var(--brand-700)]"><Plus className="h-4 w-4" />Dokumen baru</button> : undefined} />

      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-3">
          <select value={tf} onChange={e => setTf(e.target.value)} className="h-10 rounded-lg border border-[var(--border)] bg-white px-3 text-sm text-[var(--text)] outline-none focus:border-[var(--brand-600)]">
            <option value="">Semua tipe</option>
            <option>Impor</option>
            <option>Ekspor</option>
          </select>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-[var(--border)] bg-white px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">Total berat</div>
            <div className="mt-1 mono-tabular text-xl font-semibold text-[var(--text)]">{totalKg.toLocaleString('id-ID')} kg</div>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-white px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">Total nilai (IDR)</div>
            <div className="mt-1 mono-tabular text-xl font-semibold text-[var(--text)]">{formatIdr(totalValue)}</div>
          </div>
        </div>
      </div>

      <section className="table-shell overflow-x-auto">
        <table className="w-full min-w-[1040px]">
          <thead>
            <tr>
              {['Tipe', 'Asal → Tujuan', 'Moda', 'No. Kontainer', 'HS Code', 'Berat', 'Nilai (IDR)', 'Clearance', ...(role === 'Admin' ? ['Aksi'] : [])].map(h => (
                <th key={h} className="text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="hover:bg-[var(--panel-soft)]">
                <td className="font-semibold text-[var(--text)]">{r.tipe}</td>
                <td className="text-[var(--text)]">{r.asal} → {r.tujuan}</td>
                <td className="text-[var(--text)]">{r.moda}</td>
                <td className="mono-tabular text-[var(--text)]">{r.kont}</td>
                <td className="mono-tabular text-[var(--text)]">{r.hs}</td>
                <td className="mono-tabular text-right text-[var(--text)]">{r.kg.toLocaleString('id-ID')} kg</td>
                <td className="mono-tabular text-right text-[var(--text)]">{formatIdr(r.nilai)}</td>
                <td><StatusBadge status={cc2status[r.cc] || 'Diproses'} /></td>
                {role === 'Admin' && <td className="text-right">
                  <div className="inline-flex items-center gap-2">
                    <button type="button" aria-label={`Edit dokumen ${r.asal} ke ${r.tujuan}`} title="Edit dokumen"
                      onClick={() => onEdit(r)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-soft)] hover:bg-[var(--panel-soft)]">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button type="button" aria-label={`Hapus dokumen ${r.asal} ke ${r.tujuan}`} title="Hapus dokumen"
                      onClick={() => onDelete(r)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--danger)]/20 bg-[var(--danger-soft)] text-[var(--danger)] hover:brightness-95">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>}
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={9} className="p-10 text-center text-sm text-[var(--text-soft)]">Belum ada dokumen untuk tipe ini.</td></tr>}
          </tbody>
        </table>
      </section>
    </>
  )
}

function TrackingPage({ orders, role, track, setTrack, onLookup, onUpdateStatus, exampleResi }: {
  orders: Order[]; role: Role; track: string; setTrack: (s: string) => void; onLookup: (resi: string) => Promise<void>
  onUpdateStatus: (resi: string, status: string) => Promise<void>; exampleResi: string
}) {
  const [input, setInput] = useState(track)
  const o = orders.find(x => x.resi === track.trim().toUpperCase())
  const steps = ['Diterima', 'Digudang', 'Dalam Perjalanan', 'Sedang Diantar', 'Terkirim']

  const search = async () => {
    setTrack(input)
    await onLookup(input)
  }

  return (
    <>
      <PageHeader title="Lacak pengiriman" subtitle={`Masukkan nomor resi. Contoh: ${exampleResi}`} />

      <div className="utility-card p-5">
        <div className="flex flex-col gap-3 md:flex-row">
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()}
            placeholder="NX26092800..." className="h-11 flex-1 rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] px-3 text-[var(--text)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--brand-600)]" />
          <button onClick={search} className="rounded-lg bg-[var(--brand-600)] px-5 py-2.5 font-semibold text-white hover:bg-[var(--brand-700)]">Lacak</button>
        </div>

        {!track && (
          <div className="mt-6 rounded-xl border border-dashed border-[var(--border)] bg-[var(--panel-soft)] p-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-50)] text-[var(--brand-600)]">
              <MapPin className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--text)]">Belum ada nomor resi</h3>
            <p className="mt-2 text-sm text-[var(--text-soft)]">Masukkan contoh resi untuk melihat status pengiriman terbaru, timeline, dan estimasi pengiriman.</p>
            <button onClick={() => setInput(exampleResi || 'NX2609280012')} className="mt-4 rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--text)] hover:bg-[var(--panel-soft)]">Gunakan contoh resi</button>
          </div>
        )}

        {track && !o && (
          <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] p-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--danger-soft)] text-[var(--danger)]">
              <AlertCircle className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--text)]">Resi tidak ditemukan</h3>
            <p className="mt-2 text-sm text-[var(--text-soft)]">Nomor <span className="mono-tabular font-semibold text-[var(--text)]">{track}</span> belum terdaftar atau belum tersedia di sistem. Periksa kembali nomor resi Anda.</p>
          </div>
        )}

        {o && (
          <div className="mt-6 rounded-xl border border-[var(--border)] bg-white p-5">
            <div className="flex flex-col gap-3 border-b border-[var(--border)] pb-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">Tracking aktif</p>
                <div className="mt-2 flex items-center gap-3">
                  <span className="mono-tabular text-xl font-semibold text-[var(--text)]">{o.resi}</span>
                  <StatusBadge status={o.status} />
                </div>
              </div>
              <div className="text-sm text-[var(--text-soft)]">
                <div>{o.asal} → {o.tujuan}</div>
                <div className="mt-1">{o.cust}</div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] p-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">Pengirim</div>
                <div className="mt-2 text-sm font-semibold text-[var(--text)]">PT Lautan Sejati</div>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] p-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">Penerima</div>
                <div className="mt-2 text-sm font-semibold text-[var(--text)]">{o.cust}</div>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] p-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">Estimasi tiba</div>
                <div className="mt-2 text-sm font-semibold text-[var(--text)]">{formatDate(estimatedArrival(o))}</div>
                <div className="mt-1 text-xs text-[var(--text-soft)]">SLA {SLA_DAYS[o.layanan] ?? 3} hari · {o.layanan}</div>
              </div>
            </div>

            {role === 'Admin' && !o.cancelled && <label className="mt-5 block max-w-xs text-sm font-semibold text-[var(--text)]">
              <span className="mb-1.5 block">Ubah status pengiriman</span>
              <select value={normalizeStatus(o.status)} onChange={event => void onUpdateStatus(o.resi, event.target.value)} className="h-10 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--brand-600)]">
                {STATUSES.map(status => <option key={status}>{status}</option>)}
              </select>
            </label>}

            {o.cancelled
              ? <p className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">Pengiriman ini telah dibatalkan. Hubungi staf operasional jika status ini tidak sesuai.</p>
              : <div className="mt-6 ml-2 border-l border-[var(--border)] pl-6">
              {steps.map((step, index) => {
                const activeIndex = steps.indexOf(normalizeStatus(o.status))
                const isDone = index <= activeIndex
                const isCurrent = index === activeIndex

                return (
                  <div key={step} className="relative pb-6 last:pb-0">
                    <div className={`absolute -left-[1.72rem] top-0 flex h-7 w-7 items-center justify-center rounded-full border-4 border-white ${isDone ? 'bg-[var(--success)]' : isCurrent ? 'bg-[var(--brand-600)]' : 'bg-[var(--panel-soft)] border-[var(--border)]'}`} />
                    <div className="ml-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className={`text-sm font-semibold ${isCurrent ? 'text-[var(--brand-600)]' : 'text-[var(--text)]'}`}>{step}</p>
                        <span className="text-[11px] text-[var(--text-soft)]">{`${8 + index * 4}:00`}</span>
                      </div>
                      <p className="mt-1 text-xs text-[var(--text-soft)]">{index === 0 ? o.asal : index === steps.length - 1 ? o.tujuan : 'Lokasi transit'} · {index === steps.length - 1 ? 'Telah diterima' : 'Diproses'}</p>
                    </div>
                  </div>
                )
              })}
            </div>}
          </div>
        )}
      </div>
    </>
  )
}

function KpiCard({ icon: Icon, label, value, change, tone }: { icon: LucideIcon; label: string; value: string; change: string; tone: 'info' | 'success' | 'warning' | 'danger' | 'neutral' }) {
  const map = {
    info: 'bg-[var(--info-soft)] text-[var(--info)]',
    success: 'bg-[var(--success-soft)] text-[var(--success)]',
    warning: 'bg-[var(--warning-soft)] text-[var(--warning)]',
    danger: 'bg-[var(--danger-soft)] text-[var(--danger)]',
    neutral: 'bg-[var(--panel-soft)] text-[var(--brand-900)]',
  }
  return (
    <div className="utility-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">{label}</p>
          <div className="mt-3 mono-tabular text-3xl font-semibold text-[var(--text)]">{value}</div>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${map[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="metric-bottom">
        <span className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold ${tone === 'success' ? 'bg-[var(--success-soft)] text-[var(--success)]' : tone === 'danger' ? 'bg-[var(--danger-soft)] text-[var(--danger)]' : tone === 'warning' ? 'bg-[var(--warning-soft)] text-[var(--warning)]' : 'bg-[var(--info-soft)] text-[var(--info)]'}`}>{change}</span>
      </div>
    </div>
  )
}

function Dashboard() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [role, setRole] = useState<Role>('Staf Keuangan')
  const [publicGuest, setPublicGuest] = useState(false)
  const [authLoading, setAuthLoading] = useState(Boolean(supabase))
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authNotice, setAuthNotice] = useState('')
  const [page, setPage] = useState<Page>('dashboard')
  const [orders, setOrders] = useState<Order[]>(dummyOrders())
  const [trade, setTrade] = useState<Trade[]>(dummyTrade())
  const [usingLive, setUsingLive] = useState(false)
  const [toasts, setToasts] = useState<ToastMsg[]>([])
  const [sideOpen, setSideOpen] = useState(false)
  const [supportOpen, setSupportOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [pg, setPg] = useState(1)
  const [track, setTrack] = useState('')
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null)
  const [receiptItemNames, setReceiptItemNames] = useState<Record<string, string>>({})
  const [manifestWaybill, setManifestWaybill] = useState<Waybill | null>(null)
  const [newOrderOpen, setNewOrderOpen] = useState(false)
  const [editingResi, setEditingResi] = useState<string | null>(null)
  const [deletingOrder, setDeletingOrder] = useState<Order | null>(null)
  const [archiveOrderDraft, setArchiveOrderDraft] = useState<Order | null>(null)
  const [newOrderDraft, setNewOrderDraft] = useState<OrderDraft>(emptyOrderDraft())
  const [tradeFormOpen, setTradeFormOpen] = useState(false)
  const [editingTradeId, setEditingTradeId] = useState<string | null>(null)
  const [deletingTrade, setDeletingTrade] = useState<Trade | null>(null)
  const [tradeDraft, setTradeDraft] = useState<TradeDraft>(emptyTradeDraft())
  const [pricingRules, setPricingRules] = useState<PricingRules | null>(null)
  const [pricingError, setPricingError] = useState('')
  const [pricingLoading, setPricingLoading] = useState(false)
  const [useRecommendedPrice, setUseRecommendedPrice] = useState(false)
  const canManageOrders = !publicGuest && (role === 'Admin' || role === 'Staf Keuangan')

  const toast = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now()
    setToasts(t => [...t, { id, text, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 2600)
  }, [])

  const loadFromSupabase = useCallback(async (): Promise<boolean> => {
    if (!supabase) {
      setUsingLive(false)
      return false
    }

    try {
      const pageSize = 500
      const ordRows: OrderRow[] = []
      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await supabase.from('orders').select('*')
          .order('created_at', { ascending: false }).order('resi', { ascending: true }).range(offset, offset + pageSize - 1)
        if (error) {
          if (isSupabaseAccessDenied(error)) {
            setUsingLive(false)
            return false
          }
          throw error
        }
        const pageRows = (data || []) as OrderRow[]
        ordRows.push(...pageRows)
        if (pageRows.length < pageSize) break
      }

      setOrders(ordRows.map((r: OrderRow) => ({
        resi: r.resi, cust: r.customer_name, asal: r.origin_city, tujuan: r.destination_city,
        berat: Number(r.weight_kg), layanan: r.service_type, status: r.cancelled ? 'Dibatalkan' : r.status, cod: r.payment_type,
        createdAt: r.created_at, quotedPrice: r.quoted_price == null ? null : Number(r.quoted_price),
        cancelled: Boolean(r.cancelled), archived: Boolean(r.archived), intakeVerifiedAt: r.intake_verified_at || null, manifestId: r.manifest_id || null,
        items: r.order_items || [], senderDescription: r.sender_description || '',
        recipientAddress: r.recipient_address || '', notes: r.notes || '', packing: r.packing || '',
        namaBarang: (r.order_items || []).map(item => item.name).join(', '),
      })))

      const trdRows: TradeRow[] = []
      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await supabase.from('trade_documents').select('*')
          .order('created_at', { ascending: false }).order('id', { ascending: true }).range(offset, offset + pageSize - 1)
        if (error) {
          if (isSupabaseAccessDenied(error)) {
            setUsingLive(false)
            return false
          }
          throw error
        }
        const pageRows = (data || []) as TradeRow[]
        trdRows.push(...pageRows)
        if (pageRows.length < pageSize) break
      }

      setTrade(trdRows.map((r: TradeRow) => ({
        id: r.id, tipe: r.trade_type, asal: r.origin_country, tujuan: r.destination_country, moda: r.transport_mode,
        kont: r.container_number || '—', hs: r.hs_code, kg: Number(r.weight_kg), nilai: parseTradeValue(r.declared_value), cc: r.customs_status,
      })))

      setUsingLive(true)
      return true
    } catch (e) {
      console.warn('Gagal memuat data Supabase, pakai data dummy sebagai fallback.', e)
      setUsingLive(false)
      return false
    }
  }, [])

  const loadPricingRules = useCallback(async () => {
    if (!supabase) {
      setPricingRules(null)
      setPricingError('Supabase belum dikonfigurasi; rekomendasi harga tidak tersedia.')
      return
    }
    setPricingLoading(true)
    setPricingError('')
    try {
      const [ratesResult, multipliersResult, settingsResult] = await Promise.all([
        supabase.from('route_rates').select('origin_city,destination_city,base_cost_per_kg'),
        supabase.from('service_multipliers').select('service_type,multiplier'),
        supabase.from('finance_settings').select('minimum_margin_percent').limit(1).maybeSingle(),
      ])
      const error = ratesResult.error || multipliersResult.error || settingsResult.error
      if (error) throw error
      setPricingRules({
        rates: ratesResult.data || [],
        multipliers: multipliersResult.data || [],
        minimumMargin: Number(settingsResult.data?.minimum_margin_percent ?? 20),
      })
    } catch (error) {
      setPricingRules(null)
      setPricingError(`Gagal memuat rekomendasi harga dari pengaturan Keuangan: ${getErrorMessage(error)}`)
    } finally {
      setPricingLoading(false)
    }
  }, [])

  useEffect(() => {
    const client = supabase
    if (!client) return

    let active = true
    const { data: { subscription } } = client.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT') {
        setLoggedIn(false)
        setPublicGuest(false)
      }
    })

    async function restoreSession(authClient: NonNullable<typeof supabase>) {
      try {
        const { data, error } = await authClient.auth.getSession()
        if (error) throw error
        if (data.session) {
          const { data: profileRole, error: profileError } = await authClient.rpc('ensure_staff_profile')
          if (profileError) throw new Error(getStaffRoleErrorMessage(profileError))
          const restoredRole: unknown = profileRole
          if (!isStaffRole(restoredRole)) throw new Error('Peran akun tidak valid. Hubungi administrator.')
          if (active) {
            setRole(restoredRole)
            setPublicGuest(false)
            setLoggedIn(true)
            setPage(menus[restoredRole][0][0])
            const live = await loadFromSupabase()
            if (active) {
              toast(live ? 'Terhubung ke database' : 'Data live tidak tersedia; menampilkan data demo.')
              if (restoredRole === 'Admin' && live) await loadPricingRules()
            }
          }
        }
      } catch (error) {
        if (active) setAuthError(getErrorMessage(error))
      } finally {
        if (active) setAuthLoading(false)
      }
    }

    void restoreSession(client)
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [loadFromSupabase, loadPricingRules, toast])

  async function openStaffSession() {
    if (!supabase) throw new Error('Supabase belum dikonfigurasi. Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.')
    const { data, error } = await supabase.rpc('ensure_staff_profile')
    if (error) throw new Error(getStaffRoleErrorMessage(error))
    const assignedRole: unknown = data
    if (!isStaffRole(assignedRole)) throw new Error('Akun ini belum memiliki peran staf yang valid. Hubungi administrator.')

    setAuthError('')
    setAuthNotice('')
    setRole(assignedRole)
    setPublicGuest(false)
    setLoggedIn(true)
    setPage(menus[assignedRole][0][0])
    toast('Memuat data...')
    const live = await loadFromSupabase()
    toast(live ? 'Terhubung ke database' : 'Data live tidak tersedia; menampilkan data demo.')
    if (assignedRole === 'Admin' && live) await loadPricingRules()
  }

  async function signIn(email: string, password: string) {
    setAuthBusy(true)
    setAuthError('')
    setAuthNotice('')
    try {
      if (!supabase) throw new Error('Supabase belum dikonfigurasi. Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.')
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      if (!data.user) throw new Error('Supabase tidak mengembalikan pengguna yang masuk.')
      await openStaffSession()
    } catch (error) {
      setAuthError(getErrorMessage(error))
    } finally {
      setAuthBusy(false)
    }
  }

  async function signUp(name: string, email: string, password: string) {
    setAuthBusy(true)
    setAuthError('')
    setAuthNotice('')
    try {
      if (!supabase) throw new Error('Supabase belum dikonfigurasi. Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.')
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      })
      if (error) throw error
      if (!data.user) throw new Error('Supabase tidak mengembalikan akun yang dibuat.')
      if (!data.session) {
        setAuthNotice('Akun dibuat. Periksa email Anda untuk konfirmasi sebelum masuk.')
        return
      }
      await openStaffSession()
    } catch (error) {
      setAuthError(getErrorMessage(error))
    } finally {
      setAuthBusy(false)
    }
  }

  async function publicTrack() {
    setRole('Staf Keuangan')
    setPublicGuest(true)
    setLoggedIn(true)
    setPage('tracking')
  }

  async function signOut() {
    if (publicGuest) {
      setPublicGuest(false)
      setLoggedIn(false)
      return
    }
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) {
      toast(`Gagal keluar: ${error.message}`, 'error')
      return
    }
    setLoggedIn(false)
    setPublicGuest(false)
  }

  async function saveOrder() {
    if (!canManageOrders) {
      toast('Akun ini tidak memiliki akses untuk mengubah order.', 'error')
      return
    }
    const draft = { ...newOrderDraft }
    const resi = (editingResi || draft.resi || generateResi(orders)).trim().toUpperCase()
    const currentOrder = editingResi ? orders.find(order => order.resi === editingResi) : undefined
    if (editingResi && !currentOrder) {
      toast('Order tidak ditemukan.', 'error')
      return
    }
    const cust = draft.cust.trim()
    const asal = draft.asal.trim()
    const tujuan = draft.tujuan.trim()
    const senderDescription = draft.senderDescription.trim()
    const recipientAddress = draft.recipientAddress.trim()
    const items: OrderItem[] = draft.items.map(item => ({
      name: item.name.trim(),
      quantity: Number(item.quantity),
      weight: Number(item.weight),
      packing: item.packing?.trim() || '',
    }))
    const berat = items.reduce((sum, item) => sum + item.quantity * item.weight, 0)
    const layanan = draft.layanan
    const status = currentOrder?.status || 'Diterima'
    const cod = draft.cod
    const quotedPrice = role === 'Admin' && useRecommendedPrice
      ? recommendedOrderPrice(draft, pricingRules)
      : currentOrder?.quotedPrice ?? null
    const derivedPacking = items.map(item => item.packing).filter(Boolean).join(', ')

    if (!resi || !cust || !senderDescription || !recipientAddress || !asal || !tujuan ||
      !items.length || items.some(item => !item.name || !Number.isInteger(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.weight) || item.weight <= 0) ||
      !Number.isFinite(berat) || berat <= 0) {
      toast('Lengkapi pelanggan, keterangan pengirim, alamat penerima, rute, dan detail barang dengan benar.', 'error')
      return
    }
    if (role === 'Admin' && useRecommendedPrice && quotedPrice === null) {
      toast('Rekomendasi harga belum tersedia untuk rute dan layanan ini.', 'error')
      return
    }

    const newRow: Order = {
      resi, cust, namaBarang: items.map(item => item.name).join(', '), items,
      senderDescription, recipientAddress, notes: draft.notes.trim(), packing: derivedPacking || draft.packing.trim(),
      asal, tujuan, berat, layanan, status, cod,
      createdAt: currentOrder?.createdAt || new Date().toISOString(),
      quotedPrice,
      cancelled: currentOrder?.cancelled || false,
      archived: currentOrder?.archived || false,
      intakeVerifiedAt: currentOrder?.intakeVerifiedAt || null,
      manifestId: currentOrder?.manifestId || null,
    }

    const row = {
      resi, customer_name: cust, origin_city: asal, destination_city: tujuan,
      weight_kg: berat, service_type: layanan, status, payment_type: cod, quoted_price: quotedPrice,
      sender_description: senderDescription, recipient_address: recipientAddress,
      order_items: items, notes: draft.notes.trim(), packing: derivedPacking || draft.packing.trim(),
    }

    if (editingResi) {
      if (usingLive && supabase) {
        const update = supabase.from('orders').update(row).eq('resi', resi)
        const { data, error } = await update.select('resi').maybeSingle()
        if (error || !data) {
          toast(error ? 'Gagal mengubah order: ' + error.message : 'Order tidak ditemukan atau akses ditolak.', 'error')
          return
        }
      }
      setOrders(current => current.map(order => order.resi === resi ? newRow : order))
      setNewOrderOpen(false)
      setEditingResi(null)
      toast(usingLive ? 'Order berhasil diperbarui.' : 'Order demo diperbarui untuk sesi ini.')
      return
    }
    setOrders(current => [newRow, ...current])
    setNewOrderDraft(emptyOrderDraft())
    setNewOrderOpen(false)

    if (!supabase) {
      toast('Order manual tersimpan di daftar lokal. Hubungkan Supabase untuk sinkronisasi online.', 'success')
      return
    }

    const { error } = await supabase.from('orders').insert(row)
    if (error) {
      if (isSupabaseAccessDenied(error)) {
        setUsingLive(false)
        toast('Order lokal tersimpan, tetapi RLS Supabase memblokir kirim ke database.', 'error')
        return
      }
      toast('Order lokal tersimpan, tetapi gagal sinkronisasi: ' + error.message, 'error')
      return
    }

    toast('Order baru dibuat, resi ' + resi)
    await loadFromSupabase()
  }

  function editOrder(order: Order) {
    if (!canManageOrders) {
      toast('Akun ini tidak memiliki akses untuk mengubah order.', 'error')
      return
    }
    if (order.archived) {
      toast('Pulihkan order dari arsip sebelum mengubahnya.', 'error')
      return
    }
    if (order.cancelled || order.manifestId) {
      toast('Order yang dibatalkan atau sudah masuk manifest tidak dapat diedit.', 'error')
      return
    }
    setEditingResi(order.resi)
    setNewOrderDraft({
      resi: order.resi, cust: order.cust, senderDescription: order.senderDescription || '',
      recipientAddress: order.recipientAddress || '', asal: order.asal, tujuan: order.tujuan,
      items: (order.items?.length ? order.items : [{
        name: receiptItemNames[order.resi] || order.namaBarang || '', quantity: 1, weight: order.berat, packing: order.packing || '',
      }]).map(item => ({
        name: item.name,
        quantity: String(item.quantity),
        weight: String(item.weight),
        packing: item.packing || (order.items?.length === 1 ? order.packing || '' : ''),
      })),
      layanan: order.layanan, cod: order.cod, notes: order.notes || '', packing: order.packing || '',
    })
    setUseRecommendedPrice(role === 'Admin' && order.quotedPrice != null)
    setNewOrderOpen(true)
  }

  async function updateOrderStatus(resi: string, status: string) {
    if (role !== 'Admin') {
      toast('Hanya staf Admin operasional yang dapat mengubah status.', 'error')
      return
    }
    if (orders.find(order => order.resi === resi)?.cancelled) {
      toast('Status order yang sudah dibatalkan tidak dapat diubah.', 'error')
      return
    }
    if (usingLive && supabase) {
      const { data, error } = await supabase.from('orders').update({ status }).eq('resi', resi).select('resi').maybeSingle()
      if (error || !data) {
        toast(error ? `Gagal memperbarui status: ${error.message}` : 'Order tidak ditemukan atau akses ditolak.', 'error')
        return
      }
    }
    setOrders(current => current.map(order => order.resi === resi ? { ...order, status } : order))
    toast(usingLive ? `Status resi ${resi} diperbarui dan dicatat.` : 'Status order demo diperbarui untuk sesi ini.')
  }

  async function exportOrders() {
    if (role !== 'Admin') {
      toast('Hanya staf Admin operasional yang dapat mengekspor daftar order.', 'error')
      return
    }
    let exportRows = orders
    if (usingLive && supabase) {
      const pageSize = 500
      const allRows: OrderRow[] = []
      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await supabase.from('orders').select('*')
          .order('created_at', { ascending: false }).order('resi', { ascending: true }).range(offset, offset + pageSize - 1)
        if (error) {
          toast(`Gagal mengambil seluruh daftar order untuk ekspor: ${error.message}`, 'error')
          return
        }
        const pageRows = (data || []) as OrderRow[]
        allRows.push(...pageRows)
        if (pageRows.length < pageSize) break
      }
      exportRows = allRows.map(row => ({
        resi: row.resi, cust: row.customer_name, asal: row.origin_city, tujuan: row.destination_city,
        berat: Number(row.weight_kg), layanan: row.service_type, status: row.cancelled ? 'Dibatalkan' : row.status, cod: row.payment_type,
        createdAt: row.created_at, quotedPrice: row.quoted_price == null ? null : Number(row.quoted_price),
        cancelled: Boolean(row.cancelled), archived: Boolean(row.archived), intakeVerifiedAt: row.intake_verified_at || null, manifestId: row.manifest_id || null,
        items: row.order_items || [], senderDescription: row.sender_description || '',
        recipientAddress: row.recipient_address || '', notes: row.notes || '', packing: row.packing || '',
      }))
    }
    const filtered = exportRows.filter(order =>
      (statusFilter === 'Diarsipkan' ? order.archived : !order.archived) &&
      (order.resi + order.cust + order.tujuan + order.asal).toLocaleLowerCase().includes(query.toLocaleLowerCase()) &&
      (!statusFilter || statusFilter === 'Diarsipkan' || normalizeStatus(order.status) === statusFilter)
    )
    downloadOrdersCsv(filtered)
    toast(`${filtered.length} order diekspor ke CSV.`)
  }

  async function confirmCancelOrder() {
    if (!canManageOrders) {
      toast('Akun ini tidak memiliki akses untuk membatalkan order.', 'error')
      return
    }
    if (!deletingOrder) {
      return
    }

    if (usingLive && supabase) {
      const { error } = await supabase.rpc('admin_cancel_order', { p_resi: deletingOrder.resi })
      if (error) {
        toast(`Gagal membatalkan order: ${error.message}`, 'error')
        setDeletingOrder(null)
        return
      }
    }

    setOrders(current => current.map(order => order.resi === deletingOrder.resi
      ? { ...order, cancelled: true, status: 'Dibatalkan' }
      : order))
    toast(usingLive ? 'Order berhasil dibatalkan dan dicatat.' : 'Order demo dibatalkan untuk sesi ini.')
    setDeletingOrder(null)
  }

  async function setOrderArchived(order: Order, archived: boolean) {
    if (!canManageOrders) {
      toast('Akun ini tidak memiliki akses untuk mengarsipkan order.', 'error')
      return
    }
    if (order.manifestId || order.cancelled) {
      toast('Order yang sudah masuk manifest atau dibatalkan tidak dapat diarsipkan.', 'error')
      return
    }
    if (usingLive && supabase) {
      const { data, error } = await supabase.from('orders').update({ archived })
        .eq('resi', order.resi).select('resi').maybeSingle()
      if (error || !data) {
        toast(error ? `Gagal ${archived ? 'mengarsipkan' : 'memulihkan'} order: ${error.message}` : 'Order tidak ditemukan atau akses ditolak.', 'error')
        return
      }
    }
    setOrders(current => current.map(item => item.resi === order.resi ? { ...item, archived } : item))
    setArchiveOrderDraft(null)
    toast(usingLive
      ? archived ? 'Order diarsipkan dan riwayatnya tetap tersimpan.' : 'Order dipulihkan dari arsip.'
      : archived ? 'Order demo diarsipkan untuk sesi ini.' : 'Order demo dipulihkan untuk sesi ini.')
  }

  function addTrade() {
    if (role !== 'Admin') return
    setEditingTradeId(null)
    setTradeDraft(emptyTradeDraft())
    setTradeFormOpen(true)
  }

  function editTrade(record: Trade) {
    if (role !== 'Admin') return
    setEditingTradeId(record.id)
    setTradeDraft({
      tipe: record.tipe as TradeDraft['tipe'], asal: record.asal, tujuan: record.tujuan,
      moda: record.moda as TradeDraft['moda'], kont: record.kont === '—' ? '' : record.kont,
      hs: record.hs, kg: String(record.kg), nilai: String(record.nilai), cc: record.cc as TradeDraft['cc'],
    })
    setTradeFormOpen(true)
  }

  async function saveTrade() {
    if (role !== 'Admin') {
      toast('Hanya Admin yang dapat mengubah data impor/ekspor.', 'error')
      return
    }
    const asal = tradeDraft.asal.trim()
    const tujuan = tradeDraft.tujuan.trim()
    const kont = tradeDraft.kont.trim()
    const hs = tradeDraft.hs.trim()
    const kg = Number(tradeDraft.kg)
    const nilai = Number(tradeDraft.nilai)

    if (!asal || !tujuan || !hs || !tradeDraft.kg.trim() || !tradeDraft.nilai.trim() || !Number.isFinite(kg) || kg <= 0 || !Number.isFinite(nilai) || nilai < 0) {
      toast('Lengkapi negara, HS Code, berat, dan nilai IDR dengan benar.', 'error')
      return
    }

    const record: Trade = {
      id: editingTradeId || `local-trade-${Date.now()}`,
      tipe: tradeDraft.tipe, asal, tujuan, moda: tradeDraft.moda,
      kont: kont || '—', hs, kg, nilai, cc: tradeDraft.cc,
    }
    const row = {
      trade_type: record.tipe, origin_country: asal, destination_country: tujuan,
      transport_mode: record.moda, container_number: kont || null, hs_code: hs,
      weight_kg: kg, declared_value: String(nilai), customs_status: record.cc,
    }

    if (editingTradeId) {
      if (usingLive && supabase) {
        const { data, error } = await supabase.from('trade_documents').update(row).eq('id', editingTradeId).select('id').maybeSingle()
        if (error || !data) {
          toast(error ? 'Gagal memperbarui dokumen: ' + error.message : 'Dokumen tidak ditemukan atau akses ditolak.', 'error')
          return
        }
      }
      setTrade(current => current.map(item => item.id === editingTradeId ? record : item))
      toast(usingLive ? 'Dokumen berhasil diperbarui.' : 'Dokumen demo diperbarui untuk sesi ini.')
    } else {
      let savedRecord = record
      if (usingLive && supabase) {
        const { data, error } = await supabase.from('trade_documents').insert(row).select('id').single()
        if (error || !data) {
          toast(error ? 'Gagal menambahkan dokumen: ' + error.message : 'Dokumen gagal disimpan.', 'error')
          return
        }
        savedRecord = { ...record, id: data.id }
      }
      setTrade(current => [savedRecord, ...current])
      toast(usingLive ? 'Dokumen berhasil ditambahkan.' : 'Dokumen demo ditambahkan untuk sesi ini.')
    }

    setTradeFormOpen(false)
    setEditingTradeId(null)
  }

  async function confirmDeleteTrade() {
    if (role !== 'Admin') {
      toast('Hanya Admin yang dapat menghapus data impor/ekspor.', 'error')
      return
    }
    if (!deletingTrade) return
    if (usingLive && supabase) {
      const { data, error } = await supabase.from('trade_documents').delete().eq('id', deletingTrade.id).select('id').maybeSingle()
      if (error || !data) {
        toast(error ? 'Gagal menghapus dokumen: ' + error.message : 'Dokumen tidak ditemukan atau akses ditolak.', 'error')
        setDeletingTrade(null)
        return
      }
    }

    setTrade(current => current.filter(item => item.id !== deletingTrade.id))
    toast(usingLive ? 'Dokumen berhasil dihapus.' : 'Dokumen demo dihapus untuk sesi ini.')
    setDeletingTrade(null)
  }

  async function trackLookup(resi: string) {
    const q = resi.trim().toUpperCase()
    if (!q) return
    if (orders.find(x => x.resi === q)) return
    if (!supabase) return

    if (publicGuest) {
      const { data, error } = await supabase.rpc('public_track_order', { lookup_resi: q })
      if (error) {
        toast(`Gagal mencari resi: ${error.message}`, 'error')
        return
      }
      const row = Array.isArray(data) ? data[0] : data
      if (row) {
        setOrders(current => [...current, {
          resi: row.resi,
          cust: row.customer_name,
          asal: row.origin_city,
          tujuan: row.destination_city,
          berat: Number(row.weight_kg),
          layanan: row.service_type,
          status: row.status,
          cancelled: row.status === 'Dibatalkan',
          cod: '—',
        }])
      }
      return
    }

    const { data, error } = await supabase.from('orders').select('*').eq('resi', q).maybeSingle()
    if (error) {
      if (isSupabaseAccessDenied(error)) {
        setUsingLive(false)
        return
      }
      console.warn('Gagal pencarian resi di Supabase.', error)
      return
    }

    if (data) {
      setOrders(o => [...o, {
        resi: data.resi, cust: data.customer_name, asal: data.origin_city, tujuan: data.destination_city,
        berat: Number(data.weight_kg), layanan: data.service_type, status: data.cancelled ? 'Dibatalkan' : data.status, cod: data.payment_type,
        createdAt: data.created_at, quotedPrice: data.quoted_price == null ? null : Number(data.quoted_price),
        cancelled: Boolean(data.cancelled), intakeVerifiedAt: data.intake_verified_at || null, manifestId: data.manifest_id || null,
        items: data.order_items || [], senderDescription: data.sender_description || '',
        recipientAddress: data.recipient_address || '', notes: data.notes || '', packing: data.packing || '',
      }])
    }
  }

  const scope = () => orders

  const orderRecommendation = recommendedOrderPrice(newOrderDraft, pricingRules)

  function openNewOrder() {
    setNewOrderDraft({ ...emptyOrderDraft(), resi: generateResi(scope()) })
    setEditingResi(null)
    setUseRecommendedPrice(false)
    setNewOrderOpen(true)
    if (role === 'Admin' && !pricingRules && !pricingLoading) void loadPricingRules()
  }

  if (authLoading) {
    return <main className="flex min-h-screen items-center justify-center bg-[var(--surface)] text-sm font-semibold text-[var(--text-soft)]">Memeriksa sesi...</main>
  }
  if (!loggedIn) {
    return <AuthScreen
      busy={authBusy}
      error={authError}
      notice={authNotice}
      onSignIn={signIn}
      onSignUp={signUp}
      onPublicTrack={publicTrack}
    />
  }
  if (page === 'receipt' && receiptOrder) {
    return <ReceiptDocument order={receiptOrder} onBack={() => setPage('orders')} />
  }
  if (manifestWaybill) {
    return (
      <CargoManifestDocument
        manifest={manifestWaybill.manifest}
        orders={manifestWaybill.orders}
        driverInfo={manifestWaybill.driverInfo}
        onClose={() => setManifestWaybill(null)}
      />
    )
  }

  const nav = publicGuest ? menus[role].filter(([item]) => item === 'tracking') : menus[role]

  return (
    <div className="flex min-h-screen bg-[var(--surface)] text-[var(--text)]">
      {sideOpen && <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={() => setSideOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-50 flex h-screen w-[240px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--brand-900)] text-white transition-transform duration-200 ${sideOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className="flex h-[72px] items-center gap-3 border-b border-white/10 px-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white p-1 shadow-inner">
            <Image src="/company-logo.svg" alt="Logo Lautan Sejati Trans Cargo" width={36} height={36} className="h-full w-full object-contain" />
          </div>
          <div>
            <div className="text-base font-semibold leading-tight">Lautan Sejati</div>
            <div className="text-xs text-slate-300">Trans Cargo</div>
          </div>
        </div>

        <div className="px-4 py-4">
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-medium tracking-[0.14em] text-slate-300 uppercase">
            {role === 'Staf Keuangan' && isFinancePage(page) ? 'Keuangan' : 'Operasional'}
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 pb-3">
          {nav.map(([p, Icon, label]) => {
            const active = page === p
            return (
              <button
                key={p}
                onClick={() => { setPage(p); setPg(1); setSideOpen(false) }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${active ? 'border-l-2 border-[var(--brand-600)] bg-white/8 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
              >
                <Icon className={`h-4 w-4 ${active ? 'text-white' : 'text-slate-300'}`} />
                <span className="text-sm font-medium">{label}</span>
              </button>
            )
          })}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-600)] text-white">
              <Headphones className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <button
                type="button"
                aria-expanded={supportOpen}
                onClick={() => setSupportOpen(open => !open)}
                className="w-full text-left text-sm font-semibold text-white"
              >
                Butuh bantuan?
              </button>
              {supportOpen && (
                <div className="mt-2">
                  <a href="mailto:m.naufal.r332@gmail.com" className="flex items-center gap-2 text-xs text-slate-300 hover:text-white">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span className="break-all">m.naufal.r332@gmail.com</span>
                  </a>
                  <a href="https://wa.me/62895629503250" target="_blank" rel="noreferrer" className="mt-1.5 flex items-center gap-2 text-xs text-slate-300 hover:text-white">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    <span>WhatsApp · 0895629503250</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {tradeFormOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/45 p-4">
          <section className="w-full max-w-2xl rounded-xl border border-[var(--border)] bg-white p-6 shadow-[var(--shadow)]" role="dialog" aria-modal="true" aria-labelledby="trade-form-title">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">Dokumen kepabeanan</p>
                <h2 id="trade-form-title" className="text-xl font-semibold text-[var(--text)]">{editingTradeId ? 'Edit dokumen' : 'Dokumen impor/ekspor baru'}</h2>
              </div>
              <button type="button" onClick={() => setTradeFormOpen(false)} aria-label="Tutup" className="text-3xl leading-none text-[var(--text-soft)] hover:text-[var(--text)]">×</button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="text-sm font-semibold text-[var(--text)]">
                <span className="mb-1.5 block">Tipe dokumen</span>
                <select value={tradeDraft.tipe} onChange={e => setTradeDraft(draft => ({ ...draft, tipe: e.target.value as TradeDraft['tipe'] }))} className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 outline-none focus:border-[var(--brand-600)]">
                  <option>Ekspor</option><option>Impor</option>
                </select>
              </label>
              <label className="text-sm font-semibold text-[var(--text)]">
                <span className="mb-1.5 block">Moda transportasi</span>
                <select value={tradeDraft.moda} onChange={e => setTradeDraft(draft => ({ ...draft, moda: e.target.value as TradeDraft['moda'] }))} className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 outline-none focus:border-[var(--brand-600)]">
                  <option>Laut</option><option>Udara</option><option>Darat</option>
                </select>
              </label>
              <label className="text-sm font-semibold text-[var(--text)]">
                <span className="mb-1.5 block">Negara asal</span>
                <input value={tradeDraft.asal} onChange={e => setTradeDraft(draft => ({ ...draft, asal: e.target.value }))} className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 outline-none focus:border-[var(--brand-600)]" placeholder="Indonesia" />
              </label>
              <label className="text-sm font-semibold text-[var(--text)]">
                <span className="mb-1.5 block">Negara tujuan</span>
                <input value={tradeDraft.tujuan} onChange={e => setTradeDraft(draft => ({ ...draft, tujuan: e.target.value }))} className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 outline-none focus:border-[var(--brand-600)]" placeholder="Jepang" />
              </label>
              <label className="text-sm font-semibold text-[var(--text)]">
                <span className="mb-1.5 block">Nomor kontainer</span>
                <input value={tradeDraft.kont} onChange={e => setTradeDraft(draft => ({ ...draft, kont: e.target.value }))} className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 outline-none focus:border-[var(--brand-600)]" placeholder="Opsional" />
              </label>
              <label className="text-sm font-semibold text-[var(--text)]">
                <span className="mb-1.5 block">HS Code</span>
                <input value={tradeDraft.hs} onChange={e => setTradeDraft(draft => ({ ...draft, hs: e.target.value }))} className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 outline-none focus:border-[var(--brand-600)]" placeholder="1511.90.90" />
              </label>
              <label className="text-sm font-semibold text-[var(--text)]">
                <span className="mb-1.5 block">Berat (kg)</span>
                <input type="number" min="0.1" step="0.1" value={tradeDraft.kg} onChange={e => setTradeDraft(draft => ({ ...draft, kg: e.target.value }))} className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 outline-none focus:border-[var(--brand-600)]" placeholder="100" />
              </label>
              <label className="text-sm font-semibold text-[var(--text)]">
                <span className="mb-1.5 block">Nilai deklarasi (IDR)</span>
                <input type="number" min="0" step="1" value={tradeDraft.nilai} onChange={e => setTradeDraft(draft => ({ ...draft, nilai: e.target.value }))} className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 outline-none focus:border-[var(--brand-600)]" placeholder="250000000" />
              </label>
              <label className="text-sm font-semibold text-[var(--text)] md:col-span-2">
                <span className="mb-1.5 block">Status clearance</span>
                <select value={tradeDraft.cc} onChange={e => setTradeDraft(draft => ({ ...draft, cc: e.target.value as TradeDraft['cc'] }))} className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 outline-none focus:border-[var(--brand-600)]">
                  <option>Diproses</option><option>Inspeksi</option><option>Released</option>
                </select>
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setTradeFormOpen(false)} className="rounded-lg border border-[var(--border)] px-4 py-2.5 font-semibold text-[var(--text)] hover:bg-[var(--panel-soft)]">Batal</button>
              <button type="button" onClick={saveTrade} className="rounded-lg bg-[var(--brand-600)] px-5 py-2.5 font-semibold text-white hover:bg-[var(--brand-700)]">{editingTradeId ? 'Simpan perubahan' : 'Simpan dokumen'}</button>
            </div>
          </section>
        </div>
      )}

      {deletingTrade && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/45 p-4" role="presentation">
          <section className="w-full max-w-md rounded-xl border border-[var(--border)] bg-white p-6 shadow-[var(--shadow)]" role="alertdialog" aria-modal="true" aria-labelledby="delete-trade-title" aria-describedby="delete-trade-description">
            <h2 id="delete-trade-title" className="text-lg font-semibold text-[var(--text)]">Hapus dokumen ini?</h2>
            <p id="delete-trade-description" className="mt-2 text-sm text-[var(--text-soft)]">Dokumen {deletingTrade.tipe} {deletingTrade.asal} → {deletingTrade.tujuan} akan dihapus{usingLive ? ' dari database' : ' dari data sesi ini'}.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setDeletingTrade(null)} className="rounded-lg border border-[var(--border)] px-4 py-2 font-semibold text-[var(--text)]">Batal</button>
              <button type="button" onClick={confirmDeleteTrade} className="rounded-lg bg-[var(--danger)] px-4 py-2 font-semibold text-white hover:brightness-95">Hapus dokumen</button>
            </div>
          </section>
        </div>
      )}

      {newOrderOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/45 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-12 border border-[var(--border)] bg-white p-6 shadow-[var(--shadow)]">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">{editingResi ? 'Perbarui data' : 'Tambah pengiriman'}</p>
                <h2 className="text-2xl font-semibold text-[var(--text)]">{editingResi ? 'Edit order' : 'Order baru'}</h2>
              </div>
              <button onClick={() => setNewOrderOpen(false)} className="text-3xl leading-none text-[var(--text-soft)] hover:text-[var(--text)]">×</button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="text-sm font-semibold text-[var(--text)]">
                <span className="mb-1.5 block">Nomor RESI</span>
                <input value={newOrderDraft.resi} readOnly className="w-full rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-2.5 text-[var(--text)] outline-none" />
              </label>
              <label className="text-sm font-semibold text-[var(--text)]">
                <span className="mb-1.5 block">Nama penerima / pelanggan</span>
                <input value={newOrderDraft.cust} onChange={e => setNewOrderDraft(d => ({ ...d, cust: e.target.value }))} className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-[var(--text)] outline-none focus:border-[var(--brand-600)]" placeholder="PT Contoh" />
              </label>
              <label className="text-sm font-semibold text-[var(--text)]">
                <span className="mb-1.5 block">Keterangan pengirim</span>
                <textarea rows={2} value={newOrderDraft.senderDescription} onChange={e => setNewOrderDraft(d => ({ ...d, senderDescription: e.target.value }))} className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-[var(--text)] outline-none focus:border-[var(--brand-600)]" placeholder="Nama, kontak, atau informasi pengirim" />
              </label>
              <label className="text-sm font-semibold text-[var(--text)]">
                <span className="mb-1.5 block">Alamat penerima</span>
                <textarea rows={2} value={newOrderDraft.recipientAddress} onChange={e => setNewOrderDraft(d => ({ ...d, recipientAddress: e.target.value }))} className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-[var(--text)] outline-none focus:border-[var(--brand-600)]" placeholder="Alamat lengkap penerima" />
              </label>
              <label className="text-sm font-semibold text-[var(--text)]">
                <span className="mb-1.5 block">Kota asal (rute tarif)</span>
                <input value={newOrderDraft.asal} onChange={e => setNewOrderDraft(d => ({ ...d, asal: e.target.value }))} className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-[var(--text)] outline-none focus:border-[var(--brand-600)]" placeholder="Jakarta" />
              </label>
              <label className="text-sm font-semibold text-[var(--text)]">
                <span className="mb-1.5 block">Kota tujuan (rute tarif)</span>
                <input value={newOrderDraft.tujuan} onChange={e => setNewOrderDraft(d => ({ ...d, tujuan: e.target.value }))} className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-[var(--text)] outline-none focus:border-[var(--brand-600)]" placeholder="Surabaya" />
              </label>
              <section className="rounded-xl border border-[var(--border)] p-4 md:col-span-2">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--text)]">Nama / jenis barang</h3>
                    <p className="mt-1 text-xs font-normal text-[var(--text-soft)]">Isi jumlah, berat per unit, dan packing untuk setiap jenis barang.</p>
                  </div>
                  <button type="button" onClick={() => setNewOrderDraft(d => ({ ...d, items: [...d.items, emptyOrderItem()] }))} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--brand-700)] hover:bg-[var(--panel-soft)]">
                    <Plus className="h-4 w-4" />Tambah barang
                  </button>
                </div>
                <div className="space-y-3">
                  {newOrderDraft.items.map((item, index) => (
                    <div key={index} className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1.2fr_80px_100px_120px_auto]">
                      <label className="text-xs font-semibold text-[var(--text-soft)]">
                        Nama barang
                        <input value={item.name} onChange={e => setNewOrderDraft(d => ({ ...d, items: d.items.map((row, rowIndex) => rowIndex === index ? { ...row, name: e.target.value } : row) }))} className="mt-1 h-10 w-full rounded-lg border border-[var(--border)] px-3 text-sm font-normal text-[var(--text)] outline-none focus:border-[var(--brand-600)]" placeholder="Contoh: spare part" />
                      </label>
                      <label className="text-xs font-semibold text-[var(--text-soft)]">
                        Jumlah
                        <input type="number" min="1" step="1" value={item.quantity} onChange={e => setNewOrderDraft(d => ({ ...d, items: d.items.map((row, rowIndex) => rowIndex === index ? { ...row, quantity: e.target.value } : row) }))} className="mt-1 h-10 w-full rounded-lg border border-[var(--border)] px-3 text-sm font-normal text-[var(--text)] outline-none focus:border-[var(--brand-600)]" />
                      </label>
                      <label className="text-xs font-semibold text-[var(--text-soft)]">
                        Berat / unit (kg)
                        <input type="number" min="0.01" step="0.01" value={item.weight} onChange={e => setNewOrderDraft(d => ({ ...d, items: d.items.map((row, rowIndex) => rowIndex === index ? { ...row, weight: e.target.value } : row) }))} className="mt-1 h-10 w-full rounded-lg border border-[var(--border)] px-3 text-sm font-normal text-[var(--text)] outline-none focus:border-[var(--brand-600)]" placeholder="1.5" />
                      </label>
                      <label className="text-xs font-semibold text-[var(--text-soft)]">
                        Packing
                        <input value={item.packing} onChange={e => setNewOrderDraft(d => ({ ...d, items: d.items.map((row, rowIndex) => rowIndex === index ? { ...row, packing: e.target.value } : row) }))} className="mt-1 h-10 w-full rounded-lg border border-[var(--border)] px-3 text-sm font-normal text-[var(--text)] outline-none focus:border-[var(--brand-600)]" placeholder="Kayu, kardus, dll" />
                      </label>
                      <button type="button" aria-label={`Hapus barang ${index + 1}`} disabled={newOrderDraft.items.length === 1} onClick={() => setNewOrderDraft(d => ({ ...d, items: d.items.filter((_, rowIndex) => rowIndex !== index) }))} className="h-10 rounded-lg border border-[var(--danger)]/20 px-3 text-sm font-semibold text-[var(--danger)] disabled:cursor-not-allowed disabled:opacity-40">Hapus</button>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-right text-sm font-semibold text-[var(--text)]">Total berat: {Number.isFinite(totalOrderWeight(newOrderDraft.items)) ? totalOrderWeight(newOrderDraft.items).toLocaleString('id-ID', { maximumFractionDigits: 2 }) : '0'} kg</p>
              </section>
              <label className="text-sm font-semibold text-[var(--text)]">
                <span className="mb-1.5 block">Layanan</span>
                <select value={newOrderDraft.layanan} onChange={e => setNewOrderDraft(d => ({ ...d, layanan: e.target.value }))} className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-[var(--text)] outline-none focus:border-[var(--brand-600)]">
                  <option>Reguler</option>
                  <option>Express</option>
                  <option>Kargo</option>
                </select>
              </label>
              <label className="text-sm font-semibold text-[var(--text)]">
                <span className="mb-1.5 block">Pembayaran</span>
                <select value={newOrderDraft.cod} onChange={e => setNewOrderDraft(d => ({ ...d, cod: e.target.value }))} className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-[var(--text)] outline-none focus:border-[var(--brand-600)]">
                  <option>COD</option>
                  <option>Prepaid</option>
                </select>
              </label>
              <label className="text-sm font-semibold text-[var(--text)] md:col-span-2">
                <span className="mb-1.5 block">Keterangan order</span>
                <textarea rows={2} value={newOrderDraft.notes} onChange={e => setNewOrderDraft(d => ({ ...d, notes: e.target.value }))} className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-[var(--text)] outline-none focus:border-[var(--brand-600)]" placeholder="Catatan tambahan untuk resi (opsional)" />
              </label>
              {role === 'Admin' && <section className="rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] p-4 md:col-span-2">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text)]">Rekomendasi Smart Pricing</p>
                    <p className="mt-1 text-xs text-[var(--text-soft)]">Tarif dasar dan batas margin dikelola staf Keuangan. Staf Admin hanya dapat melihat dan memilih rekomendasi.</p>
                  </div>
                  <p className="mono-tabular text-lg font-bold text-[var(--brand-700)]">{orderRecommendation == null ? (pricingLoading ? 'Memuat…' : 'Belum tersedia') : formatIdr(orderRecommendation)}</p>
                </div>
                {pricingError && <p role="alert" className="mt-2 text-xs text-[var(--danger)]">{pricingError}</p>}
                {orderRecommendation == null && !pricingLoading && !pricingError && <p className="mt-2 text-xs text-[var(--text-soft)]">Tarif rute atau pengali layanan belum diatur untuk kombinasi ini.</p>}
                <label className={`mt-3 inline-flex items-center gap-2 text-sm font-medium ${orderRecommendation == null ? 'text-[var(--text-muted)]' : 'text-[var(--text)]'}`}>
                  <input type="checkbox" checked={useRecommendedPrice} disabled={orderRecommendation == null} onChange={event => setUseRecommendedPrice(event.target.checked)} />
                  Gunakan harga rekomendasi pada order
                </label>
              </section>}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setNewOrderOpen(false)} className="rounded-lg border border-[var(--border)] px-4 py-2.5 font-semibold text-[var(--text)] hover:bg-[var(--panel-soft)]">Batal</button>
              <button onClick={saveOrder} className="rounded-lg bg-[var(--brand-600)] px-5 py-2.5 font-semibold text-white hover:bg-[var(--brand-700)]">{editingResi ? 'Simpan perubahan' : 'Simpan order'}</button>
            </div>
          </div>
        </div>
      )}

      {deletingOrder && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/45 p-4" role="presentation">
          <section className="w-full max-w-md rounded-xl border border-[var(--border)] bg-white p-6 shadow-[var(--shadow)]" role="alertdialog" aria-modal="true" aria-labelledby="delete-order-title" aria-describedby="delete-order-description">
            <h2 id="delete-order-title" className="text-lg font-semibold text-[var(--text)]">Batalkan order?</h2>
            <p id="delete-order-description" className="mt-2 text-sm text-[var(--text-soft)]">Order {deletingOrder.resi} akan ditandai dibatalkan dan tetap tersimpan di riwayat. Pengiriman yang sudah masuk manifest tidak dapat dibatalkan.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setDeletingOrder(null)} className="rounded-lg border border-[var(--border)] px-4 py-2 font-semibold text-[var(--text)]">Batal</button>
              <button type="button" onClick={confirmCancelOrder} className="rounded-lg bg-[var(--danger)] px-4 py-2 font-semibold text-white hover:brightness-95">Konfirmasi pembatalan</button>
            </div>
          </section>
        </div>
      )}

      {archiveOrderDraft && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/45 p-4" role="presentation">
          <section className="w-full max-w-md rounded-xl border border-[var(--border)] bg-white p-6 shadow-[var(--shadow)]" role="alertdialog" aria-modal="true" aria-labelledby="archive-order-title" aria-describedby="archive-order-description">
            <h2 id="archive-order-title" className="text-lg font-semibold text-[var(--text)]">Arsipkan order?</h2>
            <p id="archive-order-description" className="mt-2 text-sm text-[var(--text-soft)]">Order {archiveOrderDraft.resi} akan disembunyikan dari daftar aktif, tetapi tetap tersimpan dan dapat dipulihkan dari filter “Diarsipkan”.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setArchiveOrderDraft(null)} className="rounded-lg border border-[var(--border)] px-4 py-2 font-semibold text-[var(--text)]">Kembali</button>
              <button type="button" onClick={() => void setOrderArchived(archiveOrderDraft, true)} className="rounded-lg bg-[var(--brand-600)] px-4 py-2 font-semibold text-white hover:bg-[var(--brand-700)]">Arsipkan order</button>
            </div>
          </section>
        </div>
      )}

      <main className="ml-0 w-full min-h-screen lg:ml-[240px]">
        <header className="sticky top-0 z-30 flex h-[72px] items-center gap-3 border-b border-[var(--border)] bg-white/90 backdrop-blur-sm px-4 md:px-8">
          <button onClick={() => setSideOpen(v => !v)} className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-soft)] lg:hidden" aria-label="Menu"><Menu className="h-5 w-5" /></button>

          <div className="hidden items-center gap-3 md:flex md:w-[340px]">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-soft)]" />
              <input placeholder="Cari resi, pelanggan, rute..." value={query}
                onChange={e => { setQuery(e.target.value); setPg(1); if (page !== 'orders') setPage('orders') }}
                className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] pl-10 pr-3 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--brand-600)]" />
            </div>
          </div>

          <div className="flex-1" />

          <button onClick={() => toast('Notifikasi belum tersedia dari backend.')} className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-soft)] hover:bg-[var(--panel-soft)]" aria-label="Notifikasi">
            <Bell className="h-4 w-4" />
          </button>

          <div className="hidden items-center gap-3 border-l border-[var(--border)] pl-3 sm:flex">
            <div className="text-right">
              <p className="text-sm font-semibold text-[var(--text)]">{publicGuest ? 'Tamu' : role === 'Admin' ? 'Staf Admin' : role}</p>
              <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--text-soft)]">{publicGuest ? 'Pelacakan publik' : role === 'Admin' ? 'Operasional' : 'Keuangan & Order'}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brand-900)] text-sm font-semibold text-white">NE</div>
          </div>

          <button onClick={signOut} className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-soft)] hover:bg-[var(--panel-soft)]" aria-label={publicGuest ? 'Kembali ke halaman masuk' : 'Keluar'}><LogOut className="h-4 w-4" /></button>
        </header>

        <div className="flex-1 bg-[var(--surface)] p-4 md:p-8">
          {page === 'dashboard' && <DashboardPage orders={scope()} onOpenOrders={() => setPage('orders')} />}
          {isFinancePage(page) && role === 'Staf Keuangan' && <FinanceWorkspace page={page} orders={scope()} trade={trade} ready={usingLive} />}
          {page === 'orders' && (
            <OrdersPage orders={scope()} role={role} canManageOrders={canManageOrders} query={query} statusFilter={statusFilter} setStatusFilter={setStatusFilter}
              setQuery={setQuery} pg={pg} setPg={setPg} onAdd={openNewOrder} onExport={() => void exportOrders()}
              onRowClick={resi => { setTrack(resi); setPage('tracking') }} onPrintReceipt={order => { setReceiptOrder({ ...order, namaBarang: receiptItemNames[order.resi] || order.namaBarang || '' }); setPage('receipt') }}
              onEdit={editOrder} onArchive={(order, archived) => {
                if (archived) setArchiveOrderDraft(order)
                else void setOrderArchived(order, false)
              }} onDelete={order => setDeletingOrder(order)} />
          )}
          {(page === 'drivers' || page === 'pengiriman') && (
            <DriverWorkspace
              page={page}
              orders={orders.filter(order => !order.archived)}
              onNavigate={setPage}
              onTrackResi={resi => { setTrack(resi); setPage('tracking') }}
            />
          )}
          {(page === 'customers' || page === 'staff' || page === 'manifests' || page === 'audit') && (
            <OperationsWorkspace
              page={page}
              role={role}
              orders={orders}
              onOrdersChanged={loadFromSupabase}
              onSelectResi={resi => { setTrack(resi); setPage('tracking') }}
              onOpenWaybill={wb => setManifestWaybill(wb)}
            />
          )}
          {page === 'tracking' && <TrackingPage orders={orders} role={role} track={track} setTrack={setTrack} onLookup={trackLookup} onUpdateStatus={updateOrderStatus} exampleResi={orders[0]?.resi || ''} />}
        </div>
      </main>

      <div className="pointer-events-none fixed bottom-5 left-1/2 z-[200] flex -translate-x-1/2 flex-col gap-2">
        {toasts.map(t => (
          <div key={t.id} className={`toast-enter pointer-events-auto flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold shadow-[var(--shadow)] ${t.type === 'success' ? 'bg-[var(--success-soft)] text-[var(--success)]' : 'bg-[var(--danger-soft)] text-[var(--danger)]'}`}>
            {t.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Dashboard
