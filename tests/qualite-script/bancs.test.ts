/**
 * BANCS DE NON-RÉGRESSION DU SOCLE QUALITÉ : les scripts VALIDÉS PAR WILL doivent sortir au vert. Si l'un rougit,
 * c'est la règle qui est fausse, pas le script (plan socle qualité § 5.1).
 *  1. le témoin du tableau « Ce devis collé dans ChatGPT… » (`docs/formats/tableau-anime-scripts/exemples-v4/01-formation.md`) ;
 *  2. le cas concret v4 « On recrute nos collaborateurs en quinze minutes » (`scripts-valides/recrutement-apporteurs.ts`) ;
 *  3. les extraits v4 de `modeles-will.ts` (W01-W09), lus comme un script face caméra.
 * « Vert » ici : voyant vert, aucune règle qui serait bloquante en écart, les 8 fonctions minimales présentes, chaque
 * thème à 7/10 au moins.
 */
import { describe, expect, it } from "vitest";
import { evaluerQualite, type RapportQualite } from "@/domaine/qualite-script";
import { depuisEcransCasConcret } from "@/domaine/qualite-script/adaptateurs/cas-concret";
import { depuisLignes } from "@/domaine/qualite-script/adaptateurs/commun";
import { depuisScriptTableau } from "@/domaine/qualite-script/adaptateurs/tableau";
import { RECETTE_CAS_CONCRET, RECETTE_ECRIRE_FACECAM, RECETTE_TABLEAU } from "@/domaine/qualite-script/recettes";
import { EXTRAITS_WILL } from "@/donnees/generateur/modeles-will";
import { SCRIPT_V4_RECRUTEMENT } from "@/moteurs/montage-cas-concret/scripts-valides/recrutement-apporteurs";
import { exempleV4 } from "../tableau-scripts/exemples-v4";

function auVert(r: RapportQualite, fonctionsEnAlerte: readonly string[] = []) {
  const bloquants = r.resultats.filter((x) => x.statut === "ecart" && x.niveauVise === "bloquant");
  expect(bloquants, JSON.stringify(bloquants)).toEqual([]);
  expect(r.voyant).toBe("vert");
  expect(Object.entries(r.fonctions).filter(([f, ok]) => !ok && !fonctionsEnAlerte.includes(f))).toEqual([]);
  for (const [theme, note] of Object.entries(r.notes)) if (note !== null) expect(note, theme).toBeGreaterThanOrEqual(7);
  // Mode observation : rien ne bloque, tout s'affiche en « info ».
  expect(r.mode).toBe("observation");
  expect(r.pastilles.every((p) => p.niveau === "info")).toBe(true);
}

describe("banc 1 · témoin du tableau (01-formation, validé par Will le 15/10)", () => {
  const ex = exempleV4("01-formation");
  const r = evaluerQualite(depuisScriptTableau(ex.ecriture.script, { dureeViseeSec: ex.demande.duree }), RECETTE_TABLEAU);

  /*
   * Rythme du lot B2a (165 mots/min, recette « voix-tableau/3 », 16,9 caractères par seconde) : la 1re phrase du témoin
   * (59 caractères) finit à 3,55 s au lieu de 3,05 s. AC-02 (alerte du socle, en observation, jamais bloquante) se
   * déclenchait alors presque toujours au-delà de ~50 caractères. Tranché au lot B2b : la recette du tableau recale le
   * seuil à 4,4 s (12 mots, le maximum de la 1re phrase, à 2,75 mots/s = 4,4 s) ; voir `recettes/tableau.ts`.
   */
  it("sort au vert, sans aucun écart : la 1re phrase finit à 3,55 s, sous le seuil recalé de 4,4 s (voix à 165 mots/min)", () => {
    auVert(r);
    expect(r.resultats.filter((x) => x.statut === "ecart" || x.statut === "a-trancher")).toEqual([]);
    expect(r.resultats.find((x) => x.code === "AC-02")?.message).toBe("1re phrase finie à 3.55 s.");
  });
  it("mesure ce que dit la fiche du témoin : 67,7 s, 1re phrase de 10 mots, phrase la plus longue 13 mots", () => {
    expect(r.dureeSec).toBe(67.7);
    expect(r.resultats.find((x) => x.code === "AC-01")?.message).toBe("1re phrase : 10 mots.");
    expect(r.resultats.find((x) => x.code === "RT-01")?.message).toBe("Phrase la plus longue : 13 mots.");
  });
  it("reconnaît sa boucle implicite tenue (« trois réflexes »… « Trois. ») et sa demande unique liée à l'idée", () => {
    expect(r.resultats.find((x) => x.code === "RT-03")?.message).toContain("tenue");
    expect(r.resultats.find((x) => x.code === "PR-02")?.statut).toBe("ok");
    expect(r.resultats.find((x) => x.code === "PO-01")?.statut).toBe("ok");
  });
});

describe("banc 2 · cas concret v4 « recrutement-apporteurs » (validé par Will le 11/10)", () => {
  const r = evaluerQualite(depuisEcransCasConcret(SCRIPT_V4_RECRUTEMENT.ecrans), RECETTE_CAS_CONCRET);

  it("sort au vert, sans aucun écart", () => {
    auVert(r);
    expect(r.resultats.filter((x) => x.statut === "ecart" || x.statut === "a-trancher")).toEqual([]);
  });
  it("mesure le changement à l'écran sur ses vrais écrans et événements (2,5 s au plus)", () => {
    expect(r.resultats.find((x) => x.code === "RT-06")?.statut).toBe("ok");
  });
  it("« voici ce qu'on met en place » (« on a tout automatisé », « notre seul travail ») n'est pas un interdit", () => {
    expect(r.resultats.filter((x) => x.theme === "positionnement" && x.statut !== "ok")).toEqual([]);
  });
});

describe("banc 3 · extraits v4 de Will (modeles-will.ts)", () => {
  // W01 se lit en deux temps, comme dans la v4 : l'accroche, puis sa reprise (l'écran « chiffre », la preuve).
  const [accroche, reprise] = EXTRAITS_WILL[0].extrait.split(/(?<=\.)\s+/);
  const lignes = [
    { id: "W01a", dit: accroche, partie: "accroche" },
    { id: "W01b", dit: reprise, partie: "preuve" },
    ...EXTRAITS_WILL.slice(1).map((e, i) => ({ id: e.code, dit: e.extrait, partie: (["douleur", "douleur", "corps", "corps", "corps", "preuve", "question", "appel"] as const)[i] })),
  ] as const;
  const banc = (reseau: "instagram" | "linkedin") => evaluerQualite({ ...depuisLignes(lignes, (l) => (l as (typeof lignes)[number]).partie), reseau }, RECETTE_ECRIRE_FACECAM);

  it("sort au vert sur Instagram (« Écrivez PLAN en commentaire » y est permis)", () => {
    const r = banc("instagram");
    auVert(r);
    expect(r.resultats.filter((x) => x.statut === "ecart")).toEqual([]);
  });
  it("sur LinkedIn aussi, la même fin est au vert (« écrivez MOT en commentaire » permis, décision de Will du 17/10)", () => {
    const r = banc("linkedin");
    auVert(r);
    expect(r.resultats.filter((x) => x.statut === "ecart")).toEqual([]);
    expect(r.voyant).toBe("vert");
  });
});
