/**
 * RÉPARATIONS SANS IA DU CAS CONCRET (S-04a-v19b). Fonctions PURES : ni horloge, ni hasard, ni réseau, ni réglage.
 * Fichier écrit à part : rien ne l'appelle encore (le branchement viendra avec S-04a).
 *
 *  - `remettreMarque` : remet « axion-ia.com » sur chaque écran qui l'a perdue (refus R09).
 *  - `calageApproche` : répartit les écrans sur la voix quand les mots arrivent dans le désordre (refus « l'écran ne dure pas »).
 */
import type { MotCalage } from "@/briques/motion/calage";
import { cleMot } from "@/domaine/prononciations";
import { IMAGE_MS, calerFiche, type OptionsCalageCasConcret, type ResultatCalageCasConcret } from "./calage";
import { problemesEcran, motsLus, validerSchemaFiche, type Ecran, type EcranFin, type FicheEcrans, type FinPlanifiee } from "./fiche";
import { ECRAN_DUREE_MIN_MS, MARQUE } from "./regles";

/** Rend une copie de la fiche où chaque écran porte la marque ; la fiche reçue n'est pas modifiée. */
export function remettreMarque(fiche: FicheEcrans): { fiche: FicheEcrans; faits: string[] } {
  const faits: string[] = [];
  const ecrans = fiche.ecrans.map((e) => {
    if (e.marque.trim() === MARQUE) return { ...e };
    faits.push(`Écran ${e.id} : marque remise.`);
    return { ...e, marque: MARQUE };
  }) as FicheEcrans["ecrans"];
  return { fiche: { ...fiche, ecrans }, faits };
}

const RESERVE = "Calage approché : écrans répartis sur la voix sans heures exactes. À vérifier.";
const aLImage = (v: number) => Math.round(v / IMAGE_MS) * IMAGE_MS;

/**
 * À n'utiliser QUE si `calerFiche` a refusé pour « l'écran ne dure pas ». Même signature que `calerFiche`.
 * Les autres refus (aucun mot à caler, événement au-delà des mots, heures incohérentes, aucun mot entendu) sont rendus
 * tels quels : un refus de contenu n'est jamais avalé. Sinon : la voix, de 0 à la fin du dernier mot plus la tenue,
 * est partagée entre les écrans au prorata de leurs mots, au moins 1 000 ms chacun, à l'image (40 ms).
 */
export function calageApproche(
  fiche: FicheEcrans,
  fin: FinPlanifiee | null,
  motsDits: readonly MotCalage[],
  options: OptionsCalageCasConcret,
): ResultatCalageCasConcret & { reserve?: string } {
  const exact = calerFiche(fiche, fin, motsDits, options);
  if (exact.ok || !exact.problemes.every((p) => p.includes("l'écran ne dure pas"))) return exact;

  const ecrans: Ecran[] = [...fiche.ecrans, ...(fin?.ecrans ?? [])];
  const poids = ecrans.map((e) => motsLus(e.texteDit).length);
  const dits = motsDits.filter((d) => cleMot(d.mot) !== "");
  const finVoixMs = Math.max(...dits.map((d) => Math.round(d.finSec * 1000)));
  const total = aLImage(finVoixMs + Math.round(options.finApresDernierMotSec * 1000));
  const reste = total - ecrans.length * ECRAN_DUREE_MIN_MS;
  if (reste < 0) return { ok: false, problemes: [`La voix (${total} ms) est trop courte pour donner ${ECRAN_DUREE_MIN_MS} ms à chacun des ${ecrans.length} écrans.`] };

  const somme = poids.reduce((a, b) => a + b, 0);
  const debuts: number[] = [];
  let cumul = 0;
  ecrans.forEach((_, k) => {
    debuts.push(k * ECRAN_DUREE_MIN_MS + aLImage((reste * cumul) / somme));
    cumul += poids[k];
  });
  const fins = ecrans.map((_, k) => (k + 1 < debuts.length ? debuts[k + 1] : total));

  const calees = ecrans.map((e, k) => ({ ...e, debutMs: debuts[k], finMs: fins[k] }) as Ecran);
  const evenements = ecrans.flatMap((e, k) =>
    e.evenements.map((ev) => ({
      ecranId: e.id,
      cible: ev.cible,
      debutMs: Math.min(fins[k] - IMAGE_MS, Math.max(debuts[k], debuts[k] + aLImage(((fins[k] - debuts[k]) * ev.surMot) / poids[k]))),
    })),
  );
  const corps = calees.slice(0, fiche.ecrans.length) as FicheEcrans["ecrans"];
  const v = validerSchemaFiche({ ...fiche, ecrans: corps });
  if (!v.ok) return { ok: false, problemes: v.problemes.map((p) => p.message) };
  const finCalee: FinPlanifiee | null = fin ? { ...fin, ecrans: calees.slice(fiche.ecrans.length) as EcranFin[] } : null;
  if (finCalee) {
    const horaires = finCalee.ecrans.flatMap((e, k) => problemesEcran(e, k === 0 ? corps[corps.length - 1] : finCalee.ecrans[k - 1]));
    if (horaires.length) return { ok: false, problemes: horaires.map((p) => p.message) };
  }
  return { ok: true, fiche: v.fiche, fin: finCalee, evenements, dureeMs: total, ecarts: [], reserve: RESERVE };
}
