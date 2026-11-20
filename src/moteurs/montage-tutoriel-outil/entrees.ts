/**
 * ENTRÉES DU TUTORIEL D'OUTIL (lot I) : ce que la création range dans `commande.entrees.tutorielOutil`.
 *  - script collé (`scriptColle: true`, texte dans `commande.script.texteComplet`) : utilisé TEL QUEL, fabriqué directement ;
 *  - titre ou idée (`idee`) : le studio écrit un script, puis s'arrête pour que Williams le relise, le modifie et le valide
 *    (`scriptValide`), comme Image → vidéo (lot F). Cette pause n'est ni un échec ni un prix.
 * Lecture tolérante : un champ mal formé est ignoré, jamais une erreur.
 */
import { lireModeVoix, MODE_SANS_VOIX } from "../../formats/tutoriel-outil/mode-sans-voix";
import { lireNavigationFilmee, type NavigationFilmee } from "../../briques/plan-scenes/tutoriel/navigation-filmee";
import type { IdGabarit } from "./sortie-usine";

export const ENTREE_TUTORIEL = "tutorielOutil";

/** Ce que Williams a donné (T-EXT-33) : un dossier déjà envoyé (référence du fichier et attestation), ou une phrase. */
export type DepotTutoriel = { mode: "dossier"; fichierId: string; attestationImages: boolean } | { mode: "phrase"; phrase: string };

/** Limites de la phrase (celles du formulaire) ; recopiées de `chef-de-projet.ts` par un test d'égalité. */
export const PHRASE_DEPOT_MIN = 10;
export const PHRASE_DEPOT_MAX = 300;

const GABARITS_CONNUS: readonly IdGabarit[] = ["G-Journee", "G-Decision", "G-Reponse", "G-Flux"];

export interface EntreesTutoriel {
  /** Titre ou idée de Williams (script à écrire). */
  idee?: string;
  /** Le texte de `commande.script.texteComplet` est le script de Williams, utilisé tel quel. */
  scriptColle?: boolean;
  /** Script relu et validé par Williams (après écriture depuis l'idée) : il fait foi. */
  scriptValide?: string;
  /** Film de la navigation dans la maquette (T-EXT-38) : absent ou illisible = pas de film, rien ne change. */
  navigationFilmee?: NavigationFilmee;
  /** T-EXT-33 : dossier ou phrase déposé. Absent ou mal formé : ignoré. */
  depot?: DepotTutoriel;
  /** T-EXT-33 : parcours choisi. Absent ou inconnu : choisi par le chef de projet. */
  gabarit?: IdGabarit;
  /** T-EXT-26a : fin choisie dans le formulaire (« prendre-rendez-vous », valeur déjà lue par l'équipe, est lue comme « rendez-vous »). Toute autre valeur est ignorée : jamais une phrase inventée. */
  fin?: "aucune" | "rendez-vous";
  /** T-EXT-SV : `true` = mode « sans voix » choisi par l'utilisateur (silence total, 0 appel HeyGen, 0 €). Absent = avec voix (défaut). */
  sansVoix?: true;
}

const gabaritConnu = (v: unknown): IdGabarit | undefined => GABARITS_CONNUS.find((g) => g === v);

function lireDepot(v: unknown): DepotTutoriel | undefined {
  if (!v || typeof v !== "object") return undefined;
  const d = v as Record<string, unknown>;
  if (d.mode === "dossier") {
    const fichierId = texte(d.fichierId);
    return fichierId ? { mode: "dossier", fichierId, attestationImages: d.attestationImages === true } : undefined;
  }
  if (d.mode === "phrase") {
    const phrase = texte(d.phrase);
    return phrase && phrase.length >= PHRASE_DEPOT_MIN && phrase.length <= PHRASE_DEPOT_MAX ? { mode: "phrase", phrase } : undefined;
  }
  return undefined;
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
  const depot = lireDepot(o.depot);
  const gabarit = gabaritConnu(o.gabarit);
  return { ...(depot ? { depot } : {}), ...(gabarit ? { gabarit } : {}), ...(idee ? { idee } : {}), ...(lireModeVoix(o) === MODE_SANS_VOIX ? { sansVoix: true as const } : {}), ...(o.scriptColle === true ? { scriptColle: true } : {}), ...(scriptValide ? { scriptValide } : {}), ...(film?.ok ? { navigationFilmee: film.navigation } : {}), ...(o.fin === "aucune" ? { fin: "aucune" as const } : o.fin === "rendez-vous" || o.fin === "prendre-rendez-vous" ? { fin: "rendez-vous" as const } : {}) };
}
