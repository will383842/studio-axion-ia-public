/**
 * RAP-3 · bandeau d'écart en haut du calendrier : visible seulement si des publications du diffuseur manquent au calendrier, ou si l'écart
 * n'a pas pu être vérifié (ou date de plus d'une heure). Lecture de la mesure locale : aucun appel au diffuseur depuis un écran.
 */
import type { EcartCalendrier } from "@/services/zernio";
import { BoutonRetirerIntrouvables } from "./BoutonRetirerIntrouvables";
import { BoutonRelireDiffuseur } from "./BoutonRelireDiffuseur";

const UNE_HEURE_MS = 3_600_000;

export type EtatBandeauEcart = "aucun" | "absents" | "non-verifie" | "introuvables";
type MesureBandeau = Pick<EcartCalendrier, "luLe" | "verifie" | "absents"> & { introuvables?: number };

/** Mesure absente : rien à dire (le diffuseur n'est pas relié ou rien n'a encore été lu). */
export function etatBandeauEcart(ecart: MesureBandeau | null | undefined, maintenant: number): EtatBandeauEcart {
  if (!ecart) return "aucun";
  const lu = Date.parse(ecart.luLe);
  if (!ecart.verifie || !Number.isFinite(lu) || maintenant - lu > UNE_HEURE_MS) return "non-verifie";
  if (ecart.absents > 0) return "absents";
  return (ecart.introuvables ?? 0) > 0 ? "introuvables" : "aucun";
}

const HEURE_PARIS = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });

export function BandeauEcartDiffuseur({ ecart, maintenant }: { ecart: (EcartCalendrier & { introuvables?: number }) | null | undefined; maintenant: number }) {
  const etat = etatBandeauEcart(ecart, maintenant);
  if (etat === "aucun" || !ecart) return null;
  const n = ecart.absents;
  const introuvables = ecart.introuvables ?? 0;
  const phraseEcart =
    etat === "introuvables"
      ? null
      : etat === "absents"
      ? `${n} publication${n > 1 ? "s" : ""} du diffuseur ${n > 1 ? "ne sont" : "n'est"} pas encore au calendrier.`
      : `L'écart avec le diffuseur n'a pas pu être vérifié${Number.isFinite(Date.parse(ecart.luLe)) ? ` (dernière lecture à ${HEURE_PARIS.format(new Date(ecart.luLe))}, heure de Paris)` : ""}.${n > 0 ? ` Au moins ${n} publication${n > 1 ? "s" : ""} manque${n > 1 ? "nt" : ""}.` : ""}`;
  const phraseIntrouvables = introuvables > 0 ? `${introuvables} publication${introuvables > 1 ? "s" : ""} du calendrier introuvable${introuvables > 1 ? "s" : ""} chez le diffuseur.` : null;
  const phrase = [phraseEcart, phraseIntrouvables].filter(Boolean).join(" ");
  return (
    <div role="status" data-bandeau-ecart={etat} className="mb-3 flex flex-wrap items-center gap-3 rounded-2xl border border-trait-fort bg-surface-2 px-4 py-3 text-sm text-texte">
      <p className="min-w-0 flex-1 font-bold">{phrase}</p>
      <BoutonRelireDiffuseur />
      {introuvables > 0 && <BoutonRetirerIntrouvables nombre={introuvables} />}
    </div>
  );
}
