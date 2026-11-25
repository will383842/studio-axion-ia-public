/**
 * K2-T2-b2 (sélectifs). Modèle : BR-ETIQUETTES-OUTIL (17/11) : l'étiquette « HUBSPOT », « ZAPIER » (texte seul, sans logo) est BRANCHÉE à la fabrication
 * de l'avocat. Le réglage part du vrai chemin de lancement (`bibliothequeVideo.avocat` → `entreeBibliothequeDuLancement`,
 * la fonction qui remplit `commande.entrees` dans `src/services/fabrication.ts`), puis `parametresComposition` (appelé par
 * `montage-avocat/index.ts`) ; le rendu de `CalqueSousTitres` montre l'étiquette à l'instant attendu.
 * Éteint (réglage absent, ou capacité non listée) = propriétés de composition identiques, aucune clé neuve.
 */
import { beforeEach, describe, expect, it } from "vitest";
import type { CommandeFabrication, SegmentSousTitres } from "@/domaine/types";
import { decorsCatalogue } from "@/donnees/decors-catalogue";
import { ACCESSOIRE_MICRO, HABILLAGE_AVOCAT, PROFIL_SON_AVOCAT, STYLE_SOUS_TITRES_AVOCAT } from "@/donnees/elements-avocat";
import { formatAvocat, RECETTE_MONTAGE_AVOCAT } from "@/formats/avocat";
import { parametresComposition } from "@/moteurs/montage-avocat/composition";
import { escalierPermis, selectifPermis } from "@/briques/composition/porte-texte";
import { PROFILS_DU_CODE } from "@/briques/bibliotheque-video/profils";

const { reinitialiserDepots } = await import("@/donnees/memoire");
const commun = await import("@/services/_commun");
const { entreeBibliothequeDuLancement } = await import("@/services/bibliotheque-video");

const CLE = "bibliothequeVideo.avocat";
const CLE_ENTREE = "bibliothequeVideo";
const MAINTENANT = "2026-11-17T08:00:00.000Z";
const n1 = decorsCatalogue(MAINTENANT).find((d) => d.id === "decor-n1-halo-orange")!;

function commande(entrees: Record<string, unknown>): CommandeFabrication {
  return {
    versionContrat: 2, moteurId: "montage-avocat", videoId: "v-test", formatId: "avocat", versionFormat: 2, profilRenduVersion: 1,
    dureeCibleSec: 12, ratios: ["9:16"],
    script: { blocs: [{ id: "b", blocRecette: "accroche", segments: [{ id: "s1", texte: "Avec HubSpot vos devis Jamais payer 30 euros Bonjour à tous" }] }], texteComplet: "Avec HubSpot vos devis Jamais payer 30 euros Bonjour à tous" },
    distribution: [{ role: "Face caméra", source: "double", modeAngles: "un-angle", visagesResolus: { "trois-quarts": { visageId: "vis-1" } } }],
    styles: {
      lut: null,
      sousTitres: { id: "st-avocat-v1", nom: "Avocat", valeur: STYLE_SOUS_TITRES_AVOCAT },
      habillage: { id: "hab-avocat-v1", nom: "Avocat", valeur: HABILLAGE_AVOCAT },
      profilSon: { id: "ps-avocat-v1", nom: "Avocat", valeur: PROFIL_SON_AVOCAT },
      musique: null,
      decor: { id: n1.id, nom: n1.nom, valeur: n1.valeur as never },
    },
    briques: { "sous-titres": true, etalonnage: true, illustrations: true, son: true, habillage: true, "texte-ecran": true, "mention-ia": false },
    entrees, reglages: {}, plans: [], prononciations: [], mentionIA: { active: false } as never, budgetMax: { centimes: 15000, devise: "EUR" },
    accessoires: [{ id: "acc-micro-podcast", nom: "Micro", valeur: ACCESSOIRE_MICRO }],
    profilRealisme: formatAvocat.profilRendu?.realisme, profilRendu: formatAvocat.profilRendu, recetteMontage: RECETTE_MONTAGE_AVOCAT,
    construiteLe: MAINTENANT, sousTitres: { base: "karaoke", intensite: "equilibre" },
    medias: { "decor-n1-halo-orange": { cle: "/demo/decors/fond-1-halo-orange.jpg", mime: "image/jpeg" } },
  } as CommandeFabrication;
}

const mot = (m: string, d: number) => ({ mot: m, debutSec: d, finSec: d + 0.3 });
const SEGMENTS: SegmentSousTitres[] = [
  { id: "g1", debutSec: 0.5, finSec: 2.5, mots: [mot("Avec", 0.5), mot("HubSpot", 1.2), mot("vos", 1.7), mot("devis", 2)] },
  { id: "g2", debutSec: 3, finSec: 5, mots: [mot("Jamais", 3), mot("payer", 3.4), mot("30", 4), mot("euros", 4.5)] },
  { id: "g3", debutSec: 5.5, finSec: 7, mots: [mot("Bonjour", 5.6), mot("à", 6.2), mot("tous", 6.5)] },
];
const PLANS = [{ ordre: 1, debutSec: 0, finSec: 12, texte: "t", segmentId: "s1", sourceImage: "double" as const, motsEnValeur: [], cadrage: { pointInteret: { x: 0.5, y: 0.38 }, zoom: 1, valeur: "large" as const }, transition: "coupe" as const, angle: "trois-quarts" as const }];
const composer = (c: CommandeFabrication) => parametresComposition(c, { ratio: "9:16", plans: PLANS, segments: SEGMENTS, dureeSec: 12 });

async function entreesDuLancement(reglage?: unknown) {
  if (reglage !== undefined) await commun.ecrireParametre(CLE, reglage);
  return entreeBibliothequeDuLancement({ id: "v-test", formatId: "avocat" });
}



/** Entrée figée réelle (chemin de lancement) dont le profil a, en plus, les capacités données ouvertes à la main : aucun profil réel ne permet texte.selectif. */
async function entreesOuvertes(...ids: string[]) {
  const entrees = (await entreesDuLancement(true)) as Record<string, { profil: { capacites: Record<string, unknown> } }>;
  const e = structuredClone(entrees[CLE_ENTREE]);
  for (const id of ids) e.profil.capacites[id] = { permis: true };
  return { [CLE_ENTREE]: e };
}
const mots = (p: ReturnType<typeof composer>) => p.texte.sousTitres!.segments.map((s) => s.mots.map((m) => m.mot));

beforeEach(() => { reinitialiserDepots(); });

describe("(a) éteint = identique", () => {
  it("(a) selectifPermis est false pour CHAQUE profil réel figé au lancement, et pour les entrées absentes ou illisibles", () => {
    for (const e of [undefined, null, {}, "x", 3, { bibliothequeVideo: 1 }]) expect(selectifPermis(e)).toBe(false);
    for (const [formatId, profil] of Object.entries(PROFILS_DU_CODE)) {
      expect(profil.capacites["texte.selectif" as never]?.permis ?? false, formatId).toBe(false);
      expect(selectifPermis({ [CLE_ENTREE]: { profil } }), formatId).toBe(false);
    }
  });
  it("(a) 3 cas éteints (sans bibliothèque, bibliothèque sans la capacité, capacité permis:false) : composition identique et mêmes alertes", async () => {
    const ref = composer(commande({}));
    for (const entrees of [{}, await entreesDuLancement(true), await entreesDuLancement({ capacites: ["texte.selectif"] })]) {
      const p = composer(commande(entrees));
      expect(selectifPermis(entrees)).toBe(false);
      expect({ ...p, entrees: null }).toEqual({ ...ref, entrees: null });
    }
    expect(mots(ref)).toEqual(SEGMENTS.map((s) => s.mots.map((m) => m.mot)));
  });
});

describe("(b) porte ouverte", () => {
  it("(b) les groupes sans nombre ni mot fort n'ont plus de mots ; bornes identiques ; groupes gardés égaux ; aucune alerte « mots manquants » neuve", async () => {
    const entrees = await entreesOuvertes("texte.selectif");
    expect(selectifPermis(entrees)).toBe(true);
    const eteint = composer(commande({}));
    const p = composer(commande(entrees));
    const seg = p.texte.sousTitres!.segments;
    expect(mots(p)).toEqual([[], ["Jamais", "payer", "30", "euros"], []]);
    expect(seg.map((s) => [s.id, s.debutSec, s.finSec])).toEqual(eteint.texte.sousTitres!.segments.map((s) => [s.id, s.debutSec, s.finSec]));
    expect(seg[1]).toEqual(eteint.texte.sousTitres!.segments[1]);
    expect(eteint.alertes.filter((a) => a.code === "sous-titres-incomplets")).toEqual([]);
    expect(p.alertes.filter((a) => a.code === "sous-titres-incomplets")).toEqual([]);
  });
});

describe("(c) le sélectif prime sur l'escalier", () => {
  it("(c) porte ouverte + escalier permis : pas de champ escalier ; porte fermée + escalier permis : escalier présent", async () => {
    const ouvert = await entreesOuvertes("texte.selectif", "texte.escalier");
    expect(escalierPermis(ouvert)).toBe(true);
    expect("escalier" in composer(commande(ouvert)).texte.sousTitres!).toBe(false);
    const ferme = await entreesOuvertes("texte.escalier");
    expect(selectifPermis(ferme)).toBe(false);
    expect("escalier" in composer(commande(ferme)).texte.sousTitres!).toBe(true);
  });
});

describe("(d) le .srt n'est pas filtré", () => {
  it("(d) les segments d'entrée restent intacts avant/après, porte ouverte", async () => {
    const avant = structuredClone(SEGMENTS);
    composer(commande(await entreesOuvertes("texte.selectif")));
    expect(SEGMENTS).toEqual(avant);
  });
});

describe("(e) aucun profil réel ne permet texte.selectif", () => {
  it("(e) porteCapacite refuse pour chaque profil réel", () => {
    for (const [formatId, profil] of Object.entries(PROFILS_DU_CODE)) expect(selectifPermis({ [CLE_ENTREE]: { profil } }), formatId).toBe(false);
  });
});

