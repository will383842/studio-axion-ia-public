/**
 * Variété « Image → vidéo » · axe 10, intensité des sous-titres (lot TYP-SOU) : SOU-C (appuyés) → intensité « Très
 * dynamique » de la brique ; SOU-B (référence) et sans recette : inchangé. Toujours dans la bande (Q22).
 * GV-ST-03b : le tirage par version est ÉTEINT (le style de la Bibliothèque fait loi) : SOU-C/D/E donnent désormais les
 * mêmes sous-titres que SOU-B (charte duo) ; les tests ci-dessous vérifient ce nouveau comportement.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { RecetteVarieteIV } from "@/briques/schema-motion/variete";
import type { CarteImage } from "@/domaine/image-video/carte";
import { RESEAUX_IV, type ReseauIV } from "@/domaine/image-video/plafonds";
import { idElementBruitage, SONS_BANQUE } from "@/donnees/bruitages";
import type { BruitageValideIV } from "@/moteurs/montage-image-video/bruitages";
import { pisteSimulee } from "@/moteurs/montage-image-video/calage";
import { FICHES_SIMULEES } from "@/moteurs/montage-image-video/ecriture.simulation";
// 26/10/2026 : valeurs de référence (octet pour octet) calculées sur le plan des fins d'AVANT (fin « diagnostic », LinkedIn muet) :
// elles prouvent que le rendu ne change pas pour un plan inchangé, quelles que soient les fins posées aujourd'hui.
import { planDesFinsAvant as planDesFinsIV } from "../plan-des-fins-avant";
import { mettreEnSceneIV } from "@/moteurs/montage-image-video/mise-en-scene";
import { codeSousTitresIV, controlerVariationsIV, intensiteSousTitresIV, sousTitresVariesIV, surlignageSousTitresIV } from "@/moteurs/montage-image-video/sous-titres-varies";
import { RECETTE_REFERENCE_IV } from "@/moteurs/montage-image-video/variete/tirage";
import type { SegmentSousTitres } from "@/domaine/types";

const DOSSIER = join(process.cwd(), "tests/image-video/fixtures/cartes");
const carteDe = (nom: string): CarteImage => JSON.parse(readFileSync(join(DOSSIER, `${nom}.json`), "utf8"));
const VALIDES: BruitageValideIV[] = SONS_BANQUE.map((s) => ({ elementId: idElementBruitage(s), declencheur: s.declencheur, variante: s.variante, dureeSec: s.dureeSec }));
const NOMS = ["A", "B", "C", "D", "E", "F"];

function miseEnScene(nom: string, reseau: ReseauIV, sousTitres?: RecetteVarieteIV["sousTitres"], format?: "4:5") {
  const carte = carteDe(nom);
  const fiche = FICHES_SIMULEES[`essai-${nom.toLowerCase()}` as keyof typeof FICHES_SIMULEES];
  const fin = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit }).fins.find((f) => f.reseaux.includes(reseau))!;
  return mettreEnSceneIV({ carte, fiche, voix: pisteSimulee(fiche, fin.muet ? null : fin), fin, reseaux: fin.reseaux, bruitagesValides: VALIDES, ...(format ? { format } : {}), ...(sousTitres ? { variete: { ...RECETTE_REFERENCE_IV, sousTitres } } : {}) });
}

const accents = (s: readonly SegmentSousTitres[]) => s.filter((x) => x.style === "impact" || x.style === "bandeau");
/** Mots mis en avant : ceux d'un accent (Impact, Bandeau) ou soulignés. */
const misEnAvant = (s: readonly SegmentSousTitres[]) => s.filter((x) => x.style === "impact" || x.style === "bandeau" || !!x.souligne).reduce((n, x) => n + x.mots.length, 0);

/** Empreinte des sous-titres variés SANS recette, 6 cartes × 5 réseaux (figée sur la branche du socle f3c79ec, avant le lot). */
// 19/10/2026 : TikTok retiré d'Image → vidéo (décision de Will) : 4 réseaux. Recalculée sur master (#551 compris) avec YouTube Shorts à la place de TikTok : même valeur que sur cette branche.
const EMPREINTE_SANS_RECETTE = "eb5b9209eee6358f18c9b5937ce71711858301084b05f981f87eb1c686858b47";

describe("sous-titres · sans recette, rien ne change", () => {
  it("6 cartes × 4 réseaux : sous-titres variés identiques à ceux d'avant le lot", { timeout: 60_000 }, () => {
    const h = createHash("sha256");
    for (const nom of NOMS) for (const r of RESEAUX_IV) h.update(JSON.stringify(sousTitresVariesIV(miseEnScene(nom, r).ligne)));
    expect(h.digest("hex")).toBe(EMPREINTE_SANS_RECETTE);
  });

  it("SOU-B (référence) et SOU-A (retirée) : comme sans recette", () => {
    const sans = sousTitresVariesIV(miseEnScene("C", "youtube-shorts").ligne);
    // Intégration (défaut vu à l'œil : accent en contour illisible sur l'appoint de l'ouverture) : la recette pose une
    // ouverture (OUV-D, référence) ; pendant elle, aucun accent en 9:16. Le mélange de la brique étant global, les accents
    // se répartissent alors autrement ; les mots, leurs heures et l'intensité restent ceux de « sans recette ».
    const mots = (l: typeof sans) => l.map((x) => [x.debutSec, x.finSec, x.mots.map((m) => [m.mot, m.debutSec, m.finSec])]);
    for (const code of ["SOU-B", "SOU-A"] as const) {
      const l = miseEnScene("C", "youtube-shorts", code).ligne;
      const ouv = l.blocs.find((b) => b.sorte === "variete" && b.axe === "ouverture")!;
      const dans = (x: { debutSec: number; finSec: number }) => x.debutSec < ouv.fin - 1e-6 && x.finSec > ouv.debut + 1e-6;
      const avec = sousTitresVariesIV(l);
      expect(mots(avec), code).toEqual(mots(sans));
      expect(avec.filter(dans).every((x) => x.style === "base"), code).toBe(true);
      expect(intensiteSousTitresIV(l), code).toBe("equilibre");
    }
    expect(intensiteSousTitresIV({})).toBe("equilibre");
    // GV-ST-03b : avant, SOU-C donnait « tres-dynamique » ; le tirage étant éteint, l'intensité reste « equilibre ».
    expect(intensiteSousTitresIV({ variete: { recette: { ...RECETTE_REFERENCE_IV, sousTitres: "SOU-C" }, format: "9:16", replis: [] } })).toBe("equilibre");
  });
});

describe("sous-titres · SOU-C appuyés", () => {
  // GV-ST-03b : avant, SOU-C donnait d'autres segments que SOU-B ; le tirage étant éteint, ils sont identiques.
  it("SOU-C donne les mêmes segments que SOU-B (carte C), le tirage par version étant éteint", () => {
    expect(JSON.stringify(sousTitresVariesIV(miseEnScene("C", "youtube-shorts", "SOU-C").ligne))).toBe(JSON.stringify(sousTitresVariesIV(miseEnScene("C", "youtube-shorts", "SOU-B").ligne)));
  });

  // GV-ST-03b : avant, SOU-C mettait plus de mots et d'accents en avant que SOU-B (greaterThan) ; désormais égalité.
  it("carte C : autant de mots mis en avant et d'accents que SOU-B ; mêmes mots, mêmes heures", () => {
    const b = miseEnScene("C", "youtube-shorts", "SOU-B");
    const c = miseEnScene("C", "youtube-shorts", "SOU-C");
    const sb = sousTitresVariesIV(b.ligne);
    const sc = sousTitresVariesIV(c.ligne);
    expect(misEnAvant(sc)).toBe(misEnAvant(sb));
    expect(accents(sc).length).toBe(accents(sb).length);
    expect(sc.map((s) => s.mots.map((m) => [m.mot, m.debutSec, m.finSec]))).toEqual(sb.map((s) => s.mots.map((m) => [m.mot, m.debutSec, m.finSec])));
  });

  it("6 cartes × 5 réseaux : toujours dans la bande, jamais collés, jamais sur la question (Q22 vert)", { timeout: 60_000 }, () => {
    for (const nom of NOMS) {
      for (const r of RESEAUX_IV) {
        const res = miseEnScene(nom, r, "SOU-C");
        const segments = sousTitresVariesIV(res.ligne);
        expect(controlerVariationsIV(segments, res.ligne), `${nom} ${r}`).toEqual([]);
        const q22 = res.rapport.lignes.find((l) => l.code === "Q22")!;
        expect(q22.ok, `${nom} ${r} ${q22.details.join(" ")}`).toBe(true);
        for (const s of accents(segments)) expect(s.position).toBe("milieu");
      }
    }
  });
});

describe("sous-titres · SOU-D (surlignage) et SOU-E (calme, à l'envers)", () => {
  // GV-ST-03b : avant, SOU-D posait un surlignage (toHaveProperty) ; le tirage étant éteint, aucun surlignage tiré.
  it("SOU-D : pas de surlignage tiré, mélange de SOU-B ; SOU-E : mots et heures inchangés, pas de surlignage", () => {
    const b = miseEnScene("C", "youtube-shorts", "SOU-B").ligne;
    const d = miseEnScene("C", "youtube-shorts", "SOU-D").ligne;
    const e = miseEnScene("C", "youtube-shorts", "SOU-E").ligne;
    expect(surlignageSousTitresIV(d)).toEqual({});
    expect(surlignageSousTitresIV(e)).toEqual({});
    expect(surlignageSousTitresIV(b)).toEqual({});
    expect(JSON.stringify(sousTitresVariesIV(d))).toBe(JSON.stringify(sousTitresVariesIV(b)));
    const mots = (l: SegmentSousTitres[]) => l.map((x) => x.mots.map((m) => [m.mot, m.debutSec, m.finSec]));
    expect(mots(sousTitresVariesIV(e))).toEqual(mots(sousTitresVariesIV(b)));
  });

  for (const format of [undefined, "4:5"] as const) {
    // GV-ST-03b : avant, « retours » comptait les versions retombées sur SOU-B (0 en 9:16, au plus 30 en 4:5) ; le tirage
    // étant éteint, aucune version ne garde SOU-D/SOU-E (code effectif absent) : on le vérifie, et Q22 reste vert.
    it(`6 cartes × 5 réseaux en ${format ?? "9:16"} : Q22 vert pour SOU-D et SOU-E, aucun code tiré`, { timeout: 60_000 }, () => {
      let retours = 0; // versions dont le code SOU-D/SOU-E n'est pas gardé (toutes, le tirage étant éteint)
      for (const code of ["SOU-D", "SOU-E"] as const) {
        for (const nom of NOMS) {
          for (const r of RESEAUX_IV) {
            const res = miseEnScene(nom, r, code, format);
            expect(controlerVariationsIV(sousTitresVariesIV(res.ligne), res.ligne), `${code} ${nom} ${r}`).toEqual([]);
            for (const s of accents(sousTitresVariesIV(res.ligne))) expect(s.position).toBe("milieu");
            if (codeSousTitresIV(res.ligne) !== code) retours++;
          }
        }
      }
      expect(retours).toBe(2 * NOMS.length * RESEAUX_IV.length);
    });
  }
});
