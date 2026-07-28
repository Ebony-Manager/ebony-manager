# CLAUDE.md — Ebony Custom Woodwork App

## Project Overview

**App Name:** Ebony Manager  
**Company:** Ebony Custom Woodwork — empresa de ebanistería especializada en muebles custom made (melamina, MDF, pintura, y otros materiales). Principales productos: closets, cocinas, camas, muebles de TV, panelería, cielos rasos, entre otros.  
**Primary Clients:** Diseñadoras de interiores y sus clientes finales.  
**Stack:** React + Tailwind CSS, Google Sheets as backend, Google OAuth authentication, deployed on Vercel.  
**Languages:** Spanish (primary UI), English (secondary — bilingual support required throughout).  
**Access:** Responsive design — must work equally well on desktop (office) and mobile (field installers).  
**Users:** ~15–20 internal users. No role-based permissions for now — all authenticated users see all modules. Permissions system to be added in a future phase.  
**Authentication:** Google OAuth (same Google account domain used for Sheets backend).

---

## Architecture

### Backend: Google Sheets
- One master Google Spreadsheet per major data domain (see sheet list below).
- All reads/writes via Google Sheets API v4 (service account or OAuth token).
- Sheet names and column headers are treated as the source of truth — do not rename without updating the app.

### Frontend: React + Tailwind CSS
- Single Page Application (SPA).
- Sidebar navigation with module tabs.
- Bilingual toggle (ES/EN) — all labels, buttons, and headings must have both language versions.
- Color palette and brand: dark wood tones (#2C1A0E, #5C3A1E), warm whites (#FAF7F2), and gold accents (#C9A84C). Typography: clean sans-serif (Inter or similar).

### Deployment: Vercel
- Environment variables stored in Vercel dashboard (never hardcoded).
- Google Sheets API credentials stored as env vars.

---

## Google Sheets Structure

### Sheet 1: `Proyectos`
| Column | Description |
|---|---|
| ID_Proyecto | Unique project ID (auto-generated) |
| Cliente | Client name |
| Diseñadora | Interior designer name (optional) |
| Descripcion | Short project description |
| Fecha_Inicio | Start date |
| Fecha_Entrega_Estimada | Estimated delivery date |
| Fecha_Entrega_Real | Actual delivery date |
| Status | Active / En Taller / En Instalación / Entregado / Cancelado |
| Prioridad | Alta / Media / Baja |
| Cotizacion_Total | Total quoted amount (USD) |
| Notas | Open notes field |

### Sheet 2: `Cotizaciones`
| Column | Description |
|---|---|
| ID_Cotizacion | Unique quote ID |
| ID_Proyecto | FK → Proyectos |
| Fecha | Quote date |
| Item | Item name (e.g. Closet, Cocina, Cama) |
| Categoria | Category (e.g. Melamina, MDF, Pintura) |
| M2 | Square meters |
| Precio_M2 | Price per m² (USD) |
| Subtotal | Auto-calculated (M2 × Precio_M2) |
| Descuento | Discount % |
| Total | Final line total |
| Status | Borrador / Enviada / Aprobada / Rechazada |

### Sheet 3: `Precios_Referencia`

This sheet stores the **output cost per reference unit** for each item type and material combination. Prices are derived from the internal cost calculator (which accounts for laminas, waste, canteo, labor %, hardware) — the app does NOT need to replicate the calculator logic; it simply reads the final `Costo_Total` per item and applies it to the quantity entered by the user.

| Column | Description |
|---|---|
| ID_Item | Unique item ID |
| Categoria | Main category: Módulo / Gaveta / Tablilla / Puerta de Closet / Revestimiento |
| Subcategoria | Variant: Liso / +Listones 2cm / +Listones 5.5cm / Rengrosada / etc. |
| Material | Aglomerado / MDF Pintado / Chapilla |
| Unidad | m² or unidad (per-piece items like gavetas) |
| Costo_Total_USD | Final cost per unit (output from the cost calculator) |
| Margen_Utilidad_Pct | Default suggested margin % (reference only — overridden per quote) |
| Precio_Venta_USD | Auto-calculated: Costo_Total × (1 + Margen) — recalculated live in the quote form |
| Ultima_Actualizacion | Date last updated |
| Notas | Notes on supplier price changes |

**Current item catalog (from cost calculator — to be loaded into this sheet):**

The catalog covers standard items with defined cost formulas. However, Ebony regularly produces custom or one-off pieces (mesitas de noche, tablilleros, panelados curvos, bufeteras, etc.) that may not fit a standard template. The `Precios_Referencia` sheet supports both:
- **Catalog items:** standard items with pre-calculated `Costo_Total_USD` (closet modules, gavetas, puertas, revestimientos, etc.)
- **Custom items:** admin can add new rows at any time with a manual `Costo_Total_USD` — no formula required. The quotation form allows selecting any row from this sheet OR creating a free-form line item with a custom name and price.

| Categoria | Subcategoria | Material | Costo_Total ref. |
|---|---|---|---|
| Módulo | Estándar | Aglomerado | $194.24 / mueble 1×2.4m |
| Módulo | Estándar | MDF Pintado | (calculated) |
| Módulo | Estándar | Chapilla | $210.45 / mueble 1×2.4m |
| Gaveta | Formato 1×0.50×0.20 | Aglomerado | $71.53 |
| Gaveta | Formato 1×0.50×0.20 | MDF Pintado | $46.53 |
| Gaveta | Formato 0.50×0.50×0.20 | Aglomerado | (calculated) |
| Tablilla | Estándar | Aglomerado | $16.50 |
| Tablilla | Rengrosada | Aglomerado | $16.50 |
| Puerta de Closet | Liso | Aglomerado | $129.73 |
| Puerta de Closet | Liso | MDF Pintado | $168.95 |
| Puerta de Closet | Liso | Chapilla | $111.86 |
| Puerta de Closet | +Listones 2cm Dil. 2cm | Aglomerado | $167.81 |
| Puerta de Closet | +Listones 2cm Dil. 2cm | MDF Pintado | $168.95 |
| Puerta de Closet | +Listones 2cm Dil. 2cm | Chapilla | $148.39 |
| Puerta de Closet | +Listones 5.5cm Dil. 2cm | Aglomerado | $111.34 |
| Puerta de Closet | +Listones 5.5cm Dil. 2cm | MDF Pintado | $234.60 |
| Puerta de Closet | +Listones 5.5cm Dil. 2cm | Chapilla | $875.10 |
| Revestimiento | Liso | Aglomerado | $57.10 / m² |
| Revestimiento | Liso | MDF Pintado | $91.14 / m² |
| Revestimiento | Liso | Chapilla | $111.86 / m² |
| Revestimiento | +Listones 2cm Dil. 2cm | Aglomerado | $180.46 / m² |
| Revestimiento | +Listones 5.5cm Dil. 2cm | Aglomerado | $66.83 / m² |
| Revestimiento | +Listones 5.5cm Dil. 2cm | Chapilla | $66.83 / m² |

**Material base costs (for admin reference / price updates):**
- Lámina Aglomerado: $110.00 (2.44×2.1m)
- Lámina MDF: $124.00
- Lámina Chapilla: $185.00

> This sheet is the master price list. The quotation module reads `Precio_Venta_USD` from here. Admin can update `Costo_Total_USD` and `Margen_Utilidad_Pct` directly, and the app reflects changes immediately. Never hardcode prices in the frontend.

### Sheet 4: `Gastos`
| Column | Description |
|---|---|
| ID_Gasto | Unique expense ID |
| ID_Proyecto | FK → Proyectos |
| Fecha | Date |
| Categoria | Materiales / Mano de Obra / Transporte / Subcontrato / Otro |
| Proveedor | Supplier or payee |
| Descripcion | Description |
| Monto_USD | Amount (USD) |
| Factura_Ref | Invoice reference number |
| Registrado_Por | Who logged it |

### Sheet 5: `Tareas`
| Column | Description |
|---|---|
| ID_Tarea | Unique task ID |
| ID_Proyecto | FK → Proyectos |
| Titulo | Task title |
| Descripcion | Task description |
| Area | Taller / Instalación / Administración / Diseño |
| Responsable | Assigned team member |
| Fecha_Inicio | Start date |
| Fecha_Limite | Due date |
| Fecha_Completada | Completion date |
| Status | Pendiente / En Progreso / Completada / Bloqueada |
| Prioridad | Alta / Media / Baja |

### Sheet 6: `Empleados`
| Column | Description |
|---|---|
| ID_Empleado | Unique employee ID |
| Nombre | Full name |
| Rol | Role (Ebanista, Instalador, Jefe Taller, Jefe Proyectos, Admin, etc.) |
| Area | Taller / Instalación / Oficina |
| Salario_Base | Base salary (USD/month) |
| Fecha_Ingreso | Start date |
| Activo | TRUE / FALSE |

---

## Modules

### 1. 📋 Cotización (Phase 1 — Priority)

**Purpose:** Replace the manual Google Sheets quotation process with a fast, structured quoting tool that pulls prices from the `Precios_Referencia` sheet and generates a professional PDF output.

**Features:**
- Create new quote linked to a project or a new client.
- Select items from categorized dropdown (pulled from `Precios_Referencia`).
- Input m² per item — subtotals auto-calculate.
- Apply line-level or global discount.
- Edit/override price per m² inline (for one-off adjustments without changing master prices).
- Quote summary panel showing total, discount, and final amount.
- **PDF export** — branded PDF with Ebony logo, client name, itemized breakdown, total, date, and validity period.
- Quote status workflow: Borrador → Enviada → Aprobada / Rechazada.
- Admin panel to update master prices in `Precios_Referencia` with date stamp.

**Key UX requirement:** The form must be fast to fill. Dropdowns, autofill, and keyboard navigation are priorities. A full quote should be completable in under 5 minutes.

**Pricing logic:** The app reads `Costo_Total_USD` from `Precios_Referencia` for each (Categoria + Subcategoria + Material) combination. The margin is set **per quote, not per item** — the user inputs a single margin % when creating the quote (e.g. 80%, 120%, 150%) and it applies globally to all line items in that quote. The user can also override the margin at the line-item level for more granular control. The subtotal per line is `Costo_Total_USD × Qty × (1 + Margen%)`. Admins update base costs in `Precios_Referencia` when supplier costs change — the app recalculates automatically.

**Custom line items:** The quote form allows adding free-form items not in the catalog (e.g. "Panelado Curvo", "Mesita de Noche Custom") with a manually entered cost. These custom items are saved only to the quote, not back to `Precios_Referencia` unless the admin explicitly adds them.

**AI Floor Plan Extraction (Phase 1 — core feature):**

The quotation module includes a "Subir Plano" button that triggers the following flow:

1. User uploads a PDF or image of the floor plan (architect-grade or designer sketch).
2. The app converts the PDF to an image and sends it to the Claude API (`claude-sonnet-4-20250514`) with a structured prompt instructing it to:
   - Identify every furniture piece or built-in element visible in the plan (closets, cocinas, muebles de TV, camas, revestimientos, etc.)
   - Extract dimensions (ancho × alto × fondo where visible) and calculate m² per piece
   - Assign a confidence level per item: HIGH (explicit dimensions found), MEDIUM (inferred from scale/context), LOW (no dimensions — estimate only)
   - Return a structured JSON array ready to load into the quote form
3. Extracted items appear in a **review panel** before loading — user can accept, edit, or delete each line.
4. Confirmed items auto-populate the quote form with item type and m². User then selects material and sets the margin.

**Handling plan quality variations:**
- Formal architect plans with cotas: Claude reads dimensions directly → HIGH confidence.
- Designer sketches without cotas: Claude estimates from visual proportions → items flagged MEDIUM or LOW with a warning icon so the user knows to verify.
- If the plan is too ambiguous, the app shows a clear message and falls back to manual entry.

**Claude API prompt to use (implement exactly as written):**
```
You are a furniture measurement assistant for a custom woodwork company in Panama.
Analyze this architectural floor plan and identify all custom furniture or built-in millwork elements (closets, kitchens, TV units, beds, wall paneling, wardrobes, nightstands, etc.).
For each element return a JSON array with these fields:
- "item": furniture type in Spanish (e.g. "Closet", "Mueble de TV", "Cocina", "Revestimiento", "Cama")
- "description": brief description of the piece
- "width_m": width in meters (null if unknown)
- "height_m": height in meters (null if unknown)
- "depth_m": depth in meters (null if unknown)
- "m2": calculated surface area (width × height), null if dimensions unavailable
- "confidence": "HIGH" if dimensions are explicitly written, "MEDIUM" if inferred, "LOW" if estimated
- "notes": any caveats or observations

Return ONLY a valid JSON array. No preamble, no explanation, no markdown formatting.
```

---

### 2. 📁 Proyectos

**Purpose:** Central project registry. Overview of all active, upcoming, and completed projects.

**Features:**
- Project list with filters by status, priority, designer, and date range.
- Project detail view: all linked quotes, tasks, and expenses in one place.
- Create / edit / archive projects.
- Quick status update inline.
- Kanban board view (columns: Cotización → En Taller → En Instalación → Entregado).
- Project profitability indicator: Cotizacion_Total vs. sum of Gastos for that project.

---

### 3. 📅 Cronograma / Timeline

**Purpose:** Visual scheduling of projects and tasks with daily, weekly, monthly, quarterly, and annual views.

**Features:**
- Gantt-style timeline view per project.
- Assign tasks to employees (installers, assemblers).
- Filter by: employee, client, area (Taller / Instalación), date range.
- Color coding by area and status.
- Performance tracker: compare estimated vs. actual completion dates per task and per employee.
- Delivery projection: based on current task load, estimate realistic delivery dates.
- Alert system for overdue tasks or projects at risk.

---

### 4. 💸 Control de Gastos

**Purpose:** Project-level expense tracking to determine true project profitability.

**Features:**
- Log expenses by project, category, supplier, and date.
- Expense categories: Materiales, Mano de Obra, Transporte, Subcontrato, Otro.
- Project P&L view: quoted revenue vs. total expenses = gross margin per project.
- Monthly expense summary across all projects.
- Filter and export expenses by date range, project, or category.

---

### 5. 📊 Dashboard

**Purpose:** Executive overview of company performance — similar to the Oasis Estates dashboard.

**Features:**
- KPI cards: Active projects, Total quoted (month), Total expenses (month), Avg. project margin %.
- Charts:
  - Projects by status (donut chart).
  - Revenue quoted vs. expenses by month (bar chart).
  - Top clients / designers by volume (bar chart).
  - Task completion rate by employee (bar chart).
- Date range selector (this week / this month / this quarter / custom).
- Bilingual labels on all chart axes and KPI titles.

---

### 6. 👥 Planilla de Personal *(Phase 2)*

**Purpose:** Payroll management module. Logged for future development.

**Planned features:**
- Employee registry (sourced from `Empleados` sheet).
- Monthly payroll record: base salary, overtime hours, absent days, loans, penalties, vacation pay, décimo.
- Auto-calculation of net pay.
- Payroll history per employee.
- Export to PDF per pay period.

> **Note:** This module will be built in Phase 2 after the core modules are stable. The `Empleados` sheet should be populated from day one to support task assignment in the Cronograma module.

---

## Development Phases

| Phase | Modules | Goal |
|---|---|---|
| **Phase 1** | Cotización (con AI extracción de planos) | Reemplazar el proceso manual de cotización |
| **Phase 2** | Proyectos + Dashboard básico | Visibilidad de proyectos activos |
| **Phase 3** | Cronograma + Control de Gastos + Dashboard completo | Control operacional completo |
| **Phase 4** | Planilla de Personal + Permisos por rol | Automatización y escala |

> **IMPORTANT FOR COWORK AGENT:** Build only the current phase. Do not scaffold or stub future modules. When Phase 1 is confirmed working, the user will request Phase 2.

---

## UI/UX Guidelines

- **Sidebar navigation** with icons and labels for each module. Collapsible on mobile.
- **Language toggle** (ES / EN) persistent in the top navbar. All strings must have both versions.
- **Color theme:** Dark wood (#2C1A0E), medium wood (#5C3A1E), warm white (#FAF7F2), gold accent (#C9A84C), soft gray (#E8E2D9).
- **Typography:** Inter font, clean and professional.
- **Mobile:** All tables must be horizontally scrollable or converted to card views on small screens. Forms must be thumb-friendly.
- **Loading states:** Skeleton loaders while fetching from Sheets API.
- **Feedback:** Toast notifications for all save/update/delete actions.
- **Empty states:** Friendly illustrated empty states with a CTA when a module has no data yet.

---

## Naming Conventions

- Components: PascalCase (`QuoteForm`, `ProjectCard`, `GanttRow`)
- Hooks: camelCase with `use` prefix (`useProjects`, `useQuote`)
- Sheet column references in code: match exactly the column headers in Google Sheets (Spanish, no spaces — use underscores)
- Files: kebab-case (`quote-form.jsx`, `project-detail.jsx`)

---

## Important Notes for Claude (Cowork Agent)

1. **Always read this file first** before making any changes.
2. **Google Sheets is the database.** All data persistence goes through the Sheets API. No local state that isn't synced.
3. **Phase 1 first.** Do not build Phase 2 or 3 modules until Phase 1 is complete and confirmed working.
4. **Cotización module** depends on the `Precios_Referencia` sheet being populated. The master price structure will be shared separately — wait for it before building the quote item selector.
5. **PDF generation** for quotes should use a library like `jsPDF` or `react-pdf`. Match Ebony's brand colors and include logo placeholder.
6. **Bilingual:** Every user-facing string needs both ES and EN versions. Use a simple `i18n` object or context — no external library needed at this scale.
7. **Do not hardcode prices, employee names, or project data.** Everything comes from Sheets.
8. **Mobile-first CSS:** Use Tailwind responsive prefixes (`sm:`, `md:`, `lg:`) consistently.
