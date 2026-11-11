import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icone } from "./Icone";

/**
 * Panneau de filtres replié (composant serveur, <details> natif : les liens restent dans le HTML, sans JavaScript).
 * Props : nombre (filtres actifs, affiché en compteur), libelle? ("Filtres"), className?, children (des GroupeFiltres).
 */
export function PanneauFiltres({ nombre = 0, libelle = "Filtres", className, children }: { nombre?: number; libelle?: string; className?: string; children: ReactNode }) {
  return (
    <details className={cn("group/filtres", className)}>
      <summary
        className={cn(
          "inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors [&::-webkit-details-marker]:hidden",
          nombre > 0 ? "border-texte bg-texte text-fond" : "border-trait-fort bg-surface-1 text-texte hover:bg-surface-2",
        )}
      >
        <Icone nom="filtre" size={16} />
        {libelle}
        {nombre > 0 && <span className="rounded-full bg-fond/20 px-1.5 text-[11px] tabular-nums">{nombre}</span>}
      </summary>
      <div className="mt-3 flex flex-col gap-4 rounded-carte border border-trait bg-surface-1 p-4 shadow-carte">{children}</div>
    </details>
  );
}

/** Un groupe de filtres : titre en casse normale, puces qui passent à la ligne. Props : titre, children (des PuceLien). */
export function GroupeFiltres({ titre, className, children }: { titre: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-2", className)} role="group" aria-label={titre}>
      <span className="text-sm font-semibold text-texte-doux">{titre}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

/** Puce-lien unique. Props : href, actif (noir quand actif, aria-current), children. */
export function PuceLien({ href, actif = false, className, children }: { href: string; actif?: boolean; className?: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={actif ? "true" : undefined}
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors sm:min-h-9",
        actif ? "border-texte bg-texte text-fond" : "border-trait bg-surface-1 text-texte-doux hover:border-trait-fort hover:text-texte",
        className,
      )}
    >
      {children}
    </Link>
  );
}

/**
 * Filtres actifs retirables + « Tout effacer ». Props : puces ({ libelle, href (lien qui retire ce filtre) }[]), effacerHref, className?.
 * Ne rend rien s'il n'y a aucune puce.
 */
export function PucesActives({ puces, effacerHref, sansEffacer, className }: { puces: { libelle: string; href: string }[]; effacerHref: string; sansEffacer?: boolean; className?: string }) {
  if (puces.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {puces.map((p) => (
        <Link
          key={`${p.libelle}-${p.href}`}
          href={p.href}
          aria-label={`Retirer le filtre ${p.libelle}`}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-texte bg-texte px-3.5 text-sm font-semibold text-fond sm:min-h-9"
        >
          {p.libelle}
          <Icone nom="fermer" size={14} />
        </Link>
      ))}
      {!sansEffacer && (
        <Link href={effacerHref} className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-texte-doux hover:text-texte sm:min-h-9">
          Tout effacer
        </Link>
      )}
    </div>
  );
}
