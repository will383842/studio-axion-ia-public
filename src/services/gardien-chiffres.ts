/**
 * GARDIEN DES CHIFFRES CLÉS (fiche KB-04). Serveur seulement. Contrôle SANS IA qui compare une même donnée (prix et durée de
 * la Journée IA, durée du rendez-vous gratuit, garantie) entre le site, les preuves validées du Studio et l'usine.
 *
 *  - réglage « gardien.chiffres.actif » ÉTEINT par défaut, relu à chaque contrôle : éteint, aucune lecture, aucune notification ;
 *  - lance seulement par le bouton de la sous-page (aucune minuterie) ;
 *  - le site se lit par la porte de KB-02 (une requête par chiffre clé, cadence plafonnée par la porte) ; le site masque les
 *    montants avant que le Studio les voie : un prix du site n'est donc jamais comparable aujourd'hui (« non comparé ») ;
 *  - l'usine passe par un lecteur injecté ; sans lecteur, « non relié » ;
 *  - un écart crée UNE notification cloche (jamais de courriel ni de push) qui nomme la donnée et les sources, sans aucune valeur ;
 *  - l'empreinte de chaque écart signalé est gardée dans un paramètre : le même écart ne sonne pas deux fois ;
 *  - le gardien ne bloque rien et n'écrit rien d'autre (aucune preuve, matière, script ni publication).
 */
import "server-only";
import { CHIFFRES_CLES, REGLAGE_DERNIER_CONTROLE, REGLAGE_EMPREINTES, TITRE_NOTIFICATION_GARDIEN, comparer, empreinteEcart, phraseEcart, valeurDesPreuves, valeurDuFaitSite, valeurUnique, type Verdict } from "@/domaine/gardien-chiffres";
import type { Preuve } from "@/domaine/types";
import { chercherFaitsSite } from "./kb-site";
import { creerNotification } from "./notifications";
import { depots, ecrireParametre, lireParametre, maintenant } from "./_commun";

/** Réglage « Gardien des chiffres » : faux tant que le fondateur ne l'a pas allumé. */
export const REGLAGE_GARDIEN_CHIFFRES = "gardien.chiffres.actif";

/** Lecteur des faits de l'usine (injecté). Rend la valeur normalisée de la donnée, ou null si l'usine n'est pas reliée. */
export type LecteurUsine = (code: string) => Promise<number | null>;

export interface OptionsControle {
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  lecteurUsine?: LecteurUsine;
}

/** Une ligne du résultat : le verdict seulement, jamais une valeur. */
export interface LigneControle {
  code: string;
  libelle: string;
  verdict: Verdict;
  usineRelie: boolean;
}

export interface ResultatControle {
  etat: "eteint" | "fait";
  donnees: LigneControle[];
  /** Notifications créées par CE contrôle. */
  notifications: number;
}

export interface DernierControle {
  le: string;
  donnees: { code: string; verdict: Verdict }[];
}

const LIEN_REGLAGES = "/reglages/base-connaissances";
const VERDICTS: readonly string[] = ["accord", "ecart", "non-compare"];

/** Aucun lecteur d'usine en V1 : la base de l'usine n'ouvre aucune porte de lecture de ses faits. */
const usineNonRelie: LecteurUsine = async () => null;

export async function gardienActif(): Promise<boolean> {
  try {
    return (await lireParametre<unknown>(REGLAGE_GARDIEN_CHIFFRES, false)) === true;
  } catch {
    return false; // lecture du réglage impossible : on reste éteint
  }
}

async function empreintesConnues(): Promise<Record<string, string>> {
  try {
    const brut = await lireParametre<unknown>(REGLAGE_EMPREINTES, {});
    if (!brut || typeof brut !== "object" || Array.isArray(brut)) return {};
    return Object.fromEntries(Object.entries(brut).filter(([, v]) => typeof v === "string")) as Record<string, string>;
  } catch {
    return {};
  }
}

/** Dernier résultat enregistré (verdicts seulement), pour la sous-page. */
export async function lireDernierControle(): Promise<DernierControle | null> {
  try {
    const brut = await lireParametre<unknown>(REGLAGE_DERNIER_CONTROLE, null);
    if (!brut || typeof brut !== "object") return null;
    const { le, donnees } = brut as { le?: unknown; donnees?: unknown };
    if (typeof le !== "string" || !Array.isArray(donnees)) return null;
    const lignes = donnees.filter((d): d is { code: string; verdict: Verdict } => !!d && typeof d.code === "string" && VERDICTS.includes(d.verdict));
    return { le, donnees: lignes };
  } catch {
    return null;
  }
}

async function preuvesDuStudio(): Promise<Preuve[]> {
  try {
    return await depots().preuves.lister((p) => !p.estDemo);
  } catch {
    return [];
  }
}

async function valeurUsine(lecteur: LecteurUsine, code: string): Promise<number | null> {
  try {
    const v = await lecteur(code);
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

async function controleEnCours(options: OptionsControle): Promise<ResultatControle> {
  const lecteur = options.lecteurUsine ?? usineNonRelie;
  const preuves = await preuvesDuStudio();
  const t = Date.now();
  const connues = await empreintesConnues();
  const suivantes = { ...connues };
  const donnees: LigneControle[] = [];
  let notifications = 0;

  for (const cle of CHIFFRES_CLES) {
    const lecture = await chercherFaitsSite(cle.requete, { env: options.env, fetchImpl: options.fetchImpl });
    const site = lecture.etat === "ok" ? valeurUnique(lecture.faits.flatMap((f) => valeurDuFaitSite(f, cle))) : null;
    const preuve = valeurDesPreuves(preuves, cle, t);
    const usine = await valeurUsine(lecteur, cle.code);
    const valeurs = { site, preuve, usine };
    const { verdict, sources } = comparer(valeurs);

    if (verdict === "ecart") {
      const empreinte = empreinteEcart(cle.code, valeurs);
      if (connues[cle.code] !== empreinte) {
        try {
          await creerNotification({ type: "info", titre: TITRE_NOTIFICATION_GARDIEN, message: phraseEcart(cle, sources), lien: LIEN_REGLAGES }, { cloche: true });
          suivantes[cle.code] = empreinte;
          notifications += 1;
        } catch {
          // la cloche n'a pas pu s'écrire : l'empreinte n'est pas gardée, le prochain contrôle réessaiera
        }
      }
    } else if (verdict === "accord") {
      delete suivantes[cle.code]; // l'écart est résolu : un écart futur sonnera de nouveau
    }
    donnees.push({ code: cle.code, libelle: cle.libelle, verdict, usineRelie: usine !== null });
  }

  try {
    if (JSON.stringify(suivantes) !== JSON.stringify(connues)) await ecrireParametre(REGLAGE_EMPREINTES, suivantes);
    const dernier: DernierControle = { le: maintenant(), donnees: donnees.map((d) => ({ code: d.code, verdict: d.verdict })) };
    await ecrireParametre(REGLAGE_DERNIER_CONTROLE, dernier);
  } catch {
    // le contrôle ne casse jamais : au pire, l'écart sera signalé de nouveau
  }
  return { etat: "fait", donnees, notifications };
}

let enCours: Promise<ResultatControle> | null = null;

/** Lance le contrôle. Éteint : ne fait rien. Deux contrôles simultanés n'en font qu'un (une seule notification par écart). */
export async function controlerChiffresCles(options: OptionsControle = {}): Promise<ResultatControle> {
  if (!(await gardienActif())) return { etat: "eteint", donnees: [], notifications: 0 };
  if (enCours) return enCours;
  const travail = controleEnCours(options).finally(() => {
    enCours = null;
  });
  enCours = travail;
  return travail;
}
