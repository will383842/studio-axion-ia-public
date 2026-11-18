/**
 * FIX-CC-ECRAN-SCRIPT-COMPLET · l'écran « Relire et valider le script » montre aussi ce que le Studio écrit de lui-même
 * (« Avant », « Maintenant », « Étape 01 / 05 », « Résultat »), pour que le sens soit vu AVANT la validation.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { lignesDesEcrans, modificationsDesDifferences } from "@/moteurs/montage-cas-concret/relecture";
import { apercuDesEcrans } from "@/moteurs/montage-cas-concret/script-valide";
import { SCRIPT_V4_RECRUTEMENT } from "@/moteurs/montage-cas-concret/scripts-valides/recrutement-apporteurs";

const PREFIXE = "Ajouté par le Studio : ";
const lignes = () => lignesDesEcrans(apercuDesEcrans(SCRIPT_V4_RECRUTEMENT.ecrans)).map((l) => ({ ...l, ecrits: l.ecrits ?? [] }));
const textes = (type: string) => {
  const rang = SCRIPT_V4_RECRUTEMENT.ecrans.findIndex((e) => e.type === type);
  expect(rang).toBeGreaterThanOrEqual(0);
  return lignes()[rang]!.ecrits.map((e) => e.texte);
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

  it("c) une ligne « posée » n'est jamais modifiable : aucune modification produite", () => {
    const l = lignes().find((x) => x.ecrits.some((e) => e.texte.startsWith(PREFIXE)))!;
    expect(l.ecrits.filter((e) => e.texte.startsWith(PREFIXE)).every((e) => e.modifiable === false)).toBe(true);
    // Un texte modifié reste une modification comme avant ; les poses, placées après, restent à « inchangé » (null).
    const n = l.ecrits.length;
    const ecrits = l.ecrits.map((e, k) => (k === 0 && e.modifiable ? "Nouveau texte" : null));
    expect(modificationsDesDifferences([{ id: l.id, ecrits }])).toEqual([{ rang: Number(l.id.slice(1)), ecrits }]);
    expect(ecrits.slice(n - 1).every((x) => x === null)).toBe(true);
    expect(modificationsDesDifferences([{ id: "f-instagram" }])).toEqual([]);
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
