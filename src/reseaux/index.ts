/**
 * Registre des réseaux (AV2.3-1). PUR : importable côté client.
 * Zones protégées en POURCENTAGES de l'image (haut, droite, bas, gauche) par ratio :
 * ce que l'interface du réseau recouvre (boutons, légende, pseudo).
 */
import type { IdReseau, Ratio } from "@/domaine/types";
import { CODES_RESEAU } from "./codes";

export interface ZoneProtegee {
  haut: number;
  droite: number;
  bas: number;
  gauche: number;
}

/**
 * Emplacement d'un réseau (plan « formats par réseau », T1) : un endroit où la vidéo s'affiche, avec son format et sa
 * zone. C'est ce que la table du tableau animé appelle « réseaux servis » (« Reels Instagram », « Fil Facebook »…).
 * « video » : le réseau n'a qu'un emplacement vidéo (TikTok, Shorts, YouTube, LinkedIn).
 */
export type IdEmplacement = "video" | "reels" | "stories" | "fil";

export interface EmplacementReseau {
  id: IdEmplacement;
  /** Libellé en français, le même que dans la table du tableau animé. */
  libelle: string;
  ratio: Ratio;
  zone: ZoneProtegee;
  /** D'où vient la valeur. */
  source: string;
}

export interface DefinitionReseau {
  id: IdReseau;
  nom: string;
  /** Monogramme affiché dans la pastille du réseau (pas de logo de marque). */
  monogramme: string;
  /**
   * Générateur (G1a, branche `generateur/prepare-moteur`) : code de classement (TT, IG, FB, LI, YS ; YT pour YouTube long),
   * lu dans `reseaux/codes.ts` (une seule source). Entre dans le code des versions (« 0042-AV-TT ») et les noms de fichiers.
   */
  codeClassement: string;
  ratios: Ratio[];
  ratioPrefere: Ratio;
  dureeMaxSec: number;
  export: { resolution: Partial<Record<Ratio, string>>; fps: number; debitMbps: number; codec: "h264" };
  niveauSonoreLufs: number;
  zonesProtegees: Partial<Record<Ratio, ZoneProtegee>>;
  legende: { longueurMax: number; longueurVisible: number; motsDieseMax: number; motsDieseConseilles: number };
  /** Générateur (G1a) : « 3:4 » ajouté pour la couverture d'un Reel (affichage de la grille du profil). */
  miniature: { ratio: Ratio | "3:4"; modifiable: boolean };
  /** Libellé de la case « contenu généré par l'IA » sur le réseau. */
  etiquetteIA: string;
  /** Envoi possible via Buffer. */
  viaBuffer: boolean;
  /** Lot R1 : service du compte Buffer où part ce réseau (YouTube et YouTube Shorts : le même compte « youtube »). */
  serviceBuffer: string;
  /**
   * T1 (formats par réseau) : zones des formats que `zonesProtegees` ne connaît pas, reprises de la table du tableau
   * animé (déjà utilisées en production). Gardées à part EXPRÈS : `zonesProtegees` est lu aujourd'hui par le calque de
   * l'Aperçu et le face caméra, qui ne doivent pas changer. Lues seulement par `reseaux/sorties.ts`.
   */
  zonesComplementaires?: Partial<Record<Ratio, ZoneProtegee>>;
  /** T1 : emplacements du réseau (Reels, stories, fil…), chacun avec son format et sa zone. */
  emplacements: EmplacementReseau[];
  /**
   * T1 : règle de fin. `auMot` vrai = la fin « Écrivez MOT en commentaire » est permise sur ce réseau. Faux pour TikTok
   * et YouTube Shorts (rien n'y est envoyé, décision du 12/10/2026), LinkedIn (aucun appel à commenter, 12/10/2026) et
   * YouTube (fin de la base 7 prête mais éteinte).
   */
  fin: { auMot: boolean };
}

const RES_VERTICALE = { "9:16": "1080x1920", "1:1": "1080x1080", "4:5": "1080x1350", "16:9": "1920x1080" } as const;

/* T1 : zones et sources des emplacements, les mêmes que la table du tableau animé (`montage-tableau/formats-sortie.ts`). */
const REGISTRE = "registre des réseaux";
const PRUDENTE = "valeur prudente (table du tableau animé)";
const ZONE_REELS_META: ZoneProtegee = { haut: 14, droite: 16, bas: 30, gauche: 6 };
const ZONE_STORIES_META: ZoneProtegee = { haut: 14, droite: 6, bas: 20, gauche: 6 };
const ZONE_FIL_FACEBOOK: ZoneProtegee = { haut: 5, droite: 5, bas: 12, gauche: 5 };
const SOURCE_STORIES = `${PRUDENTE} : guide Meta des stories (≈ 14 % libres en haut et en bas), bas élargi pour la barre de réponse`;
const SOURCE_FIL_FACEBOOK = `${PRUDENTE} : barre de lecture et bouton du son en bas`;

export const RESEAUX: DefinitionReseau[] = [
  {
    id: "linkedin",
    nom: "LinkedIn",
    monogramme: "in",
    codeClassement: CODES_RESEAU.linkedin,
    ratios: ["1:1", "4:5", "16:9", "9:16"],
    ratioPrefere: "9:16",
    dureeMaxSec: 600,
    export: { resolution: RES_VERTICALE, fps: 30, debitMbps: 8, codec: "h264" },
    niveauSonoreLufs: -14,
    // 4:5 et 1:1 : la barre de lecture et le compteur couvrent ≈ 10 % en bas (moteur avocat B.7, v3.2).
    zonesProtegees: { "9:16": { haut: 8, droite: 4, bas: 14, gauche: 4 }, "4:5": { haut: 4, droite: 4, bas: 10, gauche: 4 }, "1:1": { haut: 4, droite: 4, bas: 10, gauche: 4 } },
    legende: { longueurMax: 3000, longueurVisible: 210, motsDieseMax: 5, motsDieseConseilles: 3 },
    miniature: { ratio: "16:9", modifiable: true },
    etiquetteIA: "LinkedIn : rien à cocher ; une mention dans le texte du post.",
    viaBuffer: true,
    serviceBuffer: "linkedin",
    // T1 : 16:9 comme YouTube (table du tableau, valeur déjà utilisée). Aucune valeur LinkedIn changée (question 1 du plan).
    zonesComplementaires: { "16:9": { haut: 6, droite: 4, bas: 12, gauche: 4 } },
    emplacements: [
      { id: "fil", libelle: "LinkedIn", ratio: "4:5", zone: { haut: 4, droite: 4, bas: 10, gauche: 4 }, source: REGISTRE },
      { id: "fil", libelle: "LinkedIn", ratio: "1:1", zone: { haut: 4, droite: 4, bas: 10, gauche: 4 }, source: `${REGISTRE} : barre de lecture et compteur ≈ 10 % en bas` },
    ],
    fin: { auMot: false },
  },
  {
    id: "instagram",
    nom: "Instagram",
    monogramme: "IG",
    codeClassement: CODES_RESEAU.instagram,
    ratios: ["9:16", "4:5", "1:1"],
    ratioPrefere: "9:16",
    dureeMaxSec: 180,
    export: { resolution: RES_VERTICALE, fps: 30, debitMbps: 10, codec: "h264" },
    niveauSonoreLufs: -14,
    // Guide Meta des Reels (v3.2) : 14 % en haut, 30 % en bas en organique (35 % si sponsorisé), 6 % sur les côtés.
    zonesProtegees: {
      "9:16": { haut: 14, droite: 16, bas: 30, gauche: 6 },
      "4:5": { haut: 4, droite: 4, bas: 8, gauche: 4 },
    },
    legende: { longueurMax: 2200, longueurVisible: 125, motsDieseMax: 30, motsDieseConseilles: 5 },
    // Générateur (G1a) : couverture d'un Reel en 3:4 (grille du profil), corrigée sur accord de Will.
    miniature: { ratio: "3:4", modifiable: true },
    etiquetteIA: "Activer « Étiquette IA » dans les paramètres avancés.",
    viaBuffer: true,
    serviceBuffer: "instagram",
    emplacements: [
      { id: "reels", libelle: "Reels Instagram", ratio: "9:16", zone: ZONE_REELS_META, source: `${REGISTRE} : guide Meta des Reels` },
      { id: "stories", libelle: "Stories Instagram et Facebook", ratio: "9:16", zone: ZONE_STORIES_META, source: SOURCE_STORIES },
      { id: "fil", libelle: "Fil Instagram", ratio: "4:5", zone: { haut: 4, droite: 4, bas: 8, gauche: 4 }, source: REGISTRE },
    ],
    fin: { auMot: true },
  },
  {
    id: "facebook",
    nom: "Facebook",
    monogramme: "f",
    codeClassement: CODES_RESEAU.facebook,
    ratios: ["9:16", "4:5", "1:1", "16:9"],
    ratioPrefere: "9:16",
    dureeMaxSec: 90,
    export: { resolution: RES_VERTICALE, fps: 30, debitMbps: 10, codec: "h264" },
    niveauSonoreLufs: -14,
    zonesProtegees: { "9:16": { haut: 14, droite: 16, bas: 30, gauche: 6 } },
    legende: { longueurMax: 2200, longueurVisible: 125, motsDieseMax: 10, motsDieseConseilles: 3 },
    miniature: { ratio: "9:16", modifiable: true },
    etiquetteIA: "Activer « Étiquette IA » avant de publier.",
    viaBuffer: true,
    serviceBuffer: "facebook",
    // T1 : 4:5 et carré, « valeur prudente » de la table du tableau (déjà utilisée en production).
    zonesComplementaires: { "4:5": ZONE_FIL_FACEBOOK, "1:1": ZONE_FIL_FACEBOOK },
    emplacements: [
      { id: "reels", libelle: "Reels Facebook", ratio: "9:16", zone: ZONE_REELS_META, source: `${REGISTRE} : guide Meta des Reels` },
      { id: "stories", libelle: "Stories Instagram et Facebook", ratio: "9:16", zone: ZONE_STORIES_META, source: SOURCE_STORIES },
      { id: "fil", libelle: "Fil Facebook", ratio: "4:5", zone: ZONE_FIL_FACEBOOK, source: SOURCE_FIL_FACEBOOK },
      { id: "fil", libelle: "Fil Facebook", ratio: "1:1", zone: ZONE_FIL_FACEBOOK, source: SOURCE_FIL_FACEBOOK },
    ],
    fin: { auMot: true },
  },
  {
    id: "tiktok",
    nom: "TikTok",
    monogramme: "TT",
    codeClassement: CODES_RESEAU.tiktok,
    ratios: ["9:16"],
    ratioPrefere: "9:16",
    dureeMaxSec: 600,
    export: { resolution: RES_VERTICALE, fps: 30, debitMbps: 10, codec: "h264" },
    niveauSonoreLufs: -14,
    zonesProtegees: { "9:16": { haut: 10, droite: 18, bas: 26, gauche: 4 } },
    legende: { longueurMax: 2200, longueurVisible: 100, motsDieseMax: 8, motsDieseConseilles: 4 },
    miniature: { ratio: "9:16", modifiable: true },
    etiquetteIA: "Cocher « Contenu généré par l'IA » dans les réglages de la publication.",
    viaBuffer: true,
    serviceBuffer: "tiktok",
    emplacements: [{ id: "video", libelle: "TikTok", ratio: "9:16", zone: { haut: 10, droite: 18, bas: 26, gauche: 4 }, source: `${REGISTRE} : boutons à droite, légende en bas` }],
    fin: { auMot: false },
  },
  {
    id: "youtube",
    nom: "YouTube",
    monogramme: "YT",
    codeClassement: CODES_RESEAU.youtube,
    ratios: ["16:9"],
    ratioPrefere: "16:9",
    dureeMaxSec: 43200,
    export: { resolution: RES_VERTICALE, fps: 30, debitMbps: 12, codec: "h264" },
    niveauSonoreLufs: -14,
    zonesProtegees: { "16:9": { haut: 6, droite: 4, bas: 12, gauche: 4 } },
    legende: { longueurMax: 5000, longueurVisible: 160, motsDieseMax: 15, motsDieseConseilles: 3 },
    miniature: { ratio: "16:9", modifiable: true },
    etiquetteIA: "Répondre « Oui » à « Contenu modifié ou synthétique ».",
    viaBuffer: true,
    serviceBuffer: "youtube",
    emplacements: [{ id: "video", libelle: "YouTube", ratio: "16:9", zone: { haut: 6, droite: 4, bas: 12, gauche: 4 }, source: `${REGISTRE} : titre en haut, barre de lecture en bas` }],
    fin: { auMot: false },
  },
  {
    id: "youtube-shorts",
    nom: "YouTube Shorts",
    // Générateur (G1a) : monogramme lu depuis le code de classement (« YS », plus « S » seul).
    monogramme: CODES_RESEAU["youtube-shorts"],
    codeClassement: CODES_RESEAU["youtube-shorts"],
    ratios: ["9:16"],
    ratioPrefere: "9:16",
    dureeMaxSec: 180,
    export: { resolution: RES_VERTICALE, fps: 30, debitMbps: 10, codec: "h264" },
    niveauSonoreLufs: -14,
    zonesProtegees: { "9:16": { haut: 10, droite: 16, bas: 20, gauche: 4 } },
    legende: { longueurMax: 100, longueurVisible: 60, motsDieseMax: 3, motsDieseConseilles: 2 },
    miniature: { ratio: "9:16", modifiable: false },
    etiquetteIA: "Répondre « Oui » à « Contenu modifié ou synthétique ».",
    viaBuffer: true,
    serviceBuffer: "youtube",
    emplacements: [{ id: "video", libelle: "YouTube Shorts", ratio: "9:16", zone: { haut: 10, droite: 16, bas: 20, gauche: 4 }, source: REGISTRE }],
    fin: { auMot: false },
  },
];

export function listerReseaux(): DefinitionReseau[] {
  return RESEAUX;
}

export function obtenirReseau(id: IdReseau): DefinitionReseau {
  const r = RESEAUX.find((x) => x.id === id);
  if (!r) throw new Error(`Réseau inconnu : ${id}`);
  return r;
}

export interface AvertissementReseau {
  code: "trop-longue" | "ratio-absent" | "legende-trop-longue" | "trop-de-mots-diese";
  message: string;
}

/**
 * Contrôles du kit de publication (« Trop longue pour Shorts », compteur de caractères).
 * Formats par réseau T4 : `sortieEnvoyee` est le fichier FAIT que le kit enverra à ce réseau (`meilleureSortie`), ou
 * `null` s'il n'y en a aucun ; l'avertissement « Aucun format d'image adapté » le lit, et non plus `ratios` (les formats
 * prévus de la vidéo, faux quand un moteur a fait plus). Absent : la règle d'avant, sur `ratios`.
 */
export function verifierPourReseau(
  reseau: DefinitionReseau,
  donnees: { dureeSec: number; ratios: Ratio[]; texte?: string; motsDiese?: string[]; sortieEnvoyee?: { ratio: Ratio } | null },
): AvertissementReseau[] {
  const a: AvertissementReseau[] = [];
  if (donnees.dureeSec > reseau.dureeMaxSec) {
    a.push({ code: "trop-longue", message: `Trop longue pour ${reseau.nom}` });
  }
  const sansFichier = donnees.sortieEnvoyee === undefined ? !donnees.ratios.some((r) => reseau.ratios.includes(r)) : donnees.sortieEnvoyee === null;
  if (sansFichier) {
    a.push({ code: "ratio-absent", message: `Aucun format d'image adapté à ${reseau.nom}` });
  }
  if (donnees.texte && donnees.texte.length > reseau.legende.longueurMax) {
    a.push({ code: "legende-trop-longue", message: `Texte trop long (${donnees.texte.length}/${reseau.legende.longueurMax})` });
  }
  if (donnees.motsDiese && donnees.motsDiese.length > reseau.legende.motsDieseMax) {
    a.push({ code: "trop-de-mots-diese", message: `${donnees.motsDiese.length} mots-dièse, ${reseau.legende.motsDieseMax} au plus` });
  }
  return a;
}

/** Union des zones protégées de plusieurs réseaux pour un ratio (calque de l'Aperçu). */
export function zoneProtegeeCombinee(ratio: Ratio, ids: IdReseau[]): ZoneProtegee | null {
  const zones = ids.map((id) => obtenirReseau(id).zonesProtegees[ratio]).filter(Boolean) as ZoneProtegee[];
  if (!zones.length) return null;
  return zones.reduce((acc, z) => ({
    haut: Math.max(acc.haut, z.haut),
    droite: Math.max(acc.droite, z.droite),
    bas: Math.max(acc.bas, z.bas),
    gauche: Math.max(acc.gauche, z.gauche),
  }));
}
