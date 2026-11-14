/**
 * RC-14 : service du registre d'alertes (sans IA). Évalue le registre avec une horloge injectée, et ne signale à la
 * cloche existante (`creerNotification`, option « cloche seulement ») que les alertes pas encore signalées.
 * Aucun envoi sur téléphone, aucun e-mail : la cloche reçoit, rien d'autre. « Non évalué » ne notifie pas : il
 * s'affiche tel quel dans le registre.
 */
import { evaluerRegistre, type Horloge, type ResultatAlerte, type Sources } from "@/domaine/alertes/registre";

export type CreerNotification = (
  n: { type: "info"; titre: string; message: string; lien: string },
  options: { cloche: true },
) => Promise<unknown>;

export async function evaluerAlertes(sources: Sources, horloge: Horloge): Promise<ResultatAlerte[]> {
  return evaluerRegistre(sources, horloge);
}

/** Alertes à signaler : niveau « alerte » seulement, et jamais deux fois la même (identifiants déjà signalés exclus). */
export function alertesAnotifier(resultats: ResultatAlerte[], dejaSignalees: ReadonlySet<string>): ResultatAlerte[] {
  return resultats.filter((r) => r.niveau === "alerte" && !dejaSignalees.has(r.id));
}

/** Signale chaque alerte nouvelle à la cloche ; rend les identifiants signalés. */
export async function signalerParCloche(resultats: ResultatAlerte[], dejaSignalees: ReadonlySet<string>, creer: CreerNotification): Promise<string[]> {
  const faits: string[] = [];
  for (const r of alertesAnotifier(resultats, dejaSignalees)) {
    await creer({ type: "info", titre: r.libelle, message: r.detail, lien: "/calendrier" }, { cloche: true });
    faits.push(r.id);
  }
  return faits;
}

/** Branchement réel sur la cloche existante (chargé à l'usage : le service reste testable sans base). */
export async function creerNotificationCloche(n: Parameters<CreerNotification>[0], options: Parameters<CreerNotification>[1]): Promise<unknown> {
  const { creerNotification } = await import("./notifications");
  return creerNotification(n, options);
}
