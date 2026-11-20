/**
 * ENTRÉES DU TUTORIEL D'OUTIL (lot I) : ce que la création range dans `commande.entrees.tutorielOutil`.
 *  - script collé (`scriptColle: true`, texte dans `commande.script.texteComplet`) : utilisé TEL QUEL, fabriqué directement ;
 *  - titre ou idée (`idee`) : le studio écrit un script, puis s'arrête pour que Williams le relise, le modifie et le valide
 *    (`scriptValide`), comme Image → vidéo (lot F). Cette pause n'est ni un échec ni un prix.
 * Lecture tolérante : un champ mal formé est ignoré, jamais une erreur.
 */
import { lireModeVoix, MODE_SANS_VOIX } from "../../formats/tutoriel-outil/mode-sans-voix";
import { lireNavigationFilmee, type NavigationFilmee } from "../../briques/plan-scenes/tutoriel/navigation-filmee";

export const ENTREE_TUTORIEL = "tutorielOutil";

export interface EntreesTutoriel {
  /** Titre ou idée de Williams (script à écrire). */
  idee?: string;
  /** Le texte de `commande.script.texteComplet` est le script de Williams, utilisé tel quel. */
  scriptColle?: boolean;
  /** Script relu et validé par Williams (après écriture depuis l'idée) : il fait foi. */
  scriptValide?: string;
  /** Film de la navigation dans la maquette (T-EXT-38) : absent ou illisible = pas de film, rien ne change. */
  navigationFilmee?: NavigationFilmee;
  /** T-EXT-SV : `true` = mode « sans voix » choisi par l'utilisateur (silence total, 0 appel HeyGen, 0 €). Absent = avec voix (défaut). */
  sansVoix?: true;
}

/** Le mode sans voix est-il choisi pour cette commande ? */
export const estSansVoix = (entrees: Record<string, unknown> | undefined): boolean => lireModeVoix(entrees?.[ENTREE_TUTORIEL]) === MODE_SANS_VOIX;

const texte = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);

export function lireEntreesTutoriel(entrees: Record<string, unknown> | undefined): EntreesTutoriel {
  const e = entrees?.[ENTREE_TUTORIEL];
  if (!e || typeof e !== "object") return {};
  const o = e as Record<string, unknown>;
  const idee = texte(o.idee);
  const scriptValide = texte(o.scriptValide);
  const film = o.navigationFilmee === undefined ? null : lireNavigationFilmee(o.navigationFilmee);
  return { ...(idee ? { idee } : {}), ...(lireModeVoix(o) === MODE_SANS_VOIX ? { sansVoix: true as const } : {}), ...(o.scriptColle === true ? { scriptColle: true } : {}), ...(scriptValide ? { scriptValide } : {}), ...(film?.ok ? { navigationFilmee: film.navigation } : {}) };
}
