/**
 * S2-16-b : « refaire la voix » branchée pour le cas concret (voie A : 0 ligne dans `fabrication.ts`). Le bouton fait
 * passer la liste de prononciations À JOUR (base commune, `prononciationsActives`) dans les entrées de la retouche
 * (`prononciationsRetouche`, lue par `montage-cas-concret/index.ts` pour la retouche seulement) : le texte LU par la voix
 * change, le texte ÉCRIT et les sous-titres restent les mêmes. La réservation reste celle de `lancerRetouche` (aucune
 * porte d'argent neuve ici). Un plafond PAR VIDÉO (60 centimes d'euro par défaut, `voix.plafondRefaireCentimes`) refuse
 * AVANT `lancerRetouche`, par une phrase sans montant (`estimerRefaireVoix`).
 *
 * Réglage `voix.refaireAvecPrononciation` : ALLUMÉ par défaut (décision du pilote du 21/11 07:20), seul `false` écrit
 * l'éteint ; éteint ou lecture en échec : la retouche part exactement comme avant (aucune entrée ajoutée, aucun plafond).
 * Payant seulement au clic, et sans effet tant que `casConcret.retouches` est éteint (le moteur refuse la retouche).
 */
import "server-only";
import { estimerRefaireVoix } from "@/domaine/refaire-voix";
import { prononciationsActives, substituerPrononciations } from "@/domaine/prononciations";
import type { AccordPrix } from "@/domaine/accord";
import type { Id } from "@/domaine/types";
import { CENTIMES_USD_PAR_CARACTERE_HEYGEN } from "@/fournisseurs/heygen/voix";
import { TAUX_USD_EUR_PAR_DEFAUT } from "@/lib/montants";
import { depots, ErreurStudio, lireParametre } from "./_commun";
import { exigerSession } from "./auth";

export const PARAM_REFAIRE_AVEC_PRONONCIATION = "voix.refaireAvecPrononciation";
export const PARAM_PLAFOND_REFAIRE_CENTIMES = "voix.plafondRefaireCentimes";
/** Plafond par vidéo de la voix refaite, en centimes d'EURO (décision du pilote du 21/11 07:20 : 0,60 €). */
export const PLAFOND_REFAIRE_VOIX_CENTIMES_EUR = 60;
/** Entrée de la retouche lue par le moteur du cas concret (remplace `commande.prononciations` pour la retouche seulement). */
export const ENTREE_PRONONCIATIONS_RETOUCHE = "prononciationsRetouche";

export type IssueRefaireVoix = { ok: true; retoucheId: Id; travailId: Id } | { ok: false; phrase: string };

/** Réglage lu : seul `false` écrit éteint ; une lecture en échec rend `false` (comportement d'avant). */
async function allume(): Promise<boolean> {
  try {
    return (await lireParametre<unknown>(PARAM_REFAIRE_AVEC_PRONONCIATION, true)) !== false;
  } catch {
    return false;
  }
}

/**
 * Déjà engagé sur CETTE vidéo pour la voix des retouches, en centimes d'euro : pour chaque retouche de la vidéo
 * (`retouches.videoId`), les dépenses enregistrées de son travail (lignes au caractère = la voix, en euros comme toute dépense enregistrée) PLUS ses réservations
 * HeyGen encore actives (marge comprise ; centimes USD × taux). Une réservation diminue de ce qui est dépensé
 * (`credits.ts`) : rien n'est compté deux fois. Sens prudent (toute voix de retouche compte, pas seulement ce bouton).
 */
export async function dejaEngageRefaireVoixCentimes(videoId: Id, taux: number): Promise<number> {
  const d = depots();
  const travaux = new Set((await d.retouches.lister((r) => r.videoId === videoId)).flatMap((r) => (r.travailId ? [r.travailId] : [])));
  if (!travaux.size) return 0;
  const depense = (await d.depenses.lister((x) => !!x.travailId && travaux.has(x.travailId))).flatMap((x) => x.lignes ?? []).filter((l) => l.unite === "caractere").reduce((s, l) => s + l.total.centimes, 0);
  const reserve = (await d.reservations.lister((r) => r.statut === "active" && !!r.travailId && travaux.has(r.travailId) && r.fournisseur === "heygen")).reduce((s, r) => s + (r.devise === "EUR" ? r.centimes : r.centimes * taux), 0);
  return depense + reserve;
}

/** « Refaire la voix » : contrôle du plafond par vidéo, puis la retouche avec la prononciation à jour. */
export async function refaireVoixAvecPrononciation(videoId: Id, planIds: Id[], consigne: string, options: { confirme?: AccordPrix; phrasesVisees: readonly string[] }): Promise<IssueRefaireVoix> {
  await exigerSession();
  const { lancerRetouche } = await import("./fabrication");
  const confirme = options.confirme ? { confirme: options.confirme } : {};
  if (!(await allume())) return { ok: true, ...(await lancerRetouche(videoId, planIds, consigne, confirme)) };
  const d = depots();
  const video = await d.videos.obtenir(videoId);
  const courante = video?.versionChoisieId ? await d.versions.obtenir(video.versionChoisieId) : null;
  if (!video || !courante) throw new ErreurStudio("INTROUVABLE", "Aucune version à retoucher.");
  const commande = courante.commande;
  const voix = commande.distribution[0];
  const liste = prononciationsActives(await d.prononciations.lister(), { voixId: voix?.voixId, personnageId: voix?.personnageId });
  const taux = await lireParametre<number>("taux.usdEur", TAUX_USD_EUR_PAR_DEFAUT);
  const plafond = await lireParametre<unknown>(PARAM_PLAFOND_REFAIRE_CENTIMES, PLAFOND_REFAIRE_VOIX_CENTIMES_EUR);
  const estimation = estimerRefaireVoix({
    format: commande.formatId,
    texteLu: substituerPrononciations(commande.script.texteComplet ?? "", liste),
    phrasesVisees: options.phrasesVisees,
    tarifCentimesParCaractere: CENTIMES_USD_PAR_CARACTERE_HEYGEN * taux,
    plafondCentimes: typeof plafond === "number" ? plafond : Number.NaN,
    dejaEngageCentimes: await dejaEngageRefaireVoixCentimes(videoId, taux),
  });
  if (!estimation.ok) return { ok: false, phrase: estimation.phrase };
  const entrees = { ...(commande.entrees ?? {}), [ENTREE_PRONONCIATIONS_RETOUCHE]: liste.map((p) => ({ mot: p.mot, prononciation: p.prononciation })) };
  return { ok: true, ...(await lancerRetouche(videoId, planIds, consigne, { ...confirme, entrees })) };
}
