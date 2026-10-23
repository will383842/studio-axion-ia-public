/**
 * FACE CAMÉRA ANIMÉE · PLUSIEURS PRISES D'UN COUP (essai réel du 17/10, demande de Will) — logique PURE de l'écran de dépôt :
 * tri des fichiers déposés (vidéo ou non, casse de l'extension ignorée), file d'envoi (une prise à la fois, chacune par morceaux),
 * état de chaque prise, libellé du bouton « Animer mes N vidéos », phrase de l'orientation (« Votre vidéo horizontale sera mise en
 * vertical »). Le composant `DepotPrise.tsx` ne fait qu'afficher cet état.
 */

/** Durée minimale d'une prise (même seuil que le service). */
export const DUREE_MIN_PRISE_SEC = 5;
/** Prises au plus par envoi groupé (même valeur que `PRISES_MAX_LOT_FA` du service). */
export const PRISES_MAX = 20;

/** Types acceptés par le sélecteur : extensions dans les deux casses (certains navigateurs les comparent à la lettre). */
export const ACCEPTE_PRISES = "video/*,.mp4,.MP4,.mov,.MOV,.m4v,.M4V";

/** Une vidéo MP4 / MOV ? Type du navigateur, sinon l'extension, casse ignorée (.MOV, .mov, .MP4). PUR. */
export function estVideoAcceptee(f: { name: string; type: string }): boolean {
  return /^video\//i.test(f.type) || /\.(mp4|mov|m4v)$/i.test(f.name);
}

import type { RefusSujetFA } from "@/services/facecam-animee";

export type EtapePrise = "a-envoyer" | "envoi" | "prete" | "arretee";

export interface Prise {
  id: string;
  nom: string;
  taille: number;
  /** Adresse locale de l'aperçu (vidéo entière). */
  url: string;
  dureeSec: number;
  largeur: number;
  hauteur: number;
  etape: EtapePrise;
  /** Pourcentage envoyé. */
  envoi: number;
  /** Attente en cours (studio qui redémarre, réseau coupé) : l'envoi reprend tout seul. */
  attente?: string;
  /** Arrêt de l'envoi ou refus de la prise : la phrase exacte. */
  erreur?: string;
  /** « Reprendre l'envoi » a un sens (sinon : retirer la prise). */
  reprenable?: boolean;
  fichierId?: string;
  /** Texte dit (facultatif), propre à cette prise. */
  texte: string;
  texteOuvert: boolean;
  /** Phrase sous le champ (texte d'un script repris, raccourci). */
  avisTexte?: string;
  /** Prise déjà traitée : le refus du serveur (précédents, jeton) ; l'écran propose « Choisir une autre prise » / « Refaire quand même ». */
  refusSujet?: RefusSujetFA;
}

/** Sépare les fichiers déposés : vidéos gardées (dans l'ordre), autres refusées par leur nom. PUR. */
export function trierDepot<F extends { name: string; type: string }>(fichiers: F[], deja: number): { gardes: F[]; refus: string | null } {
  const videos = fichiers.filter(estVideoAcceptee);
  const autres = fichiers.filter((f) => !estVideoAcceptee(f));
  const place = Math.max(0, PRISES_MAX - deja);
  const gardes = videos.slice(0, place);
  const phrases: string[] = [];
  if (autres.length) phrases.push(autres.length === 1 ? `« ${autres[0].name} » n'est pas une vidéo (MP4 ou MOV).` : `${autres.length} fichiers ne sont pas des vidéos (MP4 ou MOV).`);
  if (videos.length > place) phrases.push(`Au plus ${PRISES_MAX} vidéos à la fois : ${videos.length - place} n'ont pas été ajoutées.`);
  return { gardes, refus: phrases.length ? phrases.join(" ") : null };
}

/** Prochaine prise à envoyer : aucune si un envoi tourne déjà (une prise à la fois). PUR. */
export function prochaineAEnvoyer(prises: readonly Prise[]): Prise | undefined {
  if (prises.some((p) => p.etape === "envoi")) return undefined;
  return prises.find((p) => p.etape === "a-envoyer");
}

/** Prise trop courte (durée lue par le navigateur ; 0 = inconnue, le service tranchera). PUR. */
export function tropCourte(p: Pick<Prise, "dureeSec">): boolean {
  return p.dureeSec > 0 && p.dureeSec < DUREE_MIN_PRISE_SEC;
}

/** Toutes les prises sont envoyées et valables : le bouton peut partir. PUR. */
export function pretesALancer(prises: readonly Prise[]): boolean {
  return prises.length > 0 && prises.every((p) => p.etape === "prete" && !!p.fichierId && !tropCourte(p));
}

/** « Animer ma vidéo » / « Animer mes 3 vidéos ». PUR. */
export function libelleAnimer(n: number): string {
  return n <= 1 ? "Animer ma vidéo" : `Animer mes ${n} vidéos`;
}

/** Ce que la chaîne fera de l'orientation de la prise (affiché sous l'aperçu). PUR. */
export function phraseOrientation(p: Pick<Prise, "largeur" | "hauteur">): string | null {
  if (!p.largeur || !p.hauteur) return null;
  if (p.largeur > p.hauteur) return "Votre vidéo horizontale sera mise en vertical (1080 × 1920), cadrée sur votre visage, sans zoom.";
  return null;
}

/** Ligne d'état d'une prise sous son aperçu. PUR. */
export function etatPrise(p: Prise): string {
  const duree = p.dureeSec > 0 ? `${Math.round(p.dureeSec)} s` : "durée inconnue";
  switch (p.etape) {
    case "a-envoyer":
      return `${duree} · en attente d'envoi`;
    case "envoi":
      return `${duree} · envoi ${p.envoi} %`;
    case "prete":
      return `${duree} · envoyée`;
    case "arretee":
      return `${duree} · envoi arrêté à ${p.envoi} %`;
  }
}

/** Ce que la page dit à Will avant le bouton. PUR. */
export function consigneDepart(prises: readonly Prise[]): string | null {
  if (!prises.length) return null;
  if (prises.some((p) => p.etape === "envoi" || p.etape === "a-envoyer")) return "Gardez cette page ouverte pendant l'envoi. Une fois lancées, vous pouvez la quitter : les vidéos se fabriquent seules et apparaissent dans « Mes vidéos ».";
  return "Vous pourrez quitter la page : les vidéos se fabriquent l'une après l'autre et apparaissent dans « Mes vidéos » avec leur avancement.";
}
