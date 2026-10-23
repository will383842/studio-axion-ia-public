/**
 * PLAN FACECAM v4 — LOT G : Décor IA (lot E1) utilisable. Les passages sont extraits, reposés (25 i/s sans changer la
 * vitesse) et mesurés par le studio-aligneur (route `/image`), le plan `decor` part au cadrage avec une adresse par
 * morceau ; zooms limités à 110 %. Toujours COUPÉ par défaut ; double Higgsfield ; aucun appel réel, aucun réseau.
 */
import { describe, expect, it, vi } from "vitest";
import { appliquerDecor, type EntreeDecor } from "@/briques/decor";
import { creerHiggsfieldSimule } from "@/fournisseurs/higgsfield";
import type { DemandeFacecam, FournisseurFacecam } from "@/fournisseurs/facecam/client";
import { creerFacecamSimule } from "@/fournisseurs/facecam";
import type { CommandeFabrication } from "@/domaine/types";
import { avancerChaine, etatChaineInitial, fenetreDecor, plansSousDecor, type DependancesChaine, type EtatChaine } from "@/moteurs/montage-facecam/chaine";
import type { PlanCamera } from "@/briques/realisation";
import { passagesDecorAligneur } from "@/services/decor-passages";

const IMAGE = { nom: "decor.png", type: "image/png" as const, octets: new Uint8Array([1, 2, 3]) };

/** Studio-aligneur « réel » simulé : chaque travail `/image` se termine au premier suivi avec un résultat plausible. */
function aligneur(options: { mesures?: Record<string, unknown> } = {}) {
  const demandes: DemandeFacecam[] = [];
  const f: FournisseurFacecam = {
    id: "studio-aligneur",
    mode: "reel",
    async soumettre(_route, d) {
      demandes.push(d);
      return { statut: "en_file" };
    },
    async suivre(_route, id) {
      const d = demandes.find((x) => x.idTravail === id)!;
      const etape = d.parametres?.etape;
      const cles = (d.parametres?.cles ?? {}) as Record<string, string>;
      const resultat = etape === "mesurer" ? (options.mesures ?? { ecartBoucheMs: 40, ressemblanceVisage: 0.93, visageTrouvePct: 99 }) : { fichierCle: cles.passage ?? cles.decor, dureeSec: 12 };
      return { statut: "termine", resultat } as never;
    },
  };
  return { f, demandes };
}

const stockage = { lire: async (cle: string) => `https://r2.exemple/lire/${cle}`, deposer: async (cle: string) => `https://r2.exemple/deposer/${cle}` };
const reseau = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => new Response(init?.method === "PUT" ? null : new Uint8Array([7, 7, 7]), { status: 200 })) as unknown as typeof fetch;

function entree(): EntreeDecor {
  return { idVideo: "v", dureeUtileSec: 26, pauses: [{ debutSec: 11.8, finSec: 12.4 }], decor: { description: "bureau clair, plantes" }, imageReference: IMAGE, restantDuMoisCentimes: 100_00 };
}

describe("lot G · Décor IA relié au studio-aligneur", () => {
  it("extraire (fenêtre ramenée à la bande), reposer (taille de la fenêtre, conversion 25 i/s), mesurer (original + voix d'origine)", async () => {
    const { f, demandes } = aligneur();
    const passages = passagesDecorAligneur({ videoId: "v", travailId: "t-1", imageCle: "facecam/v/ver/image-10bits.mp4", priseCle: "rush/prise.mov", fenetre: { x: 1312, y: 0, largeur: 1216, hauteur: 2160 }, bandeX: 1100, facecam: f, stockage, fetch: reseau, attendre: async () => {} });
    const r = await appliquerDecor(entree(), { higgsfield: creerHiggsfieldSimule(), ...passages, attendre: async () => {} });
    expect(r.statut).toBe("applique");
    const etapes = demandes.map((d) => d.parametres?.etape);
    expect(etapes).toEqual(["extraire", "reposer", "mesurer", "extraire", "reposer", "mesurer"]);
    const extraire = demandes[0];
    expect(extraire.source).toBe("https://r2.exemple/lire/facecam/v/ver/image-10bits.mp4");
    expect(extraire.parametres?.fenetre).toEqual({ x: 212, y: 0, largeur: 1216, hauteur: 2160 });
    const reposer = demandes[1];
    expect(reposer.parametres?.conversion).toMatchObject({ vitesse: 1, filtreVideo: expect.stringMatching(/^fps=25,/) });
    expect(reposer.parametres?.taille).toEqual({ largeur: 1216, hauteur: 2160 });
    const mesurer = demandes[2];
    expect(mesurer.parametres).toMatchObject({ voix: "https://r2.exemple/lire/rush/prise.mov", original: "https://r2.exemple/lire/facecam/v/decor/t-1/passage-0.mp4" });
    // Le plan garde la clé du passage reposé : le cadrage la relira.
    expect(r.plan.morceaux.filter((m) => m.source === "decor").map((m) => m.fichierCle)).toEqual(["facecam/v/decor/t-1/decor-0.mp4", "facecam/v/decor/t-1/decor-1.mp4"]);
  });

  it("mesure impossible (MediaPipe absent, valeur nulle) ou aligneur non réel : repli, la vidéo garde son vrai décor", async () => {
    const { f } = aligneur({ mesures: { ecartBoucheMs: null, ressemblanceVisage: 0.9, visageTrouvePct: 100 } });
    const passages = passagesDecorAligneur({ videoId: "v", travailId: "t-1", imageCle: "i", priseCle: "p", fenetre: { x: 0, y: 0, largeur: 1216, hauteur: 2160 }, bandeX: 0, facecam: f, stockage, fetch: reseau, attendre: async () => {} });
    expect((await appliquerDecor(entree(), { higgsfield: creerHiggsfieldSimule(), ...passages, attendre: async () => {} })).statut).toBe("repli");
    const simule = passagesDecorAligneur({ videoId: "v", travailId: "t-1", imageCle: "i", priseCle: "p", fenetre: { x: 0, y: 0, largeur: 1216, hauteur: 2160 }, bandeX: 0, facecam: creerFacecamSimule(), stockage, fetch: reseau });
    const h = creerHiggsfieldSimule();
    const r = await appliquerDecor(entree(), { higgsfield: h, ...simule, attendre: async () => {} });
    expect(r.statut).toBe("repli");
    expect(r.creditsDebites).toBe(0);
  });

  it("fenêtre 9:16 pleine hauteur sur la médiane des cadres ; décor appliqué → zooms limités à 110 %, cadres dans la fenêtre", () => {
    const plan = (x: number, largeur: number): PlanCamera => ({ debutSec: 0, finSec: 2, priseDebutSec: 0, priseFinSec: 2, cadre: { x, y: 0, largeur, hauteur: (largeur * 16) / 9 }, taille: 1 } as unknown as PlanCamera);
    const plans = [plan(1300, 1216), plan(1500, 935), plan(1320, 1216)];
    const f = fenetreDecor(plans, { largeur: 3840, hauteur: 2160 });
    expect(f).toEqual({ x: 1320, y: 0, largeur: 1214, hauteur: 2160 });
    const limites = plansSousDecor(plans, f, 1.1);
    for (const p of limites) {
      expect(p.cadre.largeur).toBeGreaterThanOrEqual(Math.floor(f.largeur / 1.1) - 2);
      expect(p.cadre.x).toBeGreaterThanOrEqual(f.x);
      expect(p.cadre.x + p.cadre.largeur).toBeLessThanOrEqual(f.x + f.largeur);
    }
  });
});

describe("lot G · la chaîne donne le plan du décor au cadrage", () => {
  const TEXTE = "Bonjour, je suis Will. Aujourd'hui je vous parle de la formation. C'est faux. Avec un financement OPCO, la formation peut être prise en charge.";
  const commande = (decor: boolean) => ({ videoId: "v-fc", formatId: "facecam", ratios: ["9:16"], dureeCibleSec: 60, script: { blocs: [], texteComplet: TEXTE }, distribution: [{ role: "Face caméra", source: "rush" }], prises: [{ id: "p1", partie: "version", cle: "rush/prise.mov", mime: "video/quicktime", dureeSec: 60, segmentIds: [] }], briques: { etalonnage: true, "sous-titres": true }, styles: { lut: null }, entrees: decor ? { facecamDecorIa: true } : {}, reglages: {}, plans: [], prononciations: [] }) as unknown as CommandeFabrication;

  it("décor appliqué : chaque morceau retouché a son adresse de lecture ; la fenêtre et la passe sont données à la passe décor", async () => {
    const facecam = creerFacecamSimule();
    const vu: unknown[] = [];
    const deps: DependancesChaine = {
      facecam: { ...facecam, mode: "reel", soumettre: (route, d) => facecam.soumettre(route, route === "transcrire" ? { ...d, parametres: { ...d.parametres, texte: TEXTE } } : d) },
      urlLecture: async (cle) => `https://r2.exemple/lire/${cle}`,
      urlDepot: async (cle) => `https://r2.exemple/deposer/${cle}`,
      decor: async (e) => {
        vu.push(e);
        return { applique: true, message: "Décor IA appliqué.", plan: { decorApplique: true, audio: "origine", ips: 25, zoomMax: 1.1, morceaux: [{ index: 0, debutSec: 0, finSec: 12, source: "decor", fichierCle: "facecam/v-fc/decor/t/decor-0.mp4" }, { index: 1, debutSec: 12, finSec: 30, source: "origine" }] } };
      },
    };
    let etat: EtatChaine = etatChaineInitial();
    for (let i = 0; i < 20 && !etat.fini && !etat.echec; i++) etat = await avancerChaine(etat, commande(true), { travailId: "t", versionId: "ver" }, deps);
    expect(etat.fini).toBe(true);
    expect(vu[0]).toMatchObject({ imageCle: expect.stringContaining("image-10bits"), priseCle: "rush/prise.mov", fenetre: expect.objectContaining({ largeur: 1214, hauteur: 2160 }) });
    const cadrage = facecam.soumises.find((s) => s.demande.parametres?.etape === "cadrage")!.demande.parametres as { decor: { fenetre: unknown; morceaux: { source: string; adresse?: string }[] } };
    expect(cadrage.decor.fenetre).toMatchObject({ largeur: 1214 });
    expect(cadrage.decor.morceaux[0].adresse).toBe("https://r2.exemple/lire/facecam/v-fc/decor/t/decor-0.mp4");
    expect(cadrage.decor.morceaux[1].adresse).toBeUndefined();
  });

  it("option coupée (par défaut) : aucune passe décor, rien dans le cadrage", async () => {
    const facecam = creerFacecamSimule();
    const decor = vi.fn();
    let etat: EtatChaine = etatChaineInitial();
    const deps: DependancesChaine = { facecam: { ...facecam, mode: "reel" } };
    for (let i = 0; i < 20 && !etat.fini && !etat.echec; i++) etat = await avancerChaine(etat, commande(false), { travailId: "t", versionId: "ver" }, deps);
    expect(decor).not.toHaveBeenCalled();
    expect(facecam.soumises.find((s) => s.demande.parametres?.etape === "cadrage")!.demande.parametres).not.toHaveProperty("decor");
  });
});
