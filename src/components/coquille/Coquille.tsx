import Link from "next/link";
import type { ReactNode } from "react";
import { deconnexionAction } from "./actions";
import { BandeauHorsLigne } from "./BandeauHorsLigne";
import { BarreLaterale } from "./BarreLaterale";
import { Cloche } from "./Cloche";
import { Logo } from "./Logo";
import type { FormatNavigation } from "./navigation";
import { OngletsBas } from "./OngletsBas";
import { Recherche } from "./Recherche";

/**
 * COQUILLE (AV2.1) : barre latérale (ordinateur), en-tête (loupe + cloche), onglets du bas (mobile).
 * Le contenu des pages est centré, largeur max 1200 px, marges 16 px sur mobile.
 */
export function Coquille({ formats, nonLues, surLeSite = false, children }: { formats: FormatNavigation[]; nonLues: number; /** Vidéos sur le site : au moins un type de vidéo autorisé (entrée de menu « Sur le site »). */ surLeSite?: boolean; children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-full focus:bg-orange focus:px-4 focus:py-2 focus:text-sur-orange">
        Aller au contenu
      </a>
      <BandeauHorsLigne />
      <BarreLaterale formats={formats} actionDeconnexion={deconnexionAction} surLeSite={surLeSite} />
      <div className="transition-[padding] duration-300 ease-studio lg:pl-[var(--largeur-barre-courante)]">
        <header className="sticky top-0 z-30 border-b border-trait/60 bg-fond/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-2 px-4 lg:px-8">
            <Link href="/" className="inline-flex min-h-11 items-center lg:hidden" aria-label="Accueil">
              <Logo />
            </Link>
            <div className="hidden flex-1 lg:block">
              <Recherche variante="champ" />
            </div>
            <div className="ml-auto flex items-center gap-1">
              <span className="lg:hidden">
                <Recherche />
              </span>
              <Cloche nonLuesInitial={nonLues} />
            </div>
          </div>
        </header>
        <main id="contenu" className="marge-onglets-bas mx-auto max-w-[1200px] px-4 pt-5 lg:px-8 lg:pt-8">
          {children}
        </main>
      </div>
      <OngletsBas actionDeconnexion={deconnexionAction} surLeSite={surLeSite} />
    </div>
  );
}
