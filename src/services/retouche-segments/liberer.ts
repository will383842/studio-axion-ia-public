/**
 * « Libérer la place » : efface, APRÈS CONFIRMATION, les seules scènes en cache (`studio/<env>/scenes/<vidéo>/`) que plus
 * aucune version ni aucun travail de la vidéo ne cite. Jamais automatique. Ports injectés (aucun appel réel).
 * Référencée = la clé apparaît n'importe où dans le `projetMontage` d'une version (toutes, archivées comprises) ou dans les
 * paramètres d'un travail de la vidéo (plus large que `cache.ts`, exprès : le tableau et le cas concret comptent aussi).
 */
export type VersionLiberer = { id: string; projetMontage?: unknown };
export type TravailLiberer = { statut: string; parametres?: unknown };
export type PortsLiberer = {
  env: string;
  lireVersions: (videoId: string) => Promise<VersionLiberer[]>;
  lireTravaux: (videoId: string) => Promise<TravailLiberer[]>;
  listerPrefixe: (prefixe: string) => Promise<string[]>;
  tailleObjet: (cle: string) => Promise<number | null>;
  supprimer: (cle: string) => Promise<void>;
  journaliser: (message: string) => void;
};
export type ScenesALiberer = { refus: null; cles: string[]; octets: number } | { refus: string };
export type ResultatLiberer = { refus: string | null; efface: number; echecs: number; octets: number };

const ID_VALIDE = /^[A-Za-z0-9_-]+$/;
export const REFUS_EN_COURS = "Une fabrication est en cours";

const phrase = (e: unknown) => (e instanceof Error ? e.message : String(e)).replace(/\s+/g, " ").slice(0, 200);

function texteDe(v: unknown): string {
  try {
    return JSON.stringify(v ?? null) ?? "";
  } catch {
    // Illisible : on ne peut pas prouver qu'une clé n'y est pas → tout est réputé cité.
    return "\u0000illisible";
  }
}

export async function scenesALiberer(videoId: string, ports: PortsLiberer): Promise<ScenesALiberer> {
  try {
    if (typeof ports.supprimer !== "function" || typeof ports.listerPrefixe !== "function") return { refus: "Le stockage ne permet pas d'effacer" };
    if (!ID_VALIDE.test(videoId) || !ID_VALIDE.test(ports.env)) return { refus: "Identifiant de vidéo invalide" };
    const prefixe = `studio/${ports.env}/scenes/${videoId}/`;
    const [versions, travaux] = await Promise.all([ports.lireVersions(videoId), ports.lireTravaux(videoId)]);
    if (travaux.some((t) => t.statut === "en_file" || t.statut === "en_cours")) return { refus: REFUS_EN_COURS };
    const lu = [...versions.map((v) => texteDe(v.projetMontage)), ...travaux.map((t) => texteDe(t.parametres))];
    if (lu.some((t) => t.startsWith("\u0000illisible"))) return { refus: "Une version n'a pas pu être lue" };
    const cites = lu.join("\n");
    const cles = [...new Set(await ports.listerPrefixe(prefixe))].filter((k) => k.startsWith(prefixe) && k.length > prefixe.length && !k.includes("..") && !cites.includes(k));
    let octets = 0;
    for (const k of cles) octets += (await ports.tailleObjet(k).catch(() => null)) ?? 0;
    return { refus: null, cles, octets };
  } catch (e) {
    return { refus: `Lecture impossible : ${phrase(e)}` };
  }
}

/** Efface la liste recalculée à l'instant, une par une. Sans `confirme === true` : rien. */
export async function libererPlace(videoId: string, ports: PortsLiberer, confirme: true): Promise<ResultatLiberer> {
  if (confirme !== true) return { refus: "Confirmation absente", efface: 0, echecs: 0, octets: 0 };
  const liste = await scenesALiberer(videoId, ports);
  if (liste.refus !== null) return { refus: liste.refus, efface: 0, echecs: 0, octets: 0 };
  let efface = 0;
  let echecs = 0;
  let octets = 0;
  for (const cle of liste.cles) {
    try {
      const taille = (await ports.tailleObjet(cle).catch(() => null)) ?? 0;
      await ports.supprimer(cle);
      efface++;
      octets += taille;
    } catch (e) {
      echecs++;
      ports.journaliser(`Libérer la place : « ${cle} » non effacé (${phrase(e)})`);
    }
  }
  ports.journaliser(`Libérer la place (${videoId}) : ${efface} fichier(s) effacé(s), ${echecs} en échec`);
  return { refus: null, efface, echecs, octets };
}
