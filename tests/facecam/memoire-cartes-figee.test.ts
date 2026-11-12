/**
 * GV-MD-05a — la mémoire des cartes (`dejaServis`, `ouverturePrecedente`) voyage avec la vidéo : lue sans lever,
 * gardée par la livraison (la première gagne), passée à la planification des cartes automatiques. Sans mémoire,
 * rien ne change.
 */
import { describe, expect, it } from "vitest";
import { lireEntreesFacecam } from "@/domaine/facecam";
import { entreesAvecLivraison } from "@/moteurs/montage-facecam/raccords";
import { cartesAutoDeLaVideo } from "@/moteurs/montage-facecam/cartes-video";
import { habillageFacecam, type EntreeHabillageFacecam } from "@/moteurs/montage-facecam/habillage";
import { planifierCartesAuto, type MotCarte } from "@/briques/habillage-facecam";

const PHRASE = "Trois erreurs coûtent 45 minutes par jour : la TVA, l'URSSAF et la CFE.";
const DUREE = 90;
/** Mots à 0,3 s : la phrase à deux modèles possibles, répétée toutes les 25 s. */
function mots(): MotCarte[] {
  const sortie: MotCarte[] = [];
  for (let t = 0; t < DUREE - 10; t += 25) {
    PHRASE.split(" ").forEach((mot, i) => sortie.push({ mot, debutSec: t + i * 0.3, finSec: t + i * 0.3 + 0.28 }));
  }
  return sortie;
}
const MOTS = mots();

describe("lireEntreesFacecam : memoireCartes", () => {
  it("une mémoire valide est gardée", () => {
    const m = { dejaServis: ["liste", "chiffre"], ouverturePrecedente: "liste" };
    expect(lireEntreesFacecam({ facecam: { memoireCartes: m } }).memoireCartes).toEqual(m);
  });
  it("une mémoire sans ouverture est gardée", () => {
    expect(lireEntreesFacecam({ facecam: { memoireCartes: { dejaServis: ["liste"] } } }).memoireCartes).toEqual({ dejaServis: ["liste"] });
  });
  it("une mémoire mal formée est écartée, sans lever", () => {
    for (const mauvaise of [null, 3, "x", [], {}, { dejaServis: "liste" }, { dejaServis: [1] }, { dejaServis: [""] }, { dejaServis: ["x".repeat(61)] }, { dejaServis: ["a"], ouverturePrecedente: 4 }, { dejaServis: ["a"], ouverturePrecedente: "x".repeat(61) }]) {
      expect("memoireCartes" in lireEntreesFacecam({ facecam: { memoireCartes: mauvaise } })).toBe(false);
    }
  });
  it("au-delà de 40 modèles : tronquée aux 40 premiers, jamais rejetée", () => {
    const longue = Array.from({ length: 55 }, (_, i) => `m${i}`);
    const lue = lireEntreesFacecam({ facecam: { memoireCartes: { dejaServis: longue, ouverturePrecedente: "m0" } } }).memoireCartes;
    expect(lue?.dejaServis).toEqual(longue.slice(0, 40));
    expect(lue?.ouverturePrecedente).toBe("m0");
  });
  it("absente : aucune clé memoireCartes", () => {
    expect("memoireCartes" in lireEntreesFacecam({})).toBe(false);
    expect("memoireCartes" in lireEntreesFacecam({ facecam: {} })).toBe(false);
  });
});

describe("entreesAvecLivraison : memoireCartes", () => {
  it("la livraison pose la mémoire si la vidéo n'en a pas", () => {
    const r = entreesAvecLivraison({ facecam: {} }, { memoireCartes: { dejaServis: ["liste"] } });
    expect(lireEntreesFacecam(r).memoireCartes).toEqual({ dejaServis: ["liste"] });
  });
  it("la livraison ne remplace pas une mémoire déjà sur la vidéo", () => {
    const r = entreesAvecLivraison({ facecam: { memoireCartes: { dejaServis: ["chiffre"] } } }, { memoireCartes: { dejaServis: ["liste"] } });
    expect(lireEntreesFacecam(r).memoireCartes).toEqual({ dejaServis: ["chiffre"] });
  });
  it("sans mémoire de part et d'autre, aucune clé", () => {
    const r = entreesAvecLivraison({ facecam: {} }, {}) as { facecam: Record<string, unknown> };
    expect("memoireCartes" in r.facecam).toBe(false);
  });
});

describe("cartesAutoDeLaVideo : la mémoire est passée à la planification", () => {
  it("sans mémoire : mêmes cartes qu'avant", () => {
    const a = cartesAutoDeLaVideo(MOTS, DUREE);
    const b = cartesAutoDeLaVideo(MOTS, DUREE, [], [], [], {});
    expect(b).toEqual(a);
  });
  it("avec mémoire : mêmes modèles que planifierCartesAuto(…, {}, mémoire)", () => {
    for (const m of [{ dejaServis: ["liste"] }, { dejaServis: ["chiffre", "liste"] }, { dejaServis: ["liste"], ouverturePrecedente: "liste" }]) {
      const attendu = planifierCartesAuto(MOTS, DUREE, {}, m).map((p) => p.carte.modele);
      const obtenu = cartesAutoDeLaVideo(MOTS, DUREE, [], [], [], m).vues.map((v) => v.modele);
      expect(obtenu).toEqual(attendu);
    }
  });
});

describe("habillageFacecam : mémoire vide = sans mémoire", () => {
  const base: EntreeHabillageFacecam = { pisteMonteeCle: "facecam/v/ver/montage.mov", dureeSec: DUREE, mots: MOTS.map((m) => ({ mot: m.mot, debutSec: m.debutSec, finSec: m.finSec })), prefixeCartes: "facecam/v/ver/cartes" };
  it("`memoireCartes: { dejaServis: [] }` égale l'entrée sans mémoire", () => {
    expect(habillageFacecam({ ...base, memoireCartes: { dejaServis: [] } })).toEqual(habillageFacecam(base));
  });
});
