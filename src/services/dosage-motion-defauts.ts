/**
 * Service des défauts du dosage de l'animation par générateur (X3-10a).
 * Tout éteint : tant que `dosageMotion.actif` n'est pas exactement `true`, aucune écriture.
 * Ports injectables (lire, écrire, session, journal) pour les tests. Rien n'appelle ce service.
 * Aucun appel payant : ni fournisseur, ni rendu, ni réseau.
 */
import "server-only";
import { CRANS_PERMIS } from "@/briques/dosage-motion/crans";
import { CLE_DEFAUTS, defautsLus, dosageActif, type LireReglage } from "@/briques/dosage-motion/reglage";
import type { DosageMotion, IdGenerateurDosage } from "@/briques/dosage-motion/types";
import { ecrireParametre, journaliser, lireParametre } from "./_commun";
import { exigerSession } from "./auth";

export interface PortsDefautsDosage {
  lire?: LireReglage;
  ecrire?: (id: string, valeur: unknown) => Promise<void>;
  session?: () => Promise<unknown>;
  journaliser?: (type: string, message: string) => Promise<void>;
}

export type ResultatDefautDosage = { ok: true } | { ok: false; message: string };

const lecteur = (p?: PortsDefautsDosage): LireReglage => p?.lire ?? ((id, d) => lireParametre<unknown>(id, d));

/** Défauts actuels par générateur (lecture seule). */
export async function lireDefautsDosage(ports?: PortsDefautsDosage): Promise<Record<IdGenerateurDosage, DosageMotion>> {
  return defautsLus(lecteur(ports));
}

export async function definirDefautDosage(
  generateur: IdGenerateurDosage,
  cran: DosageMotion,
  ports?: PortsDefautsDosage,
): Promise<ResultatDefautDosage> {
  await (ports?.session ?? exigerSession)();
  const lire = lecteur(ports);
  if (!(await dosageActif(lire))) return { ok: false, message: "Pas encore actif." };
  const permis = Object.prototype.hasOwnProperty.call(CRANS_PERMIS, generateur) ? CRANS_PERMIS[generateur] : undefined;
  if (!permis || !permis.includes(cran)) return { ok: false, message: "Ce choix n'existe pas pour ce générateur." };
  const actuels = await defautsLus(lire);
  if (actuels[generateur] === cran) return { ok: true };
  await (ports?.ecrire ?? ecrireParametre)(CLE_DEFAUTS, { ...actuels, [generateur]: cran });
  await (ports?.journaliser ?? ((t, m) => journaliser(t, m)))("dosage-motion", `Dosage par défaut de ${generateur} : ${cran}`);
  return { ok: true };
}
