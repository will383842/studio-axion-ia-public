import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * L'action principale de l'écran, COLLÉE EN BAS sur mobile (au-dessus des onglets du bas),
 * en ligne à droite sur ordinateur. Une seule par écran.
 * Ajouter `pb-28` au contenu de la page sur mobile pour ne rien masquer (fait par la coquille via .marge-onglets-bas + ce composant).
 */
export function BarreActionCollee({ children, secondaire, className, auDessusDesOnglets = true }: { children: ReactNode; secondaire?: ReactNode; className?: string; auDessusDesOnglets?: boolean }) {
  return (
    <>
      <div aria-hidden className="h-24 lg:hidden" />
      <div
        className={cn(
          "fixed inset-x-0 z-30 border-t border-trait bg-fond/90 px-4 py-3 backdrop-blur-lg lg:static lg:mt-8 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none",
          auDessusDesOnglets ? "bottom-[calc(var(--hauteur-onglets-bas)+env(safe-area-inset-bottom))]" : "bottom-0 pb-[max(12px,env(safe-area-inset-bottom))]",
          "lg:bottom-auto",
          className,
        )}
      >
        <div className="mx-auto flex max-w-xl items-center gap-2 lg:mx-0 lg:max-w-none lg:justify-end [&>*:last-child]:flex-1 lg:[&>*:last-child]:flex-none">
          {secondaire}
          {children}
        </div>
      </div>
    </>
  );
}
