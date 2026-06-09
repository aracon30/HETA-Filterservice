// NO top-level @react-pdf/renderer imports — all loaded dynamically inside
// renderServiceReportPDF() so that static and dynamic imports share the same
// ESM instance. Mixing static (CJS via serverExternalPackages) and dynamic
// (ESM) imports of @react-pdf causes "Eh.component is not a constructor".

export interface ReportData {
  orderNumber: string
  scheduledAt: string
  completedAt: string | null
  customer: {
    name: string
    address: string | null
    contactName: string | null
    email: string | null
    phone: string | null
  }
  plants: {
    name: string
    type: string
    serialNumber: string | null
    location: string | null
    manufacturer: string | null
    model: string | null
    buildYear: number | null
  }[]
  technicians: { userName: string }[]
  vehicles: string[]
  description: string | null
  findings: string | null
  recommendations: string | null
  workTimeEntries: { date: string; startTime: string; endTime: string }[] | null
  checklistItems: {
    id: string
    label: string
    section: string | null
    status: string
    comment: string | null
    photoUrl: string | null
  }[]
  technicianSignature: string | null
  customerSignature: string | null
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export async function renderServiceReportPDF(data: ReportData): Promise<Buffer> {
  // All @react-pdf imports inside this function — ensures a single ESM instance
  const ReactPDF = await import('@react-pdf/renderer')
  const {
    Document, Page, Text, View, Image, StyleSheet,
    renderToBuffer,
  } = ReactPDF as typeof import('@react-pdf/renderer') & {
    renderToBuffer: (element: unknown) => Promise<Buffer>
  }

  const s = StyleSheet.create({
    page: {
      fontFamily: 'Helvetica',
      fontSize: 9,
      color: '#1f2937',
      paddingTop: 40,
      paddingBottom: 50,
      paddingHorizontal: 40,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 20,
      paddingBottom: 14,
      borderBottomWidth: 2,
      borderBottomColor: '#1d4ed8',
    },
    companyName: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#1d4ed8', letterSpacing: 1 },
    companyTagline: { fontSize: 8, color: '#6b7280', marginTop: 2 },
    headerRight: { alignItems: 'flex-end' },
    reportTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#1f2937' },
    orderNumber: { fontSize: 10, color: '#4b5563', marginTop: 2 },
    infoGrid: { flexDirection: 'row', gap: 12, marginBottom: 14 },
    infoBox: {
      flex: 1, backgroundColor: '#f9fafb', borderRadius: 4,
      padding: 10, borderWidth: 1, borderColor: '#e5e7eb',
    },
    infoBoxTitle: {
      fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#6b7280',
      textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5,
    },
    infoRow: { flexDirection: 'row', marginBottom: 3 },
    infoLabel: { fontSize: 8, color: '#6b7280', width: 70 },
    infoValue: { fontSize: 8, color: '#1f2937', flex: 1, fontFamily: 'Helvetica-Bold' },
    sectionHeader: {
      backgroundColor: '#1d4ed8', padding: '5 10', borderRadius: 3,
      marginBottom: 6, marginTop: 12,
    },
    sectionHeaderText: {
      fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#ffffff',
      textTransform: 'uppercase', letterSpacing: 0.5,
    },
    subSection: {
      fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#374151',
      marginBottom: 4, marginTop: 6, paddingBottom: 2,
      borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
    },
    tableHeader: {
      flexDirection: 'row', backgroundColor: '#f3f4f6',
      padding: '4 6', borderTopLeftRadius: 3, borderTopRightRadius: 3,
    },
    tableHeaderText: {
      fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#6b7280',
      textTransform: 'uppercase', letterSpacing: 0.3,
    },
    tableRow: {
      flexDirection: 'row', padding: '4 6',
      borderBottomWidth: 1, borderBottomColor: '#f3f4f6', alignItems: 'flex-start',
    },
    tableRowAlt: { backgroundColor: '#fafafa' },
    colStatus: { width: 40 },
    colLabel: { flex: 1 },
    colComment: { width: 130 },
    badgeIO: { backgroundColor: '#dcfce7', padding: '2 5', borderRadius: 3 },
    badgeNIO: { backgroundColor: '#fee2e2', padding: '2 5', borderRadius: 3 },
    badgeOpen: { backgroundColor: '#f3f4f6', padding: '2 5', borderRadius: 3 },
    badgeIOText: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#15803d' },
    badgeNIOText: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#dc2626' },
    badgeOpenText: { fontSize: 7, color: '#9ca3af' },
    textBlock: {
      backgroundColor: '#f9fafb', borderRadius: 4, padding: 10,
      borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 8,
    },
    textBlockLabel: {
      fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#6b7280',
      textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
    },
    textBlockContent: { fontSize: 9, color: '#1f2937', lineHeight: 1.5 },
    wtTable: { marginTop: 4 },
    wtRow: {
      flexDirection: 'row', borderBottomWidth: 1,
      borderBottomColor: '#f3f4f6', padding: '3 6',
    },
    wtCol: { flex: 1, fontSize: 8 },
    signatureGrid: { flexDirection: 'row', gap: 12, marginTop: 8 },
    signatureBox: {
      flex: 1, borderWidth: 1, borderColor: '#e5e7eb',
      borderRadius: 4, padding: 8, minHeight: 80,
    },
    signatureLabel: {
      fontSize: 7, color: '#6b7280', marginBottom: 4,
      fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.3,
    },
    signatureImage: { width: '100%', height: 60, objectFit: 'contain' },
    statsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    statBox: { flex: 1, borderRadius: 4, padding: 8, alignItems: 'center' },
    statNumber: { fontSize: 18, fontFamily: 'Helvetica-Bold' },
    statLabel: { fontSize: 7, color: '#6b7280', marginTop: 2 },
    footer: {
      position: 'absolute', bottom: 20, left: 40, right: 40,
      flexDirection: 'row', justifyContent: 'space-between',
      borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 6,
    },
    footerText: { fontSize: 7, color: '#9ca3af' },
    photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4, marginBottom: 4 },
    photoThumb: { width: 60, height: 60, borderRadius: 3, objectFit: 'cover' },
  })

  type Items = ReportData['checklistItems']

  function ChecklistSection({ title, items }: { title: string; items: Items }) {
    const photos = items.filter(i => i.photoUrl)
    return (
      <View>
        <View style={s.subSection}><Text>{title}</Text></View>
        <View style={s.tableHeader}>
          <Text style={[s.tableHeaderText, s.colStatus]}>Status</Text>
          <Text style={[s.tableHeaderText, s.colLabel]}>Prüfpunkt</Text>
          <Text style={[s.tableHeaderText, s.colComment]}>Bemerkung</Text>
        </View>
        {items.map((item, idx) => (
          <View key={item.id} style={[s.tableRow, idx % 2 === 1 ? s.tableRowAlt : {}]}>
            <View style={s.colStatus}>
              {item.status === 'io'
                ? <View style={s.badgeIO}><Text style={s.badgeIOText}>i.O.</Text></View>
                : item.status === 'nio'
                ? <View style={s.badgeNIO}><Text style={s.badgeNIOText}>n.i.O.</Text></View>
                : <View style={s.badgeOpen}><Text style={s.badgeOpenText}>—</Text></View>
              }
            </View>
            <View style={s.colLabel}>
              <Text style={{ fontSize: 8, color: item.status === 'nio' ? '#dc2626' : '#1f2937', fontFamily: item.status === 'nio' ? 'Helvetica-Bold' : 'Helvetica' }}>
                {item.label}
              </Text>
            </View>
            <Text style={[{ fontSize: 8, color: '#6b7280', fontStyle: 'italic' }, s.colComment]}>
              {item.comment ?? ''}
            </Text>
          </View>
        ))}
        {photos.length > 0 && (
          <View style={s.photoRow}>
            {photos.map(item => (
              <Image key={item.id} src={item.photoUrl!} style={s.photoThumb} />
            ))}
          </View>
        )}
      </View>
    )
  }

  const groups: Record<string, Items> = {}
  for (const item of data.checklistItems) {
    const key = item.section ?? 'Allgemein'
    if (!groups[key]) groups[key] = []
    groups[key].push(item)
  }

  const total = data.checklistItems.length
  const io    = data.checklistItems.filter(i => i.status === 'io').length
  const nio   = data.checklistItems.filter(i => i.status === 'nio').length
  const open  = data.checklistItems.filter(i => i.status === 'open').length
  const technicianNames = data.technicians.map(t => t.userName).join(', ') || '—'
  const now = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const element = (
    <Document title={`Servicebericht ${data.orderNumber}`} author="HETA Filterservice" subject="Inspektionsbericht">
      <Page size="A4" style={s.page}>

        <View style={s.header} fixed>
          <View>
            <Text style={s.companyName}>HETA</Text>
            <Text style={s.companyTagline}>Filterservice</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.reportTitle}>Servicebericht</Text>
            <Text style={s.orderNumber}>{data.orderNumber}</Text>
          </View>
        </View>

        <View style={s.infoGrid}>
          <View style={s.infoBox}>
            <Text style={s.infoBoxTitle}>Kunde</Text>
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Name</Text>
              <Text style={s.infoValue}>{data.customer.name}</Text>
            </View>
            {data.customer.contactName && (
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Ansprechpartner</Text>
                <Text style={s.infoValue}>{data.customer.contactName}</Text>
              </View>
            )}
            {data.customer.address && (
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Adresse</Text>
                <Text style={s.infoValue}>{data.customer.address}</Text>
              </View>
            )}
          </View>

          <View style={s.infoBox}>
            <Text style={s.infoBoxTitle}>Einsatz</Text>
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Auftragsnummer</Text>
              <Text style={s.infoValue}>{data.orderNumber}</Text>
            </View>
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Geplant am</Text>
              <Text style={s.infoValue}>{fmtDateTime(data.scheduledAt)}</Text>
            </View>
            {data.completedAt && (
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Abgeschlossen</Text>
                <Text style={s.infoValue}>{fmtDateTime(data.completedAt)}</Text>
              </View>
            )}
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Techniker</Text>
              <Text style={s.infoValue}>{technicianNames}</Text>
            </View>
            {data.vehicles.length > 0 && (
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Fahrzeuge</Text>
                <Text style={s.infoValue}>{data.vehicles.join(', ')}</Text>
              </View>
            )}
          </View>
        </View>

        {data.plants.length > 0 && (
          <View style={{ marginBottom: 12 }}>
            <Text style={[s.infoBoxTitle, { marginBottom: 4 }]}>Geprüfte Anlagen</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {data.plants.map((p, idx) => (
                <View key={idx} style={[s.infoBox, { flex: 0, minWidth: 180 }]}>
                  <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#1f2937', marginBottom: 3 }}>{p.name}</Text>
                  <Text style={{ fontSize: 8, color: '#6b7280' }}>{p.type}{p.serialNumber ? ` · SN: ${p.serialNumber}` : ''}</Text>
                  {p.location   && <Text style={{ fontSize: 8, color: '#6b7280' }}>Standort: {p.location}</Text>}
                  {p.manufacturer && <Text style={{ fontSize: 8, color: '#6b7280' }}>Hersteller: {p.manufacturer}{p.model ? ` ${p.model}` : ''}</Text>}
                  {p.buildYear  && <Text style={{ fontSize: 8, color: '#6b7280' }}>Baujahr: {p.buildYear}</Text>}
                </View>
              ))}
            </View>
          </View>
        )}

        {data.description && (
          <View style={s.textBlock}>
            <Text style={s.textBlockLabel}>Auftragsbeschreibung</Text>
            <Text style={s.textBlockContent}>{data.description}</Text>
          </View>
        )}

        <View style={s.statsRow}>
          <View style={[s.statBox, { backgroundColor: '#f3f4f6' }]}>
            <Text style={[s.statNumber, { color: '#1f2937' }]}>{total}</Text>
            <Text style={s.statLabel}>Gesamt geprüft</Text>
          </View>
          <View style={[s.statBox, { backgroundColor: '#dcfce7' }]}>
            <Text style={[s.statNumber, { color: '#15803d' }]}>{io}</Text>
            <Text style={s.statLabel}>In Ordnung</Text>
          </View>
          <View style={[s.statBox, { backgroundColor: nio > 0 ? '#fee2e2' : '#f3f4f6' }]}>
            <Text style={[s.statNumber, { color: nio > 0 ? '#dc2626' : '#9ca3af' }]}>{nio}</Text>
            <Text style={s.statLabel}>Nicht in Ordnung</Text>
          </View>
          {open > 0 && (
            <View style={[s.statBox, { backgroundColor: '#fef9c3' }]}>
              <Text style={[s.statNumber, { color: '#ca8a04' }]}>{open}</Text>
              <Text style={s.statLabel}>Nicht geprüft</Text>
            </View>
          )}
        </View>

        {Object.keys(groups).length > 0 && (
          <View>
            <View style={s.sectionHeader}>
              <Text style={s.sectionHeaderText}>Inspektionsbericht</Text>
            </View>
            {Object.entries(groups).map(([section, items]) => (
              <ChecklistSection key={section} title={section} items={items} />
            ))}
          </View>
        )}

        {(data.findings || data.recommendations) && (
          <View>
            <View style={s.sectionHeader}>
              <Text style={s.sectionHeaderText}>Befunde & Empfehlungen</Text>
            </View>
            {data.findings && (
              <View style={s.textBlock}>
                <Text style={s.textBlockLabel}>Befunde</Text>
                <Text style={s.textBlockContent}>{data.findings}</Text>
              </View>
            )}
            {data.recommendations && (
              <View style={s.textBlock}>
                <Text style={s.textBlockLabel}>Empfehlungen</Text>
                <Text style={s.textBlockContent}>{data.recommendations}</Text>
              </View>
            )}
          </View>
        )}

        {data.workTimeEntries && data.workTimeEntries.length > 0 && (
          <View>
            <View style={s.sectionHeader}>
              <Text style={s.sectionHeaderText}>Geleistete Arbeitszeit</Text>
            </View>
            <View style={s.wtTable}>
              <View style={[s.wtRow, { backgroundColor: '#f3f4f6' }]}>
                <Text style={[s.wtCol, { fontFamily: 'Helvetica-Bold', fontSize: 7, color: '#6b7280', textTransform: 'uppercase' }]}>Datum</Text>
                <Text style={[s.wtCol, { fontFamily: 'Helvetica-Bold', fontSize: 7, color: '#6b7280', textTransform: 'uppercase' }]}>Beginn</Text>
                <Text style={[s.wtCol, { fontFamily: 'Helvetica-Bold', fontSize: 7, color: '#6b7280', textTransform: 'uppercase' }]}>Ende</Text>
              </View>
              {data.workTimeEntries.map((e, i) => (
                <View key={i} style={[s.wtRow, i % 2 === 1 ? { backgroundColor: '#fafafa' } : {}]}>
                  <Text style={s.wtCol}>{fmtDate(e.date)}</Text>
                  <Text style={s.wtCol}>{e.startTime}</Text>
                  <Text style={s.wtCol}>{e.endTime}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={{ marginTop: 16 }}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionHeaderText}>Unterschriften</Text>
          </View>
          <View style={s.signatureGrid}>
            <View style={s.signatureBox}>
              <Text style={s.signatureLabel}>Techniker · {technicianNames}</Text>
              {data.technicianSignature
                ? <Image src={data.technicianSignature} style={s.signatureImage} />
                : <Text style={{ fontSize: 8, color: '#9ca3af', marginTop: 10 }}>Keine Unterschrift</Text>
              }
            </View>
            <View style={s.signatureBox}>
              <Text style={s.signatureLabel}>Kunde · {data.customer.name}</Text>
              {data.customerSignature
                ? <Image src={data.customerSignature} style={s.signatureImage} />
                : <Text style={{ fontSize: 8, color: '#9ca3af', marginTop: 10 }}>Keine Unterschrift</Text>
              }
            </View>
          </View>
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>HETA Filterservice · {data.orderNumber}</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Seite ${pageNumber} von ${totalPages}`} />
          <Text style={s.footerText}>Erstellt am {now}</Text>
        </View>

      </Page>
    </Document>
  )

  return renderToBuffer(element as never)
}
