/**
 * RAPPORT V6 — P0 n° 4 et 5 « LOOK WILL ». De bout en bout, dépôts en mémoire, doubles du studio-aligneur :
 *  1. Will règle son image (lumière, couleurs, bonne mine, dents ; la teinte de la vidéo) et touche « Garder pour les
 *     prochaines vidéos » → le réglage `facecam.look` garde crans + teinte, et la version qui part est « à mesurer » ;
 *  2. cette version est fabriquée → la peau et le mur MESURÉS par la passe image deviennent la référence du look ;
 *  3. la vidéo SUIVANTE reçoit au lancement crans, teinte et `facecamLookWill` ; la chaîne les envoie à la passe image
 *     (`lookWill`), et un teint éloigné de la référence (ΔE00 ≥ 4) donne l'alerte.
 * Aucun réseau.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import type { CommandeFabrication } from "@/domaine/types";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

/** `lancerRetouche` remplacé : une nouvelle version (entrées données) et son travail, sans moteur. */
const retouches: { videoId: string; versionId: string; entrees?: Record<string, unknown> }[] = [];
vi.mock("@/services/fabrication", async (original) => {
  const vrai = await original<typeof import("@/services/fabrication")>();
  return {
    ...vrai,
    lancerRetouche: async (videoId: string, _plans: string[], _consigne: string, options: { entrees?: Record<string, unknown> } = {}) => {
      const { depots } = await import("@/donnees/memoire");
      const v = (await depots().videos.obtenir(videoId))!;
      const ver = (await depots().versions.obtenir(v.versionChoisieId!))!;
      const n = retouches.length + 1;
      const versionId = `ver-look-${n}`;
      const travailId = `trav-look-${n}`;
      retouches.push({ videoId, versionId, entrees: options.entrees });
      await depots().versions.enregistrer({ ...ver, id: versionId, numero: 100 + n, parentVersionId: ver.id, choisie: false, travailId, commande: { ...ver.commande, entrees: options.entrees ?? {} } });
      await depots().travaux.enregistrer({ id: travailId, type: "retouche", cibleId: videoId, versionId, titre: "Retouche", etapes: [], statut: "en_cours", progression: 0, tentatives: 0, cleIdempotence: travailId, fournisseurUtilise: "simulation", creeLe: ver.creeLe, modifieLe: ver.creeLe } as never);
      return { retoucheId: `ret-${n}`, travailId };
    },
  };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { retoucherImage, lookGarde, memoriserMesureLook, validerMonLook } = await import("@/services/monteur-facecam");
const fabrication = await import("@/services/fabrication");
const { creerFacecamSimule } = await import("@/fournisseurs/facecam");
const { avancerChaine, etatChaineInitial, livraisonChaine } = await import("@/moteurs/montage-facecam/chaine");
const { resultatChaine } = await import("@/moteurs/montage-facecam/etapes-chaine");
const { lireLook, entreesDuLook, lookAValider } = await import("@/moteurs/montage-facecam/look");

const MDP = "essai-look-will";
const VIDEO = "v-04";
const SUIVANTE = "v-03";
const PEAU = [62.4, 14.2, 18.9];
const MUR = [71.0, 1.2, 4.8];

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  retouches.length = 0;
  vi.stubGlobal("fetch", (async () => {
    throw new Error("réseau interdit");
  }) as typeof fetch);
  await auth.seConnecter(MDP, false);
  const v = (await depots().videos.obtenir(VIDEO))!;
  const ver = (await depots().versions.obtenir(v.versionChoisieId!))!;
  await depots().videos.modifier(VIDEO, { formatId: "facecam", statut: "prete", ratios: ["9:16"] });
  // La vidéo validée a déjà la teinte « plus chaud » demandée au monteur.
  await depots().versions.modifier(ver.id, { commande: { ...ver.commande, formatId: "facecam", ratios: ["9:16"], entrees: { facecamMonteur: { teinte: "plus-chaud" } } }, statut: "prete" });
});
afterEach(() => vi.unstubAllGlobals());

/** Fabrique (chaîne doublée) ; la passe image rend les mesures de la peau et du mur après retouche. */
async function fabriquer(c: CommandeFabrication, mesures: Record<string, unknown>) {
  const facecam = creerFacecamSimule();
  const suivre = facecam.suivre;
  const deps = {
    facecam: {
      ...facecam,
      suivre: (async (route, id) => {
        const r = await suivre(route, id);
        return route === "image" && id.includes("-passe") && r.statut === "termine" ? { ...r, resultat: { ...r.resultat, mesures } } : r;
      }) as typeof facecam.suivre,
    },
  };
  let etat = etatChaineInitial();
  for (let i = 0; i < 30 && !etat.fini && !etat.echec; i++) etat = await avancerChaine(etat, c, { travailId: "t-look", versionId: "ver-x" }, deps);
  expect(etat.fini).toBe(true);
  return { etat, passe: facecam.soumises.find((s) => s.demande.parametres?.etape === "passe")!.demande };
}

describe("V6 P0 n° 4-5 · « Garder pour les prochaines vidéos » est vraiment écrit et appliqué", () => {
  it("bout en bout : réglage gardé → version mesurée → vidéo suivante retouchée vers la référence, ΔE contrôlé", async () => {
    // 1. Will règle son image et la garde.
    await retoucherImage(VIDEO, { lumiere: "plus", couleurs: "moins", mine: "plus", dents: "moins" }, { garder: true });
    const garde = (await lookGarde())!;
    expect(garde.image).toEqual({ lumiere: "plus", couleurs: "moins", mine: "plus", dents: "moins" });
    expect(garde.teinte).toBe("plus-chaud");
    expect(garde.aMesurer).toEqual({ videoId: VIDEO, versionId: retouches[0].versionId });
    expect(garde.reference).toBeUndefined();

    // 2. La version gardée est fabriquée : la passe image mesure la peau et le mur → référence du look.
    const commandeGardee = { ...(await depots().versions.obtenir(retouches[0].versionId))!.commande, prises: [{ id: "p1", partie: "version", cle: "studio/prod/rush/v-04/prise.mov", mime: "video/quicktime", dureeSec: 30, segmentIds: [] }] } as unknown as CommandeFabrication;
    const f1 = await fabriquer(commandeGardee, { peauLab: PEAU, murLab: MUR, luminanceVisageApres: 128 });
    // La retouche gardée part bien avec les crans et la teinte (la passe les reçoit).
    expect(f1.passe.parametres!.image).toMatchObject({ lumiere: "plus", mine: "plus" });
    expect(f1.passe.parametres!.teinte).toBe("plus-chaud");
    const projet = resultatChaine(commandeGardee, f1.etat, false).projetMontage as Record<string, unknown>;
    expect(projet.lookMesure).toEqual({ peauLab: PEAU, murLab: MUR });
    // Une autre version (pas celle gardée) ne touche pas au look.
    expect(await memoriserMesureLook("ver-autre", projet)).toBe(false);
    expect(await memoriserMesureLook(retouches[0].versionId, projet)).toBe(true);
    const mesure = (await lookGarde())!;
    expect(mesure.reference).toMatchObject({ peauLab: PEAU, murLab: MUR, videoId: VIDEO, versionId: retouches[0].versionId });
    expect(mesure.aMesurer).toBeUndefined();

    // 3. La vidéo SUIVANTE (aucun réglage d'image propre) reçoit le look au lancement…
    await depots().videos.modifier(SUIVANTE, { formatId: "facecam", entrees: {} });
    const c = await fabrication.construireCommande(SUIVANTE);
    expect(c.entrees?.facecamLookWill).toEqual({ peauLab: PEAU, murLab: MUR });
    expect((c.entrees?.facecam as { image: unknown }).image).toEqual({ lumiere: "plus", couleurs: "moins", mine: "plus", dents: "moins" });
    expect((c.entrees?.facecamMonteur as { teinte: string }).teinte).toBe("plus-chaud");

    // … et la chaîne l'envoie à la passe image ; un teint trop loin de la référence est signalé.
    const cSuivante = { ...c, prises: [{ id: "p1", partie: "version", cle: "studio/prod/rush/v-03/prise.mov", mime: "video/quicktime", dureeSec: 30, segmentIds: [] }] } as unknown as CommandeFabrication;
    const f2 = await fabriquer(cSuivante, { peauLab: [60, 22, 9], deltaE00Peau: 6.3 });
    expect(f2.passe.parametres!.lookWill).toEqual({ peauLab: PEAU, murLab: MUR });
    expect(f2.passe.parametres!.image).toMatchObject({ lumiere: "plus", couleurs: "moins", mine: "plus", dents: "moins" });
    expect(f2.passe.parametres!.teinte).toBe("plus-chaud");
    expect(livraisonChaine(f2.etat).alertes.map((a) => a.message).join(" ")).toMatch(/Teint éloigné du Look Will \(ΔE 6,3|ΔE 6\.3/);
  });

  it("premier usage (V6 n° 5) : « C'est mon look » garde le look de la version affichée, sans nouvelle version, avec sa référence mesurée", async () => {
    expect(lookAValider(await lookGarde())).toBe(true);
    const v = (await depots().videos.obtenir(VIDEO))!;
    const ver = (await depots().versions.obtenir(v.versionChoisieId!))!;
    await depots().versions.modifier(ver.id, { commande: { ...ver.commande, entrees: { facecam: { image: { lumiere: "plus", couleurs: "juste", mine: "plus", dents: "juste" } }, facecamMonteur: { teinte: "plus-froid" } } }, projetMontage: { moteur: "montage-facecam", lookMesure: { peauLab: PEAU, murLab: MUR } } });
    expect(await validerMonLook(VIDEO)).toEqual({ reference: true });
    expect(retouches).toHaveLength(0);
    const look = (await lookGarde())!;
    expect(look).toMatchObject({ image: { lumiere: "plus", mine: "plus" }, teinte: "plus-froid", reference: { peauLab: PEAU, murLab: MUR, versionId: ver.id } });
    expect(lookAValider(look)).toBe(false);
  });

  it("une vidéo qui a ses propres réglages les garde ; sans look gardé rien n'est ajouté ; l'ancienne forme se relit", () => {
    const look = lireLook({ image: { lumiere: "plus", couleurs: "juste", mine: "juste", dents: "juste" }, le: "2026-10-01" })!;
    expect(look).toMatchObject({ teinte: "neutre", image: { lumiere: "plus" } });
    expect(look.reference).toBeUndefined();
    expect(entreesDuLook({}, null)).toEqual({});
    const propre = { facecam: { image: { lumiere: "moins", couleurs: "juste", mine: "juste", dents: "juste" } }, facecamMonteur: { teinte: "plus-froid" } };
    const avecRef = { ...look, teinte: "plus-chaud" as const, reference: { peauLab: PEAU, videoId: "v", versionId: "x", le: "" } };
    expect(entreesDuLook(propre, avecRef)).toEqual({ facecamLookWill: { peauLab: PEAU } });
  });
});
