/**
 * GV-MD-05b — l'historique des cartes des 5 dernières vidéos est lu UNE fois au premier habillage, gardé dans l'état
 * du travail, recopié sur la livraison ; une lecture en panne ou une mémoire vide ne fige rien.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const versionsSimulees: Record<string, unknown>[] = [];
let lectureEnPanne = false;
vi.mock("@/services/_commun", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  depots: () => ({
    versions: {
      lister: async (filtre: (v: never) => boolean) => {
        if (lectureEnPanne) throw new Error("base illisible");
        return versionsSimulees.filter((v) => filtre(v as never));
      },
    },
  }),
}));

import type { CommandeFabrication } from "@/domaine/types";
import type { DemandeRendu } from "@/fournisseurs/types";
import { creerFacecamSimule } from "@/fournisseurs/facecam";
import { creerServiceRenduSimule } from "@/fournisseurs/simulation/rendu";
import type { OutilsMontage } from "@/briques/composition/montage";
import { avancerChaine, etatChaineInitial, livraisonChaine, type DependancesChaine, type EtatChaine } from "@/moteurs/montage-facecam/chaine";
import { RECETTE_COMPOSITION_FACECAM } from "@/moteurs/montage-facecam/habillage";
import { memoireCartesFacecam } from "@/services/facecam-branchements";

const TEXTE = "Bonjour, je suis Will. Aujourd'hui je vous parle de la formation. Beaucoup de dirigeants pensent que l'intelligence artificielle est réservée aux grands groupes. C'est faux. Avec un financement OPCO, la formation peut être prise en charge.";

function version(videoId: string, creeLe: string, modeles: string[], extra: Record<string, unknown> = {}) {
  return {
    id: `ver-${videoId}-${creeLe}`,
    videoId,
    creeLe,
    statut: "prete",
    commande: { moteurId: "montage-facecam" },
    projetMontage: { cartesAuto: modeles.map((modele, i) => ({ modele, etat: "posee", debutSec: i })) },
    ...extra,
  };
}

describe("memoireCartesFacecam (dépôts simulés)", () => {
  beforeEach(() => {
    versionsSimulees.length = 0;
    lectureEnPanne = false;
  });
  it("6 vidéos terminées : 5 au plus, la plus récente d'abord, la vidéo en cours exclue, un seul travail par vidéo", async () => {
    for (let i = 1; i <= 6; i++) versionsSimulees.push(version(`v${i}`, `2026-01-0${i}`, [`m${i}`]));
    versionsSimulees.push(version("v6", "2026-01-00", ["ancien6"])); // plus ancien travail de v6 : ignoré
    versionsSimulees.push(version("v7", "2026-02-01", ["encours"])); // vidéo en cours : exclue
    versionsSimulees.push(version("v8", "2026-03-01", ["rate"], { statut: "echec" })); // pas terminée
    const m = await memoireCartesFacecam("v7");
    expect(m.dejaServis).toEqual(["m6", "m5", "m4", "m3", "m2"]);
    expect(m.ouverturePrecedente).toBe("m6");
  });
  it("5 vidéos de 12 cartes : la mémoire est coupée à 40 modèles, les plus récents", async () => {
    for (let i = 1; i <= 5; i++) versionsSimulees.push(version(`v${i}`, `2026-01-0${i}`, Array.from({ length: 12 }, (_, k) => `v${i}k${k}`)));
    const m = await memoireCartesFacecam("autre");
    expect(m.dejaServis).toHaveLength(40);
    expect(m.dejaServis[0]).toBe("v5k0");
    expect(m.dejaServis).not.toContain("v1k0");
  });
  it("une panne de lecture donne une liste vide, sans lever", async () => {
    lectureEnPanne = true;
    expect(await memoireCartesFacecam("v1")).toEqual({ dejaServis: [] });
  });
});

function outilsRendu(): OutilsMontage {
  let t = 0;
  const rendu = creerServiceRenduSimule(() => (t += 6_000));
  const soumises: DemandeRendu[] = [];
  return {
    rendu: () => ({ soumettre: async (d) => (soumises.push(d), rendu.soumettre(d)), etat: (id) => rendu.etat(id) }),
    recette: RECETTE_COMPOSITION_FACECAM,
    signer: async (lectures, depots) => ({ lectures: Object.fromEntries(Object.entries(lectures).map(([k, c]) => [k, `https://r2.exemple/lire/${c}`])), depots: Object.fromEntries(depots.map((d) => [d.cle, `https://r2.exemple/deposer/${d.cle}`])) }),
    cle: (c, nom) => `facecam/${c.videoId}/${nom}`,
  };
}

function commande(entrees: Record<string, unknown> = {}): CommandeFabrication {
  return {
    videoId: "v-fc",
    formatId: "facecam",
    moteurId: "montage-facecam",
    ratios: ["9:16"],
    dureeCibleSec: 60,
    script: { blocs: [], texteComplet: TEXTE },
    distribution: [{ role: "Face caméra", source: "rush" }],
    prises: [{ id: "p1", partie: "version", cle: "studio/prod/rush/v-fc/prise-1.mov", mime: "video/quicktime", dureeSec: 60, segmentIds: [] }],
    briques: { etalonnage: true, "sous-titres": true, "mention-ia": false },
    styles: { lut: null },
    entrees,
    reglages: {},
    plans: [],
    prononciations: [],
  } as unknown as CommandeFabrication;
}

async function jusquAuBout(deps: DependancesChaine, c: CommandeFabrication): Promise<EtatChaine> {
  let etat = etatChaineInitial();
  for (let i = 0; i < 80 && !etat.fini && !etat.echec; i++) etat = await avancerChaine(etat, c, { travailId: "t-m", versionId: "ver-m" }, deps);
  return etat;
}

const MEMOIRE = { dejaServis: ["liste", "chiffre"], ouverturePrecedente: "liste" };

describe("chaîne : la mémoire des cartes est lue une fois et figée", () => {
  it("lue une seule fois sur plusieurs tours, posée dans l'état, recopiée sur la livraison", async () => {
    const appels = vi.fn(async () => MEMOIRE);
    const etat = await jusquAuBout({ facecam: creerFacecamSimule(), habillage: outilsRendu(), memoireCartes: appels }, commande());
    expect(etat.fini).toBe(true);
    expect(appels).toHaveBeenCalledTimes(1);
    expect(etat.memoireCartes).toEqual(MEMOIRE);
    expect(livraisonChaine(etat).facecam.memoireCartes).toEqual(MEMOIRE);
  });
  it("déjà sur la vidéo (entrées) : jamais relue", async () => {
    const appels = vi.fn(async () => ({ dejaServis: ["autre"] }));
    const c = commande({ facecam: { memoireCartes: MEMOIRE } });
    const etat = await jusquAuBout({ facecam: creerFacecamSimule(), habillage: outilsRendu(), memoireCartes: appels }, c);
    expect(etat.fini).toBe(true);
    expect(appels).not.toHaveBeenCalled();
    expect(etat.memoireCartes).toBeUndefined();
  });
  it("lecture en panne : rien de figé, comportement d'avant", async () => {
    const etat = await jusquAuBout({ facecam: creerFacecamSimule(), habillage: outilsRendu(), memoireCartes: async () => { throw new Error("panne"); } }, commande());
    expect(etat.fini).toBe(true);
    expect(etat.memoireCartes).toBeUndefined();
    expect("memoireCartes" in livraisonChaine(etat).facecam).toBe(false);
  });
  it("première vidéo (mémoire vide figée) : figée, et la retouche ne relit pas l'historique", async () => {
    const etat = await jusquAuBout({ facecam: creerFacecamSimule(), habillage: outilsRendu(), memoireCartes: async () => ({ dejaServis: [] }) }, commande());
    expect(etat.fini).toBe(true);
    expect(etat.memoireCartes).toEqual({ dejaServis: [] });
    const figee = livraisonChaine(etat).facecam.memoireCartes;
    expect(figee).toEqual({ dejaServis: [] });
    const relue = vi.fn(async () => ({ dejaServis: ["autre"] }));
    const retouche = await jusquAuBout({ facecam: creerFacecamSimule(), habillage: outilsRendu(), memoireCartes: relue }, commande({ facecam: { memoireCartes: figee } }));
    expect(retouche.fini).toBe(true);
    expect(relue).not.toHaveBeenCalled();
  });
  it("retouche d'une vidéo dont la mémoire dépassait 40 : mêmes cartes (40 modèles figés, pas de relecture)", async () => {
    const longue = Array.from({ length: 55 }, (_, i) => `m${i}`);
    const etat = await jusquAuBout({ facecam: creerFacecamSimule(), habillage: outilsRendu(), memoireCartes: async () => ({ dejaServis: longue.slice(0, 40) }) }, commande());
    const figee = livraisonChaine(etat).facecam.memoireCartes;
    expect(figee?.dejaServis).toHaveLength(40);
    const relue = vi.fn(async () => ({ dejaServis: ["autre"] }));
    const retouche = await jusquAuBout({ facecam: creerFacecamSimule(), habillage: outilsRendu(), memoireCartes: relue }, commande({ facecam: { memoireCartes: { dejaServis: longue } } }));
    expect(retouche.fini).toBe(true);
    expect(relue).not.toHaveBeenCalled();
  });
  it("sans service : état et livraison inchangés", async () => {
    const etat = await jusquAuBout({ facecam: creerFacecamSimule(), habillage: outilsRendu() }, commande());
    expect(etat.fini).toBe(true);
    expect("memoireCartes" in etat).toBe(false);
    expect("memoireCartes" in livraisonChaine(etat).facecam).toBe(false);
  });
});
