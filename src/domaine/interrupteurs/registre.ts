/**
 * L5-07 · registre PUR des interrupteurs de la publication (existant recensé, rien de neuf n'est allumé).
 * Deux interrupteurs, en français simple : « Envoi automatique » et « Premier commentaire ».
 * Le réglage du premier commentaire sert UNIQUEMENT à couper : faux/absent = le premier commentaire part (comportement actuel).
 */
export const CLE_ENVOI_AUTOMATIQUE = "publication.editoriale_active";
export const CLE_PREMIER_COMMENTAIRE_COUPE = "publication.premier_commentaire_coupe";

export type IdInterrupteurPublication = "envoi-automatique" | "premier-commentaire";

export interface DefinitionInterrupteurPublication {
  id: IdInterrupteurPublication;
  libelle: string;
  cle: string;
  /** « inverse » : le réglage stocké dit « coupé » ; l'interrupteur affiché « allumé » = réglage faux. */
  sens: "direct" | "inverse";
  phraseAllume: string;
  phraseEteint: string;
}

export const INTERRUPTEURS_PUBLICATION: readonly DefinitionInterrupteurPublication[] = [
  {
    id: "envoi-automatique",
    libelle: "Envoi automatique",
    cle: CLE_ENVOI_AUTOMATIQUE,
    sens: "direct",
    phraseAllume: "Allumé : le calendrier peut préparer vos publications et les envoyer à l'heure prévue, si les autres réglages d'envoi sont aussi ouverts.",
    phraseEteint: "Éteint : rien ne part tout seul. Aucune publication n'est préparée ni envoyée par le calendrier.",
  },
  {
    id: "premier-commentaire",
    libelle: "Premier commentaire",
    cle: CLE_PREMIER_COMMENTAIRE_COUPE,
    sens: "inverse",
    phraseAllume: "Allumé : le premier commentaire que vous avez écrit part avec la publication (Facebook et LinkedIn).",
    phraseEteint: "Éteint : la publication part sans son premier commentaire.",
  },
];

export const trouverInterrupteurPublication = (id: unknown): DefinitionInterrupteurPublication | undefined => INTERRUPTEURS_PUBLICATION.find((i) => i.id === id);

/** PUR. Seul le booléen exact `true` compte ; toute autre valeur (absente, illisible) = comportement par défaut. */
export function interrupteurAllume(def: DefinitionInterrupteurPublication, brut: unknown): boolean {
  return def.sens === "direct" ? brut === true : brut !== true;
}

/** PUR. Valeur à écrire dans le réglage pour que l'interrupteur affiché prenne l'état voulu. */
export function valeurReglage(def: DefinitionInterrupteurPublication, allume: boolean): boolean {
  return def.sens === "direct" ? allume : !allume;
}
