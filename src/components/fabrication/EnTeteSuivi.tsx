import { PHRASES_SUIVI } from "@/domaine/libelles";
import type { EtatSuivi } from "@/components/creation/SuiviFabrication";

/**
 * Titre et phrase d'un suivi de fabrication : les mêmes mots pour tous les formats (présentation seule, aucun montant).
 * `sansTemps` : l'écran dit déjà le temps (rang dans la file, heure de fin) sous la barre, l'en-tête n'en promet pas un autre.
 * Jamais de `<h1>` : l'écran qui l'accueille a déjà le sien.
 */
export function EnTeteSuivi({ etat, pret, message, sansTemps }: { etat: EtatSuivi; pret?: string | null; message?: string; sansTemps?: boolean }) {
  const { titre, phrase } = PHRASES_SUIVI[etat];
  const ligne = etat === "en-cours" ? (sansTemps ? phrase : `${pret ?? "Encore quelques minutes"} · ${phrase}`) : etat === "coincee" || etat === "arretee" ? (message ?? phrase) : phrase;
  return (
    <div data-etat={etat} aria-live="polite">
      <h2 className="font-titre text-2xl text-texte">{titre}</h2>
      <p className="mt-1 text-[15px] text-texte-doux">{ligne}</p>
    </div>
  );
}
