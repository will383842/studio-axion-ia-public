/**
 * CAL-18 · « Proposer la semaine » : le Studio APPELLE l'usine par la porte et AFFICHE ce qu'elle propose.
 * Le stratège (quoi, pour qui, quel équilibre) vit dans l'usine : ici aucun appel de modèle, aucun choix de sujet.
 * Les réponses arrivent toujours « propose » : rien n'est programmé ni validé d'ici, la validation se fait dans l'écran « À valider ».
 * Plafond d'appels par jour compté ICI, côté serveur (jour de Paris) ; au-delà, une phrase sans montant ; l'ajout à la main reste possible.
 * Rien n'est allumé : sans USINE_URL et clé, aucun appel ne part et l'essai n'est pas compté. SERVEUR UNIQUEMENT.
 */
import "server-only";
import type { EntreeCarte } from "@/components/calendrier/CarteEntreeCalendrier";
import type { IdReseau } from "@/domaine/types";
import type { IdeeUsine } from "@/domaine/usine";
import { cleJour } from "@/lib/dates";
import { RESEAUX } from "@/reseaux";
import { creerVerrou, ecrireParametre, ErreurStudio, lireParametre } from "@/services/_commun";
import { proposerSemaineUsineAvecMessage, usineActive, type Options } from "@/services/usine-porte";

/** Appels permis par jour (jour de Paris) : un compte en quantité, jamais en argent. */
export const PLAFOND_APPELS_SEMAINE_PAR_JOUR = 5;
export const PARAM_COMPTEUR_SEMAINE = "calendrier.proposerSemaine.compteur";
export const PHRASE_PLAFOND_SEMAINE = "Vous avez déjà demandé plusieurs semaines aujourd'hui. Revenez demain pour en demander une autre. En attendant, vous pouvez ajouter vos contenus à la main : rien n'est bloqué.";

/**
 * Adresse de l'écran « À valider » de l'usine : donnée par USINE_A_VALIDER_URL (https), à confirmer contre U-PLANIF.
 * Absente ou invalide : null, et le bouton n'est pas monté (jamais de lien qui ramène à la page elle-même).
 */
export function adresseAValiderUsine(env: { USINE_A_VALIDER_URL?: string | undefined } = process.env as { USINE_A_VALIDER_URL?: string }): string | null {
  const brut = env.USINE_A_VALIDER_URL?.trim();
  if (!brut) return null;
  try {
    const u = new URL(brut);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export interface PropositionSemaine extends EntreeCarte {
  etat: "propose";
  pourquoi?: string;
  ressembleA?: string;
  /** Le sujet que l'Usine propose ; absent : la carte n'a pas de bouton « Retenir ce sujet ». */
  sujet?: IdeeUsine;
}
export interface SemaineProposee {
  propositions: PropositionSemaine[];
  appelsRestants: number;
  /** Phrase de l'Usine quand la réponse est partielle (ex. un réseau sans compte actif), telle quelle. */
  message?: string;
}
/** Réglage où le serveur garde la DERNIÈRE semaine proposée : seule source de « Retenir ce sujet » (le navigateur n'envoie que `debut` et `cle`). */
export const PARAM_DERNIERE_SEMAINE = "calendrier.proposerSemaine.derniere";
export type TypeCarteSemaine = "video" | "carrousel" | "infographie" | "image";
export interface DerniereSemaine {
  debut: string;
  /** `type` : absent d'une semaine gardée avant le plan usine #63, lu comme « video ». */
  propositions: { cle: string; jour: string; reseau: string; type: TypeCarteSemaine; /** Titre de la carte : texte du carrousel retenu (sinon le sujet, sinon la douleur). */ titre?: string; sujet: IdeeUsine }[];
}
export interface OptionsSemaine extends Pick<Options, "env" | "fetchImpl" | "delaiMs"> {
  /** Instant pris pour « aujourd'hui » (tests). */
  maintenant?: Date;
}

const TYPES = new Set(["video", "carrousel", "infographie", "image"]);
const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;
const JOUR = /^\d{4}-\d{2}-\d{2}$/;
const JOUR_MS = 86_400_000;

function lundiValide(debut: string): number | null {
  if (!JOUR.test(debut)) return null;
  const t = Date.parse(`${debut}T12:00:00Z`);
  if (Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== debut) return null;
  return new Date(t).getUTCDay() === 1 ? t : null;
}

/** Un seul compteur à la fois : lecture, contrôle et écriture ne se croisent jamais (rafale de clics ou de sessions). */
const unALaFois = creerVerrou();

/** Réserve un appel du jour : refuse au-delà du plafond, sinon écrit le compteur AVANT l'appel. Renvoie les appels restants. */
function reserverAppel(maintenant: Date): Promise<number> {
  return unALaFois(async () => {
    const jour = cleJour(maintenant);
    const brut = await lireParametre<{ jour?: unknown; n?: unknown } | null>(PARAM_COMPTEUR_SEMAINE, null);
    const deja = brut && brut.jour === jour && typeof brut.n === "number" && Number.isFinite(brut.n) && brut.n > 0 ? Math.floor(brut.n) : 0;
    if (deja >= PLAFOND_APPELS_SEMAINE_PAR_JOUR) throw new ErreurStudio("SEMAINE_PLAFOND", PHRASE_PLAFOND_SEMAINE);
    await ecrireParametre(PARAM_COMPTEUR_SEMAINE, { jour, n: deja + 1 });
    return PLAFOND_APPELS_SEMAINE_PAR_JOUR - (deja + 1);
  });
}

/**
 * Demande la semaine qui commence ce lundi. Ne garde que les lignes lisibles et comprises dans la semaine demandée ;
 * chaque ligne est mise à l'état « propose », quoi que dise l'usine.
 */
export async function proposerSemaine(demande: { debut: string; reseaux?: readonly IdReseau[] }, o: OptionsSemaine = {}): Promise<SemaineProposee> {
  const lundi = lundiValide(demande.debut);
  if (lundi === null) throw new ErreurStudio("SEMAINE_DATE", "Choisissez une semaine qui commence un lundi.");
  const env = o.env ?? (process.env as Parameters<typeof usineActive>[0]);
  if (!usineActive(env)) throw new ErreurStudio("USINE_ETEINTE", "L'usine n'est pas reliée : la semaine ne peut pas être proposée pour le moment. Vous pouvez ajouter vos contenus à la main.");
  const appelsRestants = await reserverAppel(o.maintenant ?? new Date());
  const { lignes, message } = await proposerSemaineUsineAvecMessage({ debut: demande.debut, ...(demande.reseaux?.length ? { reseaux: demande.reseaux } : {}) }, { env, ...(o.fetchImpl ? { fetchImpl: o.fetchImpl } : {}), ...(o.delaiMs ? { delaiMs: o.delaiMs } : {}) });
  const fin = lundi + 7 * JOUR_MS;
  const reseaux = new Set<string>(RESEAUX.map((r) => r.id));
  const propositions: PropositionSemaine[] = [];
  const vues = new Set<string>();
  for (const l of lignes) {
    const t = JOUR.test(l.jour) ? Date.parse(`${l.jour}T12:00:00Z`) : Number.NaN;
    // Un jour impossible (29 février d'une année non bissextile) déborde sur le mois suivant : écarté.
    if (Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== l.jour) continue;
    if (!(t >= lundi && t < fin) || !reseaux.has(l.reseau) || !TYPES.has(l.type) || vues.has(l.cle)) continue;
    vues.add(l.cle);
    propositions.push({
      cle: l.cle,
      jour: l.jour,
      reseau: l.reseau as IdReseau,
      type: l.type as EntreeCarte["type"],
      etat: "propose",
      ...(l.heure && HEURE.test(l.heure) ? { heure: l.heure } : {}),
      ...(l.titre ? { titre: l.titre } : {}),
      ...(l.pourquoi ? { pourquoi: l.pourquoi } : {}),
      ...(l.ressembleA ? { ressembleA: l.ressembleA } : {}),
      ...(l.sujet ? { sujet: l.sujet } : {}),
    });
  }
  await garderDerniereSemaine({ debut: demande.debut, propositions: propositions.flatMap((p) => (p.sujet ? [{ cle: p.cle, jour: p.jour, reseau: p.reseau, type: p.type as TypeCarteSemaine, ...(p.titre ? { titre: p.titre } : {}), sujet: p.sujet }] : [])) });
  return { propositions, appelsRestants, ...(message ? { message } : {}) };
}

/** Garde la semaine côté serveur (remplace la précédente). Un échec d'écriture ne coupe pas l'affichage : le bouton « Retenir » refusera alors, avec sa phrase. */
async function garderDerniereSemaine(d: DerniereSemaine): Promise<void> {
  try {
    await unALaFois(() => ecrireParametre(PARAM_DERNIERE_SEMAINE, d));
  } catch (e) {
    console.error(e);
  }
}

/** Relit la dernière semaine gardée ; une valeur absente ou abîmée vaut « rien de gardé » (null). */
export async function lireDerniereSemaine(): Promise<DerniereSemaine | null> {
  const brut = await lireParametre<unknown>(PARAM_DERNIERE_SEMAINE, null);
  if (!brut || typeof brut !== "object") return null;
  const { debut, propositions } = brut as { debut?: unknown; propositions?: unknown };
  if (typeof debut !== "string" || !Array.isArray(propositions)) return null;
  const bonnes = propositions
    .filter((p) => !!p && typeof p === "object" && typeof p.cle === "string" && typeof p.jour === "string" && typeof p.reseau === "string" && !!p.sujet && typeof p.sujet === "object" && typeof p.sujet.signature === "string")
    .map((p): DerniereSemaine["propositions"][number] => {
      const { titre, ...reste } = p;
      return { ...reste, type: typeof p.type === "string" && TYPES.has(p.type) ? (p.type as TypeCarteSemaine) : "video", ...(typeof titre === "string" && titre.trim() ? { titre } : {}) };
    });
  return { debut, propositions: bonnes };
}
