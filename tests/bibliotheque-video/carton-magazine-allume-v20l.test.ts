/**
 * FOND-FLOU-C10-04-b-v20l (décision de Williams du 21/11 00:25, tranchée par le pilote le 21/11 07:20) :
 * le carton magazine, et lui seul, est ouvert dans le profil de la face caméra. Le flou reste celui de master
 * (C10-04-c : aucun flou sur une vraie prise filmée ; jamais sur le visage). Aucun réseau, aucun euro.
 */
import { describe, expect, it } from "vitest";
import { appliquerReglage } from "@/briques/bibliotheque-video/permissions";
import { profilDuFormat } from "@/briques/bibliotheque-video/profils";
import { PROFIL_FACECAM } from "@/briques/bibliotheque-video/profils/facecam";
import { PROFIL_TABLEAU_ANIME } from "@/briques/bibliotheque-video/profils/tableau-anime";
import { lireReglageBibliotheque } from "@/briques/bibliotheque-video/reglage";
import { ID } from "@/briques/bibliotheque-video/noms";
import { profilNeutre } from "@/briques/bibliotheque-video/profils";
import type { EntreeBibliotheque, ProfilVideo } from "@/briques/bibliotheque-video/types";
import { VERSION_BIBLIOTHEQUE } from "@/briques/bibliotheque-video/version";
import { dessinFacecamPermis } from "@/briques/plan-scenes-generateurs/dessin-facecam-porte";
import { piecesPermisesDesEntrees } from "@/briques/plan-scenes-objets/pieces-permises";
import { OBJETS_INSCRITS } from "@/briques/plan-scenes-objets/registre";
import { parametresComposition } from "@/briques/composition";
import { RECETTE_COMPOSITION_FACECAM } from "@/moteurs/montage-facecam/habillage";
import type { CommandeFabrication } from "@/domaine/types";
import type { PlanValide } from "@/briques/plan-scenes/schema";

const CARTON = "objet-carton-magazine";
const ETIQUETTES = OBJETS_INSCRITS.filter((d) => d.capacite === "objet.etiquette").map((d) => d.id);
const entree = (profil: ProfilVideo): { bibliothequeVideo: EntreeBibliotheque } => ({ bibliothequeVideo: { version: VERSION_BIBLIOTHEQUE, profil, recents: [], graine: "G", figeeLe: "2026-11-25" } });
/** Entrée telle que la construit le lancement d'une face caméra, base vide (réglage par défaut du code). */
async function entreeFacecamParDefaut() {
  const reglage = await lireReglageBibliotheque("facecam", async () => undefined);
  return entree(appliquerReglage(profilDuFormat("facecam"), reglage));
}

describe("(a) un plan face caméra peut demander objet-carton-magazine", () => {
  it("profil du code : objet.etiquette permis, décision nommée", () => {
    expect(PROFIL_FACECAM.capacites[ID.objetEtiquette]).toEqual({ permis: true, decision: "FOND-FLOU-C10-04-b-v20l · Williams 21/11 00:25 (carton magazine seul)" });
  });
  it("lancement base vide : le carton magazine est la seule pièce permise", async () => {
    expect([...piecesPermisesDesEntrees(await entreeFacecamParDefaut())]).toEqual([CARTON]);
  });
  it("2e appel identique (aucun état caché)", async () => {
    const e = await entreeFacecamParDefaut();
    expect(piecesPermisesDesEntrees(e)).toEqual(piecesPermisesDesEntrees(e));
  });
});

describe("(b) aucune autre pièce de la famille étiquette en face caméra", () => {
  it("bulles, post-it, pastilles, cartes et cartons définition restent fermés", () => {
    expect(ETIQUETTES.length).toBeGreaterThan(5);
    const permises = piecesPermisesDesEntrees(entree(PROFIL_FACECAM));
    for (const id of ETIQUETTES.filter((i) => i !== CARTON)) expect(permises, id).not.toContain(id);
    for (const id of ["objet-bulle-parole", "objet-bulle-pensee", "objet-bulle-notification", "objet-post-it", "objet-pastille-icone", "objet-etiquette-icone", "objet-carton-definition"]) expect(ETIQUETTES).toContain(id);
  });
  it("seules objet.etiquette et les permissions de prod sont ouvertes dans le profil facecam", () => {
    const permis = Object.entries(PROFIL_FACECAM.capacites).filter(([, r]) => r?.permis === true).map(([id]) => id).sort();
    expect(permis).toEqual([ID.cadrageZoomClassique, ID.objetEtiquette, ID.transitionCoupe].sort());
  });
  it("le filtre ne vaut que pour la face caméra : un autre format garde toute la famille, le tableau ne change pas", () => {
    const autre = { ...profilNeutre("format-essai"), capacites: { [ID.objetEtiquette]: { permis: true } } } as ProfilVideo;
    expect([...piecesPermisesDesEntrees(entree(autre))].sort()).toEqual([...ETIQUETTES].sort());
    expect(piecesPermisesDesEntrees(entree(PROFIL_TABLEAU_ANIME))).not.toContain(CARTON);
  });
  it("entrée absente ou illisible : aucune pièce", () => {
    for (const e of [undefined, null, {}, { bibliothequeVideo: 1 }, { bibliothequeVideo: { profil: { formatId: "facecam" } } }]) expect(piecesPermisesDesEntrees(e)).toEqual([]);
  });
});

describe("(c) le dessin du plan de scènes face caméra reste comme sur master", () => {
  it("entrée par défaut : dessin permis, comme sans entrée", async () => {
    const ok = { planScenesFacecam: true, dessin: true };
    expect(dessinFacecamPermis({ ...ok, entrees: {} })).toBe(true);
    expect(dessinFacecamPermis({ ...ok, entrees: await entreeFacecamParDefaut() })).toBe(true);
  });
});

describe("(d) fondFlouCartes posé comme sur master (C10-04-c)", () => {
  const scene = { id: "b", version: 1, empreinte: "0123456789abcdef", mots: { premier: 0, dernier: 1 }, debutMs: 3000, finMs: 6000, niveau: 1, position: "centre", transition: { entree: "fondu", sortie: "fondu", dureeMs: 400 }, piece: CARTON, parametres: {} };
  const plan = { version: "plan-scenes-1", format: { largeur: 1080, hauteur: 1920, fps: 25 }, facecam: true, dureeMs: 12000, habillage: { fond: "ivoire", accent: "terracotta" }, mots: [], scenes: [scene] } as unknown as PlanValide;
  const plans = [{ ordre: 1, debutSec: 0, finSec: 12, texte: "", segmentId: "facecam", sourceImage: "double", motsEnValeur: [], cadrage: { pointInteret: { x: 0.5, y: 0.4 }, zoom: 1, valeur: "large" }, transition: "coupe", angle: "face" }] as never;
  const base = { ratio: "9:16" as const, plans, segments: [], dureeSec: 12, audioCle: "m.mov", pistesDouble: { face: "m.mov" }, pistesDepuisLook: true, planScenes: plan };
  const commande = (source: string) => ({ videoId: "v", formatId: "facecam", moteurId: "montage-facecam", ratios: ["9:16"], dureeCibleSec: 12, script: { blocs: [], texteComplet: "" }, distribution: [{ role: "Face caméra", source }], briques: { etalonnage: true, "sous-titres": true, "mention-ia": false }, styles: { lut: null }, entrees: {}, reglages: {}, plans: [], prononciations: [], sousTitres: { base: "simple", intensite: "equilibre" } }) as unknown as CommandeFabrication;
  it("vraie prise filmée (rush + pistes du look) : carton posé, aucun flou", () => {
    const p = parametresComposition(commande("rush"), base, RECETTE_COMPOSITION_FACECAM);
    expect(JSON.stringify(p.image.planScenes)).toContain(CARTON);
    expect("fondFlouCartes" in p.image).toBe(false);
  });
  it("décor visible : flou sur le DÉCOR seulement, jamais sur le visage", () => {
    const p = parametresComposition(commande("double"), base, RECETTE_COMPOSITION_FACECAM);
    expect(p.image.fondFlouCartes?.length).toBe(1);
    expect(p.image.fondFlouCartes!.every((f) => f.cible === "decor")).toBe(true);
  });
});
