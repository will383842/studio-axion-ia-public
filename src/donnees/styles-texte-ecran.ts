/**
 * STYLES DE TEXTE À L'ÉCRAN (C2-U13, migration 25). PUR.
 *
 * Cinq styles de Bibliothèque que Williams pourra choisir une fois validés sur planche : « Axion surligné »,
 * « Axion pavé », « Axion outils », « Axion varié » et « Pastille Axion » (Manrope, tableau « reference/3 »).
 * Créations du studio : licence de propriété, aucun fichier, aucune police ni son ajoutés. Aucun n'est le style par
 * défaut d'un format (`formatsParDefaut: []`) : tant que Williams n'en choisit pas un, aucune vidéo ne change.
 *
 * ÉTEINT : `STYLES_TEXTE_ECRAN_INSTALLES` vaut `false`, la migration 25 ne fait rien. Elle s'allume par une PR d'une
 * ligne, sur geste de Williams, après la planche U15. Seul `true` allume.
 */
import type { ElementBibliotheque, Licence, ValeurStyleSousTitres } from "@/domaine/types";
import { STYLE_SOUS_TITRES_AVOCAT, STYLE_SOUS_TITRES_MINIMAL } from "@/donnees/elements-avocat";

export const STYLES_TEXTE_ECRAN_INSTALLES = true;

const PROPRIETE: Licence = { type: "propriete", usageCommercial: true, reseaux: [] };

const karaoke = (texteEcran?: ValeurStyleSousTitres["texteEcran"]): ValeurStyleSousTitres => ({ ...STYLE_SOUS_TITRES_AVOCAT, ...(texteEcran ? { texteEcran } : {}) });

/** Les valeurs, sans date : copies des bases existantes (jamais modifiées) plus le réglage de texte à l'écran. */
export const VALEUR_AXION_SURLIGNE: ValeurStyleSousTitres = karaoke({ marqueur: { teinte: "terracotta", cible: "expression" } });
export const VALEUR_AXION_PAVE: ValeurStyleSousTitres = karaoke({ pave: { mots: "forts-et-chiffres" } });
export const VALEUR_AXION_OUTILS: ValeurStyleSousTitres = { ...STYLE_SOUS_TITRES_MINIMAL, texteEcran: { outils: "etiquette" } };
export const VALEUR_AXION_VARIE: ValeurStyleSousTitres = karaoke({ varier: true });
/** Pastille pleine, mot dit en orange clair ; la police suit `PASTILLE_EN_MANROPE` (C2-U14, allumée : Manrope Bold). */
export const VALEUR_PASTILLE_AXION: ValeurStyleSousTitres = { ...STYLE_SOUS_TITRES_AVOCAT, pastille: "axion" };

export function elementsStylesTexteEcran(maintenant: string): ElementBibliotheque[] {
  const base = { type: "style-sous-titres" as const, formatsParDefaut: [], marqueId: "marque-axion", licence: PROPRIETE, creeLe: maintenant, modifieLe: maintenant };
  return [
    { ...base, id: "st-axion-surligne-v1", nom: "Axion surligné", motsCles: ["axion", "surlignage", "marqueur", "terracotta"], valeur: VALEUR_AXION_SURLIGNE },
    { ...base, id: "st-axion-pave-v1", nom: "Axion pavé", motsCles: ["axion", "pavé", "mot-clé", "chiffres"], valeur: VALEUR_AXION_PAVE },
    { ...base, id: "st-axion-outils-v1", nom: "Axion outils", motsCles: ["axion", "outils", "étiquette", "minimal"], valeur: VALEUR_AXION_OUTILS },
    { ...base, id: "st-axion-varie-v1", nom: "Axion varié", motsCles: ["axion", "varié", "variantes"], valeur: VALEUR_AXION_VARIE },
    { ...base, id: "st-pastille-axion-v1", nom: "Pastille Axion", motsCles: ["axion", "pastille", "manrope"], valeur: VALEUR_PASTILLE_AXION },
  ];
}
