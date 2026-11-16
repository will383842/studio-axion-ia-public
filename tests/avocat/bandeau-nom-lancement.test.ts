/**
 * C2-U11 : branchement du bandeau « nom et fonction » sur l'avocat, derrière `avocat.bandeauNom` (absent = faux).
 * Dépôts simulés (mémoire), aucun appel réel.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { depots, reinitialiserDepots } from "@/donnees/memoire";
import { entreesAvocatDuLancement } from "@/services/avocat-branchements";
import { entreeBandeauDuLancement, PARAM_BANDEAU_AVOCAT } from "@/services/bandeau-nom";
import { ENTREE_BANDEAU_NOM, lireEntreeBandeau } from "@/briques/sous-titres/bandeau-nom";
import { parametresComposition } from "@/briques/composition/parametres";
import type { CommandeFabrication, SegmentSousTitres } from "@/domaine/types";
import { decorsCatalogue } from "@/donnees/decors-catalogue";
import { PROFIL_SON_AVOCAT, STYLE_SOUS_TITRES_AVOCAT } from "@/donnees/elements-avocat";
import { formatAvocat, RECETTE_MONTAGE_AVOCAT } from "@/formats/avocat";
import { RECETTE_COMPOSITION_AVOCAT } from "@/moteurs/montage-avocat/recette-composition";

async function personnage(p: Record<string, unknown>) {
  await depots().personnages.enregistrer({ id: "p1", nom: "Marie Durand", principal: true, creeLe: "2026-01-01T00:00:00Z", modifieLe: "2026-01-01T00:00:00Z", ...p } as never);
}
async function regler(valeur: unknown) {
  await depots().parametres.enregistrer({ id: PARAM_BANDEAU_AVOCAT, valeur } as never);
}
const video = { id: "v1", entrees: {}, distribution: [{ personnageId: "p1" }] };

beforeEach(() => reinitialiserDepots());

describe("entreeBandeauDuLancement", () => {
  it("réglage absent : rien, même avec un personnage « moi » et un rôle", async () => {
    await personnage({ nature: "moi", role: "Avocate en droit du travail" });
    expect(await entreeBandeauDuLancement(video)).toBeNull();
  });
  it("seul `true` allume (pas « true », 1, {actif:true})", async () => {
    await personnage({ nature: "moi", role: "Avocate" });
    for (const v of ["true", 1, { actif: true }, false]) {
      await regler(v);
      expect(await entreeBandeauDuLancement(video)).toBeNull();
    }
  });
  it("« moi » avec rôle : nom et fonction tels que saisis", async () => {
    await regler(true);
    await personnage({ nature: "moi", role: "Avocate en droit du travail" });
    expect(await entreeBandeauDuLancement(video)).toEqual({ nom: "Marie Durand", fonction: "Avocate en droit du travail" });
  });
  it("« reel » : accord coché obligatoire", async () => {
    await regler(true);
    await personnage({ nature: "reel", role: "Avocat", accord: { case: false } });
    expect(await entreeBandeauDuLancement(video)).toBeNull();
    await personnage({ nature: "reel", role: "Avocat" });
    expect(await entreeBandeauDuLancement(video)).toBeNull();
    await personnage({ nature: "reel", role: "Avocat", accord: { case: true } });
    expect(await entreeBandeauDuLancement(video)).toEqual({ nom: "Marie Durand", fonction: "Avocat" });
  });
  it("personnage inventé, rôle absent ou vide, personnage introuvable : rien", async () => {
    await regler(true);
    await personnage({ nature: "invente", role: "Avocate" });
    expect(await entreeBandeauDuLancement(video)).toBeNull();
    await personnage({ nature: "moi" });
    expect(await entreeBandeauDuLancement(video)).toBeNull();
    await personnage({ nature: "moi", role: "   " });
    expect(await entreeBandeauDuLancement(video)).toBeNull();
    await personnage({ nature: "moi", role: "Avocate" });
    expect(await entreeBandeauDuLancement({ ...video, distribution: [{ personnageId: "autre" }] })).toBeNull();
    expect(await entreeBandeauDuLancement({ entrees: {} })).toBeNull();
  });
});

describe("entreesAvocatDuLancement", () => {
  it("réglage absent : aucune clé bandeauNom, mêmes entrées qu'avant", async () => {
    await personnage({ nature: "moi", role: "Avocate" });
    const avec = await entreesAvocatDuLancement(video);
    reinitialiserDepots();
    const sans = await entreesAvocatDuLancement(video);
    expect(avec).toEqual(sans);
    expect(ENTREE_BANDEAU_NOM in avec).toBe(false);
  });
  it("réglage vrai + « moi » avec rôle : la clé est présente ; inventé : absente", async () => {
    await regler(true);
    await personnage({ nature: "moi", role: "Avocate" });
    expect((await entreesAvocatDuLancement(video))[ENTREE_BANDEAU_NOM]).toEqual({ nom: "Marie Durand", fonction: "Avocate" });
    await personnage({ nature: "invente", role: "Avocate" });
    expect(ENTREE_BANDEAU_NOM in (await entreesAvocatDuLancement(video))).toBe(false);
  });
});

describe("lireEntreeBandeau (contrôle pur)", () => {
  it("accepte { nom, fonction } non vides, refuse le reste", () => {
    expect(lireEntreeBandeau({ [ENTREE_BANDEAU_NOM]: { nom: " A ", fonction: " B " } })).toEqual({ nom: "A", fonction: "B" });
    for (const e of [undefined, null, {}, { [ENTREE_BANDEAU_NOM]: null }, { [ENTREE_BANDEAU_NOM]: { nom: "A" } }, { [ENTREE_BANDEAU_NOM]: { nom: "", fonction: "B" } }, { [ENTREE_BANDEAU_NOM]: { nom: 1, fonction: "B" } }]) {
      expect(lireEntreeBandeau(e)).toBeNull();
    }
  });
});

describe("parametresComposition", () => {
  const MAINTENANT = "2026-10-02T08:00:00.000Z";
  const n1 = decorsCatalogue(MAINTENANT).find((d) => d.id === "decor-n1-halo-orange")!;
  const plans = [{ ordre: 1, debutSec: 0, finSec: 12, texte: "t", segmentId: "s1", sourceImage: "double" as const, motsEnValeur: [], cadrage: { pointInteret: { x: 0.5, y: 0.38 }, zoom: 1, valeur: "large" as const }, transition: "coupe" as const, angle: "trois-quarts" as const }];
  const segments: SegmentSousTitres[] = [{ id: "g1", debutSec: 0.1, finSec: 0.8, mots: [{ mot: "Vous", debutSec: 0.1, finSec: 0.3 }, { mot: "recevez", debutSec: 0.3, finSec: 0.8 }] }];
  const commande = (extra: Partial<CommandeFabrication> = {}, briques: Record<string, boolean> = {}) =>
    ({
      versionContrat: 2, moteurId: "montage-avocat", videoId: "v-test", formatId: "avocat", versionFormat: 2, profilRenduVersion: 1, dureeCibleSec: 12, ratios: ["9:16"],
      script: { blocs: [{ id: "b", blocRecette: "accroche", segments: [{ id: "s1", texte: "Vous recevez" }] }], texteComplet: "" },
      distribution: [{ role: "Face caméra", source: "double", modeAngles: "un-angle", visagesResolus: { "trois-quarts": { visageId: "vis-1" } } }],
      styles: { lut: null, sousTitres: { id: "st-avocat-v1", nom: "Avocat", valeur: STYLE_SOUS_TITRES_AVOCAT }, habillage: null, profilSon: { id: "ps", nom: "Avocat", valeur: PROFIL_SON_AVOCAT }, musique: null, decor: { id: n1.id, nom: n1.nom, valeur: n1.valeur as never } },
      briques: { "sous-titres": true, etalonnage: false, illustrations: false, son: true, habillage: false, "texte-ecran": false, "mention-ia": false, ...briques },
      entrees: {}, reglages: {}, plans: [], prononciations: [], mentionIA: { active: false }, budgetMax: { centimes: 15000, devise: "EUR" },
      profilRealisme: formatAvocat.profilRendu?.realisme, profilRendu: undefined, recetteMontage: RECETTE_MONTAGE_AVOCAT, construiteLe: MAINTENANT,
      sousTitres: { base: "karaoke", intensite: "equilibre" }, medias: { "decor-n1-halo-orange": { cle: "/demo/decors/fond-1-halo-orange.jpg", mime: "image/jpeg" } },
      ...extra,
    }) as unknown as CommandeFabrication;
  const composer = (c: CommandeFabrication) => parametresComposition(c, { ratio: "9:16", plans, segments, dureeSec: 12 }, RECETTE_COMPOSITION_AVOCAT);

  it("sans l'entrée : texte.sousTitres identique à avant, sans clé bandeauNom (objet complet)", () => {
    const a = composer(commande());
    expect(a.texte.sousTitres).toBeDefined();
    expect("bandeauNom" in a.texte.sousTitres!).toBe(false);
    expect(composer(commande({ entrees: { autre: 1 } }))).toEqual(a);
  });
  it("avec l'entrée : bandeauNom posé (nom, fonction, début 0,8 s), le reste de l'objet inchangé", () => {
    const a = composer(commande());
    const b = composer(commande({ entrees: { [ENTREE_BANDEAU_NOM]: { nom: "Marie Durand", fonction: "Avocate en droit du travail" } } }));
    expect(b.texte.sousTitres?.bandeauNom).toMatchObject({ nom: "Marie Durand", fonction: "Avocate en droit du travail", debutSec: 0.8, finSec: 3.8 });
    const { bandeauNom: _b, ...reste } = b.texte.sousTitres!;
    expect(reste).toEqual(a.texte.sousTitres);
  });
  it("sans sous-titres : pas de bandeau (limite assumée) ; entrée invalide : rien", () => {
    const e = { [ENTREE_BANDEAU_NOM]: { nom: "Marie Durand", fonction: "Avocate" } };
    expect(composer(commande({ entrees: e }, { "sous-titres": false })).texte.sousTitres).toBeUndefined();
    expect("bandeauNom" in composer(commande({ entrees: { [ENTREE_BANDEAU_NOM]: { nom: "x" } } })).texte.sousTitres!).toBe(false);
  });
});
