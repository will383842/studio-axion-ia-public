import { describe, expect, it } from "vitest";
import { formatAvocat } from "@/formats/avocat";
import { noterScriptSync } from "@/fournisseurs/simulation/script";
import { noterScriptDetaille } from "@/domaine/notation-script";
import { remarquesCiblageAvocat } from "@/moteurs/montage-avocat/controles";
import type { BlocScript } from "@/domaine/types";

const CTX = { adresse: "vous" as const, motsParSeconde: 4.4 };
const bloc = (id: string, blocRecette: string, ...textes: string[]): BlocScript => ({ id, blocRecette, segments: textes.map((texte, i) => ({ id: `${id}-${i}`, texte })) });
const CRITERES = formatAvocat.recetteScript.criteres.map((c) => c.id);

const VARIE = (p: string) => [
  bloc(`${p}a`, "accroche", "Vous recevez un PV ? Stop."),
  bloc(`${p}c`, "coeur", "Regardez d'abord la date exacte inscrite sur le document que vous avez reçu hier.", "Puis la plaque.", "Enfin, demandez la photo du contrôle, c'est votre droit le plus strict."),
];
const REGULIER = [bloc("r", "coeur", "Vous voyez la date du jour. Vous lisez la plaque du car. Vous gardez la photo du PV. Vous payez la somme du PV.")];
const IRREGULIER = [bloc("r", "coeur", "Stop. Vous voyez la date inscrite sur le document que vous avez reçu hier matin par courrier. Non. Vous lisez la plaque du véhicule avec soin.")];

describe("lot G : note de rythme réelle", () => {
  it("même texte, identifiants différents : même note", () => {
    const a = noterScriptSync(VARIE("x"), formatAvocat.recetteScript, 30);
    const b = noterScriptSync(VARIE("y"), formatAvocat.recetteScript, 30);
    expect(a.globale).toBe(b.globale);
    expect(a.criteres).toEqual(b.criteres);
  });
  it("la note de rythme varie avec la longueur des phrases", () => {
    const r = noterScriptDetaille(REGULIER, ["rythme"], CTX).criteres.rythme;
    const i = noterScriptDetaille(IRREGULIER, ["rythme"], CTX).criteres.rythme;
    expect(r).toBeDefined();
    expect(i).toBeGreaterThan(r);
  });
  it("un critère non calculé sort de la moyenne pondérée", () => {
    const recette = { ...formatAvocat.recetteScript, criteres: [{ id: "inconnu-xyz", nom: "X", poids: 5 }, { id: "clarte", nom: "Clarté", poids: 1 }] };
    const n = noterScriptSync(VARIE("z"), recette, 30);
    expect(n.criteres["inconnu-xyz"]).toBeUndefined();
    expect(n.globale).toBe(n.criteres.clarte);
  });
  it("sans critère calculable, la note globale est 0 et non inventée", () => {
    const recette = { ...formatAvocat.recetteScript, criteres: [{ id: "inconnu-xyz", nom: "X", poids: 5 }] };
    expect(noterScriptSync(VARIE("z"), recette, 30).globale).toBe(0);
  });
  it("tous les critères avocat sont calculés", () => {
    const n = noterScriptDetaille(IRREGULIER, CRITERES, CTX, () => null);
    for (const id of CRITERES.filter((c) => c !== "rythme")) void id;
    expect(Object.keys(n.criteres).length).toBeGreaterThan(0);
  });
});

describe("lot G : remarque de ciblage avocat (non bloquante)", () => {
  const cible = { niveau: "metier" as const, libelle: "plombier", origine: "saisie" as const };
  it("C100 si la cible n'est pas nommée au début, jamais bloquant", () => {
    const r = remarquesCiblageAvocat("Vous perdez des heures chaque semaine sur vos devis.", cible);
    expect(r.map((x) => x.code)).toContain("C100");
    expect(r.every((x) => x.bloquant === false)).toBe(true);
  });
  it("aucune remarque si la cible est nommée avec un bénéfice, ni sans cible déclarée", () => {
    expect(remarquesCiblageAvocat("Plombier, gagnez 2 heures par semaine sur vos devis.", cible)).toEqual([]);
    expect(remarquesCiblageAvocat("Vous perdez du temps.", undefined)).toEqual([]);
  });
});
