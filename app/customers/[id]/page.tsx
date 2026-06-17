'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import InvoicePanel from '@/components/InvoicePanel'
import PlantDocuments from '@/components/PlantDocuments'
import PlantArchivedRequests from '@/components/PlantArchivedRequests'
import CustomerArchivedRequests from '@/components/CustomerArchivedRequests'

interface Contact {
  id: string
  customerId: string
  siteId: string | null
  plantId: string | null
  userId: string | null
  name: string
  role: string | null
  email: string | null
  phone: string | null
  isPrimary: boolean
  note: string | null
  user?: { id: string; name: string } | null
}

interface Plant {
  id: string
  name: string
  type: string
  serialNumber: string | null
  location: string | null
  installedAt: string | null
  buildYear: number | null
  description: string | null
  manufacturer: string | null
  model: string | null
  customerId: string
  siteId: string | null
  defaultTechnicianId: string | null
  defaultTechnician: { id: string; name: string } | null
  externalUsers: { userId: string; user: { id: string; name: string } }[]
  contacts: Contact[]
  _count?: { jobPlants: number }
}

interface CustomerUser {
  id: string
  name: string
  email: string | null
  phone: string | null
  role: string
  externalPlants: { plant: { id: string; name: string } }[]
}

interface Hotel {
  id: string
  name: string
  address: string | null
  phone: string | null
  note: string | null
  siteId: string | null
}

interface Site {
  id: string
  name: string
  address: string | null
  zip: string | null
  city: string | null
  note: string | null
  contacts: Contact[]
  _count?: { plants: number }
}

interface Customer {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  plants: Plant[]
  sites: Site[]
  contacts: Contact[]
  users: CustomerUser[]
  _count: { jobs: number }
}

interface PlantType {
  id: string
  value: string
  label: string
  items: { section: string; label: string; order: number }[]
}

interface ChecklistOverrideItem {
  id?: string
  section: string
  label: string
  order: number
}

interface PlantForm {
  name: string
  type: string
  serialNumber: string
  location: string
  installedAt: string
  buildYear: string
  description: string
  manufacturer: string
  model: string
  defaultTechnicianId: string
  externalUserIds: string[]
  siteId: string
}

const emptyPlantForm: PlantForm = {
  name: '',
  type: '',
  serialNumber: '',
  location: '',
  installedAt: '',
  buildYear: '',
  description: '',
  manufacturer: '',
  model: '',
  defaultTechnicianId: '',
  externalUserIds: [],
  siteId: '',
}

type ContactLevel = 'company' | 'site' | 'plant'

interface ContactForm {
  name: string
  role: string
  email: string
  phone: string
  isPrimary: boolean
  note: string
  userId: string
}

const emptyContactForm: ContactForm = {
  name: '', role: '', email: '', phone: '', isPrimary: false, note: '', userId: '',
}

export default function CustomerDetailPage() {
  const { data: session } = useSession()
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Edit customer state
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
  })
  const [saving, setSaving] = useState(false)

  // Delete customer state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Plant modal state
  const [showPlantModal, setShowPlantModal] = useState(false)
  const [editingPlant, setEditingPlant] = useState<Plant | null>(null)
  const [plantForm, setPlantForm] = useState<PlantForm>(emptyPlantForm)
  const [submittingPlant, setSubmittingPlant] = useState(false)

  // Delete plant state
  const [plantToDelete, setPlantToDelete] = useState<Plant | null>(null)
  const [deletingPlant, setDeletingPlant] = useState(false)
  const [deletePlantError, setDeletePlantError] = useState<string | null>(null)

  // Plant types from DB
  const [plantTypes, setPlantTypes] = useState<PlantType[]>([])

  // Technician list for plant assignment (internal)
  const [internalTechs, setInternalTechs] = useState<{id: string; name: string}[]>([])

  // Hotels
  const [hotels, setHotels] = useState<Hotel[]>([])
  const [showHotelModal, setShowHotelModal] = useState(false)
  const [editingHotel, setEditingHotel] = useState<Hotel | null>(null)
  const [hotelForm, setHotelForm] = useState({ name: '', address: '', phone: '', note: '' })
  const [hotelSiteId, setHotelSiteId] = useState<string>('')
  const [savingHotel, setSavingHotel] = useState(false)

  // Sites (Standorte)
  const [showSiteModal, setShowSiteModal] = useState(false)
  const [editingSite, setEditingSite] = useState<Site | null>(null)
  const [siteForm, setSiteForm] = useState({ name: '', address: '', zip: '', city: '', note: '' })
  const [savingSite, setSavingSite] = useState(false)
  const [expandedSites, setExpandedSites] = useState<Record<string, boolean>>({})

  // Contacts (Ansprechpartner)
  const [showContactModal, setShowContactModal] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [contactLevel, setContactLevel] = useState<ContactLevel>('company')
  const [contactTargetId, setContactTargetId] = useState<string | null>(null) // siteId or plantId
  const [contactForm, setContactForm] = useState<ContactForm>(emptyContactForm)
  const [savingContact, setSavingContact] = useState(false)

  // Per-plant checklist override editor
  const [checklistPlant, setChecklistPlant] = useState<Plant | null>(null)
  const [overrideItems, setOverrideItems] = useState<ChecklistOverrideItem[]>([])
  const [loadingOverride, setLoadingOverride] = useState(false)
  const [savingOverride, setSavingOverride] = useState(false)
  const [overrideHasData, setOverrideHasData] = useState(false)

  const role = session?.user?.role ?? ''
  const canEditDelete = ['ADMIN', 'SERVICE_MANAGER'].includes(role)
  const canManagePlants = ['ADMIN', 'SERVICE_MANAGER', 'SERVICE_TECHNICIAN'].includes(role)
  const canManageInvoices = ['ADMIN', 'SERVICE_MANAGER'].includes(role)

  const fetchCustomer = async () => {
    setLoading(true)
    const res = await fetch(`/api/customers/${id}`)
    if (res.ok) {
      const data = await res.json()
      setCustomer(data)
    } else {
      setError('Kunde nicht gefunden')
    }
    setLoading(false)
  }

  const fetchHotels = async () => {
    const res = await fetch(`/api/hotels?customerId=${id}`)
    if (res.ok) setHotels(await res.json())
  }

  useEffect(() => {
    if (id) { fetchCustomer(); fetchHotels() }
    fetch('/api/plant-types').then(r => r.json()).then(setPlantTypes).catch(() => {})
    // Load internal technicians (SERVICE_TECHNICIAN)
    fetch('/api/users?role=SERVICE_TECHNICIAN').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setInternalTechs(data.filter((u: {active: boolean}) => u.active))
    }).catch(() => {})
  }, [id])

  async function openChecklistEditor(plant: Plant) {
    setChecklistPlant(plant)
    setLoadingOverride(true)
    const res = await fetch(`/api/plants/${plant.id}/checklist`)
    if (res.ok) {
      const data: ChecklistOverrideItem[] = await res.json()
      if (data.length > 0) {
        setOverrideItems(data.map((item, idx) => ({ ...item, order: idx })))
        setOverrideHasData(true)
      } else {
        // Load type default as starting point
        const pt = plantTypes.find(p => p.value === plant.type)
        const defaults = pt?.items ?? []
        setOverrideItems(defaults.map((item, idx) => ({ section: item.section, label: item.label, order: idx })))
        setOverrideHasData(false)
      }
    }
    setLoadingOverride(false)
  }

  async function saveOverride() {
    if (!checklistPlant) return
    setSavingOverride(true)
    await fetch(`/api/plants/${checklistPlant.id}/checklist`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: overrideItems }),
    })
    setOverrideHasData(overrideItems.length > 0)
    setSavingOverride(false)
  }

  async function resetOverride() {
    if (!checklistPlant) return
    if (!confirm('Angepasste Checkliste löschen und Typ-Standard wiederherstellen?')) return
    await fetch(`/api/plants/${checklistPlant.id}/checklist`, { method: 'DELETE' })
    const pt = plantTypes.find(p => p.value === checklistPlant.type)
    setOverrideItems((pt?.items ?? []).map((item, idx) => ({ section: item.section, label: item.label, order: idx })))
    setOverrideHasData(false)
  }

  function addOverrideItem() {
    setOverrideItems(items => [...items, { section: '', label: '', order: items.length }])
  }

  function updateOverrideItem(idx: number, field: 'section' | 'label', value: string) {
    setOverrideItems(items => items.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  function removeOverrideItem(idx: number) {
    setOverrideItems(items => items.filter((_, i) => i !== idx).map((item, i) => ({ ...item, order: i })))
  }

  function moveOverrideItem(idx: number, dir: -1 | 1) {
    const newItems = [...overrideItems]
    const target = idx + dir
    if (target < 0 || target >= newItems.length) return
    ;[newItems[idx], newItems[target]] = [newItems[target], newItems[idx]]
    setOverrideItems(newItems.map((item, i) => ({ ...item, order: i })))
  }

  const openAddHotel = (siteId: string) => {
    setEditingHotel(null)
    setHotelSiteId(siteId)
    setHotelForm({ name: '', address: '', phone: '', note: '' })
    setShowHotelModal(true)
  }

  const openEditHotel = (hotel: Hotel) => {
    setEditingHotel(hotel)
    setHotelSiteId(hotel.siteId ?? '')
    setHotelForm({ name: hotel.name, address: hotel.address ?? '', phone: hotel.phone ?? '', note: hotel.note ?? '' })
    setShowHotelModal(true)
  }

  const handleHotelSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingHotel(true)
    const url = editingHotel ? `/api/hotels/${editingHotel.id}` : '/api/hotels'
    const method = editingHotel ? 'PUT' : 'POST'
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...hotelForm, customerId: id, siteId: hotelSiteId || null }),
    })
    await fetchHotels()
    setShowHotelModal(false)
    setSavingHotel(false)
  }

  const handleDeleteHotel = async (hotel: Hotel) => {
    if (!confirm(`Hotel "${hotel.name}" wirklich löschen?`)) return
    await fetch(`/api/hotels/${hotel.id}`, { method: 'DELETE' })
    await fetchHotels()
  }

  // --- Sites (Standorte) ---
  const openAddSite = () => {
    setEditingSite(null)
    setSiteForm({ name: '', address: '', zip: '', city: '', note: '' })
    setShowSiteModal(true)
  }

  const openEditSite = (site: Site) => {
    setEditingSite(site)
    setSiteForm({
      name: site.name,
      address: site.address ?? '',
      zip: site.zip ?? '',
      city: site.city ?? '',
      note: site.note ?? '',
    })
    setShowSiteModal(true)
  }

  const handleSiteSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingSite(true)
    const url = editingSite ? `/api/sites/${editingSite.id}` : '/api/sites'
    const method = editingSite ? 'PUT' : 'POST'
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...siteForm, customerId: id }),
    })
    await fetchCustomer()
    setShowSiteModal(false)
    setSavingSite(false)
  }

  const handleDeleteSite = async (site: Site) => {
    if (!confirm(`Standort "${site.name}" wirklich löschen? Anlagen werden zu „Nicht zugeordnet", Kontakte und Hotels dieses Standorts werden gelöscht.`)) return
    await fetch(`/api/sites/${site.id}`, { method: 'DELETE' })
    await Promise.all([fetchCustomer(), fetchHotels()])
  }

  const toggleSite = (siteId: string) =>
    setExpandedSites(prev => ({ ...prev, [siteId]: !prev[siteId] }))

  // --- Contacts (Ansprechpartner) ---
  const openAddContact = (level: ContactLevel, targetId: string | null) => {
    setEditingContact(null)
    setContactLevel(level)
    setContactTargetId(targetId)
    setContactForm(emptyContactForm)
    setShowContactModal(true)
  }

  const openEditContact = (contact: Contact) => {
    setEditingContact(contact)
    setContactLevel(contact.plantId ? 'plant' : contact.siteId ? 'site' : 'company')
    setContactTargetId(contact.plantId ?? contact.siteId ?? null)
    setContactForm({
      name: contact.name,
      role: contact.role ?? '',
      email: contact.email ?? '',
      phone: contact.phone ?? '',
      isPrimary: contact.isPrimary,
      note: contact.note ?? '',
      userId: contact.userId ?? '',
    })
    setShowContactModal(true)
  }

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingContact(true)
    const payload: Record<string, unknown> = {
      ...contactForm,
      customerId: id,
      siteId: contactLevel === 'site' ? contactTargetId : null,
      plantId: contactLevel === 'plant' ? contactTargetId : null,
    }
    const url = editingContact ? `/api/contacts/${editingContact.id}` : '/api/contacts'
    const method = editingContact ? 'PUT' : 'POST'
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    await fetchCustomer()
    setShowContactModal(false)
    setSavingContact(false)
  }

  const handleDeleteContact = async (contact: Contact) => {
    if (!confirm(`Ansprechpartner "${contact.name}" wirklich löschen?`)) return
    await fetch(`/api/contacts/${contact.id}`, { method: 'DELETE' })
    await fetchCustomer()
  }

  const startEdit = () => {
    if (!customer) return
    setEditForm({
      name: customer.name,
      email: customer.email ?? '',
      phone: customer.phone ?? '',
      address: customer.address ?? '',
    })
    setEditing(true)
  }

  const handleSave = async () => {
    setSaving(true)
    const res = await fetch(`/api/customers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    if (res.ok) {
      await fetchCustomer()
      setEditing(false)
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    setDeleting(true)
    setDeleteError(null)
    const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' })
    if (res.ok) {
      router.push('/customers')
    } else {
      const data = await res.json()
      setDeleteError(data.error ?? 'Fehler beim Löschen')
      setDeleting(false)
    }
  }

  const openAddPlant = (siteId = '') => {
    setEditingPlant(null)
    setPlantForm({ ...emptyPlantForm, siteId })
    setShowPlantModal(true)
  }

  const openEditPlant = (plant: Plant) => {
    setEditingPlant(plant)
    setPlantForm({
      name: plant.name,
      type: plant.type,
      serialNumber: plant.serialNumber ?? '',
      location: plant.location ?? '',
      installedAt: plant.installedAt ? plant.installedAt.slice(0, 10) : '',
      buildYear: plant.buildYear != null ? String(plant.buildYear) : '',
      description: plant.description ?? '',
      manufacturer: plant.manufacturer ?? '',
      model: plant.model ?? '',
      defaultTechnicianId: plant.defaultTechnicianId ?? '',
      externalUserIds: plant.externalUsers?.map(eu => eu.userId) ?? [],
      siteId: plant.siteId ?? '',
    })
    setShowPlantModal(true)
  }

  const handlePlantSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmittingPlant(true)
    const payload = {
      ...plantForm,
      customerId: id,
      siteId: plantForm.siteId || null,
      buildYear: plantForm.buildYear ? Number(plantForm.buildYear) : null,
      installedAt: plantForm.installedAt || null,
      defaultTechnicianId: plantForm.defaultTechnicianId || null,
      externalUserIds: plantForm.externalUserIds,
    }
    const url = editingPlant ? `/api/plants/${editingPlant.id}` : '/api/plants'
    const method = editingPlant ? 'PUT' : 'POST'
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    await fetchCustomer()
    setShowPlantModal(false)
    setSubmittingPlant(false)
  }

  const handleDeletePlant = async () => {
    if (!plantToDelete) return
    setDeletingPlant(true)
    setDeletePlantError(null)
    const res = await fetch(`/api/plants/${plantToDelete.id}`, { method: 'DELETE' })
    if (res.ok) {
      await fetchCustomer()
      setPlantToDelete(null)
    } else {
      const data = await res.json()
      setDeletePlantError(data.error ?? 'Fehler beim Löschen')
    }
    setDeletingPlant(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-sm text-gray-400">Laden...</div>
      </div>
    )
  }

  if (error || !customer) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="text-sm text-red-500">{error ?? 'Kunde nicht gefunden'}</div>
        <Link href="/customers" className="text-sm text-blue-600 hover:underline">Zurück zur Übersicht</Link>
      </div>
    )
  }

  const c = customer
  const showSiteSection = ['ADMIN', 'SERVICE_MANAGER', 'SERVICE_TECHNICIAN'].includes(role)
  const plantsBySite = (siteId: string | null) => c.plants.filter(p => (p.siteId ?? null) === siteId)
  const hotelsBySite = (siteId: string | null) => hotels.filter(h => (h.siteId ?? null) === siteId)
  const unassignedPlants = c.plants.filter(p => !p.siteId)
  const unassignedHotels = hotels.filter(h => !h.siteId)

  const renderContactRow = (contact: Contact) => (
    <div key={contact.id} className="flex items-start justify-between gap-2 py-1.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          {contact.isPrimary && (
            <svg className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-label="Hauptansprechpartner">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.367 2.446a1 1 0 00-.364 1.118l1.286 3.957c.3.922-.755 1.688-1.54 1.118l-3.366-2.446a1 1 0 00-1.175 0l-3.367 2.446c-.784.57-1.838-.196-1.539-1.118l1.286-3.957a1 1 0 00-.364-1.118L2.05 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" />
            </svg>
          )}
          <span className="font-medium text-gray-900 text-sm">{contact.name}</span>
          {contact.role && <span className="text-xs text-gray-500">· {contact.role}</span>}
          {contact.userId && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[10px] rounded-full" title="Mit Portal-Zugang verknüpft">
              Portal
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs">
          {contact.email && <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline">{contact.email}</a>}
          {contact.phone && <a href={`tel:${contact.phone}`} className="text-blue-600 hover:underline">{contact.phone}</a>}
          {!contact.email && !contact.phone && <span className="text-gray-300">keine Kontaktdaten</span>}
        </div>
        {contact.note && <div className="text-xs text-gray-400 italic mt-0.5">{contact.note}</div>}
      </div>
      {canEditDelete && (
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={() => openEditContact(contact)} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Bearbeiten">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          </button>
          <button onClick={() => handleDeleteContact(contact)} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Löschen">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>
      )}
    </div>
  )

  const renderContactsBlock = (contacts: Contact[], level: ContactLevel, targetId: string | null, label = 'Ansprechpartner') => (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</span>
        {canEditDelete && (
          <button onClick={() => openAddContact(level, targetId)} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Kontakt
          </button>
        )}
      </div>
      {contacts.length === 0
        ? <p className="text-xs text-gray-400 py-1">Kein Ansprechpartner hinterlegt.</p>
        : <div className="divide-y divide-gray-50">{contacts.map(renderContactRow)}</div>}
    </div>
  )

  const renderHotelCard = (hotel: Hotel) => (
    <div key={hotel.id} className="border border-gray-100 rounded-lg p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-900 text-sm truncate">{hotel.name}</div>
          {hotel.address && <div className="text-xs text-gray-600 mt-0.5">{hotel.address}</div>}
          {hotel.phone && <a href={`tel:${hotel.phone}`} className="text-xs text-blue-600 hover:underline mt-0.5 block">{hotel.phone}</a>}
          {hotel.note && <div className="text-[11px] text-gray-400 mt-1 italic">{hotel.note}</div>}
        </div>
        {canEditDelete && (
          <div className="flex gap-1 flex-shrink-0">
            <button onClick={() => openEditHotel(hotel)} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors" title="Bearbeiten">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            </button>
            <button onClick={() => handleDeleteHotel(hotel)} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Löschen">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          </div>
        )}
      </div>
    </div>
  )

  const renderPlantCard = (plant: Plant) => (
    <div key={plant.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="font-semibold text-gray-900">{plant.name}</div>
          <span className="inline-block mt-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">{plant.type}</span>
        </div>
        <div className="flex gap-1.5">
          {canEditDelete && (
            <button onClick={() => openChecklistEditor(plant)} className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors" title="Checkliste anpassen">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 8h.01M9 16h.01M15 12h-6" /></svg>
            </button>
          )}
          {canManagePlants && (
            <button onClick={() => openEditPlant(plant)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Bearbeiten">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            </button>
          )}
          {canEditDelete && (
            <button onClick={() => { setDeletePlantError(null); setPlantToDelete(plant) }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Löschen">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          )}
        </div>
      </div>

      <div className="space-y-1 text-sm">
        {(plant.manufacturer || plant.model) && (
          <div className="text-gray-600">{[plant.manufacturer, plant.model].filter(Boolean).join(' · ')}</div>
        )}
        {plant.buildYear && <div className="text-gray-500">Baujahr: {plant.buildYear}</div>}
        {plant.serialNumber && <div className="text-gray-500">Seriennummer: {plant.serialNumber}</div>}
        {plant.location && <div className="text-gray-500">Position: {plant.location}</div>}
        {plant.defaultTechnician && <div className="text-gray-500">Standardtechniker: {plant.defaultTechnician.name}</div>}
        {plant.description && <p className="text-gray-500 line-clamp-2 mt-2">{plant.description}</p>}
      </div>

      {showSiteSection && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          {renderContactsBlock(plant.contacts ?? [], 'plant', plant.id, 'Anlagen-Ansprechpartner')}
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-4">
        <Link href={`/jobs?customer=${c.id}`} className="text-xs text-blue-600 hover:underline">
          {plant._count?.jobPlants ?? 0} Einsätze
        </Link>
      </div>

      <PlantDocuments plantId={plant.id} customerId={c.id} role={role ?? ''} />
      {['ADMIN', 'SERVICE_MANAGER'].includes(role ?? '') && <PlantArchivedRequests plantId={plant.id} />}
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto">
      {/* Back */}
      <Link href="/customers" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Zurück zu Kunden
      </Link>

      {/* Customer info card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-8">
        <div className="flex items-start justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
          {canEditDelete && !editing && (
            <div className="flex gap-2">
              <button
                onClick={startEdit}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Bearbeiten
              </button>
              <button
                onClick={() => { setDeleteError(null); setShowDeleteModal(true) }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Löschen
              </button>
            </div>
          )}
        </div>

        {editing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Firmenname <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={editForm.name}
                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                required
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
              <input
                type="text"
                value={editForm.address}
                onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Speichern...' : 'Speichern'}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                Abbrechen
              </button>
            </div>
          </div>
        ) : (
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Firmenname</dt>
              <dd className="text-sm text-gray-900">{customer.name}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Personen</dt>
              <dd className="text-sm text-gray-900">{customer.users.length} angelegt</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">E-Mail</dt>
              <dd className="text-sm">
                {customer.email ? (
                  <a href={`mailto:${customer.email}`} className="text-blue-600 hover:underline">{customer.email}</a>
                ) : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Telefon</dt>
              <dd className="text-sm text-gray-900">{customer.phone ?? '—'}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Adresse</dt>
              <dd className="text-sm text-gray-900">{customer.address ?? '—'}</dd>
            </div>
          </dl>
        )}
      </div>

      {/* Persons section — visible to internal roles */}
      {['ADMIN', 'SERVICE_MANAGER', 'SERVICE_TECHNICIAN'].includes(role) && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Personen</h2>
            <span className="inline-flex items-center justify-center px-2.5 py-0.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">
              {customer.users.length}
            </span>
          </div>
          {customer.users.length === 0 ? (
            <p className="text-sm text-gray-400">Keine externen Benutzer angelegt. Benutzer können in der Benutzerverwaltung hinzugefügt werden.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 pr-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="text-left py-2 pr-4 text-xs font-medium text-gray-500 uppercase tracking-wider">E-Mail</th>
                    <th className="text-left py-2 pr-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Telefon</th>
                    <th className="text-left py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Ansprechpartner für</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {customer.users.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="py-2.5 pr-4 font-medium text-gray-900">{u.name}</td>
                      <td className="py-2.5 pr-4 text-gray-600">
                        {u.email ? (
                          <a href={`mailto:${u.email}`} className="text-blue-600 hover:underline">{u.email}</a>
                        ) : '—'}
                      </td>
                      <td className="py-2.5 pr-4 text-gray-600">{u.phone ?? '—'}</td>
                      <td className="py-2.5 text-gray-600">
                        {u.externalPlants.length > 0
                          ? u.externalPlants.map(ep => ep.plant.name).join(', ')
                          : <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Unternehmensweite Ansprechpartner — visible to internal roles */}
      {showSiteSection && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Unternehmensweite Ansprechpartner</h2>
            <span className="inline-flex items-center justify-center px-2.5 py-0.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">
              {c.contacts.length}
            </span>
          </div>
          {renderContactsBlock(c.contacts, 'company', null, 'Ansprechpartner (firmenweit)')}
        </div>
      )}

      {/* Standorte — visible to internal roles */}
      {showSiteSection && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-900">Standorte</h2>
              <span className="inline-flex items-center justify-center px-2.5 py-0.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">
                {c.sites.length}
              </span>
            </div>
            {canEditDelete && (
              <button
                onClick={openAddSite}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Standort hinzufügen
              </button>
            )}
          </div>

          {c.sites.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center text-sm text-gray-400">
              Noch keine Standorte angelegt.
            </div>
          ) : (
            <div className="space-y-4">
              {c.sites.map(site => {
                const sitePlants = plantsBySite(site.id)
                const siteHotels = hotelsBySite(site.id)
                const open = expandedSites[site.id] ?? false
                return (
                  <div key={site.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div
                      className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => toggleSite(site.id)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-900 truncate">{site.name}</div>
                          <div className="text-xs text-gray-500 truncate">
                            {[site.zip, site.city].filter(Boolean).join(' ') || site.address || '—'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="inline-flex items-center justify-center px-2.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                          {sitePlants.length} Anlagen
                        </span>
                        {canEditDelete && (
                          <>
                            <button
                              onClick={e => { e.stopPropagation(); openEditSite(site) }}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Standort bearbeiten"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); handleDeleteSite(site) }}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Standort löschen"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {open && (
                      <div className="border-t border-gray-100 px-5 py-4 space-y-5">
                        {(site.address || site.note) && (
                          <div className="text-sm text-gray-600">
                            {site.address && (
                              <div>{[site.address, [site.zip, site.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</div>
                            )}
                            {site.note && <div className="text-xs text-gray-400 italic mt-0.5">{site.note}</div>}
                          </div>
                        )}

                        {renderContactsBlock(site.contacts ?? [], 'site', site.id, 'Ansprechpartner (Standort)')}

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Hotels</span>
                            {canEditDelete && (
                              <button onClick={() => openAddHotel(site.id)} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                Hotel
                              </button>
                            )}
                          </div>
                          {siteHotels.length === 0
                            ? <p className="text-xs text-gray-400 py-1">Kein Hotel hinterlegt.</p>
                            : <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{siteHotels.map(renderHotelCard)}</div>}
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Anlagen</span>
                            {canManagePlants && (
                              <button onClick={() => openAddPlant(site.id)} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                Anlage
                              </button>
                            )}
                          </div>
                          {sitePlants.length === 0
                            ? <p className="text-xs text-gray-400">Keine Anlagen an diesem Standort.</p>
                            : <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{sitePlants.map(renderPlantCard)}</div>}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Nicht zugeordnet — Anlagen/Hotels ohne Standort */}
      {showSiteSection && (unassignedPlants.length > 0 || unassignedHotels.length > 0) && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-900">Nicht zugeordnet</h2>
              <span className="inline-flex items-center justify-center px-2.5 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                {unassignedPlants.length + unassignedHotels.length}
              </span>
            </div>
            {canManagePlants && (
              <button onClick={() => openAddPlant('')} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Anlage hinzufügen
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400 mb-3">Über „Bearbeiten“ einem Standort zuweisen.</p>
          {unassignedHotels.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">{unassignedHotels.map(renderHotelCard)}</div>
          )}
          {unassignedPlants.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{unassignedPlants.map(renderPlantCard)}</div>
          )}
        </div>
      )}

      {/* Fallback für externe Rollen ohne Standort-Verwaltung */}
      {!showSiteSection && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Anlagen</h2>
            <span className="inline-flex items-center justify-center px-2.5 py-0.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">
              {c.plants.length}
            </span>
          </div>
          {c.plants.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center text-sm text-gray-400">
              Keine Anlagen vorhanden
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{c.plants.map(renderPlantCard)}</div>
          )}
        </div>
      )}

      {/* Delete customer modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowDeleteModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Kunde löschen</h2>
            <p className="text-sm text-gray-600 mb-4">
              Wirklich löschen? Alle Anlagen werden ebenfalls gelöscht.
            </p>
            {deleteError && (
              <div className="mb-4 px-3 py-2 bg-red-50 text-red-700 text-sm rounded-lg">{deleteError}</div>
            )}
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleting ? 'Löschen...' : 'Löschen'}
              </button>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete plant modal */}
      {plantToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setPlantToDelete(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Anlage löschen</h2>
            <p className="text-sm text-gray-600 mb-4">
              Soll die Anlage &ldquo;{plantToDelete.name}&rdquo; wirklich gelöscht werden?
            </p>
            {deletePlantError && (
              <div className="mb-4 px-3 py-2 bg-red-50 text-red-700 text-sm rounded-lg">{deletePlantError}</div>
            )}
            <div className="flex gap-3">
              <button
                onClick={handleDeletePlant}
                disabled={deletingPlant}
                className="flex-1 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deletingPlant ? 'Löschen...' : 'Löschen'}
              </button>
              <button
                onClick={() => setPlantToDelete(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plant modal (add/edit) */}
      {showPlantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowPlantModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingPlant ? 'Anlage bearbeiten' : 'Neue Anlage'}
              </h2>
              <button onClick={() => setShowPlantModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handlePlantSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={plantForm.name}
                    onChange={e => setPlantForm(f => ({ ...f, name: e.target.value }))}
                    required
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Typ <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={plantForm.type}
                    onChange={e => setPlantForm(f => ({ ...f, type: e.target.value }))}
                    required
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Anlagentyp auswählen...</option>
                    {plantTypes.map(pt => (
                      <option key={pt.value} value={pt.value}>{pt.label}</option>
                    ))}
                  </select>
                  {plantForm.type && (plantTypes.find(p => p.value === plantForm.type)?.items.length ?? 0) > 0 ? (
                    <p className="mt-1 text-xs text-green-600">
                      ✓ Typspezifische Checkliste ({plantTypes.find(p => p.value === plantForm.type)!.items.length} Punkte) verfügbar
                    </p>
                  ) : plantForm.type ? (
                    <p className="mt-1 text-xs text-gray-400">Standard-Checkliste wird verwendet</p>
                  ) : null}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hersteller</label>
                  <input
                    type="text"
                    value={plantForm.manufacturer}
                    onChange={e => setPlantForm(f => ({ ...f, manufacturer: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Modell</label>
                  <input
                    type="text"
                    value={plantForm.model}
                    onChange={e => setPlantForm(f => ({ ...f, model: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Baujahr</label>
                  <input
                    type="number"
                    value={plantForm.buildYear}
                    onChange={e => setPlantForm(f => ({ ...f, buildYear: e.target.value }))}
                    min={1900}
                    max={2100}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Seriennummer</label>
                  <input
                    type="text"
                    value={plantForm.serialNumber}
                    onChange={e => setPlantForm(f => ({ ...f, serialNumber: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Standort</label>
                <select
                  value={plantForm.siteId}
                  onChange={e => setPlantForm(f => ({ ...f, siteId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Kein Standort —</option>
                  {customer.sites.map(s => (
                    <option key={s.id} value={s.id}>{s.name}{s.city ? ` (${s.city})` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Position (innerhalb des Standorts)</label>
                <input
                  type="text"
                  value={plantForm.location}
                  onChange={e => setPlantForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="z.B. Halle 3, Tor 2"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Installiert am</label>
                <input
                  type="date"
                  value={plantForm.installedAt}
                  onChange={e => setPlantForm(f => ({ ...f, installedAt: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
                <textarea
                  value={plantForm.description}
                  onChange={e => setPlantForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Standardtechniker (intern) */}
              {canManagePlants && internalTechs.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Standardtechniker (intern)</label>
                  <select
                    value={plantForm.defaultTechnicianId}
                    onChange={e => setPlantForm(f => ({ ...f, defaultTechnicianId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Kein Standardtechniker</option>
                    {internalTechs.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-400">Wird bei Einsatzerstellung vorgeschlagen.</p>
                </div>
              )}

              {/* Personen zuordnen */}
              {canManagePlants && customer && customer.users.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Personen zuordnen</label>
                  <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-40 overflow-y-auto">
                    {customer.users.map(u => {
                      const checked = plantForm.externalUserIds.includes(u.id)
                      return (
                        <label key={u.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => setPlantForm(f => ({
                              ...f,
                              externalUserIds: checked
                                ? f.externalUserIds.filter(uid => uid !== u.id)
                                : [...f.externalUserIds, u.id],
                            }))}
                            className="w-4 h-4 text-blue-600 rounded border-gray-300"
                          />
                          <span className="text-sm text-gray-800">{u.name}</span>
                          {u.email && <span className="text-xs text-gray-400 ml-auto">{u.email}</span>}
                        </label>
                      )
                    })}
                  </div>
                  <p className="mt-1 text-xs text-gray-400">Zugeordnete Personen können diese Anlage im Portal einsehen.</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submittingPlant}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {submittingPlant ? 'Speichern...' : editingPlant ? 'Speichern' : 'Anlage hinzufügen'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPlantModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Abbrechen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Per-plant checklist override modal */}
      {checklistPlant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setChecklistPlant(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Checkliste anpassen</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {checklistPlant.name} · {checklistPlant.type}
                  {overrideHasData && <span className="ml-2 px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">Angepasst</span>}
                </p>
              </div>
              <button onClick={() => setChecklistPlant(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 text-xs text-amber-700">
              Diese Checkliste ersetzt die Typ-Standardcheckliste für alle neuen Einsätze dieser Anlage.
              {overrideHasData && (
                <button onClick={resetOverride} className="ml-3 underline hover:no-underline">Auf Typ-Standard zurücksetzen</button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {loadingOverride ? (
                <div className="p-8 text-center text-sm text-gray-400">Laden...</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {overrideItems.length === 0 && (
                    <div className="p-8 text-center text-sm text-gray-400">
                      Noch keine Prüfpunkte. Klicke auf &quot;Prüfpunkt hinzufügen&quot;.
                    </div>
                  )}
                  {overrideItems.map((item, idx) => (
                    <div key={idx} className="px-5 py-3 flex items-center gap-3">
                      <div className="flex flex-col gap-0.5">
                        <button onClick={() => moveOverrideItem(idx, -1)} disabled={idx === 0} className="text-gray-300 hover:text-gray-500 disabled:opacity-20">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                        </button>
                        <button onClick={() => moveOverrideItem(idx, 1)} disabled={idx === overrideItems.length - 1} className="text-gray-300 hover:text-gray-500 disabled:opacity-20">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </button>
                      </div>
                      <span className="text-xs text-gray-400 w-6 text-center">{idx + 1}</span>
                      <input
                        type="text"
                        value={item.section}
                        onChange={e => updateOverrideItem(idx, 'section', e.target.value)}
                        placeholder="Abschnitt"
                        className="w-36 border border-gray-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                      />
                      <input
                        type="text"
                        value={item.label}
                        onChange={e => updateOverrideItem(idx, 'label', e.target.value)}
                        placeholder="Prüfpunkt-Beschreibung"
                        className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                      />
                      <button onClick={() => removeOverrideItem(idx)} className="text-red-400 hover:text-red-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 bg-gray-50">
              <button
                onClick={addOverrideItem}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-white"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Prüfpunkt hinzufügen
              </button>
              <div className="flex gap-2">
                <button onClick={() => setChecklistPlant(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
                  Schließen
                </button>
                <button
                  onClick={saveOverride}
                  disabled={savingOverride}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingOverride ? 'Speichert...' : 'Speichern'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hotel Modal */}
      {showHotelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">
                {editingHotel ? 'Hotel bearbeiten' : 'Hotel hinzufügen'}
              </h3>
              <button onClick={() => setShowHotelModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleHotelSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Standort <span className="text-red-500">*</span>
                </label>
                <select
                  value={hotelSiteId}
                  onChange={e => setHotelSiteId(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Standort auswählen...</option>
                  {customer.sites.map(s => (
                    <option key={s.id} value={s.id}>{s.name}{s.city ? ` (${s.city})` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={hotelForm.name}
                  onChange={e => setHotelForm(f => ({ ...f, name: e.target.value }))}
                  required
                  placeholder="z.B. Mercure Hotel Köln"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
                <input
                  type="text"
                  value={hotelForm.address}
                  onChange={e => setHotelForm(f => ({ ...f, address: e.target.value }))}
                  placeholder="Straße, PLZ Ort"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                <input
                  type="tel"
                  value={hotelForm.phone}
                  onChange={e => setHotelForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="0221 / 123456"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notiz</label>
                <textarea
                  value={hotelForm.note}
                  onChange={e => setHotelForm(f => ({ ...f, note: e.target.value }))}
                  rows={2}
                  placeholder="z.B. nur bei Einsätzen im Werk Nord"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={savingHotel}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {savingHotel ? 'Speichern...' : 'Speichern'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowHotelModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Abbrechen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Site Modal (add/edit) */}
      {showSiteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">
                {editingSite ? 'Standort bearbeiten' : 'Standort hinzufügen'}
              </h3>
              <button onClick={() => setShowSiteModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleSiteSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={siteForm.name}
                  onChange={e => setSiteForm(f => ({ ...f, name: e.target.value }))}
                  required
                  placeholder="z.B. Werk Nord"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
                <input
                  type="text"
                  value={siteForm.address}
                  onChange={e => setSiteForm(f => ({ ...f, address: e.target.value }))}
                  placeholder="Straße und Hausnummer"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">PLZ</label>
                  <input
                    type="text"
                    value={siteForm.zip}
                    onChange={e => setSiteForm(f => ({ ...f, zip: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ort</label>
                  <input
                    type="text"
                    value={siteForm.city}
                    onChange={e => setSiteForm(f => ({ ...f, city: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notiz</label>
                <textarea
                  value={siteForm.note}
                  onChange={e => setSiteForm(f => ({ ...f, note: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={savingSite} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
                  {savingSite ? 'Speichern...' : 'Speichern'}
                </button>
                <button type="button" onClick={() => setShowSiteModal(false)} className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors">
                  Abbrechen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Contact Modal (add/edit) */}
      {showContactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  {editingContact ? 'Ansprechpartner bearbeiten' : 'Ansprechpartner hinzufügen'}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {contactLevel === 'company' ? 'Firmenweit' : contactLevel === 'site' ? 'Standort-Ebene' : 'Anlagen-Ebene'}
                </p>
              </div>
              <button onClick={() => setShowContactModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleContactSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={contactForm.name}
                  onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rolle / Funktion</label>
                <input
                  type="text"
                  value={contactForm.role}
                  onChange={e => setContactForm(f => ({ ...f, role: e.target.value }))}
                  placeholder="z.B. Instandhaltungsleiter"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
                  <input
                    type="email"
                    value={contactForm.email}
                    onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                  <input
                    type="tel"
                    value={contactForm.phone}
                    onChange={e => setContactForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              {customer.users.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mit Portal-User verknüpfen</label>
                  <select
                    value={contactForm.userId}
                    onChange={e => setContactForm(f => ({ ...f, userId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">— Keine Verknüpfung —</option>
                    {customer.users.map(u => (
                      <option key={u.id} value={u.id}>{u.name}{u.email ? ` (${u.email})` : ''}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-400">Optional: Kennzeichnet, dass dieser Kontakt einen Portal-Zugang hat.</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notiz</label>
                <textarea
                  value={contactForm.note}
                  onChange={e => setContactForm(f => ({ ...f, note: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={contactForm.isPrimary}
                  onChange={e => setContactForm(f => ({ ...f, isPrimary: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">Als Hauptansprechpartner markieren</span>
              </label>
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={savingContact} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
                  {savingContact ? 'Speichern...' : 'Speichern'}
                </button>
                <button type="button" onClick={() => setShowContactModal(false)} className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors">
                  Abbrechen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Archivierte Anfragen ohne Anlage — Admin und Service Manager */}
      {canManagePlants && customer && (
        <CustomerArchivedRequests customerId={customer.id} />
      )}

      {/* Rechnungen — nur für Admin und Service Manager */}
      {canManageInvoices && customer && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mt-6">
          <InvoicePanel customerId={customer.id} canUpload={canManageInvoices} />
        </div>
      )}
    </div>
  )
}
