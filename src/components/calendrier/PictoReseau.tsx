import type { IdReseau } from "@/domaine/types";
import { cn } from "@/lib/cn";
import { RESEAUX } from "@/reseaux";

export interface ProprietesPictoReseau {
  reseau: IdReseau;
  taille?: "sm" | "md";
  /** Écrit le nom du réseau à côté du picto (défaut : oui). La couleur n'est jamais seule. */
  avecNom?: boolean;
  className?: string;
}

/**
 * Pictogramme monochrome d'un réseau (monogramme, sans logo de marque) suivi du nom du réseau.
 * Le picto prend la couleur du texte ; la couleur du réseau (`--c`) ne sert que de contour.
 */
export function PictoReseau({ reseau, taille = "md", avecNom = true, className }: ProprietesPictoReseau) {
  const def = RESEAUX.find((r) => r.id === reseau);
  return (
    <span data-reseau={reseau} className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        aria-hidden="true"
        data-picto={reseau}
        className={cn(
          "inline-grid shrink-0 place-items-center border-2 border-[color:var(--c)] bg-surface-1 font-bold leading-none text-texte",
          taille === "sm" ? "size-[18px] rounded-[5px] text-[9px]" : "size-[22px] rounded-md text-[11px]",
        )}
      >
        {def?.monogramme ?? "?"}
      </span>
      {avecNom && <span>{def?.nom ?? "Réseau"}</span>}
    </span>
  );
}
