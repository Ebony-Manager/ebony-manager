import type { CatalogCategory, CostInputKind, Finish, Shape, Unit } from "@/types/cotizador";

/**
 * Catálogo inicial del cotizador — la MISMA información que siembra la
 * migración `supabase/migrations/20261013130000_fase1_cotizador.sql`
 * (se generaron los dos del mismo origen: la "HOJA DE CALCULO oficial" y
 * la plantilla de cotización del Excel "Cuadro de costos").
 *
 * La app NO lee precios de acá: en tiempo de ejecución salen de Supabase
 * (`quote_catalog_items`). Este archivo existe para los tests de la capa
 * de cálculo, que comprueban que las recetas y los totales dan lo mismo
 * que el Excel.
 */
export interface SeedRecipe {
  sheetKey: string;
  usableM2: number;
  edgeMl: number;
  edgeKey: string;
  paint: [number, string][];
  labor: number;
  hardwarePct: number;
  hardwareBase: "edge" | "paint";
  fixed: number;
  fixedLabel: string | null;
  baseM2: number;
}
export interface SeedItem {
  code: string;
  category: CatalogCategory;
  finish: Finish | null;
  name: string;
  unit: Unit;
  price: number;
  shape: Shape;
  sortOrder: number;
  recipe: SeedRecipe | null;
}
export interface SeedInput {
  key: string;
  value: number;
  unit: string;
  label: string;
  kind: CostInputKind;
  sortOrder: number;
}

export const SEED_ITEMS: SeedItem[] = [
  {
    "code": "mod-ag",
    "category": "modulos",
    "finish": "aglomerado",
    "name": "Módulo aglomerado",
    "unit": "m2",
    "price": 165,
    "shape": "mod",
    "sortOrder": 10,
    "recipe": {
      "sheetKey": "lamAglo",
      "usableM2": 6.82,
      "edgeMl": 6.74,
      "edgeKey": "canteo",
      "paint": [],
      "labor": 89.37,
      "hardwarePct": 0.03,
      "hardwareBase": "edge",
      "fixed": 0,
      "fixedLabel": null,
      "baseM2": 2.4
    }
  },
  {
    "code": "mod-bl",
    "category": "modulos",
    "finish": "blanco",
    "name": "Módulo aglomerado blanco",
    "unit": "m2",
    "price": 127.98,
    "shape": "mod",
    "sortOrder": 20,
    "recipe": {
      "sheetKey": "lamBlanco",
      "usableM2": 6.82,
      "edgeMl": 6.74,
      "edgeKey": "canteo",
      "paint": [],
      "labor": 68,
      "hardwarePct": 0.03,
      "hardwareBase": "edge",
      "fixed": 0,
      "fixedLabel": null,
      "baseM2": 2.4
    }
  },
  {
    "code": "mod-pi",
    "category": "modulos",
    "finish": "pintado",
    "name": "Módulo pintado",
    "unit": "m2",
    "price": 295.95,
    "shape": "mod",
    "sortOrder": 30,
    "recipe": {
      "sheetKey": "lamMdf",
      "usableM2": 6.82,
      "edgeMl": 0,
      "edgeKey": "canteo",
      "paint": [
        [
          10.12,
          "pintLiso"
        ]
      ],
      "labor": 68,
      "hardwarePct": 0.0025,
      "hardwareBase": "paint",
      "fixed": 0,
      "fixedLabel": null,
      "baseM2": 2.4
    }
  },
  {
    "code": "mod-ch",
    "category": "modulos",
    "finish": "chapilla",
    "name": "Módulo chapilla",
    "unit": "m2",
    "price": 359.71,
    "shape": "mod",
    "sortOrder": 40,
    "recipe": {
      "sheetKey": "lamChap",
      "usableM2": 6.82,
      "edgeMl": 6.74,
      "edgeKey": "canteoChap",
      "paint": [
        [
          10.12,
          "pintChap"
        ]
      ],
      "labor": 68,
      "hardwarePct": 0.0025,
      "hardwareBase": "paint",
      "fixed": 0,
      "fixedLabel": null,
      "baseM2": 2.4
    }
  },
  {
    "code": "mod-cu",
    "category": "modulos",
    "finish": "pintado",
    "name": "Módulo curvo",
    "unit": "m2",
    "price": 280,
    "shape": "mod",
    "sortOrder": 50,
    "recipe": null
  },
  {
    "code": "gav-es-ag",
    "category": "gavetas",
    "finish": "aglomerado",
    "name": "Gaveta · estructura aglomerado",
    "unit": "ml",
    "price": 57.35,
    "shape": "none",
    "sortOrder": 60,
    "recipe": {
      "sheetKey": "lamAglo",
      "usableM2": 0.9145,
      "edgeMl": 4.91,
      "edgeKey": "canteo",
      "paint": [],
      "labor": 6,
      "hardwarePct": 0.012,
      "hardwareBase": "edge",
      "fixed": 0,
      "fixedLabel": null,
      "baseM2": 1
    }
  },
  {
    "code": "gav-fr-ag",
    "category": "gavetas",
    "finish": "aglomerado",
    "name": "Gaveta · frente aglomerado",
    "unit": "m2",
    "price": 65.89,
    "shape": "gav",
    "sortOrder": 70,
    "recipe": null
  },
  {
    "code": "gav-go-ag",
    "category": "gavetas",
    "finish": "aglomerado",
    "name": "Gola para gaveta aglomerado",
    "unit": "ml",
    "price": 11.2,
    "shape": "none",
    "sortOrder": 80,
    "recipe": null
  },
  {
    "code": "gav-es-pi",
    "category": "gavetas",
    "finish": "pintado",
    "name": "Gaveta · estructura pintada",
    "unit": "ml",
    "price": 108.63,
    "shape": "none",
    "sortOrder": 90,
    "recipe": {
      "sheetKey": "lamMdf",
      "usableM2": 1.274,
      "edgeMl": 2.94,
      "edgeKey": "canteo",
      "paint": [
        [
          1.3,
          "pintLiso"
        ]
      ],
      "labor": 6,
      "hardwarePct": 0.03,
      "hardwareBase": "paint",
      "fixed": 0,
      "fixedLabel": null,
      "baseM2": 1
    }
  },
  {
    "code": "gav-fr-pi",
    "category": "gavetas",
    "finish": "pintado",
    "name": "Gaveta · frente pintado",
    "unit": "m2",
    "price": 95.49,
    "shape": "gav",
    "sortOrder": 100,
    "recipe": {
      "sheetKey": "lamMdf",
      "usableM2": 1.26,
      "edgeMl": 0,
      "edgeKey": "canteo",
      "paint": [
        [
          1,
          "pintLiso"
        ]
      ],
      "labor": 16,
      "hardwarePct": 0,
      "hardwareBase": "edge",
      "fixed": 2,
      "fixedLabel": "High Tack",
      "baseM2": 1
    }
  },
  {
    "code": "gav-go-pi",
    "category": "gavetas",
    "finish": "pintado",
    "name": "Gola para gaveta pintada",
    "unit": "ml",
    "price": 16.93,
    "shape": "none",
    "sortOrder": 110,
    "recipe": null
  },
  {
    "code": "gav-es-ch",
    "category": "gavetas",
    "finish": "chapilla",
    "name": "Gaveta · estructura chapilla",
    "unit": "ml",
    "price": 139.87,
    "shape": "none",
    "sortOrder": 120,
    "recipe": {
      "sheetKey": "lamChap",
      "usableM2": 1.274,
      "edgeMl": 5.44,
      "edgeKey": "canteoChap",
      "paint": [
        [
          1.3,
          "pintChap"
        ]
      ],
      "labor": 6,
      "hardwarePct": 0.03,
      "hardwareBase": "paint",
      "fixed": 0,
      "fixedLabel": null,
      "baseM2": 1
    }
  },
  {
    "code": "gav-fr-ch",
    "category": "gavetas",
    "finish": "chapilla",
    "name": "Gaveta · frente chapilla",
    "unit": "m2",
    "price": 139.42,
    "shape": "gav",
    "sortOrder": 130,
    "recipe": {
      "sheetKey": "lamChap",
      "usableM2": 1.26,
      "edgeMl": 7.72,
      "edgeKey": "canteoChap",
      "paint": [
        [
          1,
          "pintChap"
        ]
      ],
      "labor": 16,
      "hardwarePct": 0,
      "hardwareBase": "edge",
      "fixed": 2,
      "fixedLabel": "High Tack",
      "baseM2": 1
    }
  },
  {
    "code": "tab-ag",
    "category": "tablillas",
    "finish": "aglomerado",
    "name": "Tablilla aglomerado",
    "unit": "m2",
    "price": 50.6,
    "shape": "tab",
    "sortOrder": 140,
    "recipe": {
      "sheetKey": "lamAglo",
      "usableM2": 0.543,
      "edgeMl": 0.97,
      "edgeKey": "canteo",
      "paint": [],
      "labor": 2.5,
      "hardwarePct": 0,
      "hardwareBase": "edge",
      "fixed": 0.8,
      "fixedLabel": "Soportes",
      "baseM2": 0.5568
    }
  },
  {
    "code": "tab-ag-r",
    "category": "tablillas",
    "finish": "aglomerado",
    "name": "Tablilla rengrosada aglomerado",
    "unit": "m2",
    "price": 87.7,
    "shape": "tab",
    "sortOrder": 150,
    "recipe": {
      "sheetKey": "lamAglo",
      "usableM2": 1.05,
      "edgeMl": 0.97,
      "edgeKey": "canteoReng",
      "paint": [],
      "labor": 2.5,
      "hardwarePct": 0,
      "hardwareBase": "edge",
      "fixed": 0,
      "fixedLabel": null,
      "baseM2": 0.5568
    }
  },
  {
    "code": "tab-pi",
    "category": "tablillas",
    "finish": "pintado",
    "name": "Tablilla pintada",
    "unit": "m2",
    "price": 122.09,
    "shape": "tab",
    "sortOrder": 160,
    "recipe": {
      "sheetKey": "lamMdf",
      "usableM2": 0.543,
      "edgeMl": 0,
      "edgeKey": "canteo",
      "paint": [
        [
          1.1136,
          "pintLiso"
        ]
      ],
      "labor": 2.5,
      "hardwarePct": 0,
      "hardwareBase": "edge",
      "fixed": 0,
      "fixedLabel": null,
      "baseM2": 0.5568
    }
  },
  {
    "code": "tab-pi-r",
    "category": "tablillas",
    "finish": "pintado",
    "name": "Tablilla rengrosada pintada",
    "unit": "m2",
    "price": 144.13,
    "shape": "tab",
    "sortOrder": 170,
    "recipe": {
      "sheetKey": "lamMdf",
      "usableM2": 1.05,
      "edgeMl": 0,
      "edgeKey": "canteo",
      "paint": [
        [
          1.1136,
          "pintLiso"
        ]
      ],
      "labor": 2.5,
      "hardwarePct": 0,
      "hardwareBase": "edge",
      "fixed": 0,
      "fixedLabel": null,
      "baseM2": 0.5568
    }
  },
  {
    "code": "tab-ch",
    "category": "tablillas",
    "finish": "chapilla",
    "name": "Tablilla chapilla",
    "unit": "m2",
    "price": 149.1,
    "shape": "tab",
    "sortOrder": 180,
    "recipe": {
      "sheetKey": "lamChap",
      "usableM2": 0.543,
      "edgeMl": 0.97,
      "edgeKey": "canteoChap",
      "paint": [
        [
          1.1136,
          "pintChap"
        ]
      ],
      "labor": 2.5,
      "hardwarePct": 0,
      "hardwareBase": "edge",
      "fixed": 0,
      "fixedLabel": null,
      "baseM2": 0.5568
    }
  },
  {
    "code": "tab-ch-r",
    "category": "tablillas",
    "finish": "chapilla",
    "name": "Tablilla doble chapilla",
    "unit": "m2",
    "price": 182.5,
    "shape": "tab",
    "sortOrder": 190,
    "recipe": {
      "sheetKey": "lamChap",
      "usableM2": 1.05,
      "edgeMl": 0.97,
      "edgeKey": "canteoReng",
      "paint": [
        [
          1.1136,
          "pintChap"
        ]
      ],
      "labor": 2.5,
      "hardwarePct": 0,
      "hardwareBase": "edge",
      "fixed": 0,
      "fixedLabel": null,
      "baseM2": 0.5568
    }
  },
  {
    "code": "pta-ag",
    "category": "puertas",
    "finish": "aglomerado",
    "name": "Puerta aglomerado",
    "unit": "m2",
    "price": 61.26,
    "shape": "pta",
    "sortOrder": 200,
    "recipe": {
      "sheetKey": "lamAglo",
      "usableM2": 1.44,
      "edgeMl": 6,
      "edgeKey": "canteo",
      "paint": [],
      "labor": 13,
      "hardwarePct": 0,
      "hardwareBase": "edge",
      "fixed": 0,
      "fixedLabel": null,
      "baseM2": 1.44
    }
  },
  {
    "code": "pta-ag-l",
    "category": "puertas",
    "finish": "aglomerado",
    "name": "Puerta aglomerado con listones",
    "unit": "m2",
    "price": 168.14,
    "shape": "ptaL",
    "sortOrder": 210,
    "recipe": {
      "sheetKey": "lamAglo",
      "usableM2": 2.56,
      "edgeMl": 46,
      "edgeKey": "canteo",
      "paint": [],
      "labor": 13,
      "hardwarePct": 0,
      "hardwareBase": "edge",
      "fixed": 0,
      "fixedLabel": null,
      "baseM2": 1.44
    }
  },
  {
    "code": "pta-pi",
    "category": "puertas",
    "finish": "pintado",
    "name": "Puerta pintada",
    "unit": "m2",
    "price": 127.23,
    "shape": "pta",
    "sortOrder": 220,
    "recipe": {
      "sheetKey": "lamMdf",
      "usableM2": 1.44,
      "edgeMl": 0,
      "edgeKey": "canteo",
      "paint": [
        [
          2.88,
          "pintLiso"
        ]
      ],
      "labor": 13,
      "hardwarePct": 0,
      "hardwareBase": "edge",
      "fixed": 0,
      "fixedLabel": null,
      "baseM2": 1.44
    }
  },
  {
    "code": "pta-pi-l",
    "category": "puertas",
    "finish": "pintado",
    "name": "Puerta pintada con listones",
    "unit": "m2",
    "price": 150.04,
    "shape": "ptaL",
    "sortOrder": 230,
    "recipe": {
      "sheetKey": "lamMdf",
      "usableM2": 2.5,
      "edgeMl": 0,
      "edgeKey": "canteo",
      "paint": [
        [
          1.44,
          "pintLiso"
        ],
        [
          1.44,
          "pintList"
        ]
      ],
      "labor": 13,
      "hardwarePct": 0,
      "hardwareBase": "edge",
      "fixed": 0,
      "fixedLabel": null,
      "baseM2": 1.44
    }
  },
  {
    "code": "pta-ch",
    "category": "puertas",
    "finish": "chapilla",
    "name": "Puerta chapilla",
    "unit": "m2",
    "price": 162.05,
    "shape": "pta",
    "sortOrder": 240,
    "recipe": {
      "sheetKey": "lamChap",
      "usableM2": 1.44,
      "edgeMl": 6,
      "edgeKey": "canteoChap",
      "paint": [
        [
          2.88,
          "pintChap"
        ]
      ],
      "labor": 13,
      "hardwarePct": 0,
      "hardwareBase": "edge",
      "fixed": 0,
      "fixedLabel": null,
      "baseM2": 1.44
    }
  },
  {
    "code": "pta-ch-l",
    "category": "puertas",
    "finish": "chapilla",
    "name": "Puerta chapilla con listones",
    "unit": "m2",
    "price": 274.74,
    "shape": "ptaL",
    "sortOrder": 250,
    "recipe": {
      "sheetKey": "lamChap",
      "usableM2": 2.5,
      "edgeMl": 46,
      "edgeKey": "canteoChap",
      "paint": [
        [
          1.44,
          "pintChap"
        ],
        [
          1.44,
          "pintList"
        ]
      ],
      "labor": 13,
      "hardwarePct": 0,
      "hardwareBase": "edge",
      "fixed": 0,
      "fixedLabel": null,
      "baseM2": 1.44
    }
  },
  {
    "code": "rev-ag",
    "category": "revestimientos",
    "finish": "aglomerado",
    "name": "Revestimiento liso aglomerado",
    "unit": "m2",
    "price": 97.5,
    "shape": "rev",
    "sortOrder": 260,
    "recipe": {
      "sheetKey": "lamAglo",
      "usableM2": 1.26,
      "edgeMl": 7.72,
      "edgeKey": "canteo",
      "paint": [],
      "labor": 16,
      "hardwarePct": 0,
      "hardwareBase": "edge",
      "fixed": 2,
      "fixedLabel": "High Tack",
      "baseM2": 1
    }
  },
  {
    "code": "rev-ag-55",
    "category": "revestimientos",
    "finish": "aglomerado",
    "name": "Rev. listones 5.5 cm aglomerado",
    "unit": "m2",
    "price": 211.8,
    "shape": "rev55",
    "sortOrder": 270,
    "recipe": {
      "sheetKey": "lamAglo",
      "usableM2": 2.03,
      "edgeMl": 37.26,
      "edgeKey": "canteo",
      "paint": [],
      "labor": 26,
      "hardwarePct": 0,
      "hardwareBase": "edge",
      "fixed": 2,
      "fixedLabel": "High Tack",
      "baseM2": 1
    }
  },
  {
    "code": "rev-ag-2",
    "category": "revestimientos",
    "finish": "aglomerado",
    "name": "Rev. listones 2 cm aglomerado",
    "unit": "m2",
    "price": 209.55,
    "shape": "rev2",
    "sortOrder": 280,
    "recipe": {
      "sheetKey": "lamAglo",
      "usableM2": 1.78,
      "edgeMl": 37.26,
      "edgeKey": "canteo",
      "paint": [],
      "labor": 34,
      "hardwarePct": 0,
      "hardwareBase": "edge",
      "fixed": 2,
      "fixedLabel": "High Tack",
      "baseM2": 1
    }
  },
  {
    "code": "rev-pi",
    "category": "revestimientos",
    "finish": "pintado",
    "name": "Revestimiento liso pintado",
    "unit": "m2",
    "price": 134.5,
    "shape": "rev",
    "sortOrder": 290,
    "recipe": {
      "sheetKey": "lamMdf",
      "usableM2": 1.26,
      "edgeMl": 0,
      "edgeKey": "canteo",
      "paint": [
        [
          1,
          "pintLiso"
        ]
      ],
      "labor": 16,
      "hardwarePct": 0,
      "hardwareBase": "edge",
      "fixed": 2,
      "fixedLabel": "High Tack",
      "baseM2": 1
    }
  },
  {
    "code": "rev-pi-55",
    "category": "revestimientos",
    "finish": "pintado",
    "name": "Rev. listones 5.5 cm pintado",
    "unit": "m2",
    "price": 159.5,
    "shape": "rev55",
    "sortOrder": 300,
    "recipe": {
      "sheetKey": "lamMdf",
      "usableM2": 2.03,
      "edgeMl": 0,
      "edgeKey": "canteo",
      "paint": [
        [
          1,
          "pintList"
        ]
      ],
      "labor": 26,
      "hardwarePct": 0,
      "hardwareBase": "edge",
      "fixed": 2,
      "fixedLabel": "High Tack",
      "baseM2": 1
    }
  },
  {
    "code": "rev-pi-2",
    "category": "revestimientos",
    "finish": "pintado",
    "name": "Rev. listones 2 cm pintado",
    "unit": "m2",
    "price": 161.5,
    "shape": "rev2",
    "sortOrder": 310,
    "recipe": {
      "sheetKey": "lamMdf",
      "usableM2": 1.78,
      "edgeMl": 0,
      "edgeKey": "canteo",
      "paint": [
        [
          1,
          "pintList"
        ]
      ],
      "labor": 34,
      "hardwarePct": 0,
      "hardwareBase": "edge",
      "fixed": 2,
      "fixedLabel": "High Tack",
      "baseM2": 1
    }
  },
  {
    "code": "rev-ch",
    "category": "revestimientos",
    "finish": "chapilla",
    "name": "Revestimiento liso chapilla",
    "unit": "m2",
    "price": 184.3,
    "shape": "rev",
    "sortOrder": 320,
    "recipe": {
      "sheetKey": "lamChap",
      "usableM2": 1.26,
      "edgeMl": 7.72,
      "edgeKey": "canteoChap",
      "paint": [
        [
          1,
          "pintChap"
        ]
      ],
      "labor": 16,
      "hardwarePct": 0,
      "hardwareBase": "edge",
      "fixed": 2,
      "fixedLabel": "High Tack",
      "baseM2": 1
    }
  },
  {
    "code": "rev-ch-55",
    "category": "revestimientos",
    "finish": "chapilla",
    "name": "Rev. listones 5.5 cm chapilla",
    "unit": "m2",
    "price": 268.8,
    "shape": "rev55",
    "sortOrder": 330,
    "recipe": {
      "sheetKey": "lamChap",
      "usableM2": 2.03,
      "edgeMl": 37.26,
      "edgeKey": "canteoChap",
      "paint": [
        [
          1,
          "pintList"
        ]
      ],
      "labor": 26,
      "hardwarePct": 0,
      "hardwareBase": "edge",
      "fixed": 2,
      "fixedLabel": "High Tack",
      "baseM2": 1
    }
  },
  {
    "code": "rev-ch-2",
    "category": "revestimientos",
    "finish": "chapilla",
    "name": "Rev. listones 2 cm chapilla",
    "unit": "m2",
    "price": 267.77,
    "shape": "rev2",
    "sortOrder": 340,
    "recipe": {
      "sheetKey": "lamChap",
      "usableM2": 1.78,
      "edgeMl": 37.26,
      "edgeKey": "canteoChap",
      "paint": [
        [
          1,
          "pintList"
        ]
      ],
      "labor": 34,
      "hardwarePct": 0,
      "hardwareBase": "edge",
      "fixed": 2,
      "fixedLabel": "High Tack",
      "baseM2": 1
    }
  },
  {
    "code": "ac-tubo",
    "category": "accesorios",
    "finish": null,
    "name": "Tubo",
    "unit": "unidad",
    "price": 4.27,
    "shape": "none",
    "sortOrder": 350,
    "recipe": null
  },
  {
    "code": "ac-stubo",
    "category": "accesorios",
    "finish": null,
    "name": "Soporte de tubo",
    "unit": "unidad",
    "price": 1.75,
    "shape": "none",
    "sortOrder": 360,
    "recipe": null
  },
  {
    "code": "ac-pata",
    "category": "accesorios",
    "finish": null,
    "name": "Pata",
    "unit": "unidad",
    "price": 1.5,
    "shape": "none",
    "sortOrder": 370,
    "recipe": null
  },
  {
    "code": "ac-rueda",
    "category": "accesorios",
    "finish": null,
    "name": "Rueda",
    "unit": "unidad",
    "price": 7.5,
    "shape": "none",
    "sortOrder": 380,
    "recipe": null
  },
  {
    "code": "ac-bis-r",
    "category": "accesorios",
    "finish": null,
    "name": "Bisagra recta",
    "unit": "unidad",
    "price": 3.6,
    "shape": "none",
    "sortOrder": 390,
    "recipe": null
  },
  {
    "code": "ac-bis-c",
    "category": "accesorios",
    "finish": null,
    "name": "Bisagra de cangrejo",
    "unit": "unidad",
    "price": 6.1,
    "shape": "none",
    "sortOrder": 400,
    "recipe": null
  },
  {
    "code": "ac-brazo",
    "category": "accesorios",
    "finish": null,
    "name": "Brazo mecánico",
    "unit": "unidad",
    "price": 12.5,
    "shape": "none",
    "sortOrder": 410,
    "recipe": null
  },
  {
    "code": "ac-tir",
    "category": "accesorios",
    "finish": null,
    "name": "Tirador",
    "unit": "unidad",
    "price": 5,
    "shape": "none",
    "sortOrder": 420,
    "recipe": null
  },
  {
    "code": "ac-riel-b",
    "category": "accesorios",
    "finish": null,
    "name": "Riel oculto Blum",
    "unit": "unidad",
    "price": 47,
    "shape": "none",
    "sortOrder": 430,
    "recipe": null
  },
  {
    "code": "ac-riel-e",
    "category": "accesorios",
    "finish": null,
    "name": "Riel oculto económico",
    "unit": "unidad",
    "price": 25,
    "shape": "none",
    "sortOrder": 440,
    "recipe": null
  },
  {
    "code": "ac-riel-l",
    "category": "accesorios",
    "finish": null,
    "name": "Riel lateral de extensión",
    "unit": "unidad",
    "price": 8,
    "shape": "none",
    "sortOrder": 450,
    "recipe": null
  },
  {
    "code": "ac-exp",
    "category": "accesorios",
    "finish": null,
    "name": "Expulsor",
    "unit": "unidad",
    "price": 6.5,
    "shape": "none",
    "sortOrder": 460,
    "recipe": null
  },
  {
    "code": "ac-ht",
    "category": "accesorios",
    "finish": null,
    "name": "Tubo de High Tack",
    "unit": "unidad",
    "price": 8,
    "shape": "none",
    "sortOrder": 470,
    "recipe": null
  },
  {
    "code": "ac-perf",
    "category": "accesorios",
    "finish": null,
    "name": "Perfil de metal",
    "unit": "unidad",
    "price": 405,
    "shape": "none",
    "sortOrder": 480,
    "recipe": null
  },
  {
    "code": "sb-esp-c",
    "category": "espejos",
    "finish": null,
    "name": "Espejo claro",
    "unit": "m2",
    "price": 185,
    "shape": "esp",
    "sortOrder": 490,
    "recipe": null
  },
  {
    "code": "sb-esp-b",
    "category": "espejos",
    "finish": null,
    "name": "Espejo bronce",
    "unit": "m2",
    "price": 181,
    "shape": "esp",
    "sortOrder": 500,
    "recipe": null
  },
  {
    "code": "sb-esp-g",
    "category": "espejos",
    "finish": null,
    "name": "Espejo gris / fumé",
    "unit": "m2",
    "price": 195,
    "shape": "esp",
    "sortOrder": 510,
    "recipe": null
  },
  {
    "code": "sb-vid-6",
    "category": "vidrios",
    "finish": null,
    "name": "Vidrio templado 6 mm",
    "unit": "m2",
    "price": 64,
    "shape": "vid",
    "sortOrder": 520,
    "recipe": null
  },
  {
    "code": "sb-vid-10",
    "category": "vidrios",
    "finish": null,
    "name": "Vidrio templado 10 mm",
    "unit": "m2",
    "price": 82,
    "shape": "vid",
    "sortOrder": 530,
    "recipe": null
  },
  {
    "code": "sb-pvid",
    "category": "vidrios",
    "finish": null,
    "name": "Puerta de vidrio + perfil aluminio",
    "unit": "ml",
    "price": 286,
    "shape": "none",
    "sortOrder": 540,
    "recipe": null
  },
  {
    "code": "sb-svar",
    "category": "metales",
    "finish": null,
    "name": "Soporte de varilla",
    "unit": "unidad",
    "price": 2.75,
    "shape": "none",
    "sortOrder": 550,
    "recipe": null
  },
  {
    "code": "sb-sesc",
    "category": "metales",
    "finish": null,
    "name": "Soporte de escritorio",
    "unit": "ml",
    "price": 59.52,
    "shape": "none",
    "sortOrder": 560,
    "recipe": null
  },
  {
    "code": "sb-est",
    "category": "metales",
    "finish": null,
    "name": "Estructuras varias (metal)",
    "unit": "ml",
    "price": 65,
    "shape": "none",
    "sortOrder": 570,
    "recipe": null
  },
  {
    "code": "sb-coj",
    "category": "tapiceria",
    "finish": null,
    "name": "Cojín (foam 3\")",
    "unit": "m2",
    "price": 133,
    "shape": "none",
    "sortOrder": 580,
    "recipe": null
  },
  {
    "code": "sb-bast",
    "category": "tapiceria",
    "finish": null,
    "name": "Bastidor (foam 3\")",
    "unit": "m2",
    "price": 113,
    "shape": "none",
    "sortOrder": 590,
    "recipe": null
  },
  {
    "code": "sb-tap-larg",
    "category": "tapiceria",
    "finish": null,
    "name": "Larguero de cama (foam 1/2\")",
    "unit": "m2",
    "price": 71,
    "shape": "none",
    "sortOrder": 600,
    "recipe": null
  },
  {
    "code": "sb-tap-esps",
    "category": "tapiceria",
    "finish": null,
    "name": "Espaldar seccionado (foam 2\")",
    "unit": "m2",
    "price": 100,
    "shape": "none",
    "sortOrder": 610,
    "recipe": null
  },
  {
    "code": "sb-tap-espl",
    "category": "tapiceria",
    "finish": null,
    "name": "Espaldar liso (foam 2\")",
    "unit": "m2",
    "price": 89,
    "shape": "none",
    "sortOrder": 620,
    "recipe": null
  },
  {
    "code": "sb-led",
    "category": "iluminacion",
    "finish": null,
    "name": "Luces LED",
    "unit": "ml",
    "price": 57,
    "shape": "led",
    "sortOrder": 630,
    "recipe": null
  }
];

export const SEED_INPUTS: SeedInput[] = [
  {
    "key": "lamW",
    "value": 2.44,
    "unit": "m",
    "label": "Ancho de lámina",
    "kind": "insumo",
    "sortOrder": 10
  },
  {
    "key": "lamH",
    "value": 2.1,
    "unit": "m",
    "label": "Alto de lámina",
    "kind": "insumo",
    "sortOrder": 20
  },
  {
    "key": "lamAglo",
    "value": 210,
    "unit": "usd",
    "label": "Lámina aglomerado",
    "kind": "insumo",
    "sortOrder": 30
  },
  {
    "key": "lamBlanco",
    "value": 60,
    "unit": "usd",
    "label": "Lámina aglomerado blanco",
    "kind": "insumo",
    "sortOrder": 40
  },
  {
    "key": "lamBlancoArea",
    "value": 5.0875,
    "unit": "m2",
    "label": "Superficie de lámina blanca",
    "kind": "insumo",
    "sortOrder": 50
  },
  {
    "key": "lamMdf",
    "value": 124,
    "unit": "usd",
    "label": "Lámina MDF",
    "kind": "insumo",
    "sortOrder": 60
  },
  {
    "key": "lamChap",
    "value": 185,
    "unit": "usd",
    "label": "Lámina chapilla",
    "kind": "insumo",
    "sortOrder": 70
  },
  {
    "key": "canteo",
    "value": 2.7,
    "unit": "usd_ml",
    "label": "Canteo",
    "kind": "insumo",
    "sortOrder": 80
  },
  {
    "key": "canteoReng",
    "value": 3.4,
    "unit": "usd_ml",
    "label": "Canteo rengrosado",
    "kind": "insumo",
    "sortOrder": 90
  },
  {
    "key": "canteoChap",
    "value": 3.1,
    "unit": "usd_ml",
    "label": "Canteo chapilla",
    "kind": "insumo",
    "sortOrder": 100
  },
  {
    "key": "pintLiso",
    "value": 47,
    "unit": "usd_m2",
    "label": "Pintura lisa",
    "kind": "insumo",
    "sortOrder": 110
  },
  {
    "key": "pintList",
    "value": 52,
    "unit": "usd_m2",
    "label": "Pintura listones",
    "kind": "insumo",
    "sortOrder": 120
  },
  {
    "key": "pintChap",
    "value": 52,
    "unit": "usd_m2",
    "label": "Acabado chapilla",
    "kind": "insumo",
    "sortOrder": 130
  },
  {
    "key": "def_util",
    "value": 130,
    "unit": "pct",
    "label": "Utilidad Ebony",
    "kind": "default",
    "sortOrder": 10
  },
  {
    "key": "def_sub_margin",
    "value": 50,
    "unit": "pct",
    "label": "Margen de subcontratos",
    "kind": "default",
    "sortOrder": 20
  },
  {
    "key": "def_waste_sheets",
    "value": 1,
    "unit": "u",
    "label": "Láminas adicionales",
    "kind": "default",
    "sortOrder": 30
  },
  {
    "key": "def_waste_pct",
    "value": 30,
    "unit": "pct",
    "label": "Desperdicio",
    "kind": "default",
    "sortOrder": 40
  },
  {
    "key": "def_design3d",
    "value": 30,
    "unit": "usd",
    "label": "Diseño 3D en SketchUp",
    "kind": "default",
    "sortOrder": 50
  },
  {
    "key": "def_extra_labor",
    "value": 25,
    "unit": "usd",
    "label": "Mano de obra adicional",
    "kind": "default",
    "sortOrder": 60
  },
  {
    "key": "def_freight",
    "value": 30,
    "unit": "usd",
    "label": "Flete de material",
    "kind": "default",
    "sortOrder": 70
  },
  {
    "key": "def_commission",
    "value": 0,
    "unit": "pct",
    "label": "Comisión de diseñadora",
    "kind": "default",
    "sortOrder": 80
  },
  {
    "key": "def_ccf",
    "value": 4,
    "unit": "pct",
    "label": "Credit card fee",
    "kind": "default",
    "sortOrder": 90
  },
  {
    "key": "def_itbms",
    "value": 7,
    "unit": "pct",
    "label": "ITBMS",
    "kind": "default",
    "sortOrder": 100
  },
  {
    "key": "def_delivery_days",
    "value": 65,
    "unit": "dias",
    "label": "Días de entrega",
    "kind": "default",
    "sortOrder": 110
  }
];
