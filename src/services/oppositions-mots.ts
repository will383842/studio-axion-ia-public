/**
 * Personnes opposées (« stop », « arrêtez » écrit par la personne) : registre de mise à l'écart, par EMPREINTE de l'identifiant
 * opaque du contact (jamais l'identifiant lui-même, jamais d'adresse). Rien n'est jamais supprimé.
 */
import "server-only";
import { candidatsEmpreinte, contientEnTempsConstant, empreinteHeritee, empreintePersonne, ErreurEmpreinteIndisponible, ErreurIdentifiantInvalide, lireClesEmpreinte, type EspacePersonne, type EtatCles } from "@/domaine/guide-reseau/empreinte-personne";
import { emettreJetonNonOpposee, type JetonNonOpposee } from "@/domaine/guide-reseau/jeton-non-opposee";
import { racineDe } from "@/domaine/guide-reseau/cles-parcours";
import { ETATS_EN_COURS } from "@/domaine/guide-reseau/etats-parcours";
import { ecrireParametre, lireParametre, maintenant, sousVerrou } from "./_commun";

export const PARAM_OPPOSITIONS_MOTS = "mots.oppositions";
export interface LigneOpposition {
  id: string;
  le: string;
  transmise: boolean;
  /** Autres formes (clé courante) de la même personne, ajoutées après rotation. Aucune ligne n'est jamais supprimée. */
  alias?: string[];
}
/** HÉRITÉE, LECTURE SEULE : ancien SHA-256 tronqué. On n'écrit plus jamais sous cette forme. */
export const empreinteContact = (id: string): string => empreinteHeritee(id);

/**
 * Espaces d'identifiants, un par appelant (figés par tests/zernio/empreinte-appelants.test.ts) :
 * - « zernio-contact » (défaut) : identifiant de contact Zernio ; a-traiter, parcours-mot et mots-service (STOP avec contact) ;
 * - « evenement » : mots-service (STOP sans identifiant de contact) : identifiant de l'événement.
 * « instagram » / « facebook » : réservés à de futurs appelants, aucun aujourd'hui.
 */
export const ESPACE_CONTACT_ZERNIO: EspacePersonne = "zernio-contact";

/** Même nom que `PARAM_CONVERSATIONS` (parcours-conversation.ts importe ce module : pas d'import circulaire). */
const PARAM_CONVERSATIONS_ETAT = "parcours.conversations";

interface Options {
  env?: Record<string, string | undefined>;
}
type Cles = Extract<EtatCles, { ok: true }>;
const RE_KID = /^p1\.([0-9a-f]{8})\./;
const formes = (x: LigneOpposition): string[] => [x.id, ...(x.alias ?? [])];

/** Échec FERMÉ : plus aucune voie ancienne. Sans clés valides, on lève (jamais « non opposée », jamais d'écriture héritée). */
function cles(o?: Options): Cles {
  const c = lireClesEmpreinte(o?.env ?? process.env);
  if (!c.ok) throw new ErreurEmpreinteIndisponible();
  return c;
}
/**
 * Une ligne n'est illisible que si AUCUNE de ses formes n'est couverte : un kid connu (courant ou ancien) ou une forme héritée
 * (reconnue sans secret). Une ligne avec un alias sous la clé courante permet donc de retirer l'ancien secret.
 */
function verifierKids(liste: LigneOpposition[], c: Cles): void {
  const connus = new Set([c.courante.kid, ...c.anciennes.map((a) => a.kid)]);
  for (const x of liste) {
    const couverte = formes(x).some((f) => {
      const m = RE_KID.exec(f);
      return !m || connus.has(m[1]);
    });
    if (!couverte) throw new ErreurEmpreinteIndisponible("Le registre contient une empreinte qu'aucun secret connu ne couvre.");
  }
}
/** Indice de la ligne reconnaissant la personne (parcours complet), -1 sinon. */
function trouver(liste: LigneOpposition[], candidats: string[]): number {
  let idx = -1;
  liste.forEach((x, i) => { if (contientEnTempsConstant(formes(x), candidats) && idx < 0) idx = i; });
  return idx;
}
const avecAlias = (liste: LigneOpposition[], i: number, courante: string): LigneOpposition[] => liste.map((x, j) => (j === i ? { ...x, alias: [...(x.alias ?? []), courante] } : x));

/** Ajoute SOUS VERROU l'alias courant si la personne n'est reconnue que par une forme ancienne/héritée. */
async function ajouterAlias(idContact: string, espace: EspacePersonne, c: Cles): Promise<void> {
  await sousVerrou(async () => {
    const liste = await lireParametre<LigneOpposition[]>(PARAM_OPPOSITIONS_MOTS, []);
    const courante = empreintePersonne(c.courante, espace, idContact);
    const i = trouver(liste, candidatsEmpreinte(c, espace, idContact));
    if (i < 0 || contientEnTempsConstant(formes(liste[i]), [courante])) return;
    await ecrireParametre(PARAM_OPPOSITIONS_MOTS, avecAlias(liste, i, courante));
  });
}

/**
 * Cette personne s'est-elle déjà opposée ? Identifiant absent : non. Lecture impossible OU clés manquantes / registre non couvert :
 * l'ERREUR EST PROPAGÉE (jamais « non opposée » par défaut).
 * NE JAMAIS appeler sous `sousVerrou` : l'ajout d'alias prend lui-même le verrou (le verrou n'est pas réentrant : blocage).
 */
export async function personneOpposee(idContact: string | null | undefined, espace: EspacePersonne = ESPACE_CONTACT_ZERNIO, o?: Options): Promise<boolean> {
  if (!idContact) return false;
  const c = cles(o);
  const liste = await lireParametre<LigneOpposition[]>(PARAM_OPPOSITIONS_MOTS, []);
  verifierKids(liste, c);
  const candidats = candidatsEmpreinte(c, espace, idContact);
  const i = trouver(liste, candidats);
  if (i < 0) return false;
  if (!contientEnTempsConstant(formes(liste[i]), [candidats[0]])) {
    // « Au mieux » : la réponse (true) ne dépend jamais de cet ajout ; un échec d'écriture ne doit pas faire croire « non opposée ».
    try {
      await ajouterAlias(idContact, espace, c);
    } catch {
      /* alias réessayé à la prochaine lecture */
    }
  }
  return true;
}

/** Écrit l'opposition ; à appeler SOUS VERROU (liste relue par l'appelant du verrou). */
async function ecrireOpposition(idContact: string, espace: EspacePersonne, c: Cles): Promise<string> {
  const courante = empreintePersonne(c.courante, espace, idContact);
  const liste = await lireParametre<LigneOpposition[]>(PARAM_OPPOSITIONS_MOTS, []);
  verifierKids(liste, c);
  const i = trouver(liste, candidatsEmpreinte(c, espace, idContact));
  if (i < 0) await ecrireParametre(PARAM_OPPOSITIONS_MOTS, [...liste, { id: courante, le: maintenant(), transmise: false }]);
  else if (!contientEnTempsConstant(formes(liste[i]), [courante])) await ecrireParametre(PARAM_OPPOSITIONS_MOTS, avecAlias(liste, i, courante));
  return courante;
}

/** Met la personne à l'écart (une seule ligne par personne). Rend l'empreinte réellement enregistrée (forme p1). Échec fermé sans secret. */
export async function enregistrerOpposition(idContact: string, espace: EspacePersonne = ESPACE_CONTACT_ZERNIO, o?: Options): Promise<string> {
  const c = cles(o);
  return sousVerrou(() => ecrireOpposition(idContact, espace, c));
}
/**
 * Met à l'écart une personne connue SEULEMENT par une empreinte déjà calculée (forme p1 courante ou ancienne) : aucun identifiant brut
 * n'est requis. NE PAS UTILISER pour une forme ancienne d'un identifiant brut connu (voir `enregistrerOppositionPersonne`). Une forme déjà présente (id ou alias d'une ligne) n'ajoute rien. Échec fermé sans secret valide.
 */
export async function enregistrerOppositionParEmpreinte(empreinte: string, o?: Options): Promise<void> {
  const c = cles(o);
  await sousVerrou(async () => {
    const liste = await lireParametre<LigneOpposition[]>(PARAM_OPPOSITIONS_MOTS, []);
    verifierKids(liste, c);
    if (liste.some((x) => contientEnTempsConstant(formes(x), [empreinte]))) return;
    await ecrireParametre(PARAM_OPPOSITIONS_MOTS, [...liste, { id: empreinte, le: maintenant(), transmise: false }]);
  });
}
/**
 * « stop » d'une personne, en UNE écriture sous UN verrou. Règle de sûreté : une forme ANCIENNE n'est rattachée qu'à la ligne du MÊME
 * identifiant brut (jamais d'une forme sans brut à une autre ligne : ce serait un échec OUVERT). Pour chaque brut : la ligne reconnue
 * reçoit les formes manquantes (courante + anciennes) ; aucune ligne reconnue : nouvelle ligne. Une empreinte sans brut déjà présente
 * ne change rien ; sinon elle a sa PROPRE ligne (dette visible dans le compteur). Rend la forme courante du premier brut.
 * NE JAMAIS appeler sous `sousVerrou` (verrou non réentrant).
 */
export async function enregistrerOppositionPersonne(idsBruts: readonly string[], empreintesSansBrut: readonly string[], espace: EspacePersonne = ESPACE_CONTACT_ZERNIO, o?: Options): Promise<string> {
  if (idsBruts.length === 0) throw new ErreurIdentifiantInvalide();
  const c = cles(o);
  return sousVerrou(async () => {
    const liste = await lireParametre<LigneOpposition[]>(PARAM_OPPOSITIONS_MOTS, []);
    verifierKids(liste, c);
    let res = liste.map((x) => ({ ...x }));
    let change = false;
    for (const r of idsBruts) {
      const courante = empreintePersonne(c.courante, espace, r);
      const anciennes = c.anciennes.map((a) => empreintePersonne(a, espace, r));
      const toutes = [courante, ...anciennes];
      const cand = candidatsEmpreinte(c, espace, r);
      const concernees = res.map((x, i) => (contientEnTempsConstant(formes(x), cand) ? i : -1)).filter((i) => i >= 0);
      if (concernees.length === 0) {
        res = [...res, { id: courante, le: maintenant(), transmise: false, ...(anciennes.length > 0 ? { alias: anciennes } : {}) }];
        change = true;
        continue;
      }
      for (const i of concernees) {
        const manquantes = toutes.filter((f) => !contientEnTempsConstant(formes(res[i]), [f]));
        if (manquantes.length === 0) continue;
        res[i] = { ...res[i], alias: [...(res[i].alias ?? []), ...manquantes] };
        change = true;
      }
    }
    for (const e of empreintesSansBrut) {
      if (res.some((x) => contientEnTempsConstant(formes(x), [e]))) continue;
      res = [...res, { id: e, le: maintenant(), transmise: false }];
      change = true;
    }
    if (change) await ecrireParametre(PARAM_OPPOSITIONS_MOTS, res);
    return empreintePersonne(c.courante, espace, idsBruts[0]);
  });
}
/** Comme `enregistrerOpposition`, pour un appelant QUI TIENT DÉJÀ le verrou (le verrou n'est pas réentrant). */
export async function enregistrerOppositionSousVerrou(idContact: string, espace: EspacePersonne = ESPACE_CONTACT_ZERNIO, o?: Options): Promise<string> {
  return ecrireOpposition(idContact, espace, cles(o));
}
/** Marque « transmise » la ligne retrouvée par ses formes reconnues (courante, anciennes, héritée). */
export async function marquerTransmise(idContact: string, espace: EspacePersonne = ESPACE_CONTACT_ZERNIO, o?: Options): Promise<void> {
  const c = cles(o);
  await sousVerrou(async () => {
    const liste = await lireParametre<LigneOpposition[]>(PARAM_OPPOSITIONS_MOTS, []);
    const i = trouver(liste, candidatsEmpreinte(c, espace, idContact));
    if (i >= 0 && !liste[i].transmise) await ecrireParametre(PARAM_OPPOSITIONS_MOTS, liste.map((x, j) => (j === i ? { ...x, transmise: true } : x)));
  });
}

/**
 * Une de ces empreintes (clé de conversation, alias…) est-elle au registre ? Parcours complet en temps constant. Registre illisible
 * (kid qu'aucun secret ne couvre) ou secret absent : l'ERREUR EST LEVÉE (échec fermé, jamais « non opposée »). Ne pas appeler sous verrou.
 */
export async function empreintesOpposees(empreintes: readonly string[], o?: Options): Promise<boolean> {
  const c = cles(o);
  const liste = await lireParametre<LigneOpposition[]>(PARAM_OPPOSITIONS_MOTS, []);
  verifierKids(liste, c);
  return trouver(liste, [...empreintes]) >= 0;
}
/** Marque « transmise » la ligne reconnue par UNE empreinte déjà calculée (aucun identifiant brut, aucun secret requis). */
export async function marquerTransmiseParEmpreinte(empreinte: string, o?: Options): Promise<void> {
  void o; // signature homogène avec les autres fonctions du registre ; aucun secret requis
  await sousVerrou(async () => {
    const liste = await lireParametre<LigneOpposition[]>(PARAM_OPPOSITIONS_MOTS, []);
    const i = trouver(liste, [empreinte]);
    if (i >= 0 && !liste[i].transmise) await ecrireParametre(PARAM_OPPOSITIONS_MOTS, liste.map((x, j) => (j === i ? { ...x, transmise: true } : x)));
  });
}

/**
 * Comptes seulement : jamais d'empreinte.
 * - lignesParKid : lignes ayant au moins une forme sous ce kid (alias compris) ;
 * - seulementParKid : lignes COUVERTES UNIQUEMENT par ce kid (retirer ce secret les rendrait illisibles) ;
 * - kidsInconnus : kids présents dans le registre qu'aucun secret actuel ne porte.
 */
export async function etatRegistreEmpreintes(o?: Options): Promise<{ lignesParKid: Record<string, number>; seulementParKid: Record<string, number>; heritees: number; kidsInconnus: string[]; conversationsParKid: Record<string, number>; conversationsActivesParKid: Record<string, number> }> {
  const liste = await lireParametre<LigneOpposition[]>(PARAM_OPPOSITIONS_MOTS, []);
  const c = lireClesEmpreinte(o?.env ?? process.env);
  const connus = new Set(c.ok ? [c.courante.kid, ...c.anciennes.map((a) => a.kid)] : []);
  const lignesParKid: Record<string, number> = {};
  const seulementParKid: Record<string, number> = {};
  const inconnus = new Set<string>();
  let heritees = 0;
  for (const x of liste) {
    const kids = new Set<string>();
    let heritee = false;
    for (const f of formes(x)) {
      const m = RE_KID.exec(f);
      if (!m) heritee = true;
      else {
        kids.add(m[1]);
        if (!connus.has(m[1])) inconnus.add(m[1]);
      }
    }
    if (heritee) heritees++;
    for (const k of kids) lignesParKid[k] = (lignesParKid[k] ?? 0) + 1;
    if (!heritee && kids.size === 1) { const [k] = kids; seulementParKid[k] = (seulementParKid[k] ?? 0) + 1; }
  }
  // Conversations par kid (clé ou alias), des NOMBRES seulement. « Actives » = encore en cours (un message de la personne y serait traité).
  const conversationsParKid: Record<string, number> = {};
  const conversationsActivesParKid: Record<string, number> = {};
  const conv = await lireParametre<Record<string, { etat?: string; alias?: string[] }>>(PARAM_CONVERSATIONS_ETAT, {});
  for (const [cle, e] of Object.entries(conv)) {
    const kidsConv = new Set<string>();
    for (const f of [cle, ...(e.alias ?? [])]) {
      const m = RE_KID.exec(f);
      if (m) kidsConv.add(m[1]);
    }
    const active = ETATS_EN_COURS.includes(String(e.etat));
    for (const k of kidsConv) {
      conversationsParKid[k] = (conversationsParKid[k] ?? 0) + 1;
      if (active) conversationsActivesParKid[k] = (conversationsActivesParKid[k] ?? 0) + 1;
    }
  }
  return { lignesParKid, seulementParKid, heritees, kidsInconnus: [...inconnus].sort(), conversationsParKid, conversationsActivesParKid };
}

/** Les 5 espaces d'empreinte : une opposition vaut PARTOUT (voir `personneOpposeePartout`). */
export const ESPACES_TOUS = [
  "zernio-conversation",
  "zernio-contact",
  "evenement",
  "instagram",
  "facebook",
] as const satisfies readonly EspacePersonne[];

export interface PersonneAVerifier {
  idsBruts?: readonly (string | null | undefined)[];
  empreintes?: readonly string[];
}
export type VerdictPartout =
  | { opposee: false; jeton: JetonNonOpposee }
  | { opposee: true; source: "registre" | "etat" | "doute" };

/** Message FIXE : jamais d'identifiant, d'empreinte ni de secret. */
export class ErreurOppositionIllisible extends Error {
  readonly code:
    | "personne_inconnue"
    | "registre"
    | "conversations"
    | "site_perime";
  constructor(
    code: "personne_inconnue" | "registre" | "conversations" | "site_perime",
  ) {
    super("Opposition illisible : la personne ne peut pas être vérifiée.");
    this.name = "ErreurOppositionIllisible";
    this.code = code;
  }
}

interface ConversationLue {
  etat?: unknown;
  douteOpposition?: unknown;
}
const estObjet = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);

/**
 * Cette personne s'est-elle opposée DANS N'IMPORTE QUEL espace, registre OU état de conversation ? LECTURE SEULE (aucune écriture,
 * aucun alias, aucun verrou, aucun journal). FERMÉ : rien à vérifier, secret absent, registre ou conversations illisibles => on LÈVE.
 * Toute erreur est propagée, jamais convertie en « non opposée ». NE JAMAIS appeler sous `sousVerrou`.
 */
export async function personneOpposeePartout(
  p: PersonneAVerifier,
  o?: Options & { maintenantMs?: number; douteBloque?: boolean },
): Promise<VerdictPartout> {
  const bruts = [
    ...new Set(
      (p.idsBruts ?? []).filter(
        (x): x is string => typeof x === "string" && x.length > 0,
      ),
    ),
  ];
  const fournies = (p.empreintes ?? []).filter(
    (x) => typeof x === "string" && x.length > 0,
  );
  if (bruts.length === 0 && fournies.length === 0)
    throw new ErreurOppositionIllisible("personne_inconnue");
  const c = cles(o);
  const conv: unknown = await lireParametre<unknown>(
    PARAM_CONVERSATIONS_ETAT,
    {},
  );
  const alias: unknown = await lireParametre<unknown>(
    `${PARAM_CONVERSATIONS_ETAT}.alias`,
    {},
  );
  // Ordre : l'écrivain pose d'abord le registre PUIS l'état « oppose » ; on lit donc les conversations AVANT le registre.
  const liste: unknown = await lireParametre<unknown>(
    PARAM_OPPOSITIONS_MOTS,
    [],
  );
  if (!Array.isArray(liste)) throw new ErreurOppositionIllisible("registre");
  verifierKids(liste as LigneOpposition[], c);
  if (!estObjet(conv) || !estObjet(alias))
    throw new ErreurOppositionIllisible("conversations");

  const candidats = new Set<string>(fournies);
  for (const r of bruts) {
    for (const e of ESPACES_TOUS)
      for (const f of candidatsEmpreinte(c, e, r)) candidats.add(f);
  }
  // Table d'alias : alias -> clé de conversation. Une entrée peut aussi porter sa propre liste `alias`.
  const propres = (k: string): string[] => {
    const e = conv[k];
    const l = estObjet(e) ? e.alias : undefined;
    if (l === undefined) return [];
    // Liste d'alias mal formée : erreur FERMÉE (jamais ignorée en silence).
    if (!Array.isArray(l) || l.some((x) => typeof x !== "string"))
      throw new ErreurOppositionIllisible("conversations");
    return l as string[];
  };
  const touchees = new Set<string>();
  for (const k of Object.keys(conv))
    if (
      candidats.has(k) ||
      candidats.has(racineDe(k)) ||
      propres(k).some((x) => candidats.has(x))
    )
      touchees.add(k);
  for (const [a, cible] of Object.entries(alias)) {
    // Entrée mal formée : erreur FERMÉE, qu'elle concerne cette personne ou non (jamais ignorée en silence).
    if (typeof cible !== "string")
      throw new ErreurOppositionIllisible("conversations");
    if (!candidats.has(a)) continue;
    // Alias vers une conversation absente : ignoré, mais la cible reste un candidat (une opposition inscrite sous elle compte).
    candidats.add(cible);
    if (Object.hasOwn(conv, cible)) touchees.add(cible);
    // Cible = racine d'un dossier : toutes les clés `racine|…` sont touchées (même sans enregistrement propre).
    for (const k of Object.keys(conv))
      if (racineDe(k) === cible) touchees.add(k);
  }
  let etat = false;
  let doute = false;
  for (const k of touchees) {
    candidats.add(k);
    candidats.add(racineDe(k));
    for (const x of propres(k)) candidats.add(x);
    for (const [a, cible] of Object.entries(alias))
      if (cible === k) candidats.add(a);
    const e = conv[k];
    if (!estObjet(e)) throw new ErreurOppositionIllisible("conversations");
    const ec = e as ConversationLue;
    if (ec.etat === "oppose") etat = true;
    if (ec.douteOpposition === true && o?.douteBloque === true) doute = true;
  }
  const dansRegistre = trouver(liste as LigneOpposition[], [...candidats]) >= 0;
  if (etat) return { opposee: true, source: "etat" };
  if (dansRegistre) return { opposee: true, source: "registre" };
  if (doute) return { opposee: true, source: "doute" };
  return { opposee: false, jeton: emettreJetonNonOpposee() };
}
