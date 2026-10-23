/**
 * SANTÉ DU SERVEUR (vérification de bout en bout n° 2, données n° 8) : la sonde publique `/api/sante` vérifie
 * maintenant la BASE, et pas seulement que le processus répond. N'expose rien d'autre que des états courts.
 * Audit D, B9 : elle vérifie aussi la BOUCLE DE FOND. Un tour bloqué laissait la boucle morte sans bruit, la sonde
 * répondait 200 : désormais, aucun tour terminé depuis 3 min (hors délai de grâce au démarrage) → 503.
 */
import "server-only";
import { sourceDesBases } from "@/donnees/bases-usine";
import { sonderBase } from "@/donnees/memoire";
import { delaiDepasse } from "@/lib/demarrage";
import { versionDuCode } from "@/lib/version-code";
import { ecrireParametre, lireParametre } from "./_commun";
import { etatBoucle, type EtatBoucle } from "./_boucle-etat";

/** Aucun tour terminé depuis plus longtemps : boucle déclarée bloquée. */
export const BOUCLE_MUETTE_MAX_MS = 3 * 60_000;

/**
 * - `ok` : un tour s'est terminé il y a moins de 3 min ;
 * - `demarrage` : boucle (ou attente du verrou) lancée il y a moins de 3 min, aucun tour terminé encore ;
 * - `inactive` : la boucle ne tourne pas dans ce processus (coupure de secours STUDIO_BOUCLE=0, développement) ;
 * - `bloquee` : aucun tour terminé depuis plus de 3 min ;
 * - `verrou-ailleurs` : une autre instance tient la boucle depuis plus de 3 min (deux studios en même temps).
 */
export type EtatBoucleSante = "ok" | "demarrage" | "inactive" | "bloquee" | "verrou-ailleurs";

/** PUR : état de la boucle pour la sonde. */
export function santeBoucle(e: Pick<EtatBoucle, "active" | "dernierTour" | "demarreLe" | "attenteVerrouDepuis">, instant = Date.now()): EtatBoucleSante {
  if (e.active) {
    if (e.dernierTour !== undefined) return instant - e.dernierTour > BOUCLE_MUETTE_MAX_MS ? "bloquee" : "ok";
    return e.demarreLe !== undefined && instant - e.demarreLe > BOUCLE_MUETTE_MAX_MS ? "bloquee" : "demarrage";
  }
  if (e.attenteVerrouDepuis !== undefined) return instant - e.attenteVerrouDepuis > BOUCLE_MUETTE_MAX_MS ? "verrou-ailleurs" : "demarrage";
  return "inactive";
}

/** Réglage : l'empreinte des bases que cette mise en ligne DOIT embarquer (ADR 0001, garde d'exécution). */
export const CLE_EMPREINTE_BASES = "bases.empreinte";

/**
 * Garde d'exécution des bases : `ok` = la copie embarquée a l'empreinte attendue ; `ecart` = une autre copie est en ligne ;
 * `non-defini` = aucune empreinte attendue enregistrée. Ne rend jamais la sonde `503` : un redémarrage ne corrigerait rien.
 */
export type EtatBasesSante = { empreinte: string; attendue: string | null; etat: "ok" | "ecart" | "non-defini" };

/** PUR. Compare l'empreinte embarquée à celle du réglage. */
export function santeBases(embarquee: string, attendue: string | null): EtatBasesSante {
  return { empreinte: embarquee, attendue, etat: attendue === null ? "non-defini" : attendue === embarquee ? "ok" : "ecart" };
}

/** À appeler par l'outillage de mise en ligne après une resynchronisation voulue des bases (écrit l'empreinte attendue). */
export async function enregistrerEmpreinteBasesAttendue(empreinte: string): Promise<void> {
  await ecrireParametre(CLE_EMPREINTE_BASES, empreinte);
}

/** `version` : le commit en ligne (`versionDuCode`), « inconnu » si l'image a été construite sans lui. */
export type EtatSante = { ok: boolean; base: "ok" | "memoire" | "injoignable"; boucle: EtatBoucleSante; version: string; bases: EtatBasesSante };

/** Une base qui ne répond pas en 3 s est déclarée injoignable (la sonde de Docker coupe à 5 s). */
export async function etatSante(delaiMs = 3000): Promise<EtatSante> {
  const boucle = santeBoucle(etatBoucle());
  const boucleOk = boucle !== "bloquee" && boucle !== "verrou-ailleurs";
  const version = versionDuCode(process.env);
  const embarquee = sourceDesBases().empreinte;
  try {
    const base = await delaiDepasse(sonderBase(), delaiMs);
    const attendue = await delaiDepasse(lireParametre<string | null>(CLE_EMPREINTE_BASES, null), delaiMs).catch(() => null);
    return { ok: boucleOk, base, boucle, version, bases: santeBases(embarquee, attendue) };
  } catch {
    return { ok: false, base: "injoignable", boucle, version, bases: santeBases(embarquee, null) };
  }
}
