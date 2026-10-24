/**
 * CAS RETIRÉS : lecture, retrait et remise. SERVEUR UNIQUEMENT. Les règles sont dans `domaine/cas-retires.ts` (pur). Ce service
 * ne fabrique rien, ne dépense rien : il n'écrit que le réglage `casConcret.casRetires` (`{ [casId]: { retireLe, remisLe?, titre } }`),
 * jamais une vidéo, jamais un cas. Rien n'est supprimé : « Remettre » écrit `remisLe` à côté du retrait.
 */
import "server-only";
import { casRetires, estRetire, PHRASE_RELANCE_CAS_RETIRE, type RetraitCas } from "@/domaine/cas-retires";
import { casIdDeLaVideo } from "@/domaine/cas-traites";
import { creerVerrou, ecrireParametre, ErreurStudio, journaliser, lireParametre, maintenant } from "./_commun";
import { exigerSession } from "./auth";
import { trouverCasAutorise } from "./cas-concret-stock-acces";

export { PHRASE_CAS_RETIRE, PHRASE_RELANCE_CAS_RETIRE } from "@/domaine/cas-retires";

export const CLE_CAS_RETIRES = "casConcret.casRetires";

type Retraits = Record<string, RetraitCas>;

/** Lectures du service : remplaçables dans les tests. */
export interface SourcesCasRetires {
  lire(): Promise<Retraits>;
  ecrire(v: Retraits): Promise<void>;
  maintenant(): string;
}

const objet = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

export const SOURCES_CAS_RETIRES: SourcesCasRetires = {
  lire: async () => objet(await lireParametre<unknown>(CLE_CAS_RETIRES, {})) as Retraits,
  ecrire: (v) => ecrireParametre(CLE_CAS_RETIRES, v),
  maintenant,
};

const verrou = creerVerrou();

/** Les cas retirés maintenant. Lu frais à chaque appel. */
export async function lireCasRetires(src: SourcesCasRetires = SOURCES_CAS_RETIRES): Promise<Set<string>> {
  return casRetires(await src.lire());
}

/** Tout le réglage (pour la page « Cas retirés » : titres et dates). */
export async function lireRetraits(src: SourcesCasRetires = SOURCES_CAS_RETIRES): Promise<Retraits> {
  return objet(await src.lire()) as Retraits;
}

const idValide = (casId: unknown): casId is string => typeof casId === "string" && casId.length > 0 && casId.length <= 120;

/** Will retire un cas. Session exigée, journalisé. Idempotent : un cas déjà retiré ne réécrit rien. */
export async function retirerCas(casId: string, src: SourcesCasRetires = SOURCES_CAS_RETIRES): Promise<{ retireLe: string }> {
  await exigerSession();
  if (!idValide(casId)) throw new ErreurStudio("CAS_INCONNU", "Ce cas n'existe plus.");
  const cas = await trouverCasAutorise(casId);
  if (!cas) throw new ErreurStudio("CAS_INCONNU", "Ce cas n'existe plus.");
  return verrou(async () => {
    const lus = objet(await src.lire()) as Retraits;
    if (estRetire(lus[casId])) return { retireLe: lus[casId]!.retireLe };
    const retireLe = src.maintenant();
    await src.ecrire({ ...lus, [casId]: { ...lus[casId], retireLe, titre: cas.titre } });
    await journaliser("cas-concret", `Cas retiré : ${cas.titre}`, { type: "cas-concret", id: casId });
    return { retireLe };
  });
}

/** Will remet un cas retiré : il est de nouveau proposé. Session exigée, journalisé. Rien n'est effacé. */
export async function remettreCas(casId: string, src: SourcesCasRetires = SOURCES_CAS_RETIRES): Promise<{ remisLe: string }> {
  await exigerSession();
  if (!idValide(casId)) throw new ErreurStudio("CAS_INCONNU", "Ce cas n'existe plus.");
  return verrou(async () => {
    const lus = objet(await src.lire()) as Retraits;
    const ancien = lus[casId];
    if (!estRetire(ancien)) throw new ErreurStudio("CAS_INCONNU", "Ce cas n'est pas retiré.");
    const remisLe = src.maintenant();
    await src.ecrire({ ...lus, [casId]: { ...ancien!, remisLe } });
    await journaliser("cas-concret", `Cas remis : ${ancien!.titre}`, { type: "cas-concret", id: casId });
    return { remisLe };
  });
}

/**
 * Garde de secours : les entrées de cette commande portent-elles un cas retiré ? Renvoie la phrase de refus (sinon `null`).
 * Porte B (cas né d'une description) : jamais retiré, `null`.
 */
export async function refusCasRetire(entrees: unknown, phrase: string = PHRASE_RELANCE_CAS_RETIRE, src: SourcesCasRetires = SOURCES_CAS_RETIRES): Promise<string | null> {
  const casId = casIdDeLaVideo({ entrees: objet(entrees) });
  if (!casId) return null;
  return (await lireCasRetires(src)).has(casId) ? phrase : null;
}
