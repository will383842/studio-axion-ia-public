/**
 * VEILLE DES OUTILS (lot B2, `VEILLE-DES-OUTILS.md`) — contrat commun des sources.
 * Une source lit une page PUBLIQUE (registre npm, GitHub, page de nouveautés, catalogue fal.ai) et rend une lecture.
 * Une source qui ne répond pas rend `{ ok: false }` : la carte devient grise « impossible de vérifier »,
 * JAMAIS une fausse « à jour ».
 */

export interface LectureReussie {
  ok: true;
  /** Dernière version vue (semver, date de la dernière entrée d'un journal de nouveautés, modèle le plus récent…). */
  version?: string;
  /** Date de sortie de cette version (ISO). */
  date?: string;
  /** Lien public vers la nouveauté. */
  lien?: string;
  /** Texte brut (anglais le plus souvent) donné au résumé ; jamais montré tel quel. */
  notes: string;
  /** Empreinte du contenu lu (page sans version : un changement = une nouveauté). */
  empreinte?: string;
  /** Empreintes des fichiers surveillés (ex. `LICENSE.md` de Remotion). */
  fichiers?: Record<string, string>;
}

export interface LectureMuette {
  ok: false;
  /** Raison, en français simple (montrée sur la carte grise). */
  raison: string;
}

export type Lecture = LectureReussie | LectureMuette;

export interface ContexteLecture {
  appeler: typeof fetch;
  env: Record<string, string | undefined>;
  maintenant: Date;
  /** Délai maximal d'une requête. */
  delaiMs: number;
  /** Dernière lecture connue (pour ne lister que ce qui est nouveau). */
  precedente?: { derniereVersionLe?: string; verifieLe?: string };
}
