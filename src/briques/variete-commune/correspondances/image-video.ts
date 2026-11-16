/**
 * Image → vidéo : code local → valeur commune. Codes de `schema-motion/variete.ts` (lecture seule : `AxeVariete`,
 * `CodesParAxe`, ligne 8-27) ; noms et verdicts : `docs/formats/image-video/variete/planche/verdict-critique.json`.
 * Chaque axe local est rangé sous un axe commun ; sans équivalent de nom certain = `autre:image-video:<code>`
 * (rien « au jugé » : seuls les codes dont le nom du verdict dit la même chose reçoivent une valeur commune).
 * Les codes Chiffres (CHI-*) sont rangés sous « objets » (jauge, duel, objets comptés), Apparition (APP-*) sous « dosage »,
 * Texte (TYP-*) sous « typo » : aucun n'a d'équivalent nommé aujourd'hui.
 * OUV-A « Résultat d'abord » ouvre sur le 80 % plein écran (verdict-critique.json) = `chiffre-geant`, comme `chiffre-choc`.
 */
import type { CodesParAxe, AxeVariete } from "@/briques/schema-motion/variete";
import type { AxeCommun } from "../types";

type TableLocale = { readonly [A in AxeVariete]: { readonly [C in CodesParAxe[A]]: string } };

const LOCALE = {
  ouverture: {
    "OUV-A": "chiffre-geant",
    "OUV-B": "avant-apres",
    "OUV-C": "horloge",
    "OUV-D": "question",
    "OUV-E": "detail-puis-recul",
  },
  recit: {
    "REC-A": "ordre-chronologique",
    "REC-B": "resultat-d-abord",
    "REC-C": "suivre-un-objet",
    "REC-D": "etapes-annoncees",
  },
  chiffres: {
    "CHI-A": "autre:image-video:CHI-A",
    "CHI-B": "autre:image-video:CHI-B",
    "CHI-C": "autre:image-video:CHI-C",
    "CHI-D": "autre:image-video:CHI-D",
    "CHI-E": "autre:image-video:CHI-E",
  },
  camera: {
    "CAM-A": "suivi",
    "CAM-B": "ensemble-d-abord",
    "CAM-C": "voyage",
    "CAM-D": "aucune",
    "CAM-E": "deux-cotes",
  },
  texte: {
    "TYP-A": "autre:image-video:TYP-A",
    "TYP-B": "autre:image-video:TYP-B",
    "TYP-C": "autre:image-video:TYP-C",
    "TYP-D": "autre:image-video:TYP-D",
  },
  apparition: {
    "APP-A": "autre:image-video:APP-A",
    "APP-B": "autre:image-video:APP-B",
    "APP-C": "autre:image-video:APP-C",
    "APP-D": "autre:image-video:APP-D",
  },
  transitions: {
    "TRA-A": "coupe",
    "TRA-B": "raccord-objet",
    "TRA-C": "volet",
    "TRA-D": "autre:image-video:TRA-D",
    "TRA-E": "poussee",
  },
  fin: {
    "FIN-A": "phrase-choc",
    "FIN-B": "schema-puis-phrase",
    "FIN-C": "boucle",
    "FIN-D": "chiffre-qui-reste",
  },
  matiere: {
    "MAT-A": "ivoire-v4",
    "MAT-B": "papier",
    "MAT-C": "trait-main",
    "MAT-D": "profondeur-douce",
  },
  sousTitres: {
    "SOU-A": "calmes",
    "SOU-B": "equilibres",
    "SOU-C": "appuyes",
    "SOU-D": "autre:image-video:SOU-D",
    "SOU-E": "autre:image-video:SOU-E",
  },
  fond: {
    "FON-A": "autre:image-video:FON-A",
    "FON-B": "autre:image-video:FON-B",
    "FON-C": "autre:image-video:FON-C",
    "FON-D": "autre:image-video:FON-D",
    "FON-E": "autre:image-video:FON-E",
  },
  rail: {
    "RAI-A": "autre:image-video:RAI-A",
    "RAI-B": "autre:image-video:RAI-B",
    "RAI-C": "autre:image-video:RAI-C",
    "RAI-D": "autre:image-video:RAI-D",
  },
  objets: {
    "OBJ-A": "autre:image-video:OBJ-A",
    "OBJ-B": "autre:image-video:OBJ-B",
    "OBJ-C": "autre:image-video:OBJ-C",
    "OBJ-D": "autre:image-video:OBJ-D",
  },
  entete: {
    "ENT-A": "autre:image-video:ENT-A",
    "ENT-B": "autre:image-video:ENT-B",
    "ENT-C": "autre:image-video:ENT-C",
    "ENT-D": "autre:image-video:ENT-D",
  },
} as const satisfies TableLocale;

/** Axe commun sous lequel chaque axe local est rangé. */
export const AXE_COMMUN_DE: Readonly<Record<AxeVariete, AxeCommun>> = Object.freeze({
  ouverture: "ouverture",
  recit: "recit",
  chiffres: "objets",
  camera: "camera",
  texte: "typo",
  apparition: "dosage",
  transitions: "transitions",
  fin: "fin",
  matiere: "habillage",
  sousTitres: "sousTitres",
  fond: "habillage",
  rail: "habillage",
  objets: "objets",
  entete: "habillage",
});

function parAxeCommun(): Partial<Record<AxeCommun, Record<string, string>>> {
  const t: Partial<Record<AxeCommun, Record<string, string>>> = {};
  for (const ax of Object.keys(LOCALE) as AxeVariete[]) {
    const c = AXE_COMMUN_DE[ax];
    t[c] = { ...(t[c] ?? {}), ...(LOCALE[ax] as Record<string, string>) };
  }
  return t;
}

export const TABLE_IMAGE_VIDEO: Readonly<Partial<Record<AxeCommun, Readonly<Record<string, string>>>>> = Object.freeze(parAxeCommun());
