/**
 * LOT K — l'effet réaliste par IA dans la CHAÎNE face caméra : après le décor, avant le cadrage. Réussi : le morceau
 * reposé entre dans le plan du cadrage (fenêtre d'extraction, plan large pendant l'effet) et la vitre brisée sort à
 * l'impact ; raté : l'objet 3D (repli gratuit) sort, « Effet non réussi — Réessayer » ; sans la passe : repli, rien
 * n'est dit. Doubles du studio-aligneur et du rendu, aucun réseau, aucune dépense.
 */
import { describe, expect, it } from "vitest";
import { MESSAGE_EFFET_RATE, REGLES_PRESERVATION, type EffetRealistePrepare, type ResultatEffetRealiste } from "@/briques/effet-realiste";
import { lireEntreesFacecam } from "@/domaine/facecam";
import type { CommandeFabrication } from "@/domaine/types";
import { creerFacecamSimule } from "@/fournisseurs/facecam";
import { avancerChaine, etatChaineInitial, type DependancesChaine, type EtatChaine } from "@/moteurs/montage-facecam/chaine";
import { passageEffetRealiste } from "@/moteurs/montage-facecam/monteur";

const EFFET: EffetRealistePrepare = {
  id: "pas-effet",
  consigne: "mets un téléphone dans ma main et jette-le sur l'écran",
  description: "Un téléphone apparaît dans votre main, puis vous le jetez vers l'écran.",
  consigneVideo: `A smartphone appears in the open hand and is thrown at the camera. ${REGLES_PRESERVATION}`,
  ancre: "bon-endroit",
  debutMot: 30,
  debutPriseSec: 12,
  finPriseSec: 17,
  debutSec: 12,
  finSec: 17,
  dureeSec: 5,
  modele: "flux_3_video_edit",
  objet: "telephone",
  finitSurEcran: true,
  impactSec: 16.5,
  phrase: "regardez mon téléphone",
  raisonMoment: "Vous parlez de l'objet",
};

const lie = (id: string, type: string, si: "reussi" | "rate", debutSec: number) => ({
  id,
  type: "autre",
  debutSec,
  finSec: debutSec + 1.2,
  origine: "demande",
  ancre: { debutPriseSec: debutSec, finPriseSec: debutSec + 1.2 },
  operation: type === "vitreBrisee" ? { type, auMot: 40, dureeSec: 1.2, revele: "plan-suivant", texteCarte: null, bruitage: true } : { type, debutMot: 30, finMot: 40, objet: "telephone", description: "repli" },
  conditionEffetRealiste: { effetId: EFFET.id, si },
});

function commande(): CommandeFabrication {
  return {
    videoId: "v-fc",
    formatId: "facecam",
    moteurId: "montage-facecam",
    ratios: ["9:16"],
    dureeCibleSec: 60,
    script: { blocs: [], texteComplet: "" },
    distribution: [{ role: "Face caméra", source: "rush" }],
    prises: [{ id: "p1", partie: "version", cle: "studio/prod/rush/v-fc/prise-1.mov", mime: "video/quicktime", dureeSec: 60, segmentIds: [] }],
    briques: { etalonnage: true, "sous-titres": true, "mention-ia": false },
    styles: { lut: null },
    entrees: { facecam: { coupes: { auto: [], retablies: [] }, passages: [passageEffetRealiste(EFFET), lie("vitre", "vitreBrisee", "reussi", 16.5), lie("objet", "objetMain", "rate", 12)], consignes: [], image: {} } },
    reglages: {},
    plans: [],
    prononciations: [],
    sousTitres: { base: "simple", intensite: "equilibre" },
  } as unknown as CommandeFabrication;
}

async function jusquAuBout(deps: DependancesChaine): Promise<EtatChaine> {
  let etat = etatChaineInitial();
  for (let i = 0; i < 60 && !etat.fini && !etat.echec; i++) etat = await avancerChaine(etat, commande(), { travailId: "t-1", versionId: "ver-1" }, deps);
  return etat;
}

const monteur: DependancesChaine["monteur"] = async ({ entrees }) => ({ cartes: [], passages: lireEntreesFacecam(entrees).passages });

function cadrage(f: ReturnType<typeof creerFacecamSimule>) {
  return f.soumises.find((s) => (s.demande.parametres as { etape?: string }).etape === "cadrage")!.demande.parametres as { decor?: { effets?: boolean; fenetre: { x: number; largeur: number }; morceaux: { source: string; debutSec: number; finSec: number; fichierCle?: string }[] }; plans: { priseDebutSec: number; priseFinSec: number; cadre: { x: number; largeur: number; hauteur: number } }[] };
}

describe("lot K · effet réaliste dans la chaîne face caméra", () => {
  it("réussi : morceau dans le plan du cadrage (fenêtre d'extraction), vitre brisée gardée, objet 3D écarté", async () => {
    const facecam = creerFacecamSimule();
    const appels: { effets: number; priseCle: string; decorApplique: boolean }[] = [];
    const etat = await jusquAuBout({
      facecam,
      monteur,
      effetsRealistes: async ({ effets, priseCle, fenetre, decorApplique }) => {
        appels.push({ effets: effets.length, priseCle, decorApplique });
        return effets.map((e): ResultatEffetRealiste => ({ id: e.id, statut: "reussi", creditsDebites: 5, message: "ok", morceau: { id: e.id, source: "effet", debutSec: e.debutPriseSec, finSec: e.finPriseSec, fichierCle: "r2/effet.mp4", fonduSec: 0.2, ...(fenetre ? { fenetre } : {}) } }));
      },
    });
    expect(etat.fini).toBe(true);
    expect(appels).toEqual([{ effets: 1, priseCle: "studio/prod/rush/v-fc/prise-1.mov", decorApplique: false }]);
    const p = cadrage(facecam);
    expect(p.decor?.effets).toBe(true);
    expect(p.decor?.morceaux).toEqual([expect.objectContaining({ source: "effet", debutSec: 12, finSec: 17, fichierCle: "r2/effet.mp4" })]);
    // Plan large pendant l'effet : testé sur la brique (`plansLargesPendant`) ; la prise simulée ne dure qu'1 s ici.
    expect(p.decor?.fenetre.largeur).toBeGreaterThan(0);
    expect(etat.monteur?.effets?.map((x) => x.id)).toEqual(["vitre"]);
    expect(etat.sauts.some((s) => s.brique === "Un effet réaliste")).toBe(false);
  });

  it("raté : pas de morceau, objet 3D (repli gratuit) gardé, vitre écartée, « Effet non réussi — Réessayer »", async () => {
    const facecam = creerFacecamSimule();
    const etat = await jusquAuBout({ facecam, monteur, effetsRealistes: async ({ effets }) => effets.map((e) => ({ id: e.id, statut: "rate", raison: "levres", creditsDebites: 5, message: MESSAGE_EFFET_RATE })) });
    expect(etat.fini).toBe(true);
    expect(cadrage(facecam).decor).toBeUndefined();
    expect(etat.monteur?.effets?.map((x) => x.id)).toEqual(["objet"]);
    expect(etat.sauts.find((s) => s.brique === "Un effet réaliste")?.message).toMatch(/Effet non réussi — Réessayer/);
  });

  it("passe en panne : repli, la vidéo sort", async () => {
    const etat = await jusquAuBout({ facecam: creerFacecamSimule(), monteur, effetsRealistes: async () => Promise.reject(new Error("panne")) });
    expect(etat.fini).toBe(true);
    expect(etat.effetsRealistes?.resultats[0].statut).toBe("rate");
    expect(etat.monteur?.effets?.map((x) => x.id)).toEqual(["objet"]);
  });

  it("sans la passe (non branchée) : repli gratuit, rien n'est dit", async () => {
    const etat = await jusquAuBout({ facecam: creerFacecamSimule(), monteur });
    expect(etat.fini).toBe(true);
    expect(etat.effetsRealistes?.resultats[0]).toMatchObject({ statut: "non-lance" });
    expect(etat.sauts.some((s) => s.brique === "Un effet réaliste")).toBe(false);
  });
});
