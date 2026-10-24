/** Clarté des scripts · le contrat `recit` d'un cas : facultatif, strict, sujet de 8 mots au plus, mots clés pris dans le sujet. */
import { describe, expect, it } from "vitest";
import { empreinteCas, verifierCas } from "@/formats/cas-concret/cas";
import { CATALOGUE_TS } from "@/formats/cas-concret/catalogue/base";
import { trouverCas } from "@/formats/cas-concret/catalogue";
import { RECIT_LT02 } from "./recits-de-test";

const lt02 = trouverCas("transporteur-demandes-de-cotation")!;
const avec = (recit: unknown) => verifierCas({ ...lt02, recit });

describe("recit · contrat du cas", () => {
  it("un récit valide passe", () => {
    const r = avec(RECIT_LT02);
    expect(r.ok).toBe(true);
  });
  it("un mot clé absent du sujet est refusé", () => {
    const r = avec({ ...RECIT_LT02, motsCles: ["demandes", "camion"] });
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r)).toContain("n'est pas dans le sujet");
  });
  it("un sujet de 9 mots est refusé", () => {
    expect(avec({ ...RECIT_LT02, sujet: "Vos demandes de prix arrivent toujours sans le poids du colis.", motsCles: ["demandes", "prix"] }).ok).toBe(false);
  });
  it("moins de 2 ou plus de 3 mots clés, ou un champ en plus : refusé", () => {
    expect(avec({ ...RECIT_LT02, motsCles: ["demandes"] }).ok).toBe(false);
    expect(avec({ ...RECIT_LT02, motsCles: ["vos", "demandes", "prix", "poids"] }).ok).toBe(false);
    expect(avec({ ...RECIT_LT02, extra: 1 }).ok).toBe(false);
  });
  it("les accents et la casse ne comptent pas pour les mots clés", () => {
    expect(avec({ ...RECIT_LT02, sujet: "Vos DEMANDES de prix arrivent sans poids.", motsCles: ["demandés", "prix"] }).ok).toBe(true);
  });
  it("un cas sans récit reste valide et son empreinte ne bouge pas (les 22 du catalogue)", () => {
    for (const c of CATALOGUE_TS) {
      expect("recit" in c).toBe(false);
      const r = verifierCas(c);
      expect(r.ok, c.id).toBe(true);
      if (r.ok) expect(empreinteCas(r.cas)).toBe(empreinteCas(c));
    }
  });
});

import { patronsDeLaVideo } from "@/moteurs/montage-cas-concret/patrons-ecriture";

describe("recit · patrons", () => {
  it("avec un récit, 200 tirages sans defi, contraste d'accroche, detour, constat ni choix", () => {
    for (let i = 0; i < 200; i++) {
      const p = patronsDeLaVideo(`video-${i}`, 0, undefined, undefined, { recit: true });
      expect(p.accroche.id).not.toBe("defi");
      expect(p.accroche.id).not.toBe("contraste");
      expect(p.bascule.id).not.toBe("detour");
      expect(p.bascule.id).not.toBe("constat");
      expect(p.question.id).not.toBe("choix");
      expect(p.avant.id).toBe("scene");
    }
  });
  it("sans l'option, les tirages sont ceux de toujours", () => {
    for (let i = 0; i < 50; i++) {
      expect(patronsDeLaVideo(`video-${i}`, 0, undefined, undefined, { recit: false })).toEqual(patronsDeLaVideo(`video-${i}`));
    }
  });
  it("avec une structure qui n'en laisse aucun, la liste de la structure est gardée", () => {
    // probleme-solution : avant = cout, question, verbes ; aucun n'est « scene » : on garde la liste de la structure.
    for (let i = 0; i < 50; i++) expect(["cout", "question", "verbes"]).toContain(patronsDeLaVideo(`v-${i}`, 0, "probleme-solution", "integration", { recit: true }).avant.id);
  });
});

import { recettePour } from "@/formats/cas-concret/recette";
import { textesImposesDuCas, variableEcriture } from "@/moteurs/montage-cas-concret/ecriture";

describe("recit · partie variable", () => {
  const avecRecit = { ...lt02, recit: RECIT_LT02 };
  it("le bloc <recit> suit <cible> quand le cas a un récit, et n'apparaît pas sinon", () => {
    const v = variableEcriture(avecRecit, recettePour(avecRecit));
    expect(v).toContain("<recit>\nsujet : Vos demandes de prix arrivent sans le poids.\nscene : Un client écrit");
    expect(v).toContain("exemple : la demande de ce client\nmots_cles : demandes, prix, poids\n</recit>");
    expect(v.indexOf("<recit>")).toBeGreaterThan(v.indexOf("<cible>"));
    expect(variableEcriture(lt02, recettePour(lt02))).not.toContain("<recit>");
  });
  it("le sujet est un texte imposé du cas (jamais compté comme une reprise)", () => {
    expect(textesImposesDuCas(avecRecit)).toContain(RECIT_LT02.sujet);
    expect(textesImposesDuCas(lt02)).not.toContain(RECIT_LT02.sujet);
  });
});
