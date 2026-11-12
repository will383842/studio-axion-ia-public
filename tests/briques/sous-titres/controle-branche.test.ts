/**
 * GV-ST-04 : le contrôle central des sous-titres est branché sur la composition. Il ne produit que des remarques
 * (jamais bloquantes) et ne change aucun paramètre de rendu (donc aucune clé de cache).
 */
import { describe, expect, it } from "vitest";
import { controlerSousTitres, VITESSE_LECTURE_MAX_MOTS_PAR_SEC } from "@/briques/sous-titres";
import { parametresComposition } from "@/briques/composition";
import { decorsCatalogue } from "@/donnees/decors-catalogue";
import { ACCESSOIRE_MICRO, HABILLAGE_AVOCAT, PROFIL_SON_AVOCAT, STYLE_SOUS_TITRES_AVOCAT } from "@/donnees/elements-avocat";
import type { CommandeFabrication, SegmentSousTitres } from "@/domaine/types";
import { formatAvocat, RECETTE_MONTAGE_AVOCAT } from "@/formats/avocat";
import { RECETTE_COMPOSITION_AVOCAT } from "@/moteurs/montage-avocat/recette-composition";
import type { PlanProduit } from "@/moteurs/types";

const MAINTENANT = "2026-10-02T08:00:00.000Z";

const PLANS: PlanProduit[] = [
  { ordre: 1, debutSec: 0, finSec: 9, texte: "texte", segmentId: "s1", sourceImage: "double", motsEnValeur: [], cadrage: { pointInteret: { x: 0.5, y: 0.38 }, zoom: 1, valeur: "large" }, transition: "coupe", angle: "trois-quarts" } as PlanProduit,
];

function commande(texteComplet: string): CommandeFabrication {
  const n1 = decorsCatalogue(MAINTENANT).find((d) => d.id === "decor-n1-halo-orange")!;
  return {
    versionContrat: 2,
    moteurId: "montage-avocat",
    videoId: "v-controle",
    formatId: "avocat",
    versionFormat: 2,
    profilRenduVersion: 1,
    dureeCibleSec: 9,
    ratios: ["9:16"],
    script: { blocs: [{ id: "b", blocRecette: "preuve", segments: [{ id: "s1", texte: texteComplet }] }], texteComplet },
    distribution: [{ role: "Face caméra", source: "double", modeAngles: "un-angle", visagesResolus: { "trois-quarts": { visageId: "vis-1" } } }],
    styles: {
      lut: { id: "lut-avocat-v1", nom: "Clair-obscur", intensite: 70, cible: ["personnage", "illustrations", "rushs", "decor", "accessoire"], origine: "format" },
      sousTitres: { id: "st-avocat-v1", nom: "Avocat", valeur: STYLE_SOUS_TITRES_AVOCAT },
      habillage: { id: "hab-avocat-v1", nom: "Avocat", valeur: HABILLAGE_AVOCAT },
      profilSon: { id: "ps-avocat-v1", nom: "Avocat", valeur: PROFIL_SON_AVOCAT },
      musique: null,
      decor: { id: n1.id, nom: n1.nom, valeur: n1.valeur as never },
    },
    briques: { "sous-titres": true, etalonnage: true, illustrations: true, son: true, habillage: true, "texte-ecran": true, "mention-ia": false },
    entrees: {},
    reglages: {},
    plans: [],
    prononciations: [],
    mentionIA: { active: false } as never,
    budgetMax: { centimes: 15000, devise: "EUR" },
    accessoires: [{ id: "acc-micro-podcast", nom: "Micro", valeur: ACCESSOIRE_MICRO }],
    profilRealisme: formatAvocat.profilRendu?.realisme,
    profilRendu: formatAvocat.profilRendu,
    recetteMontage: RECETTE_MONTAGE_AVOCAT,
    construiteLe: MAINTENANT,
    sousTitres: { base: "karaoke", intensite: "equilibre" },
    medias: {
      "decor-n1-halo-orange": { cle: "/demo/decors/fond-1-halo-orange.jpg", mime: "image/jpeg" },
      "lut-avocat-v1": { cle: "/luts/axion-buffer-clair-obscur.cube", mime: "application/octet-stream", tailleCube: 65 },
    },
  } as CommandeFabrication;
}

/** Une phrase de `n` mots, dite en `dureeSec` secondes. */
function phrase(n: number, dureeSec: number): { texte: string; segments: SegmentSousTitres[] } {
  const pas = dureeSec / n;
  const mots = Array.from({ length: n }, (_, i) => ({ mot: i === n - 1 ? "mot." : "mot", debutSec: i * pas, finSec: (i + 1) * pas }));
  return { texte: mots.map((m) => m.mot).join(" "), segments: [{ id: "g1", debutSec: 0, finSec: dureeSec, mots }] };
}

const entree = (segments: SegmentSousTitres[]) => ({ ratio: "9:16" as const, plans: PLANS, segments, dureeSec: 9 });

describe("contrôle des sous-titres branché sur la composition", () => {
  it("la vitesse de lecture de référence reste 4,4 mots par seconde", () => {
    expect(VITESSE_LECTURE_MAX_MOTS_PAR_SEC).toBe(4.4);
  });

  it("une phrase de 12 mots dite en 2 s : remarque « vitesse-lecture », sans bloquer", () => {
    const { texte, segments } = phrase(12, 2);
    const p = parametresComposition(commande(texte), entree(segments), RECETTE_COMPOSITION_AVOCAT);
    const a = p.alertes.filter((x) => x.code === "vitesse-lecture");
    expect(a).toHaveLength(1);
    expect(a[0].gravite).toBe("info");
  });

  it("une phrase normale : aucune remarque de vitesse", () => {
    const { texte, segments } = phrase(8, 4);
    const p = parametresComposition(commande(texte), entree(segments), RECETTE_COMPOSITION_AVOCAT);
    expect(p.alertes.some((x) => x.code === "vitesse-lecture")).toBe(false);
  });

  it("pas de doublon d'une même remarque", () => {
    const { texte, segments } = phrase(12, 2);
    const p = parametresComposition(commande(texte), entree(segments), RECETTE_COMPOSITION_AVOCAT);
    const cles = p.alertes.map((x) => `${x.code}|${x.message}`);
    expect(new Set(cles).size).toBe(cles.length);
  });

  it("les paramètres de rendu (image, texte, couleurs, son, export) ne dépendent pas du contrôle", () => {
    const { texte, segments } = phrase(12, 2);
    const avec = parametresComposition(commande(texte), entree(segments), RECETTE_COMPOSITION_AVOCAT);
    const c = commande(texte);
    // Même commande sans texte complet : le contrôle de vitesse n'a rien à lire.
    const sans = parametresComposition({ ...c, script: { ...c.script, texteComplet: "" } }, entree(segments), RECETTE_COMPOSITION_AVOCAT);
    expect(sans.alertes.some((x) => x.code === "vitesse-lecture")).toBe(false);
    for (const cle of ["image", "texte", "couleurs", "son", "export"] as const) expect(avec[cle]).toEqual(sans[cle]);
  });

  it("le contrôle direct signale la même vitesse que la composition", () => {
    const { texte, segments } = phrase(12, 2);
    const p = parametresComposition(commande(texte), entree(segments), RECETTE_COMPOSITION_AVOCAT);
    expect(p.texte.sousTitres).toBeDefined();
    expect(controlerSousTitres(p.texte.sousTitres!, { texte }).map((x) => x.code)).toContain("vitesse-lecture");
  });
});
