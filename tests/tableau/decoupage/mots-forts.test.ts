/** Mots forts rendus en GROUPES par le modèle : remis en mots seuls avant les règles (la règle, elle, ne bouge pas). */
import { describe, expect, it } from "vitest";
import { normaliserEcrans, roleDecoupageTableau, CONSIGNE_DECOUPAGE } from "../../../src/moteurs/montage-tableau/decoupage";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { regleEcrans } from "../../../src/moteurs/montage-tableau/regles";
import { copie, ficheErreurCorrigee } from "../regles/exemples";

const LIGNES = ["Devis envoyé. Puis plus rien.", "Les relances partent seules, une fois, avec envoi à date."];

function ficheAvec(motsForts: string[], motCommentaire?: string): FicheTableau {
  const f = copie(ficheErreurCorrigee);
  const s = f.scenes[0];
  s.elements = LIGNES.map((texte, i) => ({ id: `ml${i}`, type: "ligne" as const, texte, niveau: "texte" as const, role: "condition" as const, ancre: i }));
  s.ecrans = [{ moment: "douleur", ancre: 0, motsForts, ...(motCommentaire ? { motCommentaire } : {}) }];
  return f;
}
const ecran = (f: unknown) => (f as FicheTableau).scenes[0].ecrans![0];

describe("normaliserEcrans", () => {
  it("les quatre groupes du 12/10 : refusés tels quels, acceptés une fois remis en mots seuls", () => {
    const f = ficheAvec(["plus rien", "partent seules", "une fois", "envoi à date"]);
    expect(regleEcrans(f).length).toBeGreaterThan(0);
    const n = normaliserEcrans(f);
    expect(regleEcrans(n as FicheTableau)).toEqual([]);
    // « à » (1 lettre, venu d'un groupe) est écarté ; plafond de 4.
    expect(ecran(n).motsForts).toEqual(["plus", "rien", "partent", "seules"]);
  });

  it("un mot fort absent de toute ligne est retiré, pas refusé ; le champ disparaît s'il ne reste rien", () => {
    const n = normaliserEcrans(ficheAvec(["inventé", "Devis.", "devis", "autre chose"]));
    expect(ecran(n).motsForts).toEqual(["Devis"]);
    const vide = normaliserEcrans(ficheAvec(["inventé"]));
    expect(ecran(vide)).not.toHaveProperty("motsForts");
    expect(regleEcrans(vide as FicheTableau)).toEqual([]);
  });

  it("motCommentaire : casse et ponctuation seulement ; rien d'inventé", () => {
    expect(ecran(normaliserEcrans(ficheAvec([], "DEVIS!"))).motCommentaire).toBe("Devis");
    expect(ecran(normaliserEcrans(ficheAvec([], "absent"))).motCommentaire).toBe("absent");
  });

  it("ne modifie pas l'entrée et laisse intact ce qui n'est pas une fiche", () => {
    const f = ficheAvec(["plus rien"]);
    normaliserEcrans(f);
    expect(ecran(f).motsForts).toEqual(["plus rien"]);
    expect(normaliserEcrans("x")).toBe("x");
  });

  it("la consigne demande des mots seuls et la version du rôle a monté", () => {
    expect(CONSIGNE_DECOUPAGE).toContain("des mots SEULS (un seul mot par entrée)");
    expect(roleDecoupageTableau.version).toBeGreaterThanOrEqual(10);
  });
});
