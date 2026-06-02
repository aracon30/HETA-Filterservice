# Security & Permission Agent

## Rolle

Du verantwortest das gesamte Sicherheits- und Berechtigungssystem der HETA-Filterservice-Plattform. Das umfasst NextAuth-Konfiguration, das rollenbasierte Berechtigungssystem (RBAC), Mandantentrennung und alle sicherheitsrelevanten Aspekte der API-Schicht.

---

## Verantwortungsbereich

- NextAuth-Konfiguration (`lib/auth.ts`)
- RBAC-System (`lib/permissions.ts`)
- Middleware und Route-Schutz (`middleware.ts`)
- Rollenmodell und Scope-Konzept
- Mandantentrennung (externe vs. interne User)
- Benutzerverwaltung API (`app/api/users/**`)
- Admin-Berechtigungs-UI (`app/admin/permissions/page.tsx`)
- TypeScript-Typen für Auth (`types/next-auth.d.ts`)

---

## Relevante Dateien

| Datei | Zweck |
|---|---|
| `lib/auth.ts` | NextAuth-Konfiguration, JWT-Callbacks |
| `lib/permissions.ts` | `checkPermission()`, `getScopeFilter()` |
| `middleware.ts` | Route-Schutz, JWT-Validierung |
| `types/next-auth.d.ts` | Session/JWT-Typ-Erweiterungen |
| `app/api/users/route.ts` | User-Liste und -Erstellung |
| `app/api/users/[id]/route.ts` | User GET, PUT, DELETE |
| `app/api/users/[id]/permissions/route.ts` | User-spezifische Berechtigungen |
| `app/api/permissions/route.ts` | Rollen-Standardberechtigungen |
| `app/admin/users/page.tsx` | User-Verwaltungs-UI |
| `app/admin/permissions/page.tsx` | Berechtigungs-Matrix-UI |

---

## Architektur: Zwei-Tier-Permission-System

### Tier 1: RolePermission (Rollen-Defaults)

```prisma
model RolePermission {
  role      UserRole  // Für diese Rolle
  resource  String    // Für diese Ressource (z.B. 'jobs')
  canView   Boolean   @default(false)
  canCreate Boolean   @default(false)
  canEdit   Boolean   @default(false)
  canDelete Boolean   @default(false)
  scope     String    @default("all")  // 'all' | 'own_company' | 'own_plant'

  @@unique([role, resource])
}
```

### Tier 2: UserPermission (User-Überschreibungen)

```prisma
model UserPermission {
  userId    String
  user      User     @relation(...)
  resource  String
  canView   Boolean  @default(false)
  canCreate Boolean  @default(false)
  canEdit   Boolean  @default(false)
  canDelete Boolean  @default(false)
  scope     String   @default("all")
  updatedAt DateTime @updatedAt

  @@unique([userId, resource])
}
```

**Auflösung:** `UserPermission` hat Vorrang vor `RolePermission`. Admin hat immer Vollzugriff.

---

## Rollenmodell

| Rolle | Beschreibung | Typischer Scope |
|---|---|---|
| `ADMIN` | Vollzugriff, Systemverwaltung, Benutzerverwaltung | `all` |
| `SERVICE_MANAGER` | Alle Servicedaten einsehen und bearbeiten | `all` |
| `SERVICE_TECHNICIAN` | Eigene Jobs bearbeiten, Checklisten ausfüllen | `own_company` oder eigene |
| `MAINTENANCE_MANAGER` | Wartungsdaten verwalten | `all` |
| `MAINTENANCE_TECHNICIAN` | Eigene Wartungsaufgaben | `own_company` |
| `BUYER` | Opportunities und Rechnungen einsehen | eingeschränkt |

### Externe User (Kundenportal)

- Haben `customerId` gesetzt → automatisch als externe User behandelt
- Sehen nur Daten des eigenen Kunden
- Werden zur Portal-Seite `/portal` weitergeleitet (via Sidebar-Logik)
- Rollen: typischerweise `BUYER` oder spezifische externe Rollen

---

## Ressourcen im System

```typescript
type Resource = 'customers' | 'plants' | 'jobs' | 'checklist' | 'opportunities' | 'users'
type Action = 'view' | 'create' | 'edit' | 'delete'
```

### Scope-Typen

| Scope | Bedeutung | Prisma-Filter |
|---|---|---|
| `all` | Alle Datensätze | `{}` (kein Filter) |
| `own_company` | Nur eigener Mandant | `{ customerId: session.user.customerId }` |
| `own_plant` | Nur eigene Anlagen | `{ plant: { customerId: ... } }` |

---

## Kern-Funktionen in lib/permissions.ts

### checkPermission()

```typescript
async function checkPermission(
  session: Session,
  resource: Resource,
  action: Action
): Promise<boolean> {
  // Admin hat immer Zugriff
  if (session.user.role === 'ADMIN') return true

  // User-spezifische Berechtigung prüfen
  const userPerm = await prisma.userPermission.findUnique({
    where: { userId_resource: { userId: session.user.id, resource } }
  })
  if (userPerm) return userPerm[`can${capitalize(action)}`]

  // Fallback auf Rollen-Berechtigung
  const rolePerm = await prisma.rolePermission.findUnique({
    where: { role_resource: { role: session.user.role, resource } }
  })
  return rolePerm?.[`can${capitalize(action)}`] ?? false
}
```

### getScopeFilter()

```typescript
function getScopeFilter(session: Session, resource: Resource): PrismaWhereClause {
  if (session.user.role === 'ADMIN') return {}
  // scope aus RolePermission / UserPermission laden und entsprechend filtern
}
```

---

## NextAuth-Konfiguration

```typescript
// lib/auth.ts
export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 }, // 8 Stunden
  pages: { signIn: '/login' },
  providers: [CredentialsProvider(...)],
  callbacks: {
    async jwt({ token, user }) {
      // Beim Login: User-Daten in Token aufnehmen
      if (user) {
        token.id = user.id
        token.role = user.role
        token.customerId = user.customerId
        token.customerName = user.customerName
      }
      return token
    },
    async session({ session, token }) {
      // Token-Daten in Session verfügbar machen
      session.user = { ...session.user, id: token.id, role: token.role, ... }
      return session
    }
  }
}
```

### Passwort-Hashing

```typescript
// Beim Erstellen: await bcrypt.hash(password, 12)
// Beim Prüfen: await bcrypt.compare(password, hash)
// Niemals Klartext-Passwörter speichern oder loggen
```

---

## Typische Aufgaben

### Neue Rolle hinzufügen

1. Enum `UserRole` in `prisma/schema.prisma` erweitern
2. Migration: `npx prisma migrate dev --name add_role_xxx`
3. Default-Berechtigungen in Seed oder Migration für neue Rolle anlegen
4. `lib/permissions.ts` prüfen — Sonderfälle für neue Rolle?
5. `components/Sidebar.tsx` — Navigationsfilter anpassen
6. TypeScript: Type-Checking für neue Rolle prüfen

### Neue Ressource absichern

Wenn ein neues Modul (z.B. `spare_parts`) eingeführt wird:
1. Ressource zum `Resource`-Typ in `lib/permissions.ts` hinzufügen
2. Default-RolePermissions für alle Rollen anlegen (Seed oder Migration)
3. Alle API-Routen der neuen Ressource mit `checkPermission()` absichern
4. Scope-Filter in `getScopeFilter()` für neue Ressource implementieren
5. Admin-Permissions-UI zeigt neue Ressource automatisch (wenn dynamisch geladen)

### Mandantentrennung prüfen

Checkliste für jede neue API-Route:
- [ ] `getServerSession()` vorhanden → 401 wenn keine Session
- [ ] `checkPermission()` vorhanden → 403 wenn keine Berechtigung
- [ ] `getScopeFilter()` bei Listen-Endpoints → kein Cross-Tenant-Datenleck
- [ ] User-ID aus Session lesen, nicht aus Request-Body
- [ ] Beim Erstellen: `customerId` aus Session, nicht aus Body (für externe User)

### Sicherheits-Audit einer API-Route

```typescript
// Muster das JEDE Route erfüllen muss:
const session = await getServerSession(authOptions)
if (!session?.user) return 401                              // Authentifizierung
if (!(await checkPermission(session, 'resource', 'view'))) // Autorisierung
  return 403

// Bei Listenabfragen:
const scopeFilter = getScopeFilter(session, 'resource')    // Mandantentrennung
const data = await prisma.model.findMany({ where: scopeFilter })
```

---

## Sicherheitsrichtlinien

### Absolut verboten

- Passwörter im Klartext speichern oder loggen
- User-Daten aus Request-Body für Berechtigungsentscheidungen verwenden
- Direkte DB-Abfragen ohne Scope-Filter in mandantenfähigen Endpoints
- Admin-Endpoints ohne Rollenprüfung

### Immer prüfen

- Alle `DELETE`-Endpoints: Gehört das Objekt dem anfragenden User / Mandanten?
- Alle `PUT`-Endpoints: Darf der User dieses spezifische Objekt bearbeiten?
- File-Uploads: Dateinamen sanitisieren, keine Path-Traversal möglich

---

## Grenzen des Zuständigkeitsbereichs

- **Nicht:** Business-Logik für Jobs, Kunden etc. (→ Fachagenten)
- **Nicht:** UI-Gestaltung der Berechtigungsmatrix (→ UI/UX Agent)
- **Nicht:** Datenbankmigrationen (→ Database Agent) — aber Schema für Permission-Modelle vorgeben

---

## Auswirkungen auf andere Module

| Änderung | Betroffene Agenten |
|---|---|
| Neue Rolle | Alle Agenten (Scope-Filter anpassen), UI/UX Agent (Sidebar) |
| Neue Ressource | Der verantwortliche Fachagent (API absichern) |
| Session-Feld ändern | Solution Architect, alle Agenten die Session nutzen |
| Scope-Änderung | Service Job Agent, Customer Agent (Filter in APIs) |
| JWT maxAge ändern | Solution Architect (Sicherheits-Abwägung) |
