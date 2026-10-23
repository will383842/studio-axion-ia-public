/**
 * CONTEXTE COMMUN DE MARQUE (générateur, plan v5 B.2.1 `ContexteAxion`, B.0 n° 57, lot G2).
 *
 * Versionné, jamais effacé : chaque changement écrit une NOUVELLE version (`contexte-axion-v<N>`) ; la plus haute fait foi.
 * - Mes positions : des RÉFÉRENCES vers des matières « avis » (aucune copie).
 * - Mes thèmes : la proposition tirée de la Bible reste à part (`piliersProposes`) ; un thème n'est appliqué qu'après
 *   le toucher de Will.
 * - Mes interdits : les ordres permanents de Will, préremplis (G1a) puis RELUS à la source en G2 ; ils ne font que
 *   restreindre, ils s'appliquent donc d'office et se confirment d'un toucher.
 * - Carnet de voix : expressions tirées des textes de Will par sous-chaîne exacte, validées d'un toucher.
 */
import "server-only";
import type { ContexteAxion, Id } from "@/domaine/types";
import { proposerCarnetVoix, type ExpressionProposee } from "@/domaine/voix";
import { PILIERS_ACTIVITES_AXION } from "@/donnees/generateur/domaine-axion";
import { exigerSession } from "./auth";
import { etape19Generateur } from "./migrations/etape-19-generateur";
import { depots, ErreurStudio, horodatage, journaliser, maintenant, sousVerrou } from "./_commun";

/**
 * Ordres permanents relus le 02/10/2026 dans les notes de Will, en plus des 5 préremplis par la migration (G1a). Chacun
 * cite sa source ; aucun n'est ajouté par supposition. Proposés à l'écran, ils n'entrent qu'au toucher de Will.
 */
export const INTERDITS_RELUS_G2: ContexteAxion["interdits"] = [
  {
    id: "interdit-sans-engagement-seul",
    texte: "Le diagnostic de l'appel est « gratuit et sans engagement » : jamais « sans engagement » seul.",
    regex: "(?<!gratuit et )(?<!gratuit, )\\bsans engagement\\b",
    origine: "Ordre de Will du 21/09/2026",
  },
];

/**
 * E2E-2 données n° 3 : les règles du générateur (tournures bloquantes, règles datées, interdits de marque, fiche de
 * style) sont celles de la production, QUEL QUE SOIT le mode des données. En production, la migration 19 les sème au
 * démarrage ; sans base (données en mémoire, essais à l'écran), elles ne l'étaient qu'à l'ouverture de « Ma voix » :
 * l'écriture se faisait alors sans ses garde-fous. Appelée avant chaque écriture : la migration est idempotente,
 * jouée au plus une fois par jeu de données (un contexte ET des tournures présents : rien à faire).
 */
const CLE_REGLES = Symbol.for("studio-axion-ia.regles-generateur");
type AvecRegles = typeof globalThis & { [CLE_REGLES]?: WeakMap<object, Promise<void>> };
export async function assurerReglesGenerateur(): Promise<void> {
  const d = depots();
  const g = globalThis as AvecRegles;
  const faits = (g[CLE_REGLES] ??= new WeakMap());
  let p = faits.get(d);
  if (!p) {
    p = (async () => {
      if ((await d.contexteAxion.compter()) > 0 && (await d.tournesInterdites.compter()) > 0) return;
      await etape19Generateur(d, maintenant());
    })();
    faits.set(d, p);
    p.catch(() => faits.delete(d));
  }
  await p;
}

/** Contexte courant : la plus haute version. */
export async function lireContexte(): Promise<ContexteAxion> {
  await exigerSession();
  const c = await courant();
  // Vérification E2E n° 1, n° 28 (addendum §2 quater 1) : seules les activités réelles d'Axion-IA sont proposées comme
  // thèmes. Les 5 anciens thèmes de la Bible (« L'IA au quotidien », « Former les équipes »…), en doublon, ne sont plus
  // proposés ; rien n'est effacé (ils restent dans la donnée, et un thème déjà validé par Will reste le sien).
  const activites = new Set(PILIERS_ACTIVITES_AXION.map((p) => p.id));
  return { ...c, piliersProposes: (c.piliersProposes ?? []).filter((p) => activites.has(p.id)) };
}

async function courant(): Promise<ContexteAxion> {
  let tous = await depots().contexteAxion.lister();
  if (!tous.length) {
    // Base sans la migration du générateur (données en mémoire, développement) : la migration est idempotente,
    // elle crée le contexte v0 (rien de validé) sans rien écraser.
    await etape19Generateur(depots(), maintenant());
    tous = await depots().contexteAxion.lister();
  }
  const c = tous.sort((a, b) => b.version - a.version)[0];
  if (!c) throw new ErreurStudio("INTROUVABLE", "Le contexte de marque n'est pas encore créé (migration du générateur).");
  return c;
}

/** Écrit une nouvelle version (sous verrou : deux touchers rapides ne prennent pas le même numéro). */
async function nouvelleVersion(changer: (c: ContexteAxion) => Partial<ContexteAxion>, message: string): Promise<ContexteAxion> {
  const suite = await sousVerrou(async () => {
    const c = await courant();
    const patch = changer(c);
    const v: ContexteAxion = { ...c, ...patch, id: `contexte-axion-v${c.version + 1}`, version: c.version + 1, ...horodatage() };
    await depots().contexteAxion.enregistrer(v);
    return v;
  });
  await journaliser("contexte", `${message} (contexte v${suite.version})`);
  return suite;
}

/* --- Mes positions -------------------------------------------------- */

/** Marque (ou démarque) un avis comme position de marque : une référence, jamais une copie. */
export async function marquerPosition(matiereId: Id, oui: boolean): Promise<ContexteAxion> {
  await exigerSession();
  const m = await depots().matieres.obtenir(matiereId);
  if (!m) throw new ErreurStudio("INTROUVABLE", "Cette matière n'existe plus.");
  if (m.type !== "avis-will") throw new ErreurStudio("PAS_UN_AVIS", "Seul un avis tranché peut devenir une position.");
  if (oui && (m.retrait || m.statut !== "validee")) throw new ErreurStudio("INDISPONIBLE", "Cet avis n'est pas disponible.");
  await depots().matieres.modifier(matiereId, { positionDeMarque: oui || undefined });
  return nouvelleVersion((c) => ({ positionIds: oui ? [...new Set([...c.positionIds, matiereId])] : c.positionIds.filter((x) => x !== matiereId) }), oui ? "Position ajoutée" : "Position retirée");
}

/* --- Mes thèmes ----------------------------------------------------- */

export async function validerPilier(id: string): Promise<ContexteAxion> {
  await exigerSession();
  const c = await courant();
  if (c.piliers.some((p) => p.id === id)) return c;
  const propose = c.piliersProposes?.find((p) => p.id === id);
  if (!propose) throw new ErreurStudio("INTROUVABLE", "Ce thème n'est pas proposé.");
  return nouvelleVersion((x) => ({ piliers: [...x.piliers, propose], valideeParWillLe: maintenant() }), `Thème validé : ${propose.nom}`);
}

/** Retire un thème validé (il reste dans les versions précédentes et dans la proposition). */
export async function retirerPilier(id: string): Promise<ContexteAxion> {
  await exigerSession();
  return nouvelleVersion((c) => ({ piliers: c.piliers.filter((p) => p.id !== id) }), "Thème retiré");
}

/** Thème dicté par Will (validé d'office). */
export async function ajouterPilier(nom: string, motsCles: string[] = []): Promise<ContexteAxion> {
  await exigerSession();
  const n = nom.trim();
  if (!n) throw new ErreurStudio("VIDE", "Nommez le thème.");
  const id = n
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return nouvelleVersion((c) => (c.piliers.some((p) => p.id === id) ? {} : { piliers: [...c.piliers, { id, nom: n, motsCles: motsCles.length ? motsCles : n.toLowerCase().split(/\s+/).filter((m) => m.length > 3) }], valideeParWillLe: maintenant() }), `Thème ajouté : ${n}`);
}

/* --- Mes interdits -------------------------------------------------- */

export interface VueInterdits {
  /** Dans le contexte (appliqués d'office) ; `confirmeLe` vide : à confirmer d'un toucher. */
  actifs: ContexteAxion["interdits"];
  /** Relus à la source en G2, pas encore dans le contexte : proposés. */
  proposes: ContexteAxion["interdits"];
}

export async function lireInterdits(): Promise<VueInterdits> {
  await exigerSession();
  const c = await courant();
  return { actifs: c.interdits, proposes: INTERDITS_RELUS_G2.filter((i) => !c.interdits.some((x) => x.id === i.id)) };
}

/** Confirme un interdit d'un toucher (préremplis), ou ajoute un interdit relu (proposé) déjà confirmé. */
export async function confirmerInterdit(id: string): Promise<ContexteAxion> {
  await exigerSession();
  const c = await courant();
  const present = c.interdits.find((i) => i.id === id);
  if (present?.confirmeLe) return c;
  const relu = INTERDITS_RELUS_G2.find((i) => i.id === id);
  if (!present && !relu) throw new ErreurStudio("INTROUVABLE", "Cet interdit n'existe pas.");
  const le = maintenant();
  return nouvelleVersion(
    (x) => ({ interdits: present ? x.interdits.map((i) => (i.id === id ? { ...i, confirmeLe: le } : i)) : [...x.interdits, { ...relu!, confirmeLe: le }] }),
    `Interdit confirmé : ${id}`,
  );
}

/* --- Carnet de voix ------------------------------------------------- */

/** Expressions proposées depuis les textes de Will retenus (sous-chaîne exacte), hors celles déjà dans le carnet. */
export async function proposerExpressions(): Promise<ExpressionProposee[]> {
  await exigerSession();
  const [c, textes] = await Promise.all([courant(), depots().exemplesStyle.lister((e) => e.retenu && !e.archiveLe)]);
  const deja = new Set(c.carnetVoix.map((x) => x.expression.toLowerCase()));
  return proposerCarnetVoix(textes).filter((e) => !deja.has(e.expression.toLowerCase()));
}

/** Valide une expression d'un toucher : elle doit être une sous-chaîne exacte du texte source. */
export async function validerExpression(expression: string, texteSourceId: Id): Promise<ContexteAxion> {
  await exigerSession();
  const source = await depots().exemplesStyle.obtenir(texteSourceId);
  if (!source || !source.texte.includes(expression)) throw new ErreurStudio("VERBATIM", "Cette expression ne figure pas mot pour mot dans votre texte.");
  return nouvelleVersion(
    (c) => (c.carnetVoix.some((x) => x.expression === expression) ? {} : { carnetVoix: [...c.carnetVoix, { expression, texteSourceId, validee: true }] }),
    "Expression ajoutée au carnet",
  );
}
