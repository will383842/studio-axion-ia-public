import { alertesDuree } from "@/domaine/duree-par-reseau";

/**
 * Phrase(s) en français quand la durée d'une vidéo dépasse la limite d'un réseau, ou quand cette limite n'est pas vérifiée.
 * Informative : rien n'est bloqué. Durée inconnue : rien n'est rendu.
 */
export function AlerteDureeReseau({ reseaux, dureeSec }: { reseaux: readonly string[]; dureeSec?: number | null }) {
  const alertes = alertesDuree(reseaux, dureeSec);
  if (alertes.length === 0) return null;
  return (
    <ul aria-label="Durée et limites des réseaux" className="space-y-1 text-xs">
      {alertes.map((a, i) => (
        <li key={i} className={a.genre === "depasse" ? "text-ambre" : "text-texte-faible"}>
          {a.phrase}
        </li>
      ))}
    </ul>
  );
}
