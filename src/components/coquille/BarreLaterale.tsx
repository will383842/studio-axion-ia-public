"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { Icone } from "@/components/ui/Icone";
import { Pastille } from "@/components/ui/Pastille";
import { cn } from "@/lib/cn";
import { Logo } from "./Logo";
import { estActif, formatActif, navigationLaterale, type FormatNavigation } from "./navigation";
import { nomCourtFormat } from "@/formats";

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

/** Barre latérale (ordinateur ≥ 1024 px) : 264 px, repliable à 72 px. */
export function BarreLaterale({ formats, actionDeconnexion, surLeSite = false }: { formats: FormatNavigation[]; actionDeconnexion: () => Promise<void>; surLeSite?: boolean }) {
  const chemin = usePathname();
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

  return (
    <aside
      aria-label="Barre latérale"
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-trait bg-fond transition-[width] duration-300 ease-studio lg:flex",
        repliee ? "w-[var(--largeur-barre-repliee)]" : "w-[var(--largeur-barre)]",
      )}
    >
      <div className={cn("flex h-16 shrink-0 items-center", repliee ? "justify-center" : "justify-between pl-5 pr-2")}>
        <Link href="/" aria-label="Accueil">
          <Logo replie={repliee} />
        </Link>
        {!repliee && (
          <button type="button" onClick={basculer} aria-label="Replier le menu" className="grid size-11 place-items-center rounded-full text-texte-faible hover:bg-surface-2 hover:text-texte">
            <Icone nom="barre-replier" size={18} />
          </button>
        )}
      </div>
      {repliee && (
        <button type="button" onClick={basculer} aria-label="Déplier le menu" className="mx-auto mb-2 grid size-11 place-items-center rounded-full text-texte-faible hover:bg-surface-2 hover:text-texte">
          <Icone nom="barre-deplier" size={18} />
        </button>
      )}

      <nav aria-label="Menu principal" className="sans-barre flex-1 overflow-y-auto px-3 pb-4">
        <ul className="space-y-0.5">
          {navigationLaterale(formats, surLeSite).map((e) => {
            const actif = estActif(chemin, e);
            const nouvelle = e.href === "/nouvelle";
            return (
              <li key={e.href}>
                <Link
                  href={e.href}
                  title={repliee ? e.libelle : undefined}
                  aria-current={actif ? "page" : undefined}
                  className={cn(
                    "group relative flex min-h-11 items-center gap-3 rounded-xl text-[15px] font-semibold transition-colors",
                    repliee ? "justify-center" : "px-3",
                    nouvelle
                      ? "my-2 bg-orange text-sur-orange shadow-orange hover:bg-orange-vif"
                      : actif
                        ? "bg-surface-2 text-texte"
                        : "text-texte-doux hover:bg-surface-1 hover:text-texte",
                  )}
                >
                  {actif && !nouvelle && <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-orange" />}
                  <Icone nom={e.icone} size={20} className="shrink-0" />
                  {!repliee && <span className="truncate">{e.libelle}</span>}
                </Link>
                {e.href === "/videos" && !repliee && (
                  <ul className="mb-1 ml-[22px] mt-0.5 space-y-0.5 border-l border-trait pl-3">
                    {formats.map((f) => {
                      const href = `/formats/${f.id}`;
                      const fActif = formatActif(chemin, f);
                      if (f.statut !== "actif") {
                        // Générateur pas encore fait : visible, grisé, pas un lien.
                        return (
                          <li key={f.id}>
                            <span aria-disabled="true" className="flex min-h-9 cursor-not-allowed items-center gap-2 rounded-lg px-2 text-sm text-texte-faible opacity-70">
                              <Icone nom={f.icone} size={15} className="shrink-0" />
                              <span className="flex-1 truncate">{nomCourtFormat(f)}</span>
                              <Pastille>Bientôt</Pastille>
                            </span>
                          </li>
                        );
                      }
                      return (
                        <li key={f.id}>
                          <Link
                            href={href}
                            aria-current={fActif ? "page" : undefined}
                            className={cn(
                              "flex min-h-9 items-center gap-2 rounded-lg px-2 text-sm transition-colors",
                              fActif ? "bg-surface-2 font-semibold text-texte" : "text-texte-doux hover:text-texte",
                            )}
                          >
                            <Icone nom={f.icone} size={15} className="shrink-0" />
                            <span className="flex-1 truncate">{nomCourtFormat(f)}</span>
                            {f.essai && <Pastille ton="ambre">Essai</Pastille>}
                            {f.nbVideos > 0 && <span className="text-xs tabular-nums text-texte-faible">{f.nbVideos}</span>}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <form action={actionDeconnexion} className={cn("border-t border-trait p-3", repliee && "flex justify-center")}>
        <button
          type="submit"
          title={repliee ? "Me déconnecter" : undefined}
          className={cn("flex min-h-11 w-full items-center gap-3 rounded-xl text-sm font-semibold text-texte-faible hover:bg-surface-1 hover:text-texte", repliee ? "justify-center" : "px-3")}
        >
          <Icone nom="deconnexion" size={18} />
          {!repliee && "Me déconnecter"}
        </button>
      </form>
    </aside>
  );
}
