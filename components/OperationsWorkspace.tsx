'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Check,
  ClipboardCheck,
  Plus,
  Printer,
  RefreshCw,
  Trash2,
  Edit2,
  Search,
  Building2,
  Phone,
  Mail,
  MapPin,
  Package,
  ExternalLink,
  X,
  ArrowRight,
  Truck,
  Ship,
  Calendar,
  Settings,
  Sparkles,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { type DriverManifestInfo } from './CargoManifestDocument'
import { type Driver, getStoredDrivers, saveStoredDrivers } from './DriverWorkspace'

export type OperationalOrder = {
  resi: string
  cust: string
  asal: string
  tujuan: string
  berat: number
  layanan: string
  status: string
  createdAt?: string
  cancelled?: boolean
  archived?: boolean
  intakeVerifiedAt?: string | null
  manifestId?: string | null
  items?: { name: string; quantity: number; weight: number; packing?: string }[]
  recipientAddress?: string
  senderDescription?: string
  packing?: string
  notes?: string
}

type OperationsPage = 'customers' | 'staff' | 'manifests' | 'audit'
export type Customer = {
  id: string
  name: string
  phone: string
  email: string
  address: string
  notes: string
  created_at: string
}
type Staff = { id: string; full_name: string; role: 'Admin' | 'Staf Keuangan'; email: string; created_at: string }
export type Manifest = { id: string; manifest_number: string; origin_city: string; destination_city: string; created_at: string }
type AuditEntry = { id: string; event_type: string; entity_id: string; actor_id: string | null; details: Record<string, unknown>; created_at: string }
export type Waybill = { manifest: Manifest; orders: OperationalOrder[]; driverInfo?: DriverManifestInfo }

const DEFAULT_CUSTOMERS: Customer[] = [
  { id: 'cust-1', name: 'PT Sinar Jaya', phone: '0811-2233-4455', email: 'logistik@sinarjaya.co.id', address: 'Jl. Rungkut Industri III No. 12, Surabaya', notes: 'Mitra manufaktur suku cadang, prioritas kontainer mingguan', created_at: '2026-08-10' },
  { id: 'cust-2', name: 'CV Maju Bersama', phone: '0812-9876-5432', email: 'admin@majubersama.com', address: 'Kawasan Industri Pulogadung Blok B No. 4, Jakarta Timur', notes: 'Pengiriman tekstil & garmen reguler', created_at: '2026-08-12' },
  { id: 'cust-3', name: 'Toko Berkah', phone: '0853-4455-6677', email: 'berkah.store@gmail.com', address: 'Jl. Somba Opu No. 88, Makassar', notes: 'Distributor sembako & consumer goods', created_at: '2026-08-15' },
  { id: 'cust-4', name: 'PT Global Tekstil', phone: '0813-1122-3344', email: 'supply@globaltekstil.id', address: 'Jl. Soekarno-Hatta No. 450, Bandung', notes: 'Pengiriman bahan kain bal-balan', created_at: '2026-08-18' },
  { id: 'cust-5', name: 'UD Sumber Rejeki', phone: '0821-3344-5566', email: 'sumberrejeki@yahoo.co.id', address: 'Jl. Ahmad Yani No. 102, Banjarmasin', notes: 'Toko alat teknik & perkakas', created_at: '2026-08-20' },
  { id: 'cust-6', name: 'PT Mitra Elektronik', phone: '0812-5566-7788', email: 'procurement@mitraelektronik.co.id', address: 'Jl. Gajah Mada No. 29, Semarang', notes: 'Barang elektronik, wajib packing kayu & asuransi', created_at: '2026-08-22' },
  { id: 'cust-7', name: 'CV Anugerah', phone: '0819-7788-9900', email: 'anugerah.cargo@gmail.com', address: 'Kawasan Pergudangan Kariangau No. 15, Balikpapan', notes: 'Distribusi material proyek', created_at: '2026-08-25' },
  { id: 'cust-8', name: 'Toko Harapan', phone: '0852-6677-8899', email: 'harapan.retail@gmail.com', address: 'Jl. Malioboro No. 56, Yogyakarta', notes: 'Produk ritel fashion & kerajinan', created_at: '2026-08-28' },
]

export const DEFAULT_MANIFESTS: Manifest[] = [
  {
    id: 'mnf-demo-01',
    manifest_number: 'MNF-202610-0001',
    origin_city: 'Surabaya',
    destination_city: 'Pontianak',
    created_at: '2026-10-09T08:30:00Z',
  },
]

const inputClass = 'h-10 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-[var(--text)] outline-none focus:border-[var(--brand-600)]'
const primaryButton = 'inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--brand-600)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-700)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 transition'
const secondaryButton = 'inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--text)] hover:bg-[var(--panel-soft)] disabled:cursor-not-allowed disabled:opacity-50 transition'

function PageHeading({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">{title}</h1>
        <p className="mt-1 text-sm text-[var(--text-soft)]">{subtitle}</p>
      </div>
      {action}
    </div>
  )
}

function Message({ error, notice }: { error: string; notice: string }) {
  if (!error && !notice) return null
  return (
    <div
      role={error ? 'alert' : 'status'}
      className={`mb-5 rounded-xl border px-4 py-3 text-sm ${
        error ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'
      }`}
    >
      {error || notice}
    </div>
  )
}

function errorMessage(cause: unknown, fallback: string) {
  if (cause instanceof Error) return cause.message
  if (typeof cause === 'string') return cause
  if (cause && typeof cause === 'object' && 'message' in cause && typeof cause.message === 'string') {
    const details = 'details' in cause && typeof cause.details === 'string' ? cause.details : ''
    const hint = 'hint' in cause && typeof cause.hint === 'string' ? cause.hint : ''
    const code = 'code' in cause && typeof cause.code === 'string' ? ` [${cause.code}]` : ''
    return [cause.message + code, details, hint].filter(Boolean).join(' ')
  }
  return fallback
}

export default function OperationsWorkspace({
  page,
  role,
  orders,
  onOrdersChanged,
  onSelectResi,
  onOpenWaybill,
}: {
  page: OperationsPage
  role: 'Admin' | 'Staf Keuangan'
  orders: OperationalOrder[]
  onOrdersChanged: () => Promise<unknown>
  onSelectResi?: (resi: string) => void
  onOpenWaybill?: (waybill: Waybill) => void
}) {
  const [customers, setCustomers] = useState<Customer[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ls_customers_data')
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch {
          // ignore
        }
      }
    }
    return DEFAULT_CUSTOMERS
  })

  const [staff, setStaff] = useState<Staff[]>([])
  const [currentUserId, setCurrentUserId] = useState('')
  const [manifests, setManifests] = useState<Manifest[]>(DEFAULT_MANIFESTS)
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Customer Management states
  const [customerSearch, setCustomerSearch] = useState('')
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false)
  const [selectedCustomerDetail, setSelectedCustomerDetail] = useState<Customer | null>(null)
  const [customerForm, setCustomerForm] = useState({ id: '', name: '', phone: '', email: '', address: '', notes: '' })

  const [selectedResis, setSelectedResis] = useState<string[]>([])
  const [route, setRoute] = useState('')

  // Driver & Truck Manifest states
  const [driversList, setDriversList] = useState<Driver[]>(() => getStoredDrivers())
  const [assigningDriver, setAssigningDriver] = useState<Driver | null>(null)
  const [tempAssignedResis, setTempAssignedResis] = useState<string[]>([])

  // Save customers to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && customers.length > 0) {
      localStorage.setItem('ls_customers_data', JSON.stringify(customers))
    }
  }, [customers])

  // Sync drivers from localStorage and listen to updates
  useEffect(() => {
    function onStorage() {
      setDriversList(getStoredDrivers())
    }
    window.addEventListener('ls_drivers_updated', onStorage)
    return () => window.removeEventListener('ls_drivers_updated', onStorage)
  }, [])

  // Auto-group verified orders into trucks if none are assigned yet
  useEffect(() => {
    const verifiedReady = orders.filter(o => !o.archived && !o.cancelled && o.intakeVerifiedAt)
    if (verifiedReady.length === 0) return

    const allAssigned = driversList.flatMap(d => d.ticket?.assignedResis || [])
    const hasAnyRealAssigned = verifiedReady.some(o => allAssigned.includes(o.resi))

    if (!hasAnyRealAssigned && driversList.length > 0) {
      const updatedDrivers = [...driversList]
      const d1Orders = verifiedReady.filter(o => o.asal === 'Surabaya' && (o.tujuan === 'Jakarta' || o.tujuan === 'Pontianak'))
      const d2Orders = verifiedReady.filter(o => o.asal === 'Jakarta')
      const d3Orders = verifiedReady.filter(o => o.asal === 'Yogyakarta' || o.asal === 'Semarang')
      const d4Orders = verifiedReady.filter(o => !d1Orders.includes(o) && !d2Orders.includes(o) && !d3Orders.includes(o))

      if (updatedDrivers[0] && d1Orders.length > 0) {
        updatedDrivers[0] = {
          ...updatedDrivers[0],
          ticket: {
            ...(updatedDrivers[0].ticket || {
              ticketNumber: 'TKT-DLU-20261012-09',
              shipName: 'KM Dharma Rucitra VII (DLU)',
              originPort: 'Pelabuhan Tanjung Perak (Surabaya)',
              destinationPort: 'Pelabuhan Tanjung Priok (Jakarta)',
              departureDate: new Date().toISOString().slice(0, 10),
              departureTime: '10:00',
              seaDurationHours: 28,
              portHandlingHours: 5,
              landDeliveryHours: 6,
              finalDestinationAddress: 'Gudang Distribusi Jakarta, Jl. Raya Cilincing No. 45',
              notes: 'Muatan bahan cairan dan material industri',
            }),
            assignedResis: d1Orders.map(o => o.resi),
          },
        }
      }

      if (updatedDrivers[1] && d2Orders.length > 0) {
        updatedDrivers[1] = {
          ...updatedDrivers[1],
          ticket: {
            ...(updatedDrivers[1].ticket || {
              ticketNumber: 'TKT-ASDP-20261013-14',
              shipName: 'KM Niki Sejahtera',
              originPort: 'Pelabuhan Tanjung Priok (Jakarta)',
              destinationPort: 'Pelabuhan Tanjung Perak (Surabaya)',
              departureDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
              departureTime: '14:30',
              seaDurationHours: 20,
              portHandlingHours: 4,
              landDeliveryHours: 5,
              finalDestinationAddress: 'Kawasan Pergudangan Margomulyo, Surabaya / Malang',
              notes: 'Tiket confirmed, muatan barang paket umum',
            }),
            assignedResis: d2Orders.map(o => o.resi),
          },
        }
      }

      if (updatedDrivers[2] && d3Orders.length > 0) {
        updatedDrivers[2] = {
          ...updatedDrivers[2],
          status: 'Dalam Pelayaran',
          ticket: {
            ...(updatedDrivers[2].ticket || {
              ticketNumber: 'TKT-DLU-20261014-03',
              shipName: 'KM Kumala',
              originPort: 'Pelabuhan Tanjung Emas (Semarang)',
              destinationPort: 'Pelabuhan Dwikora (Pontianak)',
              departureDate: new Date().toISOString().slice(0, 10),
              departureTime: '11:00',
              seaDurationHours: 24,
              portHandlingHours: 4,
              landDeliveryHours: 5,
              finalDestinationAddress: 'Gudang Semarang / Yogyakarta',
              notes: 'Muatan barang konsinyasi',
            }),
            assignedResis: d3Orders.map(o => o.resi),
          },
        }
      }

      if (updatedDrivers[3] && d4Orders.length > 0) {
        updatedDrivers[3] = {
          ...updatedDrivers[3],
          ticket: {
            ...(updatedDrivers[3].ticket || {
              ticketNumber: 'TKT-DLU-20261010-04',
              shipName: 'KM Kirana IX (DLU)',
              originPort: 'Pelabuhan Tanjung Perak (Surabaya)',
              destinationPort: 'Pelabuhan Belawan (Medan)',
              departureDate: new Date().toISOString().slice(0, 10),
              departureTime: '08:00',
              seaDurationHours: 26,
              portHandlingHours: 5,
              landDeliveryHours: 6,
              finalDestinationAddress: 'Gudang Konsinyasi Medan / Denpasar',
              notes: 'Barang dalam perjalanan darat ke gudang penerima',
            }),
            assignedResis: d4Orders.map(o => o.resi),
          },
        }
      }

      saveStoredDrivers(updatedDrivers)
      setDriversList(updatedDrivers)
    }
  }, [orders, driversList])

  const loadPage = useCallback(async () => {
    if (!supabase) {
      return
    }
    setLoading(true)
    setError('')
    try {
      if (page === 'customers') {
        const { data, error: loadError } = await supabase.from('customers').select('*').order('name')
        if (loadError) {
          // If error or empty, keep existing state
          console.warn('Customer load error:', loadError)
        } else if (data && data.length > 0) {
          setCustomers(data as Customer[])
        }
      } else if (page === 'staff') {
        const { data: userData, error: userError } = await supabase.auth.getUser()
        if (userError) throw userError
        setCurrentUserId(userData.user?.id || '')
        const { data, error: loadError } = await supabase.rpc('admin_list_staff')
        if (loadError) throw loadError
        setStaff((data || []) as Staff[])
      } else if (page === 'manifests') {
        const { data, error: loadError } = await supabase.from('shipment_manifests').select('*').order('created_at', { ascending: false })
        if (loadError) {
          console.warn('Manifest load warning:', loadError)
          setManifests([])
        } else {
          setManifests((data || []) as Manifest[])
        }
      } else {
        const workflowResult = await supabase.from('workflow_audit_logs').select('*').order('created_at', { ascending: false }).limit(200)
        if (workflowResult.error) throw workflowResult.error
        let entries = (workflowResult.data || []) as AuditEntry[]
        if (role === 'Admin') {
          const operationalResult = await supabase.from('operational_audit_logs').select('*').order('created_at', { ascending: false }).limit(200)
          if (operationalResult.error) throw operationalResult.error
          entries = [...entries, ...((operationalResult.data || []) as AuditEntry[])]
        }
        setAudit(entries.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 200))
      }
    } catch (cause) {
      setError(errorMessage(cause, 'Gagal memuat data operasional.'))
    } finally {
      setLoading(false)
    }
  }, [page, role])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPage()
  }, [loadPage])

  const verifiedOrders = useMemo(
    () => orders.filter(order => !order.archived && !order.cancelled && !order.manifestId && order.intakeVerifiedAt),
    [orders],
  )
  const routes = useMemo(
    () => Array.from(new Set(verifiedOrders.map(order => `${order.asal} → ${order.tujuan}`))).sort(),
    [verifiedOrders],
  )
  const routeOrders = verifiedOrders.filter(order => !route || `${order.asal} → ${order.tujuan}` === route)

  // Filtered customers
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const q = customerSearch.toLowerCase()
      return (
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q)
      )
    })
  }, [customers, customerSearch])

  // Get orders associated with a customer
  const getCustomerOrders = useCallback((customerName: string) => {
    return orders.filter(o => o.cust.toLowerCase().trim() === customerName.toLowerCase().trim())
  }, [orders])

  function openAddCustomer() {
    setCustomerForm({ id: '', name: '', phone: '', email: '', address: '', notes: '' })
    setIsCustomerModalOpen(true)
  }

  function openEditCustomer(customer: Customer) {
    setCustomerForm({
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      notes: customer.notes,
    })
    setIsCustomerModalOpen(true)
  }

  async function saveCustomer() {
    if (!customerForm.name.trim()) return
    setSaving(true)
    setError('')
    setNotice('')

    try {
      let savedId = customerForm.id
      if (supabase) {
        const { data, error: saveError } = await supabase.rpc('admin_save_customer', {
          p_id: customerForm.id || null,
          p_name: customerForm.name.trim(),
          p_phone: customerForm.phone.trim(),
          p_email: customerForm.email.trim(),
          p_address: customerForm.address.trim(),
          p_notes: customerForm.notes.trim(),
        })
        if (!saveError && data) savedId = data
      }

      // Update local state
      if (customerForm.id) {
        setCustomers(prev =>
          prev.map(c =>
            c.id === customerForm.id
              ? {
                  ...c,
                  name: customerForm.name.trim(),
                  phone: customerForm.phone.trim(),
                  email: customerForm.email.trim(),
                  address: customerForm.address.trim(),
                  notes: customerForm.notes.trim(),
                }
              : c
          )
        )
        setNotice(`Profil pelanggan "${customerForm.name}" berhasil diperbarui.`)
      } else {
        const newCustomer: Customer = {
          id: savedId || 'cust-' + Date.now(),
          name: customerForm.name.trim(),
          phone: customerForm.phone.trim(),
          email: customerForm.email.trim(),
          address: customerForm.address.trim(),
          notes: customerForm.notes.trim(),
          created_at: new Date().toISOString(),
        }
        setCustomers(prev => [newCustomer, ...prev])
        setNotice(`Pelanggan baru "${customerForm.name}" berhasil ditambahkan.`)
      }

      setIsCustomerModalOpen(false)
      setCustomerForm({ id: '', name: '', phone: '', email: '', address: '', notes: '' })
    } catch (cause) {
      setError(errorMessage(cause, 'Gagal menyimpan data pelanggan.'))
    } finally {
      setSaving(false)
    }
  }

  async function deleteCustomer(customer: Customer) {
    if (!window.confirm(`Hapus data pelanggan "${customer.name}"? Riwayat order resi tidak akan dihapus.`)) return
    setSaving(true)
    setError('')
    setNotice('')

    try {
      if (supabase) {
        await supabase.rpc('admin_delete_customer', { p_id: customer.id })
      }
      setCustomers(prev => prev.filter(c => c.id !== customer.id))
      if (selectedCustomerDetail?.id === customer.id) {
        setSelectedCustomerDetail(null)
      }
      setNotice(`Data pelanggan "${customer.name}" berhasil dihapus.`)
    } catch (cause) {
      setError(errorMessage(cause, 'Gagal menghapus data pelanggan.'))
    } finally {
      setSaving(false)
    }
  }

  async function updateStaffRole(user: Staff, nextRole: Staff['role']) {
    if (!supabase || user.role === nextRole) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const { error: updateError } = await supabase.rpc('admin_update_staff_role', { p_user_id: user.id, p_role: nextRole })
      if (updateError) throw updateError
      setNotice(`Peran ${user.full_name} berhasil diubah menjadi ${nextRole}.`)
      await loadPage()
    } catch (cause) {
      setError(errorMessage(cause, 'Gagal mengubah peran staf.'))
    } finally {
      setSaving(false)
    }
  }

  async function verifyIntake(order: OperationalOrder) {
    if (!supabase) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const { error: verifyError } = await supabase.rpc('admin_verify_order_intake', { p_resi: order.resi, p_notes: '' })
      if (verifyError) throw verifyError
      setNotice(`Penerimaan fisik barang resi ${order.resi} berhasil diverifikasi.`)
      await onOrdersChanged()
    } catch (cause) {
      setError(errorMessage(cause, 'Gagal memverifikasi penerimaan barang.'))
    } finally {
      setSaving(false)
    }
  }

  async function createManifest() {
    if (!selectedResis.length) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const selectedOrders = orders.filter(o => selectedResis.includes(o.resi))
      let manifestRow: Manifest | null = null
      if (supabase) {
        const { data, error: createError } = await supabase.rpc('admin_create_shipment_manifest', { p_order_resis: selectedResis })
        if (createError) {
          if (createError.code === '23514') {
            setError(
              `Constraint 'orders_status_check' di Supabase menolak status 'Dalam Perjalanan' [23514]. Silakan jalankan script SQL migrasi (202610120002_fix_orders_status_check.sql) di Supabase Dashboard SQL Editor.`
            )
          } else {
            throw createError
          }
        } else {
          manifestRow = Array.isArray(data) ? data[0] : data
        }
      }

      if (!manifestRow) {
        manifestRow = {
          id: 'man-' + Date.now(),
          manifest_number: `MNF-${new Date().toISOString().slice(0, 7).replace('-', '')}-${String(manifests.length + 1).padStart(4, '0')}`,
          origin_city: selectedOrders[0]?.asal || 'Surabaya',
          destination_city: selectedOrders[0]?.tujuan || 'Pontianak',
          created_at: new Date().toISOString(),
        }
      }

      // Set manifestId pada order lokal
      selectedOrders.forEach(o => {
        o.manifestId = manifestRow!.id
        o.status = 'Dalam Perjalanan'
      })

      setManifests(prev => [manifestRow!, ...prev])
      setSelectedResis([])
      setNotice(`Manifest ${manifestRow.manifest_number} berhasil dibuat untuk ${selectedOrders.length} resi.`)
      await Promise.all([loadPage(), onOrdersChanged()])
      // Buka waybill langsung dengan order riil yang disetujui
      onOpenWaybill?.({ manifest: manifestRow, orders: selectedOrders })
    } catch (cause) {
      setError(errorMessage(cause, 'Gagal membuat manifest pengiriman.'))
    } finally {
      setSaving(false)
    }
  }

  async function openWaybill(manifest: Manifest) {
    let manifestOrders = orders.filter(order => order.manifestId === manifest.id)

    // Jika di state lokal belum ada, ambil dari database Supabase
    if (!manifestOrders.length && supabase) {
      const { data, error } = await supabase.from('orders').select('*').eq('manifest_id', manifest.id)
      if (!error && data && data.length > 0) {
        manifestOrders = (data as any[]).map(r => ({
          resi: r.resi,
          cust: r.customer_name,
          asal: r.origin_city,
          tujuan: r.destination_city,
          berat: Number(r.weight_kg),
          layanan: r.service_type,
          status: r.status,
          createdAt: r.created_at,
          cancelled: Boolean(r.cancelled),
          intakeVerifiedAt: r.intake_verified_at || null,
          manifestId: r.manifest_id || null,
          items: r.order_items || [],
          senderDescription: r.sender_description || '',
          recipientAddress: r.recipient_address || '',
          notes: r.notes || '',
          packing: r.packing || '',
          namaBarang: (r.order_items || []).map((it: any) => it.name).join(', ') || r.notes || '',
        }))
      }
    }

    onOpenWaybill?.({ manifest, orders: manifestOrders })
  }

  // ----------------- CUSTOMERS PAGE -----------------
  if (page === 'customers') {
    return (
      <div className="space-y-6">
        <PageHeading
          title="Data Pelanggan & Mitra"
          subtitle={`${customers.length} pelanggan/mitra terdaftar. Klik pelanggan untuk melihat profil lengkap dan riwayat order.`}
          action={
            <button type="button" onClick={openAddCustomer} className={primaryButton}>
              <Plus className="h-4 w-4" />
              Tambah Data Pelanggan
            </button>
          }
        />

        <Message error={error} notice={notice} />

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-xs">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-soft)]">Total Pelanggan</span>
            <p className="mt-1 text-2xl font-bold text-[var(--text)]">{customers.length}</p>
            <p className="text-xs text-[var(--text-soft)]">Mitra perorangan & perusahaan</p>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-xs">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">Pelanggan Aktif</span>
            <p className="mt-1 text-2xl font-bold text-blue-600">
              {customers.filter(c => getCustomerOrders(c.name).length > 0).length}
            </p>
            <p className="text-xs text-[var(--text-soft)]">Memiliki riwayat transaksi resi</p>
          </div>

          <div className="col-span-2 sm:col-span-1 rounded-2xl border border-[var(--border)] bg-white p-4 shadow-xs">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Total Order Terhubung</span>
            <p className="mt-1 text-2xl font-bold text-emerald-600">{orders.length}</p>
            <p className="text-xs text-[var(--text-soft)]">Resi terdata dalam sistem</p>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={customerSearch}
            onChange={e => setCustomerSearch(e.target.value)}
            placeholder="Cari nama perusahaan, telepon, email, alamat..."
            className="h-10 w-full rounded-xl border border-[var(--border)] bg-white pl-10 pr-4 text-sm text-[var(--text)] shadow-xs outline-none focus:border-[var(--brand-600)]"
          />
        </div>

        {/* Customer Table / List */}
        <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-[var(--panel-soft)] text-xs uppercase tracking-wider text-[var(--text-soft)]">
                <tr>
                  <th className="px-5 py-3.5">Nama Perusahaan / Pelanggan</th>
                  <th className="px-4 py-3.5">Kontak</th>
                  <th className="px-4 py-3.5">Alamat</th>
                  <th className="px-4 py-3.5 text-center">Riwayat Order</th>
                  <th className="px-5 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filteredCustomers.map(customer => {
                  const customerOrders = getCustomerOrders(customer.name)
                  return (
                    <tr
                      key={customer.id}
                      onClick={() => setSelectedCustomerDetail(customer)}
                      className="group cursor-pointer transition hover:bg-slate-50/80"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 font-bold text-blue-700">
                            <Building2 className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="font-bold text-[var(--text)] group-hover:text-[var(--brand-600)] transition">
                              {customer.name}
                            </div>
                            {customer.notes && (
                              <p className="mt-0.5 line-clamp-1 text-xs text-[var(--text-soft)]">{customer.notes}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4 text-xs text-[var(--text)]">
                        <div className="space-y-1">
                          {customer.phone ? (
                            <div className="flex items-center gap-1.5 font-medium text-slate-700">
                              <Phone className="h-3.5 w-3.5 text-slate-400" />
                              <span>{customer.phone}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                          {customer.email && (
                            <div className="flex items-center gap-1.5 text-slate-500">
                              <Mail className="h-3.5 w-3.5 text-slate-400" />
                              <span className="line-clamp-1">{customer.email}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-4 text-xs text-[var(--text-soft)] max-w-xs">
                        {customer.address ? (
                          <div className="flex items-start gap-1.5">
                            <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400 mt-0.5" />
                            <span className="line-clamp-2">{customer.address}</span>
                          </div>
                        ) : (
                          <span>—</span>
                        )}
                      </td>

                      <td className="px-4 py-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                            customerOrders.length > 0
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          <Package className="h-3 w-3" />
                          {customerOrders.length} Order Resi
                        </span>
                      </td>

                      <td className="px-5 py-4 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedCustomerDetail(customer)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50"
                          >
                            Detail Order
                            <ArrowRight className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditCustomer(customer)}
                            className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100"
                            title="Ubah Profil Pelanggan"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void deleteCustomer(customer)}
                            className="rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50"
                            title="Hapus Pelanggan"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}

                {!filteredCustomers.length && (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-sm text-[var(--text-soft)]">
                      {loading ? 'Memuat data pelanggan…' : 'Tidak ada data pelanggan yang sesuai.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Modal: Tambah / Ubah Data Pelanggan */}
        {isCustomerModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
            <div className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-[var(--text)]">
                  {customerForm.id ? 'Ubah Profil Pelanggan' : 'Tambah Data Pelanggan Baru'}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 space-y-3.5">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Nama Perusahaan / Nama Pelanggan *</label>
                  <input
                    type="text"
                    value={customerForm.name}
                    onChange={e => setCustomerForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Misal: PT Sinar Jaya / CV Mitra Mandiri"
                    className={inputClass}
                    required
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-slate-700">Kontak Telepon / WhatsApp</label>
                    <input
                      type="text"
                      value={customerForm.phone}
                      onChange={e => setCustomerForm(f => ({ ...f, phone: e.target.value }))}
                      placeholder="Misal: 0812-3456-7890"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700">Alamat Email</label>
                    <input
                      type="email"
                      value={customerForm.email}
                      onChange={e => setCustomerForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="Misal: kontak@perusahaan.com"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700">Alamat Lengkap Kantor / Gudang</label>
                  <textarea
                    value={customerForm.address}
                    onChange={e => setCustomerForm(f => ({ ...f, address: e.target.value }))}
                    placeholder="Alamat jalan, nomor gudang, kota..."
                    className="w-full rounded-xl border border-[var(--border)] bg-white p-3 text-sm text-[var(--text)] outline-none focus:border-[var(--brand-600)] min-h-[72px]"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700">Catatan Khusus Kemitraan</label>
                  <input
                    type="text"
                    value={customerForm.notes}
                    onChange={e => setCustomerForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Misal: Prioritas ekspedisi laut, syarat packing kayu, PIC Pak Budi"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => void saveCustomer()}
                  disabled={saving || !customerForm.name.trim()}
                  className="rounded-xl bg-[var(--brand-600)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-700)] disabled:opacity-50"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Data Pelanggan'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Detail Pelanggan & Daftar Order Resi */}
        {selectedCustomerDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs overflow-y-auto">
            <div className="my-8 w-full max-w-2xl rounded-2xl border border-[var(--border)] bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-[var(--text)]">{selectedCustomerDetail.name}</h2>
                    <p className="text-xs text-[var(--text-soft)]">
                      Mitra Pelanggan CV. Lautan Sejati Trans Cargo
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCustomerDetail(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Profile details */}
              <div className="mt-4 grid gap-3 sm:grid-cols-2 rounded-xl bg-slate-50 p-4 text-xs">
                <div>
                  <span className="font-semibold text-slate-500 block">Nomor Kontak:</span>
                  <p className="mt-0.5 font-bold text-slate-800">{selectedCustomerDetail.phone || '—'}</p>
                </div>
                <div>
                  <span className="font-semibold text-slate-500 block">Email:</span>
                  <p className="mt-0.5 font-bold text-slate-800">{selectedCustomerDetail.email || '—'}</p>
                </div>
                <div className="sm:col-span-2">
                  <span className="font-semibold text-slate-500 block">Alamat Gudang / Kantor:</span>
                  <p className="mt-0.5 text-slate-800">{selectedCustomerDetail.address || '—'}</p>
                </div>
                {selectedCustomerDetail.notes && (
                  <div className="sm:col-span-2">
                    <span className="font-semibold text-slate-500 block">Catatan:</span>
                    <p className="mt-0.5 text-slate-700 italic">{selectedCustomerDetail.notes}</p>
                  </div>
                )}
              </div>

              {/* Order History Section */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-[var(--text)] flex items-center gap-2">
                    <Package className="h-4 w-4 text-[var(--brand-600)]" />
                    Daftar Order & Riwayat Resi Pelanggan ({getCustomerOrders(selectedCustomerDetail.name).length})
                  </h3>
                </div>

                <div className="max-h-80 overflow-y-auto rounded-xl border border-[var(--border)]">
                  {getCustomerOrders(selectedCustomerDetail.name).length > 0 ? (
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[var(--panel-soft)] font-semibold text-[var(--text-soft)] uppercase tracking-wider sticky top-0">
                        <tr>
                          <th className="px-3.5 py-2.5">Nomor Resi</th>
                          <th className="px-3 py-2.5">Rute</th>
                          <th className="px-3 py-2.5">Layanan</th>
                          <th className="px-3 py-2.5">Berat</th>
                          <th className="px-3 py-2.5">Status</th>
                          <th className="px-3 py-2.5 text-right">Lacak</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {getCustomerOrders(selectedCustomerDetail.name).map(ord => (
                          <tr key={ord.resi} className="hover:bg-slate-50 transition">
                            <td className="px-3.5 py-3 font-mono font-bold text-slate-900">{ord.resi}</td>
                            <td className="px-3 py-3 text-slate-700">{ord.asal} → {ord.tujuan}</td>
                            <td className="px-3 py-3 text-slate-600">{ord.layanan}</td>
                            <td className="px-3 py-3 text-slate-700 font-medium">{ord.berat.toLocaleString('id-ID')} kg</td>
                            <td className="px-3 py-3">
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                  ord.status === 'Terkirim'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : ord.status === 'Dalam Perjalanan'
                                    ? 'bg-amber-50 text-amber-700'
                                    : 'bg-blue-50 text-blue-700'
                                }`}
                              >
                                {ord.status}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-right">
                              {onSelectResi && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedCustomerDetail(null)
                                    onSelectResi(ord.resi)
                                  }}
                                  className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-800 underline"
                                >
                                  Lacak
                                  <ExternalLink className="h-3 w-3" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="py-8 text-center text-xs text-slate-500">
                      Belum ada riwayat order atau resi untuk mitra pelanggan ini.
                    </div>
                  )}
                </div>
              </div>

              {/* Close Button */}
              <div className="mt-6 flex justify-end border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setSelectedCustomerDetail(null)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ----------------- STAFF PAGE -----------------
  if (page === 'staff') {
    return (
      <div>
        <PageHeading
          title="Pengelolaan pengguna"
          subtitle="Tinjau akun staf dan tetapkan peran operasional atau keuangan."
          action={
            <button type="button" disabled={loading} className={secondaryButton} onClick={() => void loadPage()}>
              <RefreshCw className="h-4 w-4" />
              Muat ulang
            </button>
          }
        />
        <Message error={error} notice={notice} />
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Akun baru dibuat melalui proses pendaftaran. Peran Admin tidak dapat dipilih sendiri oleh pengguna, tidak dapat diubah oleh pemilik akun, dan Admin terakhir tidak dapat diturunkan perannya.
        </div>
        <section className="table-shell overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-[var(--panel-soft)] text-xs uppercase text-[var(--text-soft)]">
              <tr>
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Dibuat</th>
                <th className="px-4 py-3">Peran</th>
              </tr>
            </thead>
            <tbody>
              {staff.map(user => (
                <tr key={user.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3 font-semibold">{user.full_name}</td>
                  <td className="px-4 py-3">{user.email}</td>
                  <td className="px-4 py-3 text-xs text-[var(--text-soft)]">{user.created_at.slice(0, 10)}</td>
                  <td className="px-4 py-3">
                    <select
                      aria-label={`Peran ${user.full_name}`}
                      disabled={saving || user.id === currentUserId || (user.role === 'Admin' && !staff.some(other => other.role === 'Admin' && other.id !== user.id))}
                      value={user.role}
                      onChange={event => void updateStaffRole(user, event.target.value as Staff['role'])}
                      className="h-9 rounded-lg border border-[var(--border)] bg-white px-2"
                    >
                      <option>Admin</option>
                      <option>Staf Keuangan</option>
                    </select>
                  </td>
                </tr>
              ))}
              {!staff.length && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-[var(--text-soft)]">
                    {loading ? 'Memuat akun staf…' : 'Tidak ada data staf.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    )
  }

  // ----------------- MANIFESTS PAGE -----------------
  if (page === 'manifests') {
    // Orders yang sudah diverifikasi fisik
    const verifiedReadyOrders = orders.filter(o => !o.archived && !o.cancelled && o.intakeVerifiedAt)
    // Orders yang belum diverifikasi
    const unverifiedOrders = orders.filter(o => !o.archived && !o.cancelled && !o.intakeVerifiedAt)

    function handlePrintTruckManifest(driver: Driver, truckOrders: OperationalOrder[]) {
      if (truckOrders.length === 0) return
      const manifestNum =
        driver.manifestNumber ||
        driver.ticket?.manifestNumber ||
        `MNF-${driver.code.replace(/[^A-Za-z0-9]/g, '')}-${(driver.ticket?.departureDate || new Date().toISOString().slice(0, 10)).replace(/-/g, '')}`

      const firstOrder = truckOrders[0]
      const origin =
        driver.ticket?.originPort?.split('(')[1]?.replace(')', '').trim() ||
        driver.ticket?.originPort?.split('→')[0]?.trim() ||
        firstOrder?.asal ||
        'Surabaya'
      const destination =
        driver.ticket?.destinationPort?.split('(')[1]?.replace(')', '').trim() ||
        driver.ticket?.destinationPort?.split('→')[1]?.trim() ||
        firstOrder?.tujuan ||
        'Pontianak'

      onOpenWaybill?.({
        manifest: {
          id: `driver-${driver.id}`,
          manifest_number: manifestNum,
          origin_city: origin,
          destination_city: destination,
          created_at: driver.ticket?.departureDate || new Date().toISOString(),
        },
        orders: truckOrders,
        driverInfo: {
          driverName: driver.name,
          driverCode: driver.code,
          driverPhone: driver.phone,
          truckType: driver.truckType,
          licensePlate: driver.licensePlate,
          shipName: driver.ticket?.shipName || 'KM Dharma Rucitra VII (DLU)',
          departureDate: driver.ticket?.departureDate,
          departureTime: driver.ticket?.departureTime,
          originPort: driver.ticket?.originPort,
          destinationPort: driver.ticket?.destinationPort,
          originCity: origin,
          destinationCity: destination,
          manifestNumber: manifestNum,
        },
      })
    }

    function openAssignModal(driver: Driver) {
      setAssigningDriver(driver)
      setTempAssignedResis(driver.ticket?.assignedResis || [])
    }

    function toggleResiInModal(resi: string) {
      setTempAssignedResis(prev =>
        prev.includes(resi) ? prev.filter(r => r !== resi) : [...prev, resi]
      )
    }

    function saveAssignResis() {
      if (!assigningDriver) return
      const updated = driversList.map(d => {
        if (d.id === assigningDriver.id) {
          return {
            ...d,
            ticket: {
              ...(d.ticket || {
                ticketNumber: `TKT-${d.code}-${Date.now().toString().slice(-6)}`,
                shipName: 'KM Dharma Rucitra VII (DLU)',
                originPort: 'Pelabuhan Tanjung Perak (Surabaya)',
                destinationPort: 'Pelabuhan Tanjung Priok (Jakarta)',
                departureDate: new Date().toISOString().slice(0, 10),
                departureTime: '10:00',
                seaDurationHours: 24,
                portHandlingHours: 4,
                landDeliveryHours: 5,
                finalDestinationAddress: 'Gudang Distribusi',
                notes: '',
              }),
              assignedResis: tempAssignedResis,
            },
          }
        }
        return d
      })
      saveStoredDrivers(updated)
      setDriversList(updated)
      setAssigningDriver(null)
      setNotice(`Muatan resi untuk armada ${assigningDriver.name} berhasil diperbarui.`)
      setTimeout(() => setNotice(''), 3000)
    }

    // Hitung resi yang belum masuk ke truk mana pun
    const allAssignedResisSet = new Set(driversList.flatMap(d => d.ticket?.assignedResis || []))
    const unassignedVerifiedOrders = verifiedReadyOrders.filter(o => !allAssignedResisSet.has(o.resi))

    function handleAutoDistribute() {
      if (unassignedVerifiedOrders.length === 0 || driversList.length === 0) return
      const updated = [...driversList]
      unassignedVerifiedOrders.forEach((order, index) => {
        const targetIndex = index % updated.length
        const targetDriver = updated[targetIndex]
        if (targetDriver) {
          const currentResis = targetDriver.ticket?.assignedResis || []
          if (!currentResis.includes(order.resi)) {
            updated[targetIndex] = {
              ...targetDriver,
              ticket: {
                ...(targetDriver.ticket || {
                  ticketNumber: `TKT-${targetDriver.code}-${Date.now().toString().slice(-6)}`,
                  shipName: 'KM Dharma Rucitra VII (DLU)',
                  originPort: 'Pelabuhan Tanjung Perak (Surabaya)',
                  destinationPort: 'Pelabuhan Tujuan',
                  departureDate: new Date().toISOString().slice(0, 10),
                  departureTime: '10:00',
                  seaDurationHours: 24,
                  portHandlingHours: 4,
                  landDeliveryHours: 5,
                  finalDestinationAddress: 'Gudang Distribusi',
                  notes: '',
                }),
                assignedResis: [...currentResis, order.resi],
              },
            }
          }
        }
      })
      saveStoredDrivers(updated)
      setDriversList(updated)
      setNotice('Semua resi terverifikasi berhasil dimuatkan ke armada truk.')
      setTimeout(() => setNotice(''), 3000)
    }

    return (
      <div>
        <PageHeading
          title="Manajemen Manifest"
          subtitle="Daftar manifest armada truk. Satu surat manifest langsung memuat seluruh resi muatan dalam satu truk."
        />
        <Message error={error} notice={notice} />

        {/* Section: Barang masuk belum diverifikasi (jika ada) */}
        {unverifiedOrders.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-3 font-semibold text-[var(--text)]">Barang masuk perlu verifikasi fisik</h2>
            <div className="table-shell overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-[var(--panel-soft)] text-xs uppercase text-[var(--text-soft)]">
                  <tr>
                    <th className="px-4 py-3">Resi</th>
                    <th className="px-4 py-3">Pengirim</th>
                    <th className="px-4 py-3">Rute</th>
                    <th className="px-4 py-3 text-right">Berat</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {unverifiedOrders.map(order => (
                    <tr key={order.resi} className="border-t border-[var(--border)]">
                      <td className="px-4 py-3 font-semibold">{order.resi}</td>
                      <td className="px-4 py-3">
                        {order.cust}
                        <span className="mt-1 block text-xs text-[var(--text-soft)]">
                          {order.items?.map(item => item.name).join(', ') || 'Barang belum dirinci'}
                        </span>
                      </td>
                      <td className="px-4 py-3">{order.asal} → {order.tujuan}</td>
                      <td className="px-4 py-3 text-right">{order.berat.toLocaleString('id-ID')} kg</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          disabled={saving || role !== 'Admin'}
                          className={primaryButton}
                          onClick={() => void verifyIntake(order)}
                        >
                          <Check className="h-4 w-4" />
                          Verifikasi barang
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Banner informasi jika ada resi yang belum masuk truk */}
        {unassignedVerifiedOrders.length > 0 && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-amber-900 text-sm">
                  {unassignedVerifiedOrders.length} resi terverifikasi belum dimasukkan ke truk
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {unassignedVerifiedOrders.map(o => (
                    <span
                      key={o.resi}
                      className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 font-mono text-xs font-semibold text-amber-900 border border-amber-200"
                    >
                      {o.resi} ({o.asal}→{o.tujuan}, {o.berat}kg)
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAutoDistribute}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-amber-700 active:scale-95 transition"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Muatkan Otomatis ke Truk</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Section Utama: Manifest Per Armada Truk (1 Truk Membawa Beberapa Resi) */}
        <section className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-[var(--text)] flex items-center gap-2">
              <Truck className="h-5 w-5 text-[var(--brand-600)]" />
              <span>Manifest Per Armada Truk (Siap Cetak)</span>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                {driversList.length} armada
              </span>
            </h2>
          </div>

          <div className="table-shell overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-[var(--panel-soft)] text-xs uppercase text-[var(--text-soft)]">
                <tr>
                  <th className="px-4 py-3">Armada &amp; Nopol</th>
                  <th className="px-4 py-3">Sopir &amp; Kontak</th>
                  <th className="px-4 py-3">Kapal &amp; Rute</th>
                  <th className="px-4 py-3">Resi Muatan (Isi Truk)</th>
                  <th className="px-4 py-3 text-right">Total Berat</th>
                  <th className="px-4 py-3 text-right">Aksi Manifest</th>
                </tr>
              </thead>
              <tbody>
                {driversList.map(driver => {
                  const assignedResis = driver.ticket?.assignedResis || []
                  const truckOrders = verifiedReadyOrders.filter(o => assignedResis.includes(o.resi))
                  const totalTruckWeight = truckOrders.reduce((sum, o) => sum + (Number(o.berat) || 0), 0)
                  const hasMuatan = truckOrders.length > 0

                  return (
                    <tr key={driver.id} className="border-t border-[var(--border)] hover:bg-slate-50/50 transition">
                      {/* Armada & Nopol */}
                      <td className="px-4 py-3.5 align-top">
                        <div className="flex items-start gap-2.5">
                          <div className="rounded-lg bg-sky-100 p-2 text-sky-800 shrink-0">
                            <Truck className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 leading-snug">{driver.truckType}</p>
                            <span className="mt-1 inline-block rounded bg-slate-900 px-2 py-0.5 font-mono text-xs font-bold text-white tracking-wider">
                              {driver.licensePlate}
                            </span>
                            <p className="mt-1 font-mono text-[11px] text-slate-400">
                              {driver.manifestNumber || `MNF-${driver.code}`}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Sopir */}
                      <td className="px-4 py-3.5 align-top">
                        <p className="font-semibold text-slate-800">{driver.name}</p>
                        <p className="font-mono text-xs text-slate-500 mt-0.5">{driver.phone}</p>
                        <span className="mt-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                          {driver.code}
                        </span>
                      </td>

                      {/* Pelayaran & Rute */}
                      <td className="px-4 py-3.5 align-top">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-800">
                          <Ship className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                          <span>{driver.ticket?.shipName || 'Belum ada tiket kapal'}</span>
                        </div>
                        {driver.ticket ? (
                          <>
                            <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-600">
                              <span>{driver.ticket.originPort.split('(')[0]?.trim()}</span>
                              <ArrowRight className="h-3 w-3 text-slate-400" />
                              <span>{driver.ticket.destinationPort.split('(')[0]?.trim()}</span>
                            </div>
                            <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
                              <Calendar className="h-3 w-3" />
                              <span>{driver.ticket.departureDate} ({driver.ticket.departureTime || '10:00'})</span>
                            </div>
                          </>
                        ) : (
                          <p className="mt-1 text-[11px] text-slate-400">Belum dijadwalkan</p>
                        )}
                      </td>

                      {/* Resi Muatan */}
                      <td className="px-4 py-3.5 align-top max-w-[320px]">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            hasMuatan ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {hasMuatan ? `${truckOrders.length} Resi Muatan` : 'Belum Ada Muatan'}
                          </span>
                          <button
                            type="button"
                            onClick={() => openAssignModal(driver)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--brand-600)] hover:underline"
                          >
                            <Settings className="h-3 w-3" />
                            <span>Atur Muatan</span>
                          </button>
                        </div>

                        {hasMuatan ? (
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {truckOrders.map(order => (
                              <div
                                key={order.resi}
                                className="group relative rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs shadow-xs hover:border-sky-300"
                              >
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-bold text-sky-700">{order.resi}</span>
                                  <span className="text-slate-400">•</span>
                                  <span className="font-semibold text-slate-700">{order.berat.toLocaleString('id-ID')} kg</span>
                                </div>
                                <p className="text-[10px] text-slate-500 line-clamp-1">
                                  {order.items?.[0]?.name || order.notes || order.cust}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic">
                            Klik "Atur Muatan" untuk memasukkan resi yang akan diangkut truk ini.
                          </p>
                        )}
                      </td>

                      {/* Total Berat */}
                      <td className="px-4 py-3.5 align-top text-right">
                        <span className="font-extrabold text-base text-slate-900">
                          {totalTruckWeight.toLocaleString('id-ID')} kg
                        </span>
                        <p className="text-[11px] text-slate-400 mt-0.5">{truckOrders.length} resi</p>
                      </td>

                      {/* Aksi: Cetak Manifest Truk */}
                      <td className="px-4 py-3.5 align-top text-right">
                        <button
                          type="button"
                          disabled={!hasMuatan}
                          className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition active:scale-95 shadow-sm ${
                            hasMuatan
                              ? 'bg-[var(--brand-600)] text-white hover:bg-[var(--brand-700)]'
                              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          }`}
                          onClick={() => handlePrintTruckManifest(driver, truckOrders)}
                          title={hasMuatan ? `Cetak surat manifest untuk armada ${driver.truckType}` : 'Truk belum memiliki resi muatan'}
                        >
                          <Printer className="h-4 w-4" />
                          <span>{hasMuatan ? `Cetak Manifest (${truckOrders.length} Resi)` : 'Kosong'}</span>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section: Manifest dari database (history) */}
        {manifests.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 font-semibold text-[var(--text)]">Riwayat manifest dibuat</h2>
            <div className="table-shell overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-[var(--panel-soft)] text-xs uppercase text-[var(--text-soft)]">
                  <tr>
                    <th className="px-4 py-3">Nomor manifest</th>
                    <th className="px-4 py-3">Rute</th>
                    <th className="px-4 py-3">Dibuat</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {manifests.map(manifest => (
                    <tr key={manifest.id} className="border-t border-[var(--border)]">
                      <td className="px-4 py-3 font-semibold">{manifest.manifest_number}</td>
                      <td className="px-4 py-3">{manifest.origin_city} → {manifest.destination_city}</td>
                      <td className="px-4 py-3 text-xs text-[var(--text-soft)]">{manifest.created_at.slice(0, 10)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--brand-600)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-700)] active:scale-95 transition"
                          onClick={() => void openWaybill(manifest)}
                        >
                          <Printer className="h-4 w-4" />
                          Cetak Manifest
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Modal: Atur Muatan Resi untuk Truk Tertentu */}
        {assigningDriver && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-sky-100 p-2.5 text-sky-800">
                    <Truck className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">
                      Atur Muatan: {assigningDriver.truckType} ({assigningDriver.licensePlate})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Sopir: {assigningDriver.name} • Pilih resi-resi yang diangkut oleh truk ini
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAssigningDriver(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Body: Checkbox daftar resi terverifikasi */}
              <div className="flex-1 overflow-y-auto p-6 space-y-2">
                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Daftar Resi Terverifikasi ({verifiedReadyOrders.length} resi tersedia di gudang)
                </p>

                {verifiedReadyOrders.length > 0 ? (
                  verifiedReadyOrders.map(order => {
                    const isChecked = tempAssignedResis.includes(order.resi)
                    return (
                      <label
                        key={order.resi}
                        className={`flex items-center justify-between gap-3 rounded-xl border p-3.5 cursor-pointer transition ${
                          isChecked
                            ? 'border-sky-500 bg-sky-50/60 shadow-xs'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleResiInModal(order.resi)}
                            className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-slate-900 text-sm">{order.resi}</span>
                              <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                                {order.asal} → {order.tujuan}
                              </span>
                            </div>
                            <p className="mt-0.5 text-xs text-slate-600">
                              Pengirim: <strong>{order.cust}</strong> • {order.items?.[0]?.name || order.notes || 'Barang umum'}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-bold text-sm text-slate-800">{order.berat.toLocaleString('id-ID')} kg</span>
                          <span className={`block text-[10px] font-semibold ${isChecked ? 'text-sky-700' : 'text-slate-400'}`}>
                            {isChecked ? 'Dimuat di truk' : 'Belum dimuat'}
                          </span>
                        </div>
                      </label>
                    )
                  })
                ) : (
                  <div className="p-8 text-center text-slate-400">
                    Belum ada order terverifikasi fisik di gudang.
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 bg-slate-50">
                <div className="text-xs text-slate-600">
                  Total terpilih:{' '}
                  <strong className="text-slate-900 font-bold">{tempAssignedResis.length} Resi</strong> (
                  {verifiedReadyOrders
                    .filter(o => tempAssignedResis.includes(o.resi))
                    .reduce((sum, o) => sum + (Number(o.berat) || 0), 0)
                    .toLocaleString('id-ID')}{' '}
                  kg)
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAssigningDriver(null)}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={saveAssignResis}
                    className="rounded-xl bg-[var(--brand-600)] px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-[var(--brand-700)] active:scale-95 transition"
                  >
                    Simpan Muatan Truk
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ----------------- AUDIT PAGE -----------------
  return (
    <div>
      <PageHeading
        title="Log aktivitas"
        subtitle="Riwayat audit untuk penerimaan barang, pembuatan manifest, dan pembatalan."
        action={
          <button type="button" disabled={loading} className={secondaryButton} onClick={() => void loadPage()}>
            <RefreshCw className="h-4 w-4" />
            Muat ulang
          </button>
        }
      />
      <Message error={error} notice={notice} />
      <section className="table-shell overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-[var(--panel-soft)] text-xs uppercase text-[var(--text-soft)]">
            <tr>
              <th className="px-4 py-3">Waktu</th>
              <th className="px-4 py-3">Jenis aktivitas</th>
              <th className="px-4 py-3">Entitas</th>
              <th className="px-4 py-3">Rincian</th>
            </tr>
          </thead>
          <tbody>
            {audit.map(entry => (
              <tr key={entry.id} className="border-t border-[var(--border)]">
                <td className="px-4 py-3 text-xs text-[var(--text-soft)]">{entry.created_at.slice(0, 19).replace('T', ' ')}</td>
                <td className="px-4 py-3 font-semibold">{entry.event_type}</td>
                <td className="px-4 py-3 font-mono">{entry.entity_id}</td>
                <td className="px-4 py-3 text-xs text-[var(--text-soft)]">{JSON.stringify(entry.details)}</td>
              </tr>
            ))}
            {!audit.length && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-[var(--text-soft)]">
                  {loading ? 'Memuat log aktivitas…' : 'Belum ada log aktivitas.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}
