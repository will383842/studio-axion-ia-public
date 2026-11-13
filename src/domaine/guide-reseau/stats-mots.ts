// MG-2 — chiffres par mot : fonctions PURES (aucune base, aucun réseau, aucune horloge cachée : `maintenantMs` est passé).
// Entrée : des événements de commentaire et des conversations déjà réduits aux champs utiles. Sortie : des mots et des nombres,
// JAMAIS d'identifiant de personne, de clé d'empreinte ni de texte.
// Fenêtres glissantes en UTC : j7 = les 7 × 24 h qui précèdent `maintenantMs`, j30 = les 30 × 24 h ; bornes INCLUSES.
// Une date illisible ou située dans le futur ne compte que dans `total`.
import { normaliserMot } from "./mot-normalise";
import type { Fenetres, StatsMot } from "./cibles-contrat";

const JOUR_MS = 86_400_000;
/** Mot des conversations anciennes (sans champ `mot`). */
export const MOT_PAR_DEFAUT = "GUIDE";

/** Un commentaire reçu (événement `zernio.commentaire`), réduit : l'identifiant de l'auteur n'entre jamais ici. */
export interface EvenementStat {
  readonly recuLe: string;
  /** Mot écrit (absent ou illisible : l'événement n'est pas compté). */
  readonly motSeul?: string | null;
  /** État de l'événement ; `bloque` = une garde ou le port a refusé. */
  readonly etat?: string | null;
}

/** Une conversation, réduite. `cle` ne sert qu'à reconnaître une même personne : elle ne ressort jamais. */
export interface ConversationStat {
  readonly cle: string;
  /** Absent sur les anciennes conversations : GUIDE. */
  readonly mot?: string | null;
  /** `renvoi` = message déjà envoyé une fois, renvoyé ; absent (anciennes conversations) = premier envoi. */
  readonly nature?: string | null;
  readonly etat: string;
  readonly creeLe: string;
  /** Date d'envoi du premier message privé ; vide = pas encore envoyé. */
  readonly m1Le: string | null;
  /** Date du refus d'envoi (états `m1_refuse` / `site_refuse`), si lisible ; sinon `creeLe` sert de date. */
  readonly refuseLe?: string | null;
  /** Champ facultatif, absent des données actuelles : la personne suit le compte (connu sans doute possible). */
  readonly suitLeCompte?: boolean;
}

/** Chiffres d'un mot. Étend `StatsMot` du contrat : `ecrits` = personnes distinctes qui l'ont écrit, `envoyes` = premiers messages privés envoyés. */
export interface StatsMotChiffrees extends StatsMot {
  /** Commentaires reçus (une personne peut en écrire plusieurs). */
  readonly commentaires: Fenetres;
  readonly reponsesPubliques: Fenetres;
  /** Premiers messages privés ENVOYÉS : une fois par personne et par mot, dès le premier envoi ; un renvoi ne compte pas. */
  readonly premiersMessages: Fenetres;
  readonly erreurs: Fenetres;
  /** Envois incertains (`m1_a_verifier`, `m1_consommee`) : comptés à part, JAMAIS dans `premiersMessages`. */
  readonly incertains: Fenetres;
  /** Commentaires dont l'événement est `bloque` (une garde ou le port a refusé). */
  readonly commentairesBloques: Fenetres;
  /** Envois refusés (`m1_refuse`, `site_refuse`), datés par `refuseLe` s'il est lisible, sinon `creeLe`. */
  readonly envoisRefuses: Fenetres;
  /** Personnes distinctes (par clé d'empreinte, sans jamais la montrer) ayant une conversation sur ce mot. */
  readonly personnes: Fenetres;
  /**
   * Personnes gagnées : JAMAIS un chiffre exact. À lire « au moins N » : le Studio ne voit que celles dont il est sûr.
   * `suivent` porte la même information par fenêtre.
   */
  readonly auMoins: number;
}

/** États où la réponse publique n'est pas partie (ou pas encore). */
const SANS_REPONSE_PUBLIQUE: readonly string[] = ["nouveau", "oppose"];
const ETATS_INCERTAINS: readonly string[] = ["m1_a_verifier", "m1_consommee"];
const ETATS_ERREUR_CONVERSATION: readonly string[] = [
  "m1_refuse",
  "site_refuse",
];

type Compteur = { j7: number; j30: number; total: number };
const vide = (): Compteur => ({ j7: 0, j30: 0, total: 0 });

function compter(
  c: Compteur,
  date: string | null | undefined,
  maintenantMs: number,
): void {
  c.total++;
  const t = date ? Date.parse(date) : NaN;
  if (!Number.isFinite(t) || t > maintenantMs) return;
  if (maintenantMs - t <= 30 * JOUR_MS) c.j30++;
  if (maintenantMs - t <= 7 * JOUR_MS) c.j7++;
}

/** Date la plus ancienne (illisible = la plus tardive), pour ne garder que le PREMIER envoi. */
const plusAncienne = (a: string | null, b: string | null): string | null => {
  const ta = a ? Date.parse(a) : NaN;
  const tb = b ? Date.parse(b) : NaN;
  if (!Number.isFinite(ta)) return b;
  if (!Number.isFinite(tb)) return a;
  return tb < ta ? b : a;
};

/** Agrège par mot. Résultat trié par mot ; un mot sans aucune donnée n'apparaît pas. */
export function agregerStatsMots(
  evenements: readonly EvenementStat[],
  conversations: readonly ConversationStat[],
  maintenantMs: number,
): StatsMotChiffrees[] {
  type Acc = Record<
    | "commentaires"
    | "reponsesPubliques"
    | "premiersMessages"
    | "erreurs"
    | "incertains"
    | "commentairesBloques"
    | "envoisRefuses"
    | "personnes"
    | "suivent",
    Compteur
  >;
  const mots = new Map<string, Acc>();
  const acc = (mot: string): Acc => {
    let a = mots.get(mot);
    if (!a)
      mots.set(
        mot,
        (a = {
          commentaires: vide(),
          reponsesPubliques: vide(),
          premiersMessages: vide(),
          erreurs: vide(),
          incertains: vide(),
          commentairesBloques: vide(),
          envoisRefuses: vide(),
          personnes: vide(),
          suivent: vide(),
        }),
      );
    return a;
  };

  for (const ev of evenements) {
    const mot = normaliserMot(ev.motSeul);
    if (mot === null) continue;
    const a = acc(mot);
    compter(a.commentaires, ev.recuLe, maintenantMs);
    if (ev.etat === "bloque") {
      compter(a.erreurs, ev.recuLe, maintenantMs);
      compter(a.commentairesBloques, ev.recuLe, maintenantMs);
    }
  }

  // Une personne et un mot : un seul « enregistrement », daté du premier envoi.
  const parPersonneMot = new Map<
    string,
    {
      mot: string;
      creeLe: string;
      m1Le: string | null;
      refuseLe: string | null;
      reponse: boolean;
      erreur: boolean;
      incertain: boolean;
      suit: boolean;
    }
  >();
  for (const c of conversations) {
    const mot = normaliserMot(c.mot) ?? MOT_PAR_DEFAUT;
    // Même personne = même racine de clé (avant le premier « | ») : un renvoi rangé sous `racine|…` ne compte pas deux fois.
    const barre = c.cle.indexOf("|");
    const racine = barre === -1 ? c.cle : c.cle.slice(0, barre);
    const cle = JSON.stringify([racine, mot]);
    const incertain = ETATS_INCERTAINS.includes(c.etat);
    const erreur = ETATS_ERREUR_CONVERSATION.includes(c.etat);
    // Un envoi incertain n'est jamais compté comme envoyé, même si une date d'envoi est écrite.
    const premierEnvoi = c.nature !== "renvoi" && c.m1Le !== null && !incertain;
    const avant = parPersonneMot.get(cle);
    const lui = {
      mot,
      creeLe: c.creeLe,
      m1Le: premierEnvoi ? c.m1Le : null,
      refuseLe: erreur ? (c.refuseLe ?? null) : null,
      // Un état vide n'est pas une réponse publique.
      reponse: c.etat !== "" && !SANS_REPONSE_PUBLIQUE.includes(c.etat),
      erreur,
      incertain,
      suit: c.suitLeCompte === true,
    };
    parPersonneMot.set(
      cle,
      avant
        ? {
            mot,
            creeLe: plusAncienne(avant.creeLe, c.creeLe) ?? avant.creeLe,
            m1Le: plusAncienne(avant.m1Le, lui.m1Le),
            refuseLe: plusAncienne(avant.refuseLe, lui.refuseLe),
            reponse: avant.reponse || lui.reponse,
            erreur: avant.erreur || lui.erreur,
            incertain: avant.incertain || lui.incertain,
            suit: avant.suit || lui.suit,
          }
        : lui,
    );
  }
  for (const p of parPersonneMot.values()) {
    const a = acc(p.mot);
    compter(a.personnes, p.creeLe, maintenantMs);
    if (p.reponse) compter(a.reponsesPubliques, p.creeLe, maintenantMs);
    if (p.erreur) {
      compter(a.erreurs, p.creeLe, maintenantMs);
      const refus = p.refuseLe && Number.isFinite(Date.parse(p.refuseLe));
      compter(a.envoisRefuses, refus ? p.refuseLe : p.creeLe, maintenantMs);
    }
    if (p.incertain) compter(a.incertains, p.creeLe, maintenantMs);
    if (p.m1Le !== null) compter(a.premiersMessages, p.m1Le, maintenantMs);
    if (p.suit) compter(a.suivent, p.creeLe, maintenantMs);
  }

  return [...mots.entries()]
    .sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0))
    .map(([mot, a]) => ({
      mot,
      ...a,
      ecrits: { ...a.personnes },
      envoyes: { ...a.premiersMessages },
      auMoins: a.suivent.total,
    }));
}
