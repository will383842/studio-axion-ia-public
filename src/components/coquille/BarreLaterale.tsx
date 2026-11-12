"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useSyncExternalStore } from "react";
import { Icone } from "@/components/ui/Icone";
import { cn } from "@/lib/cn";
import { Logo } from "./Logo";
import { ACTION_CREER, estActif, NAV_PIED, sectionsLaterales, type EntreeNavigation, type FormatNavigation } from "./navigation";

const CLE = "studio.barreRepliee";
const EVENEMENT = "studio:barre";

function lireRepliee(): boolean {
  try {
    return localStorage.getItem(CLE) === "1";
  } catch {
    return false;
  }
}

function abonner(rappel: () => void) {
  window.addEventListener(EVENEMENT, rappel);
  window.addEventListener("storage", rappel);
  return () => {
    window.removeEventListener(EVENEMENT, rappel);
    window.removeEventListener("storage", rappel);
  };
}

/** Infobulle de la barre repliée : visible au survol ET au focus clavier (le nom accessible vient de l'aria-label du lien). */
function Infobulle({ texte }: { texte: string }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-surface-2 px-2 py-1 text-xs font-medium text-texte opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
    >
      {texte}
    </span>
  );
}

/** Une ligne du menu (14 px, graisse 500, y compris l'entrée active). `petit` = pied (12 px). */
function LigneEntree({ e, chemin, repliee, petit = false }: { e: EntreeNavigation; chemin: string; repliee: boolean; petit?: boolean }) {
  const actif = estActif(chemin, e);
  return (
    <Link
      href={e.href}
      aria-label={repliee ? e.libelle : undefined}
      title={repliee ? e.libelle : undefined}
      aria-current={actif ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-2 rounded-lg px-2 py-1.5 font-medium transition-colors",
        petit ? "text-xs leading-4" : "text-sm leading-5",
        repliee && "justify-center",
        actif ? "bg-surface-2 text-texte" : "text-texte-doux hover:bg-surface-2/70 hover:text-texte",
      )}
    >
      {actif && <span aria-hidden className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-orange" />}
      <Icone nom={e.icone} size={petit ? 16 : 18} className="shrink-0" />
      {!repliee && <span className="truncate">{e.libelle}</span>}
      {repliee && <Infobulle texte={e.libelle} />}
    </Link>
  );
}

/** Barre latérale (ordinateur ≥ 1024 px) : 264 px, repliable à 72 px. Groupes à titres fixes ; le pied (réglages) ne défile pas. */
export function BarreLaterale({ actionDeconnexion, surLeSite = false, aPublier = false }: { formats?: FormatNavigation[]; actionDeconnexion: () => Promise<void>; surLeSite?: boolean; aPublier?: boolean }) {
  const chemin = usePathname();
  const idBase = useId();
  const idNav = `${idBase}-menu`;
  const repliee = useSyncExternalStore(abonner, lireRepliee, () => false);
  useEffect(() => {
    document.documentElement.style.setProperty("--largeur-barre-courante", repliee ? "var(--largeur-barre-repliee)" : "var(--largeur-barre)");
  }, [repliee]);
  function basculer() {
    try {
      localStorage.setItem(CLE, repliee ? "0" : "1");
    } catch {
      /* stockage indisponible : l'état ne sera pas mémorisé */
    }
    window.dispatchEvent(new Event(EVENEMENT));
  }

  const creerActif = chemin === ACTION_CREER.href || chemin.startsWith(ACTION_CREER.href + "/");
  const libelleRepli = repliee ? "Déplier le menu" : "Replier le menu";

  return (
    <div
      className={cn(
        "theme-barre fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-trait bg-fond transition-[width] duration-300 ease-studio lg:flex",
        repliee ? "w-[var(--largeur-barre-repliee)]" : "w-[var(--largeur-barre)]",
      )}
    >
      <div className={cn("flex h-16 shrink-0 items-center", repliee ? "justify-center" : "justify-between pl-5 pr-2")}>
        <Link href="/" aria-label="Accueil">
          <Logo replie={repliee} />
        </Link>
        {!repliee && (
          <button type="button" onClick={basculer} aria-label={libelleRepli} aria-expanded={!repliee} aria-controls={idNav} className="grid size-11 place-items-center rounded-full text-texte-faible hover:bg-surface-2 hover:text-texte">
            <Icone nom="barre-replier" size={18} />
          </button>
        )}
      </div>
      {repliee && (
        <button type="button" onClick={basculer} aria-label={libelleRepli} aria-expanded={!repliee} aria-controls={idNav} className="mx-auto mb-2 grid size-11 place-items-center rounded-full text-texte-faible hover:bg-surface-2 hover:text-texte">
          <Icone nom="barre-deplier" size={18} />
        </button>
      )}

      {/* Action principale : bouton plein sous le logo, hors du menu. */}
      <div className="shrink-0 px-3 pb-2">
        <Link
          href={ACTION_CREER.href}
          aria-label={repliee ? ACTION_CREER.libelle : undefined}
          aria-current={creerActif ? "page" : undefined}
          className={cn(
            "group relative flex items-center gap-2 rounded-lg bg-orange px-2 py-2 text-sm font-medium leading-5 text-sur-orange shadow-orange transition-colors hover:bg-orange-vif",
            repliee && "justify-center",
          )}
        >
          <Icone nom={ACTION_CREER.icone} size={18} className="shrink-0" />
          {!repliee && <span className="truncate">{ACTION_CREER.libelle}</span>}
          {repliee && <Infobulle texte={ACTION_CREER.libelle} />}
        </Link>
      </div>

      <nav id={idNav} aria-label="Menu principal" className="flex min-h-0 flex-1 flex-col">
        <div className="sans-barre flex-1 overflow-y-auto px-3 pb-4">
          {sectionsLaterales(surLeSite, aPublier).map((s, i) => {
            const idTitre = `${idBase}-groupe-${i}`;
            return (
              <div key={s.titre ?? `tete-${i}`} className={cn(i > 0 && (repliee ? "mt-3 border-t border-trait pt-3" : "mt-4"))}>
                {s.titre && (
                  <h2 id={idTitre} className={repliee ? "sr-only" : "px-2 pb-1 text-[13px] font-semibold uppercase leading-[18px] tracking-wide text-texte-faible"}>
                    {s.titre}
                  </h2>
                )}
                <ul className="space-y-0.5" aria-labelledby={s.titre ? idTitre : undefined}>
                  {s.entrees.map((e) => (
                    <li key={e.href}>
                      <LigneEntree e={e} chemin={chemin} repliee={repliee} />
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="shrink-0 border-t border-trait px-3 py-2">
          <h2 id={`${idBase}-compte`} className="sr-only">
            Compte
          </h2>
          <ul className="space-y-0.5" aria-labelledby={`${idBase}-compte`}>
            {NAV_PIED.map((e) => (
              <li key={e.href}>
                <LigneEntree e={e} chemin={chemin} repliee={repliee} petit />
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <form action={actionDeconnexion} className={cn("border-t border-trait px-3 py-2", repliee && "flex justify-center")}>
        <button
          type="submit"
          aria-label={repliee ? "Me déconnecter" : undefined}
          className={cn("group relative flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium leading-4 text-texte-faible hover:bg-surface-2/70 hover:text-texte", repliee && "justify-center")}
        >
          <Icone nom="deconnexion" size={16} />
          {!repliee && "Me déconnecter"}
          {repliee && <Infobulle texte="Me déconnecter" />}
        </button>
      </form>
    </div>
  );
}
