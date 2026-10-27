/**
 * EMPREINTE DES ÉCRANS IV ISSUS DE `briques/ecrans-motion`. La brique appartient à la session « cas concret » (qui fige
 * ses 12 types dans `tests/cas-concret/script-valide/regles-v4.test.ts`) ; le format « image → vidéo » en réutilise
 * quatre (accroche, chiffre, titre, question), tels que `mise-en-scene.ts` les produit. Ce test fige, côté IV :
 *  1. les types d'écran réellement produits par le format et les propriétés transmises à la brique ;
 *  2. les boîtes et propriétés calculées par la brique pour ces types, au 9:16 (zone protégée de chaque réseau IV, bande
 *     des sous-titres IV) et aux autres ratios de la scène (4:5, 1:1, 16:9).
 * Toute retouche de `src/briques/ecrans-motion` qui déplace une boîte ou une propriété fait rougir CE test.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { boites, boitesEcran, charteDuoPour, proprietesEcrans, zonesEcran, type EcranCale, type TypeEcran, type ZoneProtegeePct } from "@/briques/ecrans-motion";
import { DIMENSIONS_SCENE } from "@/briques/composition/scene";
import { BANDE_SOUS_TITRES_IV } from "@/briques/schema-motion/types";
import type { CarteImage } from "@/domaine/image-video/carte";
import { RESEAUX_IV, RESEAUX_IV_HISTORIQUE } from "@/domaine/image-video/plafonds";
// 26/10/2026 : valeurs de référence (octet pour octet) calculées sur le plan des fins d'AVANT (fin « diagnostic », LinkedIn muet) :
// elles prouvent que le rendu ne change pas pour un plan inchangé, quelles que soient les fins posées aujourd'hui.
import { planDesFinsAvant as planDesFinsIV } from "./plan-des-fins-avant";
import { pisteSimulee } from "@/moteurs/montage-image-video/calage";
import { FICHES_SIMULEES } from "@/moteurs/montage-image-video/ecriture.simulation";
import { mettreEnSceneIV } from "@/moteurs/montage-image-video/mise-en-scene";
import { idElementBruitage, SONS_BANQUE } from "@/donnees/bruitages";
import { zoneProtegeeCombinee } from "@/reseaux";

const MESSAGE =
  "L'empreinte des écrans IV issus de `src/briques/ecrans-motion` a changé. Cette brique est partagée avec le cas concret : " +
  "PRÉVENEZ la session « image → vidéo », puis REVOYEZ les écrans IV (accroche, chiffre, titre, question : boîtes, textes, " +
  "retours à la ligne, rendu 9:16 et autres ratios). Si le changement est voulu et les écrans IV relus, mettez à jour " +
  "l'empreinte ci-dessous dans le même lot ; sinon annulez la retouche de la brique.";

const empreinte = (x: unknown) => createHash("sha256").update(JSON.stringify(x)).digest("hex").slice(0, 16);
const IMAGES = { A: "essai-a", B: "essai-b", C: "essai-c", D: "essai-d", E: "essai-e", F: "essai-f", "faux-16-noeuds": "essai-faux16" } as const;
const VALIDES = SONS_BANQUE.map((s) => ({ elementId: idElementBruitage(s), declencheur: s.declencheur, variante: s.variante, dureeSec: s.dureeSec }));

/** Tous les écrans calés que le format IV remet à la brique (7 images d'essai × 5 réseaux). */
function ecransProduits(): EcranCale[] {
  const sortie: EcranCale[] = [];
  for (const [nom, cle] of Object.entries(IMAGES)) {
    const carte = JSON.parse(readFileSync(join(process.cwd(), "tests/image-video/fixtures/cartes", `${nom}.json`), "utf8")) as CarteImage;
    const fiche = FICHES_SIMULEES[cle];
    const fins = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit }).fins;
    for (const reseau of RESEAUX_IV) {
      const fin = fins.find((f) => f.reseaux.includes(reseau))!;
      const res = mettreEnSceneIV({ carte, fiche, voix: pisteSimulee(fiche, fin.muet ? null : fin), fin, reseaux: fin.reseaux, bruitagesValides: VALIDES });
      for (const b of res.ligne.blocs) if (b.sorte === "ecran") sortie.push(b.ecran);
    }
  }
  return sortie;
}

describe("écrans IV · types et propriétés transmises à ecrans-motion", () => {
  const ecrans = ecransProduits();
  const types = [...new Set(ecrans.map((e) => e.type))].sort();
  const proprietes = (t: string) => [...new Set(ecrans.filter((e) => e.type === t).flatMap((e) => Object.keys(e)))].sort();

  it("le format IV n'utilise que ces types d'écran", () => {
    expect(types, MESSAGE).toEqual(["accroche", "chiffre", "question", "titre"]);
  });
  it("propriétés transmises, type par type", () => {
    const base = ["debutMs", "evenements", "finMs", "fond", "id", "type"];
    expect(proprietes("accroche"), MESSAGE).toEqual([...base, "lignes"].sort());
    expect(proprietes("titre"), MESSAGE).toEqual([...base, "lignes"].sort());
    expect(proprietes("question"), MESSAGE).toEqual([...base, "lignes", "question"].sort());
    expect(proprietes("chiffre"), MESSAGE).toEqual([...base, "compteur", "nombre", "pastilles", "unite"].sort());
  });
});

/** Contenu canonique d'un écran de chaque type utilisé par l'IV (même forme que celle produite par `mise-en-scene.ts`). */
const COMMUN = { id: "e01", fond: "sombre" as const, debutMs: 0, finMs: 4000, evenements: [{ cible: "ligne-0", ms: 300 }, { cible: "ligne-1", ms: 1200 }] };
const CANONIQUES: Record<string, EcranCale> = {
  accroche: { ...COMMUN, type: "accroche", lignes: ["Votre *équipe* répond", "à tout, tout le temps", "sans jamais dormir"] },
  chiffre: { ...COMMUN, type: "chiffre", nombre: 15, unite: "minutes", pastilles: ["par candidat", "sans rendez-vous"], compteur: true },
  titre: { ...COMMUN, type: "titre", lignes: ["Un seul *outil* pour tout relier"] },
  question: { ...COMMUN, type: "question", lignes: ["Vous reconnaissez cette situation ?"], question: "Dites *oui* en commentaire" },
};
const TYPES_IV = ["accroche", "chiffre", "titre", "question"] as const satisfies readonly TypeEcran[];

/**
 * Zone protégée de référence : union des 5 réseaux historiques (TikTok compris) au 9:16 ; aucun registre aux autres ratios →
 * rien de protégé. Gardée à cinq réseaux après le retrait de TikTok d'Image → vidéo (19/10/2026) : ce test garde la brique
 * `ecrans-motion`, dont l'entrée ne doit pas bouger.
 */
const zoneProtegeePour = (ratio: keyof typeof DIMENSIONS_SCENE): ZoneProtegeePct => zoneProtegeeCombinee(ratio, [...RESEAUX_IV_HISTORIQUE]) ?? { haut: 0, droite: 0, bas: 0, gauche: 0 };

const mesures = () => {
  const sortie: Record<string, string> = {};
  for (const ratio of Object.keys(DIMENSIONS_SCENE) as (keyof typeof DIMENSIONS_SCENE)[]) {
    const { largeur, hauteur } = DIMENSIONS_SCENE[ratio];
    const protegee = zoneProtegeePour(ratio);
    const { utile, dessin } = zonesEcran(protegee, largeur, hauteur, BANDE_SOUS_TITRES_IV.haut);
    sortie[`zones/${ratio}`] = empreinte({ protegee, utile, dessin });
    for (const type of TYPES_IV) {
      sortie[`boites/${ratio}/${type}`] = empreinte(boites(type, utile, charteDuoPour(hauteur), {}, {}));
      const [p] = proprietesEcrans({ ecrans: [CANONIQUES[type]], captures: {}, zoneProtegee: protegee, bandeSousTitres: BANDE_SOUS_TITRES_IV.haut, largeur, hauteur });
      sortie[`proprietes/${ratio}/${type}`] = empreinte(p);
      sortie[`mise-en-page/${ratio}/${type}`] = empreinte(boitesEcran(p));
    }
  }
  return sortie;
};

describe("écrans IV · boîtes et propriétés calculées par ecrans-motion", () => {
  it("empreinte des zones, boîtes, propriétés et mises en page (9:16, 4:5, 1:1, 16:9 × accroche, chiffre, titre, question)", () => {
    expect(mesures(), MESSAGE).toEqual(ATTENDU);
  });
  it("zone de référence des 5 réseaux historiques (garde de la brique ecrans-motion), bande des sous-titres IV comprise", () => {
    expect(zoneProtegeePour("9:16"), MESSAGE).toEqual(ATTENDU_ZONE_916);
    expect(BANDE_SOUS_TITRES_IV, MESSAGE).toEqual({ haut: 0.6, bas: 0.67 });
  });
});

const ATTENDU_ZONE_916: ZoneProtegeePct = { haut: 14, droite: 18, bas: 30, gauche: 6 };
const ATTENDU: Record<string, string> = {
  "boites/16:9/accroche": "8deaabe9ea254973",
  "boites/16:9/chiffre": "8d5882c5a53a32bd",
  "boites/16:9/question": "c749a0c969e4787d",
  "boites/16:9/titre": "a6235381923740a2",
  "boites/1:1/accroche": "246a43302c7aaab9",
  "boites/1:1/chiffre": "4dbf7f6eb56f50af",
  "boites/1:1/question": "fed2039a8dd62932",
  "boites/1:1/titre": "a336d27c28361da2",
  "boites/4:5/accroche": "8276b69acdcd96bd",
  "boites/4:5/chiffre": "2e846f9fddbf339e",
  "boites/4:5/question": "67d048d087eb54fb",
  "boites/4:5/titre": "9cf01c205fc627d9",
  "boites/9:16/accroche": "80208a0fc3e994d2",
  "boites/9:16/chiffre": "9cec359a8f13e030",
  "boites/9:16/question": "6be4cb5e60b72442",
  "boites/9:16/titre": "6378c17d4cfce71e",
  "mise-en-page/16:9/accroche": "a0679357fd9f2e16",
  "mise-en-page/16:9/chiffre": "789720fefd8e2e0b",
  "mise-en-page/16:9/question": "db4891c2bc1db08a",
  "mise-en-page/16:9/titre": "fc6a1958ae1502ea",
  "mise-en-page/1:1/accroche": "246a43302c7aaab9",
  "mise-en-page/1:1/chiffre": "fb9ddf402f4113a3",
  "mise-en-page/1:1/question": "6753fe62909626ce",
  "mise-en-page/1:1/titre": "dca541f75478b8c1",
  "mise-en-page/4:5/accroche": "8276b69acdcd96bd",
  "mise-en-page/4:5/chiffre": "ef07b1b7f35bbe31",
  "mise-en-page/4:5/question": "0e8dab70631ff503",
  "mise-en-page/4:5/titre": "4588d448713af805",
  "mise-en-page/9:16/accroche": "80208a0fc3e994d2",
  "mise-en-page/9:16/chiffre": "51fafff2f626cdb3",
  "mise-en-page/9:16/question": "d73fbdc3f7c4bfef",
  "mise-en-page/9:16/titre": "56f36b1b6267a167",
  "proprietes/16:9/accroche": "fdaffd67ed063d83",
  "proprietes/16:9/chiffre": "cbba914db0a13b64",
  "proprietes/16:9/question": "3035057efd4bfe65",
  "proprietes/16:9/titre": "6f37eeb10972c4e8",
  "proprietes/1:1/accroche": "135858b92d06f7e9",
  "proprietes/1:1/chiffre": "647fc31a763ba1df",
  "proprietes/1:1/question": "d3f2680e273d6c97",
  "proprietes/1:1/titre": "d022669c03266775",
  "proprietes/4:5/accroche": "9532bf4beba9d135",
  "proprietes/4:5/chiffre": "1a2b97155141cb61",
  "proprietes/4:5/question": "a5132b542d805429",
  "proprietes/4:5/titre": "4274acd26745c1dd",
  "proprietes/9:16/accroche": "80e58b535e4a1dfb",
  "proprietes/9:16/chiffre": "324d248b1a7eaeee",
  "proprietes/9:16/question": "14be9c16c660aeef",
  "proprietes/9:16/titre": "892a2c02576f83cf",
  "zones/16:9": "0359abd9bdf99047",
  "zones/1:1": "dfad05a53d8ba870",
  "zones/4:5": "9d762ce663b3049d",
  "zones/9:16": "ca20e8f356a2eb46",
};
