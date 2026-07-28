# Ebony Manager — Guía de Configuración

## Pasos para poner en producción

---

### 1. Crear la Google Sheet

1. Ve a [sheets.google.com](https://sheets.google.com) e crea una nueva hoja de cálculo.
2. Nómbrala **Ebony Manager**.
3. Crea las siguientes pestañas (tabs) con exactamente estos nombres:

| Tab | Columnas (fila 1 = encabezados) |
|---|---|
| `Cotizaciones` | ID_Cotizacion, ID_Proyecto, Fecha, Item, Categoria, M2, Precio_M2, Subtotal, Descuento, Total, Status |
| `Precios_Referencia` | ID_Item, Categoria, Subcategoria, Material, Unidad, Costo_Total_USD, Margen_Utilidad_Pct, Precio_Venta_USD, Ultima_Actualizacion, Notas |
| `Proyectos` | ID_Proyecto, Cliente, Diseñadora, Descripcion, Fecha_Inicio, Fecha_Entrega_Estimada, Fecha_Entrega_Real, Status, Prioridad, Cotizacion_Total, Notas |

4. En `Precios_Referencia`, agrega los precios del catálogo (ver CLAUDE.md para la lista completa).
5. Copia el **Spreadsheet ID** de la URL:
   - URL: `https://docs.google.com/spreadsheets/d/`**`TU_ID_AQUI`**`/edit`

---

### 2. Configurar Google OAuth

1. Ve a [Google Cloud Console](https://console.cloud.google.com/).
2. Crea un nuevo proyecto (o usa uno existente).
3. Habilita la **Google Sheets API**:
   - Menú → APIs & Services → Library → busca "Google Sheets API" → Enable.
4. Crea las credenciales OAuth:
   - APIs & Services → Credentials → Create Credentials → OAuth client ID.
   - Tipo: **Web application**.
   - Authorized JavaScript origins: `http://localhost:3000` (dev) y tu URL de Vercel (prod).
   - Copia el **Client ID**.

---

### 3. Variables de entorno

Crea un archivo `.env` en la raíz del proyecto (o configúralas en Vercel):

```env
VITE_GOOGLE_CLIENT_ID=tu_client_id.apps.googleusercontent.com
VITE_SPREADSHEET_ID=tu_spreadsheet_id

# Solo para Vercel (nunca en frontend):
ANTHROPIC_API_KEY=sk-ant-...
```

En Vercel: Project Settings → Environment Variables → agrega las tres.

---

### 4. Instalar dependencias del API serverless

Las funciones de `/api/` requieren paquetes adicionales. Ejecuta:

```bash
npm install @anthropic-ai/sdk formidable
```

---

### 5. Desarrollo local

```bash
npm install
npm run dev
# App en http://localhost:3000
```

Para probar el endpoint de análisis de planos localmente, usa [Vercel CLI](https://vercel.com/cli):

```bash
npm i -g vercel
vercel dev
```

---

### 6. Deploy en Vercel

```bash
vercel --prod
```

O conecta el repositorio en [vercel.com](https://vercel.com) para deploys automáticos en cada push.

---

## Estructura del proyecto

```
ebony-manager/
├── api/
│   └── analyze-plan.js       # Serverless: Claude API para extracción de planos
├── src/
│   ├── components/
│   │   ├── cotizacion/       # Módulo Cotización (Fase 1)
│   │   └── layout/           # Sidebar, Navbar
│   ├── context/              # Auth, Language
│   ├── hooks/                # usePrecios
│   ├── lib/                  # sheets.js, pdf.js, i18n.js
│   └── pages/                # Cotizacion.jsx, Login.jsx
├── .env.example
├── index.html
├── package.json
├── tailwind.config.js
└── vercel.json
```

---

## Notas

- Sin configurar las variables de entorno, el app corre con el catálogo de precios **embebido** (fallback desde CLAUDE.md). Útil para demos.
- La autenticación Google OAuth es necesaria para guardar cotizaciones en Sheets. Sin ella, el PDF export sigue funcionando.
- El análisis de planos con IA requiere `ANTHROPIC_API_KEY` configurado en Vercel.
