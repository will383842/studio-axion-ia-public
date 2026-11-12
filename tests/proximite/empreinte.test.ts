import { describe, expect, it } from "vitest";
import { empreinte } from "@/domaine/proximite/empreinte";

describe("empreinte de proximité", () => {
  it("« Avocat » et « avocats » donnent la même clé", () => {
    expect(empreinte({ sujet: "Avocat" }).cle).toBe(empreinte({ sujet: "avocats" }).cle);
  });
  it("ignore la casse, les accents, l'ordre et les mots vides", () => {
    expect(empreinte({ sujet: "Les Contrats de l'Équipe" }).cle).toBe(empreinte({ sujet: "equipe contrats" }).cle);
  });
  it("des sujets différents donnent des clés différentes", () => {
    expect(empreinte({ sujet: "avocat" }).cle).not.toBe(empreinte({ sujet: "comptable" }).cle);
  });
  it("accepte signatureUsine et la garde dans l'empreinte", () => {
    const e = empreinte({ sujet: "avocat", signatureUsine: "sig-fictive-1" });
    expect(e.signature).toBe("sig-fictive-1");
    expect(empreinte({ sujet: "avocat" }).signature).toBeUndefined();
  });
  it("sujet vide : aucun axe, clé vide, sans erreur", () => {
    const e = empreinte({ sujet: "  " });
    expect(e.axes).toEqual([]);
    expect(e.cle).toBe("");
  });
});
