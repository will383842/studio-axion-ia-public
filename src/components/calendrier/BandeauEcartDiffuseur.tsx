/**
 * RAP-3 · bandeau d'écart en haut du calendrier : visible seulement si des publications du diffuseur manquent au calendrier, ou si l'écart
 * n'a pas pu être vérifié (ou date de plus d'une heure). Lecture de la mesure locale : aucun appel au diffuseur depuis un écran.
 */
import type { EcartCalendrier } from "@/services/zernio";
import { mesureVerifieeRecente } from "@/services/constantes-introuvable";
import { BoutonRetirerIntrouvables } from "./BoutonRetirerIntrouvables";
import { BoutonRelireDiffuseur } from "./BoutonRelireDiffuseur";

const UNE_HEURE_MS = 3_600_000;

export type EtatBandeauEcart = "aucun" | "absents" | "non-verifie" | "introuvables";
type MesureBandeau = Pick<EcartCalendrier, "luLe" | "verifie" | "absents" | "motif"> & { introuvables?: number; jamaisMesuree?: boolean };

/** Mesure absente : rien à dire (le diffuseur n'est pas relié ou rien n'a encore été lu). */
export function etatBandeauEcart(ecart: MesureBandeau | null | undefined, maintenant: number): EtatBandeauEcart {
  if (!ecart) return "aucun";
  const lu = Date.parse(ecart.luLe);
  if (!ecart.verifie || !Number.isFinite(lu) || maintenant - lu > UNE_HEURE_MS) return "non-verifie";
  if (ecart.absents > 0) return "absents";
  return (ecart.introuvables ?? 0) > 0 ? "introuvables" : "aucun";
}

const HEURE_PARIS = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });

export const PHRASE_COMPTE_EN_PAUSE = "Compte du diffuseur en pause : paiement requis. Rien ne se publie tant que ce n'est pas réglé.";

/** Phrase de l'état « non vérifié » quand le diffuseur a dit pourquoi (compte en pause) ; `null` sinon. */
export function texteBandeauEcart(ecart: Pick<EcartCalendrier, "motif">, etat: EtatBandeauEcart): string | null {
  return etat === "non-verifie" && ecart.motif === "compte-suspendu" ? PHRASE_COMPTE_EN_PAUSE : null;
}

export function BandeauEcartDiffuseur({ ecart, maintenant }: { ecart: (EcartCalendrier & { introuvables?: number; retirables?: string[]; jamaisMesuree?: boolean; retraitRefuse?: string }) | null | undefined; maintenant: number }) {
  const etat = etatBandeauEcart(ecart, maintenant);
  if (etat === "aucun" || !ecart) return null;
  const n = ecart.absents;
  const introuvables = ecart.introuvables ?? 0;
  // Le bouton exige l'état « introuvables » ET une mesure vérifiée de moins d'une heure (jamais « non vérifié » ni « jamais mesuré »).
  const retirables = etat === "introuvables" && mesureVerifieeRecente(ecart, maintenant) ? (ecart.retirables ?? []) : [];
  const phraseEcart =
    texteBandeauEcart(ecart, etat) ??
    (etat === "introuvables"
      ? null
      : etat === "absents"
      ? `${n} publication${n > 1 ? "s" : ""} du diffuseur ${n > 1 ? "ne sont" : "n'est"} pas encore au calendrier.`
      : ecart.jamaisMesuree
      ? "L'écart avec le diffuseur n'a encore jamais été mesuré."
      : `L'écart avec le diffuseur n'a pas pu être vérifié${Number.isFinite(Date.parse(ecart.luLe)) ? ` (dernière lecture à ${HEURE_PARIS.format(new Date(ecart.luLe))}, heure de Paris)` : ""}.${n > 0 ? ` Au moins ${n} publication${n > 1 ? "s" : ""} manque${n > 1 ? "nt" : ""}.` : ""}`);
  const phraseIntrouvables = introuvables > 0 ? `${introuvables} publication${introuvables > 1 ? "s" : ""} du calendrier introuvable${introuvables > 1 ? "s" : ""} chez le diffuseur${retirables.length > 0 ? `, dont ${retirables.length} retirable${retirables.length > 1 ? "s" : ""}` : ""}.` : null;
  // Retrait refusé (autre espace probable, retrait de masse) : dit clairement, jamais de bouton.
  const phrase = [phraseEcart, phraseIntrouvables, etat === "introuvables" ? ecart.retraitRefuse : null].filter(Boolean).join(" ");
  return (
    <div role="status" data-bandeau-ecart={etat} className="mb-3 flex flex-wrap items-center gap-3 rounded-2xl border border-trait-fort bg-surface-2 px-4 py-3 text-sm text-texte">
      <p className="min-w-0 flex-1 font-bold">{phrase}</p>
      <BoutonRelireDiffuseur />
      {retirables.length > 0 && <BoutonRetirerIntrouvables ids={retirables} />}
    </div>
  );
}
