'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Ban, CalendarClock, Download, FileSpreadsheet, FileText, Landmark, Plus,
  Printer, RefreshCw, Save, Settings2, Wallet, type LucideIcon,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

export type FinanceOrder = {
  resi: string
  cust: string
  asal: string
  tujuan: string
  berat: number
  layanan: string
  status: string
  cod: string
  cancelled?: boolean
}

export type FinanceTrade = {
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

export type FinancePage =
  | 'finance-dashboard'
  | 'finance-invoices'
  | 'finance-rates'
  | 'finance-reports'

type RouteRate = {
  id: string
  origin_city: string
  destination_city: string
  base_cost_per_kg: number
  base_cost_per_m3: number
}

type Invoice = {
  id: string
  invoice_number: string
  order_resi: string
  cost_amount: number
  recommended_amount: number
  total_amount: number
  due_date: string
  sent_at: string | null
  price_approval_status: 'pending' | 'approved' | 'rejected'
  created_at: string
  cancelled: boolean
  cancelled_at: string | null
}
type Payment = {
  id: string
  invoice_id: string
  amount: number
  payment_method: string
  received_at: string
  reference: string | null
  note: string | null
}
type CodRemittance = {
  id: string
  invoice_id: string
  courier_name: string
  amount: number
  received_at: string
  note: string | null
}
type TradeCost = {
  id: string
  trade_document_id: string
  declared_value_idr: number
  customs_duty_idr: number
  customs_fees_idr: number
  updated_at: string
}

const inputClass = 'h-10 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm text-[var(--text)] outline-none focus:border-[var(--brand-600)]'
const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--brand-600)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-700)] disabled:cursor-not-allowed disabled:opacity-50'
const outlineButtonClass = 'inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--text)] hover:bg-[var(--panel-soft)] disabled:cursor-not-allowed disabled:opacity-50'
const today = () => new Date().toISOString().slice(0, 10)

function idr(value: number) {
  return `Rp ${Math.round(value || 0).toLocaleString('id-ID')}`
}

function amount(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const escape = (value: string | number) => {
    const raw = typeof value === 'string' && /^[\t\r ]*[=+\-@]/.test(value) ? `'${value}` : String(value)
    return `"${raw.replaceAll('"', '""')}"`
  }
  const csv = `\uFEFF${rows.map(row => row.map(escape).join(',')).join('\r\n')}`
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function Feedback({ error, notice }: { error: string; notice: string }) {
  if (!error && !notice) return null
  return (
    <div role={error ? 'alert' : 'status'} className={`mb-5 rounded-lg border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
      {error || notice}
    </div>
  )
}

function SectionHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight text-[var(--text)]">{title}</h1>
        <p className="mt-1 text-sm text-[var(--text-soft)]">{subtitle}</p>
      </div>
      {action}
    </div>
  )
}

function Metric({ icon: Icon, title, value, note }: { icon: LucideIcon; title: string; value: string; note: string }) {
  return (
    <section className="utility-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">{title}</p>
          <p className="mt-3 text-2xl font-semibold text-[var(--text)]">{value}</p>
          <p className="mt-2 text-xs text-[var(--text-soft)]">{note}</p>
        </div>
        <span className="rounded-xl bg-[var(--info-soft)] p-3 text-[var(--info)]"><Icon className="h-5 w-5" /></span>
      </div>
    </section>
  )
}

function statusLabel(invoice: Invoice, balance: number) {
  if (invoice.cancelled) return 'Dibatalkan'
  if (balance <= 0) return 'Lunas'
  if (invoice.due_date < today()) return 'Jatuh tempo'
  return invoice.sent_at ? 'Terkirim · belum lunas' : 'Draft'
}

function statusClass(label: string) {
  if (label === 'Lunas') return 'bg-[var(--success-soft)] text-[var(--success)]'
  if (label.includes('tempo') || label.includes('ditolak') || label === 'Dibatalkan') return 'bg-[var(--danger-soft)] text-[var(--danger)]'
  if (label.includes('Menunggu')) return 'bg-[var(--warning-soft)] text-[var(--warning)]'
  return 'bg-[var(--info-soft)] text-[var(--info)]'
}

export default function FinanceWorkspace({
  page,
  orders,
  trade,
  ready,
}: {
  page: FinancePage
  orders: FinanceOrder[]
  trade: FinanceTrade[]
  ready: boolean
}) {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [remittances, setRemittances] = useState<CodRemittance[]>([])
  const [rates, setRates] = useState<RouteRate[]>([])
  const [tradeCosts, setTradeCosts] = useState<TradeCost[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [selectedResi, setSelectedResi] = useState('')
  const [quotedPrice, setQuotedPrice] = useState('')
  const [dueDate, setDueDate] = useState(today())
  const [routeDraft, setRouteDraft] = useState({ origin: '', destination: '', costPerKg: '', costPerM3: '' })
  const [editingRateId, setEditingRateId] = useState<string | null>(null)
  const routeRateFormRef = useRef<HTMLElement | null>(null)
  const [month, setMonth] = useState(today().slice(0, 7))
  const [printInvoice, setPrintInvoice] = useState<Invoice | null>(null)
  const [cancelInvoiceDraft, setCancelInvoiceDraft] = useState<Invoice | null>(null)

  const loadFinanceData = useCallback(async () => {
    setError('')
    if (!supabase) {
      setError('Supabase belum dikonfigurasi. Modul Keuangan memerlukan database aktif.')
      setLoading(false)
      return
    }
    if (!ready) {
      setError('Data order live belum tersedia. Pastikan migrasi akses staf sudah diterapkan dan koneksi Supabase aktif.')
      setLoading(false)
      return
    }

    setLoading(true)
    const results = await Promise.all([
      supabase.from('invoices').select('*').order('created_at', { ascending: false }),
      supabase.from('invoice_payments').select('*').order('received_at', { ascending: false }),
      supabase.from('cod_remittances').select('*').order('received_at', { ascending: false }),
      supabase.from('route_rates').select('*').order('origin_city'),
      supabase.from('trade_costs').select('*').order('updated_at', { ascending: false }),
    ] as const)
    const [invoiceResult, paymentResult, remittanceResult, rateResult, costResult] = results
    const firstError = results.find(result => result.error)?.error
    if (firstError) {
      setError(`Gagal memuat data Keuangan. Pastikan migrasi finance_workspace.sql dan 202610190001_finance_order_management_and_route_volume.sql sudah dijalankan. ${firstError.message}`)
      setLoading(false)
      return
    }

    setInvoices((invoiceResult.data || []) as Invoice[])
    setPayments((paymentResult.data || []) as Payment[])
    setRemittances((remittanceResult.data || []) as CodRemittance[])
    setRates((rateResult.data || []) as RouteRate[])
    setTradeCosts((costResult.data || []) as TradeCost[])
    setLoading(false)
  }, [ready])

  useEffect(() => {
    void Promise.resolve().then(loadFinanceData)
  }, [loadFinanceData])

  const orderByResi = useMemo(() => new Map(orders.map(order => [order.resi, order])), [orders])
  const availableOrders = useMemo(() => orders.filter(order => !order.cancelled && !invoices.some(invoice => invoice.order_resi === order.resi)), [orders, invoices])

  function getReceived(invoice: Invoice) {
    const regular = payments.filter(payment => payment.invoice_id === invoice.id).reduce((sum, payment) => sum + amount(payment.amount), 0)
    const cod = remittances.filter(remittance => remittance.invoice_id === invoice.id).reduce((sum, remittance) => sum + amount(remittance.amount), 0)
    return regular + cod
  }

  function getBalance(invoice: Invoice) {
    return Math.max(0, amount(invoice.total_amount) - getReceived(invoice))
  }

  const invoiceBalances = invoices.map(invoice => ({ invoice, balance: getBalance(invoice) }))
  const outstandingInvoices = invoiceBalances.filter(({ invoice, balance }) => !invoice.cancelled && balance > 0)
  const monthlyInvoiceRows = invoiceBalances.filter(({ invoice }) => invoice.created_at.slice(0, 7) === month)
  const activeMonthlyRows = monthlyInvoiceRows.filter(({ invoice }) => !invoice.cancelled)
  const monthlyReceivables = monthlyInvoiceRows.reduce((sum, row) => sum + (row.invoice.cancelled ? 0 : row.balance), 0)
  const overdueAmount = outstandingInvoices.filter(({ invoice }) => invoice.due_date < today()).reduce((sum, row) => sum + row.balance, 0)

  async function withSaving(action: () => Promise<void>) {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await action()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Operasi Keuangan gagal disimpan.')
    } finally {
      setSaving(false)
    }
  }

  async function createInvoice() {
    const selectedOrder = availableOrders.find(order => order.resi === selectedResi)
    if (!supabase || !selectedOrder) {
      setError('Pilih order yang belum memiliki invoice.')
      return
    }
    const trimmedQuotedPrice = quotedPrice.trim()
    const finalAmount = Number(trimmedQuotedPrice)
    if (!Number.isFinite(finalAmount) || finalAmount <= 0 || !dueDate) {
      setError('Masukkan harga invoice dan tanggal jatuh tempo yang valid.')
      return
    }
    await withSaving(async () => {
      const { data: userData, error: userError } = await supabase!.auth.getUser()
      if (userError) throw userError
      const invoiceNumber = `INV-${today().replaceAll('-', '')}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
      const { error: insertError } = await supabase!.from('invoices').insert({
        invoice_number: invoiceNumber,
        order_resi: selectedOrder.resi,
        cost_amount: 0,
        recommended_amount: finalAmount,
        total_amount: finalAmount,
        due_date: dueDate,
        price_approval_status: 'approved',
        created_by: userData.user?.id,
      })
      if (insertError) throw insertError
      setNotice(`Invoice ${invoiceNumber} berhasil dibuat.`)
      setSelectedResi('')
      setQuotedPrice('')
      await loadFinanceData()
    })
  }

  async function markInvoiceSent(invoice: Invoice) {
    if (!supabase || invoice.cancelled) return
    await withSaving(async () => {
      const { error: updateError } = await supabase!.from('invoices').update({ sent_at: new Date().toISOString() }).eq('id', invoice.id)
      if (updateError) throw updateError
      setNotice(`Invoice ${invoice.invoice_number} ditandai terkirim. Pengiriman email dilakukan manual di luar aplikasi.`)
      await loadFinanceData()
    })
  }

  async function cancelInvoice(invoice: Invoice) {
    if (!supabase || invoice.cancelled) return
    await withSaving(async () => {
      const { error: cancelError } = await supabase!.rpc('finance_cancel_invoice', { p_invoice_id: invoice.id })
      if (cancelError) throw cancelError
      setNotice(`Invoice ${invoice.invoice_number} dibatalkan dan aktivitasnya dicatat.`)
      setCancelInvoiceDraft(null)
      await loadFinanceData()
    })
  }

  async function saveRouteRate() {
    if (!supabase) return
    const origin = routeDraft.origin.trim()
    const destination = routeDraft.destination.trim()
    const costPerKgInput = routeDraft.costPerKg.trim()
    const costPerM3Input = routeDraft.costPerM3.trim()
    const costPerKg = Number(costPerKgInput)
    const costPerM3 = Number(costPerM3Input)
    if (!origin || !destination || !costPerKgInput || !costPerM3Input ||
      !Number.isFinite(costPerKg) || costPerKg < 0 ||
      !Number.isFinite(costPerM3) || costPerM3 < 0) {
      setError('Isi kota asal, kota tujuan, biaya pokok per kg, dan biaya pokok per m³ dengan benar.')
      return
    }
    await withSaving(async () => {
      const existing = rates.find(rate => rate.id === editingRateId) ||
        rates.find(rate => rate.origin_city.toLowerCase() === origin.toLowerCase() && rate.destination_city.toLowerCase() === destination.toLowerCase())
      const payload = {
        origin_city: origin,
        destination_city: destination,
        base_cost_per_kg: costPerKg,
        base_cost_per_m3: costPerM3,
        updated_at: new Date().toISOString(),
      }
      if (existing) {
        const { data, error: updateError } = await supabase!.from('route_rates')
          .update(payload).eq('id', existing.id).select('id').maybeSingle()
        if (updateError) throw updateError
        if (!data) throw new Error('Tarif rute tidak ditemukan atau akses perubahan ditolak.')
      } else {
        const { error: insertError } = await supabase!.from('route_rates').insert(payload)
        if (insertError) throw insertError
      }
      setRouteDraft({ origin: '', destination: '', costPerKg: '', costPerM3: '' })
      setEditingRateId(null)
      setNotice(existing ? 'Tarif rute berhasil diperbarui.' : 'Tarif rute berhasil ditambahkan.')
      await loadFinanceData()
    })
  }


  function exportReport() {
    const rows: (string | number)[][] = [
      ['Jenis', 'Tanggal', 'Referensi', 'Resi / Dokumen', 'Pelanggan', 'Rute / Keterangan', 'Layanan / Moda', 'Nilai IDR', 'Status'],
    ]
    for (const { invoice, balance } of monthlyInvoiceRows) {
      const order = orderByResi.get(invoice.order_resi)
      rows.push([
        'Invoice', invoice.created_at.slice(0, 10), invoice.invoice_number, invoice.order_resi,
        order?.cust || '', `${order?.asal || ''} → ${order?.tujuan || ''}`, order?.layanan || '',
        invoice.total_amount, statusLabel(invoice, balance),
      ])
    }
    for (const cost of tradeCosts.filter(item => item.updated_at.slice(0, 7) === month)) {
      const record = trade.find(row => row.id === cost.trade_document_id)
      const customsTotal = amount(cost.customs_duty_idr) + amount(cost.customs_fees_idr)
      rows.push(['Biaya customs', cost.updated_at.slice(0, 10), record?.hs || '', cost.trade_document_id, record?.tipe || '', `${record?.asal || ''} → ${record?.tujuan || ''}`, record?.moda || '', customsTotal, record?.cc || ''])
    }
    downloadCsv(`laporan-keuangan-${month}.csv`, rows)
  }

  function openPrintView(invoice: Invoice) {
    setPrintInvoice(invoice)
  }

  if (loading) {
    return <div className="utility-card flex items-center gap-3 p-6 text-sm text-[var(--text-soft)]"><RefreshCw className="h-4 w-4 animate-spin" />Memuat modul Keuangan...</div>
  }

  const pageTitles: Record<FinancePage, [string, string]> = {
    'finance-dashboard': ['Dashboard keuangan', 'Ringkasan invoice, piutang, rute, dan layanan.'],
    'finance-invoices': ['Invoice dan tagihan', 'Buat, cetak, tandai terkirim, dan pantau jatuh tempo pelanggan.'],
    'finance-rates': ['Pengaturan tarif', 'Kelola biaya pokok per rute berdasarkan berat dan kubikasi.'],
    'finance-reports': ['Laporan keuangan', 'Rekap bulanan invoice dan biaya bea cukai.'],
  }
  const [title, subtitle] = pageTitles[page]

  return (
    <div>
      <SectionHeader title={title} subtitle={subtitle} action={<button type="button" disabled={saving} onClick={() => void loadFinanceData()} className={outlineButtonClass}><RefreshCw className="h-4 w-4" />Muat ulang</button>} />
      <Feedback error={error} notice={notice} />

      {page === 'finance-dashboard' && (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric icon={Wallet} title="Nilai invoice bulan ini" value={idr(activeMonthlyRows.reduce((sum, row) => sum + amount(row.invoice.total_amount), 0))} note={`${activeMonthlyRows.length} invoice aktif · ${month}`} />
            <Metric icon={CalendarClock} title="Piutang berjalan" value={idr(outstandingInvoices.reduce((sum, row) => sum + row.balance, 0))} note={`Jatuh tempo: ${idr(overdueAmount)}`} />
            <Metric icon={FileText} title="Invoice aktif" value={String(invoices.filter(invoice => !invoice.cancelled).length)} note="Tidak termasuk invoice dibatalkan" />
            <Metric icon={Landmark} title="Rute bertarif" value={String(rates.length)} note="Biaya pokok per kg dan m³" />
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <section className="utility-card p-5">
              <h2 className="mb-4 text-base font-semibold text-[var(--text)]">Nilai invoice 6 bulan terakhir</h2>
              <MonthlyInvoiceChart invoices={invoices} />
            </section>
            <section className="utility-card p-5">
              <h2 className="mb-4 text-base font-semibold text-[var(--text)]">Status invoice</h2>
              <InvoiceStatusChart rows={invoiceBalances} />
            </section>
          </div>
          <section className="utility-card mt-5 overflow-hidden p-0">
            <div className="border-b border-[var(--border)] px-5 py-4">
              <h2 className="font-semibold text-[var(--text)]">Tagihan perlu perhatian</h2>
            </div>
            <InvoiceTable rows={outstandingInvoices.slice(0, 6)} orders={orderByResi} onPrint={openPrintView} />
          </section>
        </>
      )}

      {page === 'finance-invoices' && (
        <>
          <section className="utility-card mb-6 p-5">
            <h2 className="mb-4 flex items-center gap-2 font-semibold text-[var(--text)]"><Plus className="h-4 w-4" />Buat invoice dari order</h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="text-sm font-medium text-[var(--text-soft)]">Order
                <select className={`${inputClass} mt-1`} value={selectedResi} onChange={event => {
                  const resi = event.target.value
                  setSelectedResi(resi)
                }}>
                  <option value="">Pilih order yang belum ditagih</option>
                  {availableOrders.map(order => <option key={order.resi} value={order.resi}>{order.resi} · {order.cust} · {order.asal} → {order.tujuan}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium text-[var(--text-soft)]">Harga invoice (IDR)
                <input className={`${inputClass} mt-1`} type="number" min="1" value={quotedPrice} onChange={event => setQuotedPrice(event.target.value)} placeholder="Harga jual" />
              </label>
              <label className="text-sm font-medium text-[var(--text-soft)]">Jatuh tempo
                <input className={`${inputClass} mt-1`} type="date" min={today()} value={dueDate} onChange={event => setDueDate(event.target.value)} />
              </label>
              <div className="flex items-end"><button type="button" disabled={saving || !selectedResi} onClick={() => void createInvoice()} className={`${buttonClass} w-full`}><FileText className="h-4 w-4" />Buat invoice</button></div>
            </div>
          </section>
          <section className="utility-card overflow-hidden p-0"><InvoiceTable rows={invoiceBalances} orders={orderByResi} onPrint={openPrintView} onSend={markInvoiceSent} onCancel={setCancelInvoiceDraft} canCancel={invoice => getReceived(invoice) === 0} saving={saving} /></section>
        </>
      )}

      {page === 'finance-rates' && (
        <>
          <section ref={routeRateFormRef} className="utility-card mb-5 p-5">
            <h2 className="mb-4 flex items-center gap-2 font-semibold text-[var(--text)]"><Settings2 className="h-4 w-4" />{editingRateId ? 'Ubah biaya pokok rute' : 'Tambah biaya pokok rute'}</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_auto]">
              <input className={inputClass} value={routeDraft.origin} onChange={event => setRouteDraft(draft => ({ ...draft, origin: event.target.value }))} placeholder="Kota asal" />
              <input className={inputClass} value={routeDraft.destination} onChange={event => setRouteDraft(draft => ({ ...draft, destination: event.target.value }))} placeholder="Kota tujuan" />
              <input className={inputClass} type="number" min="0" value={routeDraft.costPerKg} onChange={event => setRouteDraft(draft => ({ ...draft, costPerKg: event.target.value }))} placeholder="Biaya pokok per kg (IDR)" />
              <input className={inputClass} type="number" min="0" value={routeDraft.costPerM3} onChange={event => setRouteDraft(draft => ({ ...draft, costPerM3: event.target.value }))} placeholder="Biaya pokok per m³ (IDR)" />
              <div className="flex gap-2">
                <button type="button" disabled={saving} onClick={() => void saveRouteRate()} className={buttonClass}><Save className="h-4 w-4" />{editingRateId ? 'Simpan perubahan' : 'Simpan rute'}</button>
                {editingRateId && <button type="button" disabled={saving} onClick={() => { setEditingRateId(null); setRouteDraft({ origin: '', destination: '', costPerKg: '', costPerM3: '' }) }} className={outlineButtonClass}>Batal</button>}
              </div>
            </div>
          </section>
          <section className="utility-card overflow-hidden p-0">
            <div className="border-b border-[var(--border)] px-5 py-4"><h2 className="font-semibold text-[var(--text)]">Tarif pokok per rute</h2></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-[var(--panel-soft)] text-xs uppercase text-[var(--text-soft)]"><tr><th className="px-4 py-3">Asal</th><th className="px-4 py-3">Tujuan</th><th className="px-4 py-3 text-right">Biaya / kg</th><th className="px-4 py-3 text-right">Biaya / m³</th><th className="px-4 py-3">Aksi</th></tr></thead>
              <tbody>{rates.map(rate => <tr key={rate.id} className="border-t border-[var(--border)]"><td className="px-4 py-3">{rate.origin_city}</td><td className="px-4 py-3">{rate.destination_city}</td><td className="px-4 py-3 text-right">{idr(rate.base_cost_per_kg)}</td><td className="px-4 py-3 text-right">{idr(rate.base_cost_per_m3)}</td><td className="px-4 py-3"><button type="button" className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--brand-600)] hover:bg-[var(--panel-soft)]" onClick={() => { setError(''); setEditingRateId(rate.id); setRouteDraft({ origin: rate.origin_city, destination: rate.destination_city, costPerKg: String(rate.base_cost_per_kg), costPerM3: String(rate.base_cost_per_m3) }); routeRateFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }}>Ubah</button></td></tr>)}
                {!rates.length && <tr><td colSpan={5} className="px-4 py-8 text-center text-[var(--text-soft)]">Belum ada tarif rute.</td></tr>}</tbody>
            </table></div>
          </section>
        </>
      )}

      {page === 'finance-reports' && (
        <>
          <section className="utility-card mb-5 flex flex-col gap-3 p-5 sm:flex-row sm:items-end sm:justify-between">
            <label className="text-sm font-medium text-[var(--text-soft)]">Periode laporan
              <input className={`${inputClass} mt-1 w-48`} type="month" value={month} onChange={event => setMonth(event.target.value)} />
            </label>
            <button type="button" onClick={exportReport} className={buttonClass}><Download className="h-4 w-4" />Ekspor CSV untuk Excel</button>
          </section>
          <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric icon={Wallet} title="Nilai invoice diterbitkan" value={idr(activeMonthlyRows.reduce((sum, row) => sum + amount(row.invoice.total_amount), 0))} note={`${activeMonthlyRows.length} invoice aktif pada periode ini`} />
            <Metric icon={CalendarClock} title="Piutang periode ini" value={idr(monthlyReceivables)} note="Sisa nilai invoice periode terpilih" />
            <Metric icon={FileSpreadsheet} title="Biaya bea & customs" value={idr(tradeCosts.reduce((sum, row) => sum + (row.updated_at.slice(0, 7) === month ? amount(row.customs_duty_idr) + amount(row.customs_fees_idr) : 0), 0))} note="Data customs yang diperbarui bulan ini" />
            <Metric icon={FileText} title="Invoice jatuh tempo" value={String(outstandingInvoices.filter(row => row.invoice.due_date < today()).length)} note={idr(overdueAmount) + ' belum tertagih'} />
          </div>
          <section className="utility-card overflow-hidden p-0"><InvoiceTable rows={monthlyInvoiceRows} orders={orderByResi} onPrint={openPrintView} /></section>
        </>
      )}

      {cancelInvoiceDraft && <div className="fixed inset-0 z-[170] flex items-center justify-center bg-black/45 p-4">
        <section className="w-full max-w-md rounded-xl border border-[var(--border)] bg-white p-6 shadow-[var(--shadow)]" role="alertdialog" aria-modal="true" aria-labelledby="cancel-invoice-title">
          <h2 id="cancel-invoice-title" className="text-lg font-semibold text-[var(--text)]">Batalkan invoice?</h2>
          <p className="mt-2 text-sm text-[var(--text-soft)]">Invoice {cancelInvoiceDraft.invoice_number} akan ditandai dibatalkan dan tetap tersimpan di riwayat audit. Invoice dengan pembayaran atau setoran COD tidak dapat dibatalkan.</p>
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" disabled={saving} onClick={() => setCancelInvoiceDraft(null)} className={outlineButtonClass}>Kembali</button>
            <button type="button" disabled={saving || getReceived(cancelInvoiceDraft) > 0} onClick={() => void cancelInvoice(cancelInvoiceDraft)} className="inline-flex items-center gap-2 rounded-lg bg-[var(--danger)] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"><Ban className="h-4 w-4" />Konfirmasi pembatalan</button>
          </div>
        </section>
      </div>}
      {printInvoice && <InvoicePrint invoice={printInvoice} order={orderByResi.get(printInvoice.order_resi)} paid={getReceived(printInvoice)} onClose={() => setPrintInvoice(null)} />}
    </div>
  )
}

function MonthlyInvoiceChart({ invoices }: { invoices: Invoice[] }) {
  const current = new Date()
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(current.getFullYear(), current.getMonth() - 5 + index, 1)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const value = invoices
      .filter(invoice => !invoice.cancelled && invoice.created_at.slice(0, 7) === key)
      .reduce((sum, invoice) => sum + amount(invoice.total_amount), 0)
    return { key, label: date.toLocaleDateString('id-ID', { month: 'short' }), value }
  })
  const maximum = Math.max(1, ...months.map(item => item.value))

  return <div className="flex h-52 items-end justify-between gap-2" role="img" aria-label="Grafik nilai invoice bulanan enam bulan terakhir">
    {months.map(item => (
      <div key={item.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
        <span className="max-w-full truncate text-[10px] text-[var(--text-soft)]" title={idr(item.value)}>{item.value ? idr(item.value) : '—'}</span>
        <div className="flex h-32 w-full items-end justify-center rounded-t-md bg-[var(--panel-soft)]">
          <div className="w-2/3 rounded-t-md bg-[var(--brand-600)]" style={{ height: `${item.value ? Math.max(5, item.value / maximum * 100) : 0}%` }} />
        </div>
        <span className="text-xs font-medium capitalize text-[var(--text-soft)]">{item.label}</span>
      </div>
    ))}
  </div>
}

function InvoiceStatusChart({ rows }: { rows: { invoice: Invoice; balance: number }[] }) {
  const currentDate = today()
  const counts = [
    { label: 'Draft', count: rows.filter(({ invoice, balance }) => !invoice.cancelled && balance > 0 && !invoice.sent_at && invoice.due_date >= currentDate).length },
    { label: 'Terkirim', count: rows.filter(({ invoice, balance }) => !invoice.cancelled && balance > 0 && Boolean(invoice.sent_at) && invoice.due_date >= currentDate).length },
    { label: 'Jatuh tempo', count: rows.filter(({ invoice, balance }) => !invoice.cancelled && balance > 0 && invoice.due_date < currentDate).length },
    { label: 'Lunas', count: rows.filter(({ invoice, balance }) => !invoice.cancelled && balance <= 0).length },
    { label: 'Dibatalkan', count: rows.filter(({ invoice }) => invoice.cancelled).length },
  ]
  const maximum = Math.max(1, ...counts.map(item => item.count))

  return <div className="space-y-4" aria-label="Ringkasan status invoice">
    {counts.map(item => (
      <div key={item.label}>
        <div className="mb-1 flex justify-between gap-3 text-sm">
          <span className="text-[var(--text-soft)]">{item.label}</span>
          <strong className="text-[var(--text)]">{item.count}</strong>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-[var(--panel-soft)]">
          <div className="h-full rounded-full bg-[var(--brand-600)]" style={{ width: `${item.count ? Math.max(4, item.count / maximum * 100) : 0}%` }} />
        </div>
      </div>
    ))}
    {!rows.length && <p className="text-sm text-[var(--text-soft)]">Belum ada data invoice.</p>}
  </div>
}

function InvoiceTable({
  rows,
  orders,
  onPrint,
  onSend,
  onCancel,
  canCancel,
  saving = false,
}: {
  rows: { invoice: Invoice; balance: number }[]
  orders: Map<string, FinanceOrder>
  onPrint: (invoice: Invoice) => void
  onSend?: (invoice: Invoice) => void
  onCancel?: (invoice: Invoice) => void
  canCancel?: (invoice: Invoice) => boolean
  saving?: boolean
}) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm">
    <thead className="bg-[var(--panel-soft)] text-xs uppercase text-[var(--text-soft)]"><tr><th className="px-4 py-3">Invoice / resi</th><th className="px-4 py-3">Pelanggan</th><th className="px-4 py-3">Jatuh tempo</th><th className="px-4 py-3 text-right">Tagihan</th><th className="px-4 py-3 text-right">Sisa</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Aksi</th></tr></thead>
    <tbody>{rows.map(({ invoice, balance }) => {
      const order = orders.get(invoice.order_resi)
      const label = statusLabel(invoice, balance)
      return <tr key={invoice.id} className="border-t border-[var(--border)]">
        <td className="px-4 py-3"><span className="font-semibold text-[var(--text)]">{invoice.invoice_number}</span><span className="mt-1 block text-xs text-[var(--text-soft)]">{invoice.order_resi}</span></td>
        <td className="px-4 py-3">{order?.cust || '—'}<span className="mt-1 block text-xs text-[var(--text-soft)]">{order ? `${order.asal} → ${order.tujuan}` : 'Order tidak tersedia'}</span></td>
        <td className="px-4 py-3">{new Date(`${invoice.due_date}T00:00:00`).toLocaleDateString('id-ID')}</td>
        <td className="px-4 py-3 text-right">{idr(invoice.total_amount)}</td><td className="px-4 py-3 text-right font-semibold">{idr(balance)}</td>
        <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(label)}`}>{label}</span></td>
        <td className="px-4 py-3"><div className="flex justify-end gap-2"><button type="button" onClick={() => onPrint(invoice)} className={outlineButtonClass} aria-label={`Cetak ${invoice.invoice_number}`}><Printer className="h-4 w-4" /></button>{onSend && !invoice.cancelled && balance > 0 && <button type="button" disabled={saving} onClick={() => onSend(invoice)} className={outlineButtonClass}>{invoice.sent_at ? 'Kirim ulang' : 'Tandai terkirim'}</button>}{onCancel && !invoice.cancelled && <button type="button" disabled={saving || canCancel?.(invoice) === false} title={canCancel?.(invoice) === false ? 'Pembayaran telah tercatat; invoice tidak dapat dibatalkan' : 'Batalkan invoice'} onClick={() => onCancel(invoice)} className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40" aria-label={`Batalkan invoice ${invoice.invoice_number}`}><Ban className="h-4 w-4" />Batalkan</button>}</div></td>
      </tr>
    })}
      {!rows.length && <tr><td colSpan={7} className="px-4 py-8 text-center text-[var(--text-soft)]">Belum ada invoice untuk ditampilkan.</td></tr>}
    </tbody>
  </table></div>
}


function InvoicePrint({ invoice, order, paid, onClose }: { invoice: Invoice; order?: FinanceOrder; paid: number; onClose: () => void }) {
  return <div className="invoice-print-shell fixed inset-0 z-[180] flex items-center justify-center overflow-y-auto bg-black/50 p-4">
    <section className="invoice-print w-full max-w-3xl rounded-xl bg-white p-8 text-slate-900 shadow-xl" role="dialog" aria-modal="true" aria-label={`Invoice ${invoice.invoice_number}`}>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-800">Lautan Sejati Trans Cargo</p><h2 className="mt-3 text-3xl font-bold">INVOICE</h2><p className="mt-1 text-sm text-slate-500">{invoice.invoice_number}</p></div>
        <div className="text-right text-sm"><p>Tanggal: {new Date(invoice.created_at).toLocaleDateString('id-ID')}</p><p className="mt-1">Jatuh tempo: {new Date(`${invoice.due_date}T00:00:00`).toLocaleDateString('id-ID')}</p></div>
      </div>
      {invoice.cancelled && <p className="mb-6 rounded border-2 border-red-700 px-4 py-3 text-center text-xl font-black tracking-[0.2em] text-red-700">DIBATALKAN</p>}
      <div className="mb-8 grid gap-5 border-y border-slate-200 py-5 sm:grid-cols-2">
        <div><p className="text-xs uppercase text-slate-500">Tagihan kepada</p><p className="mt-2 font-semibold">{order?.cust || 'Pelanggan'}</p></div>
        <div><p className="text-xs uppercase text-slate-500">Detail pengiriman</p><p className="mt-2 font-semibold">{invoice.order_resi}</p><p className="mt-1 text-sm text-slate-600">{order ? `${order.asal} → ${order.tujuan} · ${order.berat} kg · ${order.layanan}` : '—'}</p></div>
      </div>
      <div className="flex justify-between border-b border-slate-200 py-4 text-sm"><span>Biaya pengiriman</span><strong>{idr(invoice.total_amount)}</strong></div>
      <div className="mt-5 space-y-2 text-right text-sm"><p>Diterima: <strong>{idr(paid)}</strong></p><p className="text-xl">Sisa tagihan: <strong>{idr(Math.max(0, invoice.total_amount - paid))}</strong></p></div>
      <p className="mt-10 text-xs text-slate-500">Invoice dibuat dari pencatatan manual pada aplikasi Lautan Sejati Trans Cargo.</p>
      <div className="mt-8 flex justify-end gap-3">
        <button type="button" onClick={onClose} className={`invoice-print-hide ${outlineButtonClass}`}>Tutup</button>
        <button type="button" onClick={() => window.print()} className={`invoice-print-hide ${buttonClass}`}><Printer className="h-4 w-4" />Cetak invoice</button>
      </div>
    </section>
  </div>
}
