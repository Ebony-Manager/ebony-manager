import { useState, useEffect, useCallback } from 'react'
import { fetchPrecios } from '../lib/sheets.js'
import { useAuth } from '../context/AuthContext.jsx'

// Fallback catalog seeded from CLAUDE.md (used when Sheets isn't configured yet)
const FALLBACK_CATALOG = [
  { ID_Item:'P001', Categoria:'Módulo',           Subcategoria:'Estándar',                Material:'Aglomerado',  Unidad:'unidad', Costo_Total_USD:'194.24' },
  { ID_Item:'P002', Categoria:'Módulo',           Subcategoria:'Estándar',                Material:'Chapilla',    Unidad:'unidad', Costo_Total_USD:'210.45' },
  { ID_Item:'P003', Categoria:'Gaveta',           Subcategoria:'Formato 1×0.50×0.20',     Material:'Aglomerado',  Unidad:'unidad', Costo_Total_USD:'71.53'  },
  { ID_Item:'P004', Categoria:'Gaveta',           Subcategoria:'Formato 1×0.50×0.20',     Material:'MDF Pintado', Unidad:'unidad', Costo_Total_USD:'46.53'  },
  { ID_Item:'P005', Categoria:'Tablilla',         Subcategoria:'Estándar',                Material:'Aglomerado',  Unidad:'unidad', Costo_Total_USD:'16.50'  },
  { ID_Item:'P006', Categoria:'Tablilla',         Subcategoria:'Rengrosada',              Material:'Aglomerado',  Unidad:'unidad', Costo_Total_USD:'16.50'  },
  { ID_Item:'P007', Categoria:'Puerta de Closet', Subcategoria:'Liso',                    Material:'Aglomerado',  Unidad:'unidad', Costo_Total_USD:'129.73' },
  { ID_Item:'P008', Categoria:'Puerta de Closet', Subcategoria:'Liso',                    Material:'MDF Pintado', Unidad:'unidad', Costo_Total_USD:'168.95' },
  { ID_Item:'P009', Categoria:'Puerta de Closet', Subcategoria:'Liso',                    Material:'Chapilla',    Unidad:'unidad', Costo_Total_USD:'111.86' },
  { ID_Item:'P010', Categoria:'Puerta de Closet', Subcategoria:'+Listones 2cm Dil. 2cm',  Material:'Aglomerado',  Unidad:'unidad', Costo_Total_USD:'167.81' },
  { ID_Item:'P011', Categoria:'Puerta de Closet', Subcategoria:'+Listones 2cm Dil. 2cm',  Material:'MDF Pintado', Unidad:'unidad', Costo_Total_USD:'168.95' },
  { ID_Item:'P012', Categoria:'Puerta de Closet', Subcategoria:'+Listones 2cm Dil. 2cm',  Material:'Chapilla',    Unidad:'unidad', Costo_Total_USD:'148.39' },
  { ID_Item:'P013', Categoria:'Puerta de Closet', Subcategoria:'+Listones 5.5cm Dil. 2cm',Material:'Aglomerado',  Unidad:'unidad', Costo_Total_USD:'111.34' },
  { ID_Item:'P014', Categoria:'Puerta de Closet', Subcategoria:'+Listones 5.5cm Dil. 2cm',Material:'MDF Pintado', Unidad:'unidad', Costo_Total_USD:'234.60' },
  { ID_Item:'P015', Categoria:'Puerta de Closet', Subcategoria:'+Listones 5.5cm Dil. 2cm',Material:'Chapilla',    Unidad:'unidad', Costo_Total_USD:'875.10' },
  { ID_Item:'P016', Categoria:'Revestimiento',    Subcategoria:'Liso',                    Material:'Aglomerado',  Unidad:'m²',    Costo_Total_USD:'57.10'  },
  { ID_Item:'P017', Categoria:'Revestimiento',    Subcategoria:'Liso',                    Material:'MDF Pintado', Unidad:'m²',    Costo_Total_USD:'91.14'  },
  { ID_Item:'P018', Categoria:'Revestimiento',    Subcategoria:'Liso',                    Material:'Chapilla',    Unidad:'m²',    Costo_Total_USD:'111.86' },
  { ID_Item:'P019', Categoria:'Revestimiento',    Subcategoria:'+Listones 2cm Dil. 2cm',  Material:'Aglomerado',  Unidad:'m²',    Costo_Total_USD:'180.46' },
  { ID_Item:'P020', Categoria:'Revestimiento',    Subcategoria:'+Listones 5.5cm Dil. 2cm',Material:'Aglomerado',  Unidad:'m²',    Costo_Total_USD:'66.83'  },
  { ID_Item:'P021', Categoria:'Revestimiento',    Subcategoria:'+Listones 5.5cm Dil. 2cm',Material:'Chapilla',    Unidad:'m²',    Costo_Total_USD:'66.83'  },
]

export function usePrecios() {
  const { token } = useAuth()
  const [precios, setPrecios]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    if (!token || !import.meta.env.VITE_SPREADSHEET_ID) {
      // No config yet — use fallback catalog
      setPrecios(FALLBACK_CATALOG)
      setLoading(false)
      return
    }

    try {
      const data = await fetchPrecios(token)
      setPrecios(data.length ? data : FALLBACK_CATALOG)
    } catch (e) {
      console.warn('Could not fetch Precios_Referencia, using fallback:', e.message)
      setPrecios(FALLBACK_CATALOG)
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  // Derived helpers
  const categories = [...new Set(precios.map((p) => p.Categoria))]

  const subcategories = (category) =>
    [...new Set(precios.filter((p) => p.Categoria === category).map((p) => p.Subcategoria))]

  const materials = (category, subcategory) =>
    precios
      .filter((p) => p.Categoria === category && p.Subcategoria === subcategory)
      .map((p) => p.Material)

  const getItem = (category, subcategory, material) =>
    precios.find(
      (p) =>
        p.Categoria === category &&
        p.Subcategoria === subcategory &&
        p.Material === material
    )

  return { precios, loading, error, categories, subcategories, materials, getItem }
}
