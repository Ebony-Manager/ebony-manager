import { describe, expect, it } from "vitest";

import {
  answersFromApi,
  answersFromRawRequest,
  findStaffMatch,
  formatAddress,
  formatBankAccount,
  formatPhone,
  intakePatch,
  normalizeBankName,
  normalizeIntake,
  parseJotformDate,
  titleCase,
  type MatchCandidate,
} from "./jotform-intake";

// Respuesta real (anonimizada) del formulario "Registro Empleado", formato de la API.
const API_ANSWERS = {
  "3": { name: "nombre", answer: { first: "javier", last: "Alonzo dominguez" } },
  "4": { name: "domicilio", answer: { addr_line1: "Vía argentina", addr_line2: "", city: "Panama", state: "Panamá", postal: "" } },
  "5": { name: "cedulaO", answer: ["https://www.jotform.com/uploads/ebonypanama/232606019835052/1/doc.jpg"] },
  "6": { name: "celular", answer: { area: "+507", phone: "68226012" } },
  "7": { name: "correoElectronico", answer: "Alonzo@Gmail.com " },
  "8": { name: "nombre8", answer: { first: "José", last: "Alonzo" } },
  "9": { name: "telefono", answer: { area: "+57", phone: "3015176041" } },
  "10": { name: "relacionCon", answer: "Hermano" },
  "12": { name: "fechaNacimiento", answer: { day: "06", month: "05", year: "1999", datetime: "1999-05-06 00:00:00" } },
  "18": { name: "numeroDe", answer: "0472968324289" },
  "19": { name: "nombreBanco", answer: "General" },
  "20": { name: "tipoDe", answer: "Cuenta Ahorros" },
  "1": { name: "heading" },
};

describe("normalizeIntake", () => {
  it("convierte una respuesta de la API a la ficha, en el formato de la app", () => {
    expect(normalizeIntake(answersFromApi(API_ANSWERS))).toEqual({
      firstName: "Javier",
      lastName: "Alonzo Dominguez",
      email: "alonzo@gmail.com",
      phone: "6822-6012",
      birthDate: "1999-05-06",
      address: "Vía argentina, Panama",
      idDocumentUrl: "https://www.jotform.com/uploads/ebonypanama/232606019835052/1/doc.jpg",
      bankName: "Banco General",
      bankAccountType: "ahorro",
      bankAccountNumber: "04-72-96-832428-9",
      emergencyContactName: "José Alonzo",
      emergencyContactPhone: "(+57) 301-5176041",
      emergencyContactRelation: "Hermano",
    });
  });

  it("el rawRequest del webhook (claves q3_nombre) da lo mismo", () => {
    const raw = Object.fromEntries(
      Object.entries(API_ANSWERS)
        .filter(([, q]) => "answer" in q)
        .map(([n, q]) => [`q${n}_${q.name}`, (q as { answer: unknown }).answer])
    );
    expect(normalizeIntake(answersFromRawRequest({ ...raw, formID: "x" }))).toEqual(
      normalizeIntake(answersFromApi(API_ANSWERS))
    );
  });

  it("lo que falta queda en null", () => {
    expect(normalizeIntake({})).toMatchObject({ firstName: null, email: null, phone: null, birthDate: null, bankAccountNumber: null });
  });
});

describe("piezas", () => {
  it("teléfonos", () => {
    expect(formatPhone({ area: "507", phone: "6411-6103" })).toBe("6411-6103");
    expect(formatPhone({ area: "", phone: "2663777" })).toBe("266-3777");
    expect(formatPhone("+507 6919 1635")).toBe("6919-1635");
    expect(formatPhone({ area: "+506", phone: "62525456" })).toBe("(+506) 62525456");
    expect(formatPhone({ area: "+507", phone: "" })).toBeNull();
  });

  it("fechas inválidas no pasan", () => {
    expect(parseJotformDate({ day: "31", month: "02", year: "1990" })).toBeNull();
    expect(parseJotformDate({ datetime: "1984-02-21 00:00:00" })).toBe("1984-02-21");
  });

  it("dirección sin repetir partes", () => {
    expect(formatAddress({ addr_line1: "Calle 5 rio abajo", city: "Panama", state: "Panamá" })).toBe("Calle 5 rio abajo, Panama");
  });

  it("bancos y cuentas", () => {
    expect(normalizeBankName("banco lafise")).toBe("Banco Lafise");
    expect(normalizeBankName("Banismo")).toBe("Banistmo");
    expect(normalizeBankName("Caja Rural")).toBe("Caja Rural");
    expect(formatBankAccount("0407979881980", "Banco General")).toBe("04-07-97-988198-0");
    // Banco General con un dígito de menos: no se inventa el formato.
    expect(formatBankAccount("040797988198", "Banco General")).toBe("040797988198");
    expect(formatBankAccount("119-478-346", "Banistmo")).toBe("119478346");
  });

  it("nombres", () => {
    expect(titleCase("  NABIL   massiel de la CRUZ ")).toBe("Nabil Massiel de la Cruz");
  });
});

describe("findStaffMatch", () => {
  const people: MatchCandidate[] = [
    { kind: "employee", id: "e1", name: "Jose Salcedo", email: null, phone: "6824-9383" },
    { kind: "contractor", id: "c1", name: "Wilson Castro", email: "castro@gmail.com", phone: null },
    { kind: "employee", id: "e2", name: "Javier Alonzo Dominguez", email: null, phone: null },
  ];

  it("por correo, teléfono o nombre", () => {
    expect(findStaffMatch({ firstName: "W", lastName: "X", email: "castro@gmail.com", phone: null }, people)?.id).toBe("c1");
    expect(findStaffMatch({ firstName: "A", lastName: "B", email: null, phone: "(+507) 6824-9383" }, people)?.id).toBe("e1");
    expect(findStaffMatch({ firstName: "Javier", lastName: "Alonzo Domínguez", email: null, phone: null }, people)?.id).toBe("e2");
    expect(findStaffMatch({ firstName: "José Ricardo", lastName: "Salcedo Serna", email: null, phone: null }, people)?.id).toBe("e1");
  });

  it("nadie parecido → null", () => {
    expect(findStaffMatch({ firstName: "Ana", lastName: "Pérez", email: "ana@x.com", phone: "6000-0000" }, people)).toBeNull();
  });
});

describe("intakePatch", () => {
  const intake = normalizeIntake(answersFromApi(API_ANSWERS));
  const empty = {
    phone: null, email: null, address: null, birthDate: null, emergencyContactName: null, emergencyContactPhone: null,
    bankName: null, bankAccountType: null, bankAccountNumber: null, notes: null,
  } as const;

  it("a una ficha vacía le llena todo, con el documento en notas", () => {
    expect(intakePatch(empty, intake)).toEqual({
      phone: "6822-6012",
      email: "alonzo@gmail.com",
      address: "Vía argentina, Panama",
      birthDate: "1999-05-06",
      emergencyContactName: "José Alonzo",
      emergencyContactPhone: "(+57) 301-5176041",
      bankName: "Banco General",
      bankAccountType: "ahorro",
      bankAccountNumber: "04-72-96-832428-9",
      notes: "Documento (JotForm): https://www.jotform.com/uploads/ebonypanama/232606019835052/1/doc.jpg",
    });
  });

  it("nunca pisa lo que ya estaba, y la cuenta va completa o nada", () => {
    const patch = intakePatch(
      { ...empty, phone: "6000-0000", bankName: "Banistmo", notes: "Buen ebanista" },
      intake
    );
    expect(patch.phone).toBeUndefined();
    expect(patch.bankAccountNumber).toBeUndefined();
    expect(patch.bankName).toBeUndefined();
    expect(patch.notes).toBe("Buen ebanista\nDocumento (JotForm): https://www.jotform.com/uploads/ebonypanama/232606019835052/1/doc.jpg");
  });
});

import { jotformDocumentUrlFromNotes, notesWithoutJotformDocument } from "./jotform-intake";
import { sniffDocumentExt } from "./staff-documents";

describe("documento de JotForm en las notas", () => {
  const url = "https://www.jotform.com/uploads/ebonypanama/232606019835052/1/doc.jpeg";
  it("encuentra el enlace y lo quita sin tocar el resto", () => {
    const notes = `Turno de tarde\nDocumento (JotForm): ${url}`;
    expect(jotformDocumentUrlFromNotes(notes)).toBe(url);
    expect(notesWithoutJotformDocument(notes)).toBe("Turno de tarde");
    expect(notesWithoutJotformDocument(`Documento (JotForm): ${url}`)).toBeNull();
    expect(jotformDocumentUrlFromNotes("sin enlace")).toBeNull();
  });
  it("reconoce el archivo por sus bytes, no por el content-type", () => {
    expect(sniffDocumentExt(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpg");
    expect(sniffDocumentExt(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe("png");
    expect(sniffDocumentExt(new TextEncoder().encode("%PDF-1.7"))).toBe("pdf");
    expect(sniffDocumentExt(new TextEncoder().encode("RIFF1234WEBPVP8"))).toBe("webp");
    expect(sniffDocumentExt(new TextEncoder().encode("<!DOCTYPE html>"))).toBeNull();
  });
});
