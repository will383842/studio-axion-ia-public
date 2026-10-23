import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icone, type NomIcone } from "./Icone";

/**
 * État vide illustré : une illustration, un titre, UNE phrase, un bouton.
 * L'illustration est dessinée avec les jetons (aucune image externe).
 */
export function EtatVide({
  icone = "film",
  titre,
  phrase,
  action,
  compact,
  className,
}: {
  icone?: NomIcone;
  titre: string;
  phrase?: string;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("relative isolate flex flex-col items-center text-center", compact ? "py-8" : "py-14", className)}>
      <div aria-hidden className="relative mb-5">
        <div className="absolute -inset-10 -z-10 lueur-forte opacity-80" />
        <svg width={compact ? 96 : 132} height={compact ? 72 : 100} viewBox="0 0 132 100" fill="none">
          <rect x="20" y="10" width="62" height="80" rx="12" className="fill-surface-2 stroke-trait-fort" strokeWidth="1.5" transform="rotate(-8 51 50)" />
          <rect x="50" y="8" width="62" height="84" rx="12" className="fill-surface-1 stroke-trait-fort" strokeWidth="1.5" transform="rotate(6 81 50)" />
          <rect x="58" y="22" width="40" height="5" rx="2.5" className="fill-trait-fort" transform="rotate(6 81 50)" />
          <rect x="58" y="32" width="28" height="5" rx="2.5" className="fill-trait" transform="rotate(6 81 50)" />
          <circle cx="104" cy="78" r="16" className="fill-orange" />
        </svg>
        <span className="absolute bottom-1.5 right-[12px] grid size-8 place-items-center text-sur-orange">
          <Icone nom={icone} size={compact ? 15 : 18} />
        </span>
      </div>
      <h3 className={cn("text-texte", compact ? "text-lg" : "text-xl")}>{titre}</h3>
      {phrase && <p className="mt-1.5 max-w-xs text-sm text-texte-doux">{phrase}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
