/**
 * Santé du calendrier (L5-05) : repère les créneaux jamais envoyés ou en retard. Fonction PURE, aucun appel.
 * Seuil : strictement plus de 20 minutes après l'heure prévue (+19 min = rien, +21 min = alerte).
 * Une seule alerte par créneau (clé « alerte:<id> ») : un créneau déjà alerté n'en reçoit pas d'autre.
 */
import type { StatutPlan } from "@/domaine/plan-editorial/types";

export const SEUIL_RETARD_MINUTES = 20;

export interface CreneauSante {
  id: string;
  statut: StatutPlan;
  /** Instants ISO UTC par réseau. */
  heuresParReseau: Partial<Record<string, string | undefined>>;
}

export interface AlerteCalendrier {
  cle: string;
  creneauId: string;
  retardMinutes: number;
  motif: string;
}

export function evaluerSante(creneaux: readonly CreneauSante[], maintenant: string, dejaAlertes: ReadonlySet<string> = new Set()): AlerteCalendrier[] {
  const now = Date.parse(maintenant);
  if (Number.isNaN(now)) throw new Error("Instant « maintenant » invalide : une date ISO est attendue.");
  const alertes: AlerteCalendrier[] = [];
  for (const c of creneaux) {
    if (c.statut !== "programme" && c.statut !== "valide") continue;
    const cle = `alerte:${c.id}`;
    if (dejaAlertes.has(cle)) continue;
    const heures = Object.values(c.heuresParReseau).filter((h): h is string => Boolean(h)).map((h) => Date.parse(h)).filter((t) => !Number.isNaN(t));
    if (!heures.length) continue;
    const retard = Math.floor((now - Math.min(...heures)) / 60000);
    if (retard <= SEUIL_RETARD_MINUTES) continue;
    const motif = c.statut === "valide" ? `Jamais programmé : ${retard} min de retard.` : `Programmé mais non publié : ${retard} min de retard.`;
    alertes.push({ cle, creneauId: c.id, retardMinutes: retard, motif });
  }
  return alertes;
}
