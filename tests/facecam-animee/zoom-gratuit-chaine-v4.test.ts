/**
 * C8-Z09-v19b (= C8-Z09b-b) : la chaîne v4 envoie les zooms gratuits au rendu, SEULEMENT si `zoomGratuit: true` (éteint par défaut).
 * Chemin réel : état à « rendu » → vraie `avancerChaineV4` avec un `rendre` factice qui CAPTE son entrée. 0 €, aucune clé lue.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { avancerChaineV4, couperPriseV4, VERSION_CHAINE_V4, type EtatChaineV4, type OutilsChaineV4 } from "@/moteurs/montage-facecam-animee/chaine-v4";
import { projetMontageV4 } from "@/moteurs/montage-facecam-animee/projet-v4";
import { lireProjetGardeV4 } from "@/moteurs/montage-facecam-animee/retouche-gratuite";
import { etatRepriseAuRenduV4 } from "@/moteurs/montage-facecam-animee/reprise-rendu-v4";
import { planValide } from "./plan-reference";

const demande = { videoId: "v-1", versionId: "ver-1", priseCle: "prises/brute.mp4", titre: "T" };
const PAROLES = "Bonjour à tous aujourd'hui je vous montre comment gagner du temps chaque semaine avec Action IA sur vos vidéos courtes pour vos clients".split(" ");
const mots = PAROLES.map((mot, i) => ({ mot, debutSec: +(i * 0.4).toFixed(2), finSec: +(i * 0.4 + 0.3).toFixed(2) }));
const dureeSec = 36;
const transcriptionDuree = +(PAROLES.length * 0.4 + 1).toFixed(2);
/** 6 gardes de 6 s : 5 raccords, à 6, 12, 18, 24 et 30 s de la prise montée. */
const GARDES = [0, 1, 2, 3, 4, 5].map((i) => ({ debutSec: i * 7, finSec: i * 7 + 6 }));

function etatAuRendu(opts: { cadrage?: boolean; dims?: { largeur?: number; hauteur?: number }; gardes?: { debutSec: number; finSec: number }[] }): EtatChaineV4 {
  const coupes = couperPriseV4({ mots, dureeSec: transcriptionDuree });
  const dims = opts.dims ?? { largeur: 1920, hauteur: 1080 };
  const prete = {
    version: VERSION_CHAINE_V4,
    etape: "prete",
    demande,
    transcription: { mots, dureeSec: transcriptionDuree, ...dims },
    ...(opts.cadrage === false ? {} : { cadrage: { x: 656, largeur: 608, hauteur: 1080, visage: true, centreX: 0.5 } }),
    coupes,
    realisation: { version: "complete", essais: 2, avertissements: 1, plan: planValide() },
    videos: { fichiers: [], retirees: [], manques: [] },
    planScenes: { entree: "e", remarques: ["r"], plan: null },
    rendu: { cle: "rendus/v.mp4", vignetteCle: "rendus/v.jpg", dureeSec: coupes.dureeSec, taille: 10 },
  } as unknown as EtatChaineV4;
  const e = etatRepriseAuRenduV4(lireProjetGardeV4(projetMontageV4(prete))!, demande)!;
  expect(e.etape).toBe("rendu");
  return { ...e, transcription: { ...e.transcription!, ...dims }, coupes: { ...e.coupes!, gardes: opts.gardes ?? GARDES, dureeSec } } as EtatChaineV4;
}

async function rendre(extra: Partial<OutilsChaineV4>, opts: Parameters<typeof etatAuRendu>[0] = {}) {
  const entrees: Record<string, unknown>[] = [];
  const outils = {
    transcrire: async () => {
      throw new Error("jamais appelé au pas « rendu »");
    },
    plafondClaudeAtteint: async () => false,
    rendre: async (d: Record<string, unknown>) => {
      entrees.push(d);
      return { cle: "rendus/fa4-ver-1.mp4", vignetteCle: "rendus/fa4-ver-1.jpg", dureeSec, taille: 12_000_000 };
    },
    ...extra,
  } as unknown as OutilsChaineV4;
  const etat = await avancerChaineV4(etatAuRendu(opts), outils);
  expect(etat.etape).toBe("prete");
  expect(entrees).toHaveLength(1);
  return { etat, entree: entrees[0] };
}

type Zooms = { fenetres: { debutSec: number; finSec: number; facteur: number }[]; largeur: number; hauteur: number };

describe("C8-Z09-v19b : éteint = identique", () => {
  it("zoomGratuit absent, false ou undefined : même entrée de rendre, même état, aucune clé zoomsPrise", async () => {
    const ref = await rendre({});
    expect(Object.keys(ref.entree)).not.toContain("zoomsPrise");
    for (const extra of [{ zoomGratuit: false }, { zoomGratuit: undefined }] as Partial<OutilsChaineV4>[]) {
      const r = await rendre(extra);
      expect(r.entree).toEqual(ref.entree);
      expect(Object.keys(r.entree)).toEqual(Object.keys(ref.entree));
      expect(JSON.stringify(r.etat)).toBe(JSON.stringify(ref.etat));
    }
  });
});

describe("C8-Z09-v19b : allumé (zoomGratuit: true)", () => {
  it("prise horizontale recadrée : zoomsPrise en 1080 × 1920, fenêtres permises seulement", async () => {
    const ref = await rendre({});
    const { entree, etat } = await rendre({ zoomGratuit: true });
    const z = entree.zoomsPrise as Zooms;
    expect(z).toBeDefined();
    expect(z.largeur).toBe(1080);
    expect(z.hauteur).toBe(1920);
    expect(z.fenetres.length).toBeGreaterThan(0);
    const plan = planValide() as unknown as { elementsV4?: { debut: number; fin: number }[] };
    for (const f of z.fenetres) {
      expect(Object.keys(f).sort()).toEqual(["debutSec", "facteur", "finSec"]);
      expect(f.facteur).toBeLessThanOrEqual(1.06);
      expect(f.debutSec).toBeGreaterThanOrEqual(0.8);
      expect(f.finSec).toBeLessThanOrEqual(dureeSec - 1);
      for (const e of plan.elementsV4 ?? []) expect(f.finSec <= e.debut - 0.3 || f.debutSec >= e.fin + 0.3).toBe(true);
    }
    const reste = { ...entree };
    delete reste.zoomsPrise;
    expect(reste).toEqual(ref.entree);
    expect(etat.rendu).toEqual(ref.etat.rendu);
  });

  it("prise verticale connue sans cadrage : dimensions de la prise ; dimensions inconnues : rien", async () => {
    const v = await rendre({ zoomGratuit: true }, { cadrage: false, dims: { largeur: 1080, hauteur: 1920 } });
    expect((v.entree.zoomsPrise as Zooms).largeur).toBe(1080);
    expect((v.entree.zoomsPrise as Zooms).hauteur).toBe(1920);
    const inconnues = await rendre({ zoomGratuit: true }, { cadrage: false, dims: {} });
    expect(Object.keys(inconnues.entree)).not.toContain("zoomsPrise");
  });

  it("une seule garde (aucun raccord) : rien", async () => {
    const r = await rendre({ zoomGratuit: true }, { gardes: [{ debutSec: 0, finSec: dureeSec }] });
    expect(Object.keys(r.entree)).not.toContain("zoomsPrise");
  });
});

describe("C8-Z09-v19b : garde statique", () => {
  it("chaine-v4.ts n'importe rien de studio-rendu et ne parle ni de plafond ni de coût en plus", () => {
    const src = readFileSync("src/moteurs/montage-facecam-animee/chaine-v4.ts", "utf8");
    expect(src).not.toMatch(/from\s+["'][^"']*studio-rendu/);
    expect(src).toMatch(/from "\.\/zoom-gratuit-v4"/);
  });
});
