import type { IdReseau } from "@/domaine/types";
import { LogoReseau } from "@/components/ui/LogoReseau";
import { cn } from "@/lib/cn";
import { obtenirReseau } from "@/reseaux";

/**
 * Pastilles des réseaux d'une vidéo (lot S) : monogrammes lisibles (« in », « IG »…), 4 au plus puis « +n ».
 * `precis` faux : réseaux PRÉVUS par défaut (aucune information sur la vidéo), pastilles atténuées.
 * Composant serveur ; couleurs = jetons du design system seulement.
 */
export function PastillesReseaux({ reseaux, precis, max = 4, className }: { reseaux: readonly IdReseau[]; precis: boolean; max?: number; className?: string }) {
  if (!reseaux.length) return null;
  const visibles = reseaux.slice(0, max);
  const reste = reseaux.length - visibles.length;
  const noms = reseaux.map((r) => obtenirReseau(r).nom).join(", ");
  return (
    <span
      role="group"
      aria-label={`Pour ${noms}${precis ? "" : " (prévu par défaut)"}`}
      title={precis ? undefined : "Réseaux prévus par défaut"}
      data-precis={precis ? "oui" : "non"}
      className={cn("inline-flex items-center gap-1", !precis && "opacity-60", className)}
    >
      {visibles.map((r) => (
        <LogoReseau key={r} reseau={r} taille="sm" />
      ))}
      {reste > 0 && (
        <span aria-hidden className="grid h-7 min-w-7 place-items-center rounded-lg bg-surface-2 px-1 font-titre text-[10px] text-texte-doux">
          +{reste}
        </span>
      )}
    </span>
  );
}
