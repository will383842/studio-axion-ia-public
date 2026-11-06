/**
 * Personnes opposées (« stop », « arrêtez » écrit par la personne) : registre de mise à l'écart, par EMPREINTE de l'identifiant
 * opaque du contact (jamais l'identifiant lui-même, jamais d'adresse). Rien n'est jamais supprimé.
 */
import "server-only";
import { candidatsEmpreinte, contientEnTempsConstant, empreinteHeritee, empreintePersonne, ErreurEmpreinteIndisponible, lireClesEmpreinte, VARIABLE_SECRET_EMPREINTE, type EspacePersonne, type EtatCles } from "@/domaine/guide-reseau/empreinte-personne";
import { ecrireParametre, lireParametre, maintenant, sousVerrou } from "./_commun";

export const PARAM_OPPOSITIONS_MOTS = "mots.oppositions";
export interface LigneOpposition {
  id: string;
  le: string;
  transmise: boolean;
  /** Autres formes (clé courante) de la même personne, ajoutées après rotation. Aucune ligne n'est jamais supprimée. */
  alias?: string[];
}
/** HÉRITÉE, LECTURE SEULE : ancien SHA-256 tronqué. On n'écrit plus jamais sous cette forme (sauf appelant non migré sans secret). */
export const empreinteContact = (id: string): string => empreinteHeritee(id);

interface Options {
  env?: Record<string, string | undefined>;
}
const RE_KID = /^p1\.([0-9a-f]{8})\./;
const formes = (x: LigneOpposition): string[] => [x.id, ...(x.alias ?? [])];

/** Voie ancienne (appelant non migré, ni espace ni options, aucun secret posé) : comportement d'avant. */
const voieAncienne = (espace: unknown, o?: Options): boolean => espace === undefined && o === undefined && !(process.env[VARIABLE_SECRET_EMPREINTE] ?? "").trim();

function cles(o?: Options): Extract<EtatCles, { ok: true }> {
  const c = lireClesEmpreinte(o?.env ?? process.env);
  if (!c.ok) throw new ErreurEmpreinteIndisponible();
  return c;
}
function verifierKids(liste: LigneOpposition[], c: Extract<EtatCles, { ok: true }>): void {
  const connus = new Set([c.courante.kid, ...c.anciennes.map((a) => a.kid)]);
  for (const x of liste) for (const f of formes(x)) {
    const m = RE_KID.exec(f);
    if (m && !connus.has(m[1])) throw new ErreurEmpreinteIndisponible("Le registre contient une empreinte qu'aucun secret connu ne couvre.");
  }
}
/** Indice de la ligne reconnaissant la personne (parcours complet), -1 sinon. */
function trouver(liste: LigneOpposition[], candidats: string[]): number {
  let idx = -1;
  liste.forEach((x, i) => { if (contientEnTempsConstant(formes(x), candidats) && idx < 0) idx = i; });
  return idx;
}
/** Ajoute SOUS VERROU l'alias courant si la personne n'est reconnue que par une forme ancienne/héritée. */
async function ajouterAlias(idContact: string, espace: EspacePersonne, c: Extract<EtatCles, { ok: true }>): Promise<void> {
  await sousVerrou(async () => {
    const liste = await lireParametre<LigneOpposition[]>(PARAM_OPPOSITIONS_MOTS, []);
    const courante = empreintePersonne(c.courante, espace, idContact);
    const i = trouver(liste, candidatsEmpreinte(c, espace, idContact));
    if (i < 0 || contientEnTempsConstant(formes(liste[i]), [courante])) return;
    await ecrireParametre(PARAM_OPPOSITIONS_MOTS, liste.map((x, j) => (j === i ? { ...x, alias: [...(x.alias ?? []), courante] } : x)));
  });
}

/**
 * Cette personne s'est-elle déjà opposée ? Identifiant absent : non. Lecture impossible OU clés manquantes / registre non couvert :
 * l'ERREUR EST PROPAGÉE (jamais « non opposée » par défaut).
 */
export async function personneOpposee(idContact: string | null | undefined, espace?: EspacePersonne, o?: Options): Promise<boolean> {
  if (!idContact) return false;
  const liste = await lireParametre<LigneOpposition[]>(PARAM_OPPOSITIONS_MOTS, []);
  if (voieAncienne(espace, o)) {
    const id = empreinteContact(idContact);
    return liste.some((x) => x.id === id);
  }
  const c = cles(o);
  const sp = espace ?? "zernio-contact";
  verifierKids(liste, c);
  const candidats = candidatsEmpreinte(c, sp, idContact);
  const i = trouver(liste, candidats);
  if (i < 0) return false;
  if (!contientEnTempsConstant(formes(liste[i]), [candidats[0]])) await ajouterAlias(idContact, sp, c);
  return true;
}

/** Met la personne à l'écart (une seule ligne par personne). Rend l'empreinte réellement enregistrée (forme p1). */
export async function enregistrerOpposition(idContact: string, espace?: EspacePersonne, o?: Options): Promise<string> {
  if (voieAncienne(espace, o)) {
    return sousVerrou(async () => {
      const liste = await lireParametre<LigneOpposition[]>(PARAM_OPPOSITIONS_MOTS, []);
      const id = empreinteContact(idContact);
      if (!liste.some((x) => x.id === id)) await ecrireParametre(PARAM_OPPOSITIONS_MOTS, [...liste, { id, le: maintenant(), transmise: false }]);
      return id;
    });
  }
  const c = cles(o);
  const sp = espace ?? "zernio-contact";
  const courante = empreintePersonne(c.courante, sp, idContact);
  return sousVerrou(async () => {
    const liste = await lireParametre<LigneOpposition[]>(PARAM_OPPOSITIONS_MOTS, []);
    verifierKids(liste, c);
    const i = trouver(liste, candidatsEmpreinte(c, sp, idContact));
    if (i < 0) await ecrireParametre(PARAM_OPPOSITIONS_MOTS, [...liste, { id: courante, le: maintenant(), transmise: false }]);
    else if (!contientEnTempsConstant(formes(liste[i]), [courante])) {
      await ecrireParametre(PARAM_OPPOSITIONS_MOTS, liste.map((x, j) => (j === i ? { ...x, alias: [...(x.alias ?? []), courante] } : x)));
    }
    return courante;
  });
}

/** Comptes seulement : jamais d'empreinte. */
export async function etatRegistreEmpreintes(o?: Options): Promise<{ lignesParKid: Record<string, number>; heritees: number; kidsInconnus: string[] }> {
  const liste = await lireParametre<LigneOpposition[]>(PARAM_OPPOSITIONS_MOTS, []);
  const c = lireClesEmpreinte(o?.env ?? process.env);
  const connus = new Set(c.ok ? [c.courante.kid, ...c.anciennes.map((a) => a.kid)] : []);
  const lignesParKid: Record<string, number> = {};
  const inconnus = new Set<string>();
  let heritees = 0;
  for (const x of liste) {
    const m = RE_KID.exec(x.id);
    if (!m) { heritees++; continue; }
    lignesParKid[m[1]] = (lignesParKid[m[1]] ?? 0) + 1;
    if (!connus.has(m[1])) inconnus.add(m[1]);
  }
  return { lignesParKid, heritees, kidsInconnus: [...inconnus].sort() };
}
