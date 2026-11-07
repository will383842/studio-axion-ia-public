/**
 * Personnes opposées (« stop », « arrêtez » écrit par la personne) : registre de mise à l'écart, par EMPREINTE de l'identifiant
 * opaque du contact (jamais l'identifiant lui-même, jamais d'adresse). Rien n'est jamais supprimé.
 */
import "server-only";
import { candidatsEmpreinte, contientEnTempsConstant, empreinteHeritee, empreintePersonne, ErreurEmpreinteIndisponible, lireClesEmpreinte, type EspacePersonne, type EtatCles } from "@/domaine/guide-reseau/empreinte-personne";
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
const ETATS_EN_COURS = ["nouveau", "pub_ok", "m1_en_vol", "attente_email", "m1_a_verifier", "m2_envoye"];

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
 * n'est requis. Une forme déjà présente (id ou alias d'une ligne) n'ajoute rien. Échec fermé sans secret valide.
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
