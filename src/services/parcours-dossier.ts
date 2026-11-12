/**
 * DOSSIER D'UNE PERSONNE (mode « un envoi par personne ET par mot »). Utilisé SEULEMENT quand le réglage « plusieurs mots » est
 * allumé (`motsMultiplesActifs()`, éteint par défaut) : éteint, ce fichier n'est jamais appelé par le parcours.
 *
 * Un dossier = tous les enregistrements de `parcours.conversations` dont la clé vaut la RACINE ou commence par `racine|`.
 * La racine est l'empreinte de la personne : la clé ANCIENNE si la personne est connue sous un ancien secret (jamais l'empreinte
 * courante dans ce cas), sinon l'empreinte courante.
 *
 * IMPORTANT — verrou : `sousVerrou` est un verrou EN MÉMOIRE, valable pour UN SEUL processus du Studio. Deux processus Studio
 * en parallèle ne seraient pas protégés l'un de l'autre. Aucune vérification d'opposition ni aucun appel réseau n'a lieu sous ce verrou.
 *
 * Aucun appel au port d'envoi ici : les envois restent dans `parcours-conversation.ts` (garde statique « stop partout »).
 */
import "server-only";
import {
  aliasDe,
  cleParcours,
  dossierDe,
  partieCible,
  racineDe,
  type EntreeDossier,
} from "@/domaine/guide-reseau/cles-parcours";
import {
  cleIdempotenceOpaque,
  empreintePersonne,
  type CleEmpreinte,
  type EtatCles,
} from "@/domaine/guide-reseau/empreinte-personne";
import {
  deciderCommentaire,
  type Conversation,
  type DecisionCommentaire,
} from "@/domaine/guide-reseau/machine-conversation";
import { ecrireParametre, lireParametre, sousVerrou } from "./_commun";
import { enregistrerOppositionPersonne } from "./oppositions-mots";
import { mettreEnFileOpposition } from "./oppositions-transmission";

/**
 * Règle de validation (décision du fondateur, fermée) : la validation des textes existante vaut UNIQUEMENT pour le mot GUIDE lié à `guide-ia`.
 * Tout AUTRE mot (même lié à `guide-ia`) n'a pas de textes validés tant qu'une validation par mot n'existe pas : rien ne part pour lui.
 */
export function textesValidesPourLeMot(mot: string, cible: string): boolean {
  return mot.toUpperCase() === "GUIDE" && cible === "guide-ia";
}

/** Messages privés à NOTRE initiative (premier envoi ou renvoi) par personne et par 24 h. Les réponses dans la fenêtre (M2, reçu, merci, adresse refusée) ne comptent pas. */
export const PLAFOND_MP_PERSONNE_JOUR = 3;

/** Mêmes valeurs que `parcours-conversation.ts` (figées par tests/zernio/liaison-service.test.ts) : pas d'import, ce fichier est importé PAR lui. */
const PARAM_CONVERSATIONS = "parcours.conversations";
const PARAM_CONVERSATIONS_ALIAS = "parcours.conversations.alias";
const ESPACE_CONVERSATION = "zernio-conversation" as const;

type ClesOk = Extract<EtatCles, { ok: true }>;
type Conversations = Record<string, Conversation>;
type Alias = Record<string, string>;

const lireTout = async (): Promise<{ conv: Conversations; alias: Alias }> => ({
  conv: await lireParametre<Conversations>(PARAM_CONVERSATIONS, {}),
  alias: await lireParametre<Alias>(PARAM_CONVERSATIONS_ALIAS, {}),
});

/** Formes d'un identifiant brut sous TOUTES les clés connues, la courante en premier. */
export const formesDe = (cles: ClesOk, idBrut: string): string[] =>
  [cles.courante, ...cles.anciennes].map((c) =>
    empreintePersonne(c, ESPACE_CONVERSATION, idBrut),
  );

export interface RacineTrouvee {
  racine: string;
  /** Forme courante de l'identifiant qui a servi à la recherche (à noter comme alias si la personne n'a été reconnue que par une forme ancienne). */
  courante: string;
  ancienne: boolean;
}

const possede = (o: object, k: string): boolean =>
  Object.prototype.hasOwnProperty.call(o, k);

/**
 * Retrouve la RACINE d'une personne avec la logique de `retrouver` (parcours-conversation) : même ordre, forme par forme —
 * alias du FIL, clé de l'expéditeur, alias de l'expéditeur, clé du fil — sous toutes les clés connues. Une forme « clé » reconnaît
 * la personne si l'enregistrement ANCIEN existe (clé = forme) OU si un dossier `forme|…` existe. La racine est la forme ANCIENNE
 * trouvée : jamais l'empreinte courante quand une ancienne existe. Fonction pure.
 */
export function chercherRacine(
  fS: readonly string[],
  fC: readonly string[],
  conv: Readonly<Conversations>,
  alias: Readonly<Alias>,
): RacineTrouvee | null {
  const directe = (f: string): boolean =>
    possede(conv, f) || dossierDe(f, conv).length > 0;
  const par = (
    formes: readonly string[],
    viaAlias: boolean,
  ): RacineTrouvee | null => {
    for (const f of formes) {
      if (!viaAlias) {
        if (directe(f))
          return { racine: f, courante: formes[0], ancienne: f !== formes[0] };
        continue;
      }
      const cible = possede(alias, f) ? alias[f] : undefined;
      if (
        typeof cible === "string" &&
        cible &&
        (possede(conv, cible) || directe(racineDe(cible)))
      )
        return {
          racine: racineDe(cible),
          courante: formes[0],
          ancienne: f !== formes[0],
        };
    }
    return null;
  };
  return par(fC, true) ?? par(fS, false) ?? par(fS, true) ?? par(fC, false);
}

export interface DossierLu {
  racine: string;
  entrees: EntreeDossier[];
  /** Alias de la personne (enregistrement ancien + table pointant vers la racine). */
  alias: string[];
}

/** Lecture seule (sans verrou) du dossier d'une racine. */
export async function lireDossier(racine: string): Promise<DossierLu> {
  const { conv, alias } = await lireTout();
  return {
    racine,
    entrees: dossierDe(racine, conv),
    alias: aliasDe(racine, conv, alias),
  };
}

/** Racine d'une personne connue par un seul identifiant (commentaire) : lecture seule ; sans dossier, l'empreinte courante. */
export async function racineDeLaPersonne(
  cles: ClesOk,
  idBrut: string,
): Promise<RacineTrouvee> {
  const { conv, alias } = await lireTout();
  const f = formesDe(cles, idBrut);
  return (
    chercherRacine(f, [], conv, alias) ?? {
      racine: f[0],
      courante: f[0],
      ancienne: false,
    }
  );
}

export interface ParamsReservation {
  cles: ClesOk;
  idAuteur: string;
  idCommentaire: string;
  ageMs: number;
  maintenantMs: number;
  /** Cible du mot (code du catalogue, ou `guide-ia`). */
  code: string;
  /** Fabrique l'enregistrement neuf (état `nouveau`) : appelée SOUS VERROU, sans effet de bord. */
  creer: (o: {
    cleGuide: string;
    nature: "premier" | "renvoi";
    groupeM1: "m1-lien" | "deja-envoye" | "lien-rappel";
  }) => Conversation;
}
export interface Reservation {
  decision: DecisionCommentaire;
  racine: string;
  /** Clé de l'enregistrement à poursuivre (décisions `demarrer`, `renvoyer`, `reprendre`). */
  cle?: string;
  etat?: Conversation;
}

/**
 * RÉSERVATION : tout dans UN SEUL `sousVerrou` — relire conversations et alias, trouver la racine, décider, puis écrire l'enregistrement
 * neuf. Deux commentaires traités en même temps voient donc l'un après l'autre le dossier à jour (un seul `demarrer`).
 * `demarrer` / `renvoyer` : écrit `nouveau` sous `cleParcours(racine, cleIdempotenceOpaque(courante, "guide", idCommentaire))`.
 * `reprendre` : rend la clé de l'enregistrement DÉJÀ trouvé par `idCommentaire` (jamais recalculée : la rotation du secret la changerait).
 * Aucune vérification d'opposition, aucun appel réseau, aucun journal ici.
 */
export function reserverParcours(p: ParamsReservation): Promise<Reservation> {
  return sousVerrou(async () => {
    const { conv, alias } = await lireTout();
    const fS = formesDe(p.cles, p.idAuteur);
    const trouvee = chercherRacine(fS, [], conv, alias);
    const racine = trouvee?.racine ?? fS[0];
    const T = dossierDe(racine, conv);
    const D = partieCible(T, p.code);
    const decision = deciderCommentaire(
      T,
      D,
      {
        idCommentaire: p.idCommentaire,
        ageMs: p.ageMs,
        maintenantMs: p.maintenantMs,
      },
      { plafondPersonneJour: PLAFOND_MP_PERSONNE_JOUR },
    );
    if (decision.action === "reprendre") {
      const meme = T.find((x) => x.etat.idCommentaire === p.idCommentaire);
      return meme
        ? { decision, racine, cle: meme.cle, etat: meme.etat }
        : { decision, racine };
    }
    if (decision.action !== "demarrer" && decision.action !== "renvoyer")
      return { decision, racine };
    const cleGuide = cleIdempotenceOpaque(
      p.cles.courante,
      "guide",
      p.idCommentaire,
    );
    const cle = cleParcours(racine, cleGuide);
    const etat = p.creer({
      cleGuide,
      nature: decision.action === "renvoyer" ? "renvoi" : "premier",
      groupeM1: decision.action === "renvoyer" ? decision.groupe : "m1-lien",
    });
    await ecrireParametre(PARAM_CONVERSATIONS, { ...conv, [cle]: etat });
    // Migration douce : reconnue par une forme ANCIENNE, la forme courante devient un alias qui pointe vers la RACINE (rien n'est supprimé).
    if (
      trouvee?.ancienne &&
      !possede(alias, trouvee.courante) &&
      !possede(conv, trouvee.courante)
    )
      await ecrireParametre(PARAM_CONVERSATIONS_ALIAS, {
        ...alias,
        [trouvee.courante]: racine,
      });
    return { decision, racine, cle, etat };
  });
}

/** États seulement : TOUS les enregistrements du dossier passent à `oppose` (un état `oppose` n'est jamais rétrogradé). Rend les enregistrements à jour. Sans enregistrement et avec `neuf`, en crée un sous la racine. */
export function passerDossierOppose(
  racine: string,
  neuf?: () => Conversation,
): Promise<EntreeDossier[]> {
  return sousVerrou(async () => {
    const conv = await lireParametre<Conversations>(PARAM_CONVERSATIONS, {});
    const liste = dossierDe(racine, conv);
    if (liste.length === 0) {
      if (!neuf) return [];
      const e = neuf();
      await ecrireParametre(PARAM_CONVERSATIONS, { ...conv, [racine]: e });
      return [{ cle: racine, etat: e }];
    }
    const suite = Object.fromEntries(
      liste.map((x) => [
        x.cle,
        { ...x.etat, etat: "oppose" as const, prochainEssaiLe: null },
      ]),
    );
    await ecrireParametre(PARAM_CONVERSATIONS, { ...conv, ...suite });
    return liste.map((x) => ({ cle: x.cle, etat: suite[x.cle] }));
  });
}

/** Met en file le « stop » de CHAQUE enregistrement du dossier (idempotent, une entrée par enregistrement ; sans effet sans adresse ni page transmise). Hors verrou. */
export async function mettreEnFileDossier(
  entrees: readonly EntreeDossier[],
  cles: CleEmpreinte,
  maintenantMs: number,
): Promise<void> {
  for (const x of entrees)
    await mettreEnFileOpposition(x.cle, x.etat, cles, maintenantMs);
}

/** Dossier déjà reconnu comme opposé (registre ou état) : tous les enregistrements passent à `oppose` et chacun est mis en file. */
export async function marquerDossierOppose(o: {
  racine: string;
  cles: CleEmpreinte;
  maintenantMs: number;
  neuf?: () => Conversation;
}): Promise<void> {
  await mettreEnFileDossier(
    await passerDossierOppose(o.racine, o.neuf),
    o.cles,
    o.maintenantMs,
  );
}

/**
 * « stop » écrit par la personne : registre sur `[racine, ...alias]` + identifiants BRUTS (toutes les formes de clé), puis TOUS les
 * enregistrements du dossier à `oppose`, puis la mise en file pour CHAQUE enregistrement. Le registre est écrit en premier.
 * NE JAMAIS appeler sous `sousVerrou`.
 */
export async function opposerDossier(o: {
  racine: string;
  idsBruts: readonly string[];
  cles: CleEmpreinte;
  env?: Record<string, string | undefined>;
  maintenantMs: number;
  neuf?: () => Conversation;
}): Promise<void> {
  const { alias } = await lireDossier(o.racine);
  await enregistrerOppositionPersonne(
    o.idsBruts,
    [o.racine, ...alias],
    ESPACE_CONVERSATION,
    { env: o.env },
  );
  await marquerDossierOppose({
    racine: o.racine,
    cles: o.cles,
    maintenantMs: o.maintenantMs,
    neuf: o.neuf,
  });
}
