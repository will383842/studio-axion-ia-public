/**
 * GV2-04 · « Réessayer » repart sur de NOUVEAUX identifiants (transcription, repérage du visage, rendu) : les services gardent un échec sous
 * l'ancien identifiant (rendu 24 h, conteneur de transcription sur disque). Au premier essai, identifiants inchangés (rendus en cours et clés
 * de stockage des vidéos existantes). Doubles seulement : aucun réseau.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";
import type { CommandeFabrication, MotHorodate, Travail } from "@/domaine/types";
import { creerMoteurMontageFacecamAnimee } from "@/moteurs/montage-facecam-animee";
import { avancerChaineV4, ErreurChaineV4, etatInitialV4, type EtatChaineV4, type OutilsChaineV4 } from "@/moteurs/montage-facecam-animee/chaine-v4";
import type { MotTranscrit } from "@/moteurs/montage-facecam-animee/realisateur";

const RACINE = join(__dirname, "..", "..");
const REPETITION = join(RACINE, "docs/facecam-animee-v4/repetition-generale");
const TRANS = JSON.parse(readFileSync(join(REPETITION, "transcription.json"), "utf8")) as { dureeMonteeSec: number; gardes: { debutSec: number; finSec: number }[]; motsMontesTexteValide: MotTranscrit[] };
const PLAN_VALIDE = JSON.parse(readFileSync(join(REPETITION, "plan-realisateur.json"), "utf8")) as PlanFacecamAnimee;
const BRUT = JSON.parse(readFileSync(join(RACINE, "tests/fixtures/img7747-v2-montage-reel.json"), "utf8")) as { mots: MotHorodate[] };

const COMMANDE = { videoId: "v-1", formatId: "facecam-animee", moteurId: "montage-facecam-animee", ratios: ["9:16"], entrees: { facecamAnimee: { priseCle: "k.mov", fichierId: "f-1", accordEssaiReel: true } }, briques: {}, distribution: [] } as unknown as CommandeFabrication;
const rendreOk = { cle: "c.mp4", vignetteCle: "c.jpg", dureeSec: 80, taille: 1 };

const etatRendu = (): EtatChaineV4 => ({
  ...etatInitialV4({ videoId: "v-1", versionId: "v" , priseCle: "k.mov" }),
  etape: "rendu",
  coupes: { gardes: TRANS.gardes, dureeSec: TRANS.dureeMonteeSec, mots: TRANS.motsMontesTexteValide },
  realisation: { version: "complete", essais: 1, avertissements: 0, plan: { ...PLAN_VALIDE, elementsV4: (PLAN_VALIDE.elementsV4 ?? []).filter((e) => !["AvantApres", "MosaiqueVideos", "duel-video"].includes(e.id)) } },
});

describe("GV2-04 · numéro d'essai dans les identifiants", () => {
  it("premier essai (ou essai absent) : identifiants inchangés ; essai 2 et 3 : suffixe -e2, -e3", async () => {
    for (const [essai, suffixe] of [[undefined, ""], [1, ""], [2, "-e2"], [3, "-e3"]] as const) {
      const rendre = vi.fn(async (_d: { idRendu: string }) => rendreOk);
      await avancerChaineV4(etatRendu(), { rendre } as unknown as OutilsChaineV4, essai);
      expect(rendre.mock.calls[0][0].idRendu).toBe(`fa4-v${suffixe}`);

      const transcrire = vi.fn(async (_d: { appelId: string }) => ({ mots: BRUT.mots, dureeSec: 130 }));
      await avancerChaineV4(etatInitialV4({ videoId: "v-1", versionId: "v", priseCle: "k.mov" }), { transcrire } as unknown as OutilsChaineV4, essai);
      expect(transcrire.mock.calls[0][0].appelId).toBe(`fa4-mots-v${suffixe}`);
    }
  });

  it("repérage du visage (prise horizontale) : fa4-visage-<version> au premier essai, -e2 au deuxième", async () => {
    const etat: EtatChaineV4 = { ...etatInitialV4({ videoId: "v-1", versionId: "v", priseCle: "k.mov" }), etape: "coupes", transcription: { mots: BRUT.mots, dureeSec: 130, largeur: 3840, hauteur: 2160 } };
    for (const [essai, suffixe] of [[1, ""], [2, "-e2"]] as const) {
      const reperer = vi.fn(async (_d: { appelId: string }) => null);
      await avancerChaineV4(etat, { reperer } as unknown as OutilsChaineV4, essai);
      expect(reperer.mock.calls[0][0].appelId).toBe(`fa4-visage-v${suffixe}`);
    }
  });
});

describe("GV2-04 · « Réessayer » relance vraiment (moteur)", () => {
  /** Service de rendu double : un échec gardé pour `fa4-v`, « terminé » pour `fa4-v-e2`. Même logique pour la transcription. */
  function outilsQuiGardentLEchec() {
    const soumis: string[] = [];
    const outils = {
      transcrire: vi.fn(async ({ appelId }: { appelId: string }) => {
        soumis.push(appelId);
        if (appelId === "fa4-mots-v") throw new ErreurChaineV4("La transcription de votre vidéo n'a pas abouti. Vous pouvez réessayer.", true);
        return { mots: BRUT.mots, dureeSec: 130.732 };
      }),
      rendre: vi.fn(async ({ idRendu }: { idRendu: string }) => {
        soumis.push(idRendu);
        if (idRendu === "fa4-v") throw new ErreurChaineV4("Le montage de la vidéo n'a pas abouti. Vous pouvez réessayer.", true);
        return rendreOk;
      }),
    } as unknown as OutilsChaineV4;
    return { outils, soumis };
  }

  it("rendu : échec sous fa4-v, « Réessayer » → fa4-v-e2 → vidéo prête", async () => {
    const { outils, soumis } = outilsQuiGardentLEchec();
    const moteur = creerMoteurMontageFacecamAnimee({ outils: async () => outils, statutFormat: "masque" });
    const t0: Travail = await moteur.lancer(COMMANDE, { travailId: "t-1", versionId: "v", titre: "Essai" });
    const enRendu: Travail = { ...t0, parametres: { ...t0.parametres, facecamAnimeeV4: etatRendu() } };
    const r1 = await moteur.avancer(enRendu, COMMANDE);
    expect(r1.travail.statut).toBe("echec");
    expect(soumis).toEqual(["fa4-v"]);
    const repris = await moteur.reessayer!(r1.travail);
    expect(repris.tentatives).toBe(2);
    const r2 = await moteur.avancer(repris, COMMANDE);
    expect(r2.travail.statut).toBe("termine");
    expect(r2.resultat?.sorties[0].fichierCle).toBe("c.mp4");
    expect(soumis).toEqual(["fa4-v", "fa4-v-e2"]);
  });

  it("transcription : échec sous fa4-mots-v, « Réessayer » → fa4-mots-v-e2 → étape suivante", async () => {
    const { outils, soumis } = outilsQuiGardentLEchec();
    const moteur = creerMoteurMontageFacecamAnimee({ outils: async () => outils, statutFormat: "masque" });
    const t0: Travail = await moteur.lancer(COMMANDE, { travailId: "t-1", versionId: "v", titre: "Essai" });
    const r1 = await moteur.avancer(t0, COMMANDE);
    expect(r1.travail.statut).toBe("echec");
    const repris = await moteur.reessayer!(r1.travail);
    const r2 = await moteur.avancer(repris, COMMANDE);
    expect(r2.travail.statut).toBe("en_cours");
    expect((r2.travail.parametres?.facecamAnimeeV4 as EtatChaineV4).etape).toBe("coupes");
    expect(soumis).toEqual(["fa4-mots-v", "fa4-mots-v-e2"]);
  });
});
