import { describe, expect, it } from "vitest";

import { actaAnswersFromApi, actaAnswersFromRaw, actaPrefillUrl, answerDate, kindForForm, normalizeActa } from "./acta-form";

const questions = [
  { name: "nombreProyecto", text: "Nombre Proyecto", type: "control_textbox" },
  { name: "direccion", text: "Direccion", type: "control_address" },
  { name: "nombreCliente", text: "Nombre Cliente", type: "control_fullname" },
  { name: "email", text: "Email", type: "control_email" },
];

describe("Acta de entrega · JotForm", () => {
  it("arma el enlace con el proyecto, la dirección y el cliente", () => {
    const url = new URL(actaPrefillUrl(questions, { project: "MM Interiores – The Colonial 23C", address: "Av. Balboa", clientName: "Ana María Pérez", email: "a@b.c" }));
    expect(url.searchParams.get("nombreProyecto")).toBe("MM Interiores – The Colonial 23C");
    expect(url.searchParams.get("direccion[addr_line1]")).toBe("Av. Balboa");
    expect(url.searchParams.get("nombreCliente[first]")).toBe("Ana María");
    expect(url.searchParams.get("nombreCliente[last]")).toBe("Pérez");
    expect(url.searchParams.get("email")).toBe("a@b.c");
  });

  it("sin cliente, no pone campos vacíos", () => {
    const url = new URL(actaPrefillUrl(questions, { project: "X", clientName: null }));
    expect([...url.searchParams.keys()]).toEqual(["nombreProyecto"]);
  });

  it("lee un envío de la API (por etiqueta) y del webhook (por nombre)", () => {
    const fromApi = normalizeActa(
      actaAnswersFromApi({
        "3": { name: "nombreProyecto", text: "Nombre Proyecto", answer: "PH Vitri 44A" },
        "4": { name: "nombreCliente", text: "Nombre Cliente", answer: { first: "Ana", last: "Pérez" } },
        "5": { name: "cedulaO", text: "Cedula o Pasaporte", answer: "8-123-456" },
        "6": { name: "fotografiasEntrega", text: "Fotografias Entrega", answer: ["https://x/a.jpg", "https://x/b.jpg"] },
        "7": { name: "date", text: "Date", answer: { day: "10", month: "11", year: "2026" } },
      })
    );
    expect(fromApi).toMatchObject({ projectName: "PH Vitri 44A", clientName: "Ana Pérez", idDoc: "8-123-456", date: "2026-11-10" });
    expect(fromApi.photos).toHaveLength(2);

    const fromRaw = normalizeActa(actaAnswersFromRaw({ q3_nombreProyecto: "PH Vitri 44A", q8_itemsEntregados: "Closet\nCocina" }));
    expect(fromRaw).toMatchObject({ projectName: "PH Vitri 44A", items: "Closet\nCocina" });
  });

  it("la lista de ítems (JSON de JotForm) queda una por línea", () => {
    const acta = normalizeActa(actaAnswersFromRaw({ q3_nombreProyecto: "X", q8_itemsEntregados: '[{"Item(s)":"Cocina"},{"Item(s)":"Closet"}]' }));
    expect(acta.items).toBe("Cocina\nCloset");
  });

  it("autorización a pintura: aprobó, recibió, mobiliario, observaciones y datos sueltos", () => {
    const a = normalizeActa(
      actaAnswersFromRaw({
        q3_nombreProyecto: "PH Vitri 44A",
        q4_aprobadoPor: "Supervisor Uno",
        q5_recibidoPor: "Pintor Dos",
        q6_mobiliario: "Closet principal",
        q7_observacionesTecnicas: "Lijar bordes",
        q8_acabado: "Mate",
        q9_codigoColor: "SW 7006",
        q10_qtyPiezas: "12",
        q11_fotosMobiliario: ["https://x/1.jpg"],
      })
    );
    expect(a).toMatchObject({ approvedBy: "Supervisor Uno", receivedBy: "Pintor Dos", items: "Closet principal", notes: "Lijar bordes" });
    expect(a.details).toEqual({ Acabado: "Mate", "Código de color": "SW 7006", Piezas: "12" });
    expect(a.photos).toHaveLength(1);
  });

  it("cada formulario se reconoce por su id", () => {
    expect(kindForForm("251893102532149")).toBe("pintura");
    expect(kindForForm("252224493029859")).toBe("embalaje");
    expect(kindForForm("230237298346864")).toBe("entrega");
    expect(kindForForm("1")).toBeNull();
  });

  it("fechas en los formatos de JotForm", () => {
    expect(answerDate("11-10-2026")).toBe("2026-11-10");
    expect(answerDate("2026-11-10 08:00")).toBe("2026-11-10");
    expect(answerDate("")).toBeNull();
  });
});
