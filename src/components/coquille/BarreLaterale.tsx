"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useSyncExternalStore } from "react";
import { Icone } from "@/components/ui/Icone";
import { Pastille } from "@/components/ui/Pastille";
import { cn } from "@/lib/cn";
import { Logo } from "./Logo";
import { estActif, formatActif, NAV_PIED, sectionsLaterales, type EntreeNavigation, type FormatNavigation } from "./navigation";
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

/** Une ligne du menu (entrée de premier niveau). « Nouvelle vidéo » est le seul bouton plein. */
function LigneEntree({ e, chemin, repliee, sousEntreeActive = false }: { e: EntreeNavigation; chemin: string; repliee: boolean; /** Une ligne en dessous (format) porte déjà aria-current : celle-ci garde le style actif sans l'annoncer. */ sousEntreeActive?: boolean }) {
  const actif = estActif(chemin, e);
  const nouvelle = e.href === "/nouvelle";
  return (
    <Link
      href={e.href}
      title={repliee ? e.libelle : undefined}
      aria-label={repliee ? e.libelle : undefined}
      aria-current={actif && !sousEntreeActive ? "page" : undefined}
      className={cn(
        "group relative flex min-h-11 items-center gap-3 rounded-xl text-[15px] font-semibold transition-colors",
        repliee ? "justify-center" : "px-3",
        nouvelle
          ? "my-2 bg-orange text-sur-orange shadow-orange hover:bg-orange-vif"
          : actif
            ? "bg-surface-2 text-texte"
            : "text-texte-doux hover:bg-surface-2/70 hover:text-texte",
      )}
    >
      {actif && !nouvelle && <span aria-hidden className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-orange" />}
      <Icone nom={e.icone} size={20} className="shrink-0" />
      {!repliee && <span className="truncate">{e.libelle}</span>}
    </Link>
  );
}

/** Formats sous « Mes vidéos » : seulement ceux qui ont un générateur (08/11, Williams : pas de ligne grisée « Bientôt »). */
function SousListeFormats({ formats, chemin }: { formats: FormatNavigation[]; chemin: string }) {
  const prets = formats.filter((f) => f.statut === "actif");
  if (!prets.length) return null;
  return (
    <ul className="mb-1 ml-[22px] mt-0.5 space-y-0.5 border-l border-trait pl-3">
      {prets.map((f) => {
        const fActif = formatActif(chemin, f);
        return (
          <li key={f.id}>
            <Link
              href={`/formats/${f.id}`}
              aria-current={fActif ? "page" : undefined}
              className={cn("flex min-h-9 items-center gap-2 rounded-lg px-2 text-sm transition-colors", fActif ? "bg-surface-2 font-semibold text-texte" : "text-texte-doux hover:bg-surface-2/70 hover:text-texte")}
            >
              <Icone nom={f.icone} size={15} className="shrink-0" />
              <span className="flex-1 truncate">{nomCourtFormat(f)}</span>
              {f.essai && <Pastille ton="ambre">Essai</Pastille>}
              {f.nbVideos > 0 && (
                <span className="text-xs tabular-nums text-texte-faible" aria-label={`${f.nbVideos} vidéo${f.nbVideos > 1 ? "s" : ""}`}>
                  {f.nbVideos > 99 ? "99+" : f.nbVideos}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Barre latérale (ordinateur ≥ 1024 px) : 264 px, repliable à 72 px. Sections titrées ; le pied (veille, réglages) ne défile pas. */
export function BarreLaterale({ formats, actionDeconnexion, surLeSite = false, aPublier = false }: { formats: FormatNavigation[]; actionDeconnexion: () => Promise<void>; surLeSite?: boolean; aPublier?: boolean }) {
  const chemin = usePathname();
  const idBase = useId();
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
    <div
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

      <nav aria-label="Menu principal" className="flex min-h-0 flex-1 flex-col">
        <div className="sans-barre flex-1 overflow-y-auto px-3 pb-4">
          {sectionsLaterales(surLeSite, aPublier).map((s, i) => {
            const idTitre = `${idBase}-section-${i}`;
            return (
              <div key={s.titre ?? `tete-${i}`} className={cn(i > 0 && (repliee ? "mt-3 border-t border-trait pt-3" : "mt-5"))}>
                {s.titre && !repliee && (
                  <p id={idTitre} className="mb-1 px-3 text-xs font-semibold text-texte-faible">
                    {s.titre}
                  </p>
                )}
                <ul className="space-y-0.5" aria-labelledby={s.titre && !repliee ? idTitre : undefined} aria-label={s.titre && repliee ? s.titre : undefined}>
                  {s.entrees.map((e) => (
                    <li key={e.href}>
                      <LigneEntree e={e} chemin={chemin} repliee={repliee} sousEntreeActive={e.href === "/videos" && !repliee && formats.some((f) => f.statut === "actif" && formatActif(chemin, f))} />
                      {e.href === "/videos" && !repliee && <SousListeFormats formats={formats} chemin={chemin} />}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <ul className="shrink-0 space-y-0.5 border-t border-trait px-3 py-2">
          {NAV_PIED.map((e) => (
            <li key={e.href}>
              <LigneEntree e={e} chemin={chemin} repliee={repliee} />
            </li>
          ))}
        </ul>
      </nav>

      <form action={actionDeconnexion} className={cn("border-t border-trait p-3", repliee && "flex justify-center")}>
        <button
          type="submit"
          title={repliee ? "Me déconnecter" : undefined}
          aria-label={repliee ? "Me déconnecter" : undefined}
          className={cn("flex min-h-11 w-full items-center gap-3 rounded-xl text-sm font-semibold text-texte-faible hover:bg-surface-2/70 hover:text-texte", repliee ? "justify-center" : "px-3")}
        >
          <Icone nom="deconnexion" size={18} />
          {!repliee && "Me déconnecter"}
        </button>
      </form>
    </div>
  );
}
