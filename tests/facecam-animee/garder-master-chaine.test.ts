/**
 * G11-09c (W-H, 17/11) : la chaîne v4 sait demander et garder le rendu brut (« master »), ÉTEINT par défaut.
 * Chemin réel : état à « rendu » (reprise du projet gardé) → vraie `avancerChaineV4` avec un `rendre` factice qui CAPTE son entrée
 * → vraie `resultatV4`. Aucun appel, aucune dépense, aucune clé de réglage lue ici (G11-09d la lira).
 */
import { describe, expect, it } from "vitest";
import { avancerChaineV4, couperPriseV4, VERSION_CHAINE_V4, type EtatChaineV4, type OutilsChaineV4 } from "@/moteurs/montage-facecam-animee/chaine-v4";
import { resultatV4 } from "@/moteurs/montage-facecam-animee";
import { projetMontageV4 } from "@/moteurs/montage-facecam-animee/projet-v4";
import { lireProjetGardeV4 } from "@/moteurs/montage-facecam-animee/retouche-gratuite";
import { etatRepriseAuRenduV4 } from "@/moteurs/montage-facecam-animee/reprise-rendu-v4";
import { planValide } from "./plan-reference";

const demande = { videoId: "v-1", versionId: "ver-1", priseCle: "prises/brute.mp4", titre: "T" };
const PAROLES = "Bonjour à tous aujourd'hui je vous montre comment gagner du temps chaque semaine avec Action IA sur vos vidéos courtes pour vos clients".split(" ");
const mots = PAROLES.map((mot, i) => ({ mot, debutSec: +(i * 0.4).toFixed(2), finSec: +(i * 0.4 + 0.3).toFixed(2) }));
const transcription = { mots, dureeSec: +(PAROLES.length * 0.4 + 1).toFixed(2), largeur: 1920, hauteur: 1080 };
const MASTER = "studio/dev/facecam-animee/v-1/fa4-ver-1-master.mp4";

/** État à « rendu » tiré du chemin réel de reprise (comme `reprise-rendu-v4.test.ts`). */
function etatAuRendu(): EtatChaineV4 {
  const coupes = couperPriseV4({ mots, dureeSec: transcription.dureeSec });
  const prete = {
    version: VERSION_CHAINE_V4,
    etape: "prete",
    demande,
    transcription,
    cadrage: { x: 656, largeur: 608, hauteur: 1080, visage: true, centreX: 0.5 },
    coupes,
    realisation: { version: "complete", essais: 2, avertissements: 1, plan: planValide() },
    videos: { fichiers: [], retirees: [], manques: [] },
    planScenes: { entree: "e", remarques: ["r"], plan: null },
    rendu: { cle: "rendus/v.mp4", vignetteCle: "rendus/v.jpg", dureeSec: coupes.dureeSec, taille: 10 },
  } as unknown as EtatChaineV4;
  const e = etatRepriseAuRenduV4(lireProjetGardeV4(projetMontageV4(prete))!, demande)!;
  expect(e.etape).toBe("rendu");
  return e;
}

/** Outils factices : `rendre` capte son entrée ; `avecMaster` : il rend aussi la clé et la taille du master. */
function outilsCapteurs(extra: Partial<OutilsChaineV4>, avecMaster: boolean) {
  const entrees: Record<string, unknown>[] = [];
  const outils = {
    transcrire: async () => {
      throw new Error("jamais appelé au pas « rendu »");
    },
    plafondClaudeAtteint: async () => false,
    rendre: async (d: Record<string, unknown>) => {
      entrees.push(d);
      return { cle: "rendus/fa4-ver-1.mp4", vignetteCle: "rendus/fa4-ver-1.jpg", dureeSec: 9.5, taille: 12_000_000, ...(avecMaster ? { masterCle: MASTER, tailleMaster: 300_000_000 } : {}) };
    },
    ...extra,
  } as unknown as OutilsChaineV4;
  return { outils, entrees };
}

async function rendre(extra: Partial<OutilsChaineV4>, avecMaster = false) {
  const { outils, entrees } = outilsCapteurs(extra, avecMaster);
  const etat = await avancerChaineV4(etatAuRendu(), outils);
  expect(etat.etape).toBe("prete");
  expect(entrees).toHaveLength(1);
  return { etat, entree: entrees[0] };
}

describe("G11-09c : éteint = identique", () => {
  it("sans garderMaster, false ou undefined : même entrée de rendre (aucune clé garderMaster), aucun master gardé", async () => {
    const reference = await rendre({});
    expect(Object.keys(reference.entree)).not.toContain("garderMaster");
    expect(reference.etat.rendu).not.toHaveProperty("masterCle");
    expect(reference.etat.rendu).not.toHaveProperty("tailleMaster");
    expect(resultatV4(reference.etat).projetMontage).not.toHaveProperty("masterCle");
    for (const extra of [{ garderMaster: false }, { garderMaster: undefined }] as Partial<OutilsChaineV4>[]) {
      const r = await rendre(extra);
      expect(r.entree).toEqual(reference.entree);
      expect(Object.keys(r.entree)).toEqual(Object.keys(reference.entree));
      expect(r.etat).toEqual(reference.etat);
      expect(r.etat.rendu).not.toHaveProperty("masterCle");
      expect(resultatV4(r.etat).projetMontage).toEqual(resultatV4(reference.etat).projetMontage);
    }
  });
});

describe("G11-09c : allumé (garderMaster: true)", () => {
  it("demande le master, le garde dans l'état et le porte au projet de montage", async () => {
    const eteint = await rendre({});
    const { etat, entree } = await rendre({ garderMaster: true }, true);
    expect(entree.garderMaster).toBe(true);
    const reste = { ...entree };
    delete reste.garderMaster;
    expect(reste).toEqual(eteint.entree);
    expect(etat.rendu?.masterCle).toBe(MASTER);
    expect(etat.rendu?.tailleMaster).toBe(300_000_000);
    const projet = resultatV4(etat).projetMontage as Record<string, unknown>;
    expect(projet.masterCle).toBe(MASTER);
    const projetEteint = resultatV4(eteint.etat).projetMontage as Record<string, unknown>;
    for (const cle of ["moteur", "squelette", "version", "charte", "plaquettes", "essaisClaude"]) expect(projet[cle]).toEqual(projetEteint[cle]);
  });
});
