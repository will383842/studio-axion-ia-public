/**
 * FIX-CC-ECRAN-SCRIPT-COMPLET · l'écran « Relire et valider le script » montre aussi ce que le Studio écrit de lui-même
 * (« Avant », « Maintenant », « Étape 01 / 05 », « Résultat »), pour que le sens soit vu AVANT la validation.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { trouverCas } from "@/formats/cas-concret/catalogue";
import { appliquerSaisie, differences } from "@/domaine/relecture-script";
import { appliquerModifications } from "@/moteurs/montage-cas-concret/modifier-script";
import { lignesDesEcrans, modificationsDesDifferences } from "@/moteurs/montage-cas-concret/relecture";
import { apercuDesEcrans, ficheDuScriptValide } from "@/moteurs/montage-cas-concret/script-valide";
import { SCRIPT_V4_RECRUTEMENT } from "@/moteurs/montage-cas-concret/scripts-valides/recrutement-apporteurs";

const PREFIXE = "Ajouté par le Studio : ";
const toutes = () => lignesDesEcrans(apercuDesEcrans(SCRIPT_V4_RECRUTEMENT.ecrans)).map((l) => ({ ...l, ecrits: l.ecrits ?? [] }));
/** Les lignes d'écran seules (`eNN`), une par écran : les poses sont sur des lignes `p-eNN` à part. */
const lignes = () => toutes().filter((l) => /^e\d+$/.test(l.id));
const idDe = (rang: number) => `e${String(rang + 1).padStart(2, "0")}`;
const ligneDePoses = (rang: number) => toutes().find((l) => l.id === `p-${idDe(rang)}`);
const textes = (type: string) => {
  const rang = SCRIPT_V4_RECRUTEMENT.ecrans.findIndex((e) => e.type === type);
  expect(rang).toBeGreaterThanOrEqual(0);
  return (ligneDePoses(rang)?.ecrits ?? []).map((e) => e.texte);
};

describe("l'écran de validation montre ce que le Studio pose", () => {
  it("a) l'écran résultat montre « Avant : … » et « Maintenant : … » avec les valeurs du script, et « Résultat »", () => {
    const t = textes("resultat");
    expect(t).toContain(`${PREFIXE}Avant : +1 H`);
    expect(t).toContain(`${PREFIXE}Maintenant : 15 MIN`);
    expect(t).toContain(`${PREFIXE}Résultat`);
  });

  it("b) un écran étape montre « Étape 01 / 05 » (nombres du script)", () => {
    const premiere = SCRIPT_V4_RECRUTEMENT.ecrans.find((e) => e.type === "etape") as unknown as { numero: number; total: number };
    const attendu = `Étape ${String(premiere.numero).padStart(2, "0")} / ${premiere.total}`;
    expect(textes("etape")).toContain(`${PREFIXE}${attendu}`);
    expect(attendu).toMatch(/^Étape 01 \/ \d+$/u);
    expect(textes("liste-avant")).toContain(`${PREFIXE}Avant`);
  });

  it("c) les poses sont sur une ligne verrouillée à part : jamais une modification, une frappe dessus ne change rien", () => {
    const l = toutes().find((x) => x.id.startsWith("p-"))!;
    expect(l.verrouille).toBe(true);
    expect(l.ecrits.every((e) => e.modifiable === false && e.texte.startsWith(PREFIXE))).toBe(true);
    expect(modificationsDesDifferences([{ id: l.id, ecrits: l.ecrits.map(() => "X") }])).toEqual([]);
    const apres = appliquerSaisie(toutes(), l.id, { ecrit: { index: 0, texte: "Autre" } });
    expect(apres).toEqual(toutes());
    expect(differences(toutes(), apres)).toEqual([]);
    // la ligne de l'écran, elle, ne contient plus aucune pose
    expect(lignes().every((x) => x.ecrits.every((e) => !e.texte.startsWith(PREFIXE)))).toBe(true);
    expect(modificationsDesDifferences([{ id: "f-instagram" }])).toEqual([]);
  });

  it.each(["resultat", "etape", "liste-avant"])("c bis) chemin complet : corriger un texte d'un écran « %s » est accepté (saisie → differences → modifications → appliquerModifications)", (type) => {
    const rang = SCRIPT_V4_RECRUTEMENT.ecrans.findIndex((e) => e.type === type);
    const avant = toutes();
    const ligne = avant.find((x) => x.id === idDe(rang))!;
    expect(ligneDePoses(rang)).toBeDefined();
    const k = ligne.ecrits.findIndex((e) => e.modifiable);
    expect(k).toBeGreaterThanOrEqual(0);
    const apres = appliquerSaisie(avant, ligne.id, { ecrit: { index: k, texte: "Texte corrigé par Will" } });
    const modifications = modificationsDesDifferences(differences(avant, apres));
    expect(modifications).toHaveLength(1);
    const fiche = ficheDuScriptValide(SCRIPT_V4_RECRUTEMENT, { videoId: "t", versionId: "t", habillage: "charte-duo/1", origine: "porte-a" }, trouverCas(SCRIPT_V4_RECRUTEMENT.casId)!);
    const r = appliquerModifications(fiche, modifications);
    expect(r).toMatchObject({ ok: true });
  });

  it("d) « Avant », « Maintenant », « Étape » sont mot pour mot dans le texte de dispositions.ts", () => {
    const src = readFileSync("studio-rendu/compositions/cas-concret/mises-en-page/dispositions.ts", "utf8");
    expect(src).toContain('"Avant"');
    expect(src).toContain('"Maintenant"');
    expect(src).toContain("`Étape ${");
    expect(textes("resultat").join("|")).toContain("Maintenant : ");
  });

  it("e) un écran sans pose : écrits identiques à ceux d'avant (rien d'ajouté, index inchangés)", () => {
    const rang = SCRIPT_V4_RECRUTEMENT.ecrans.findIndex((e) => e.type === "titre");
    const ap = apercuDesEcrans(SCRIPT_V4_RECRUTEMENT.ecrans)[rang]!;
    expect(ap.poses).toBeUndefined();
    expect(lignes()[rang]!.ecrits).toEqual((ap.ecrits ?? []).map((texte, k) => ({ texte, modifiable: ap.modifiables?.[k] === true })));
  });

  it("les écrits modifiables gardent leurs index : les poses viennent après", () => {
    for (const [i, e] of apercuDesEcrans(SCRIPT_V4_RECRUTEMENT.ecrans).entries()) {
      const n = (e.ecrits ?? []).length;
      expect(lignes()[i]!.ecrits.slice(0, n).map((x) => x.texte)).toEqual(e.ecrits ?? []);
      expect(lignes()[i]!.ecrits.slice(n).every((x) => !x.modifiable && x.texte.startsWith(PREFIXE))).toBe(true);
    }
  });
});
