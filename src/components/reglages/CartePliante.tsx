"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Icone, type NomIcone } from "@/components/ui/Icone";

/**
 * Carte de Réglages pliable (maquette M6, décision de Williams du 12/11) : un titre, une phrase de résumé qui reste
 * visible quand la carte est pliée, puis le contenu. `<details>` natif : le contenu reste dans le HTML du serveur.
 * Une ancre (`/reglages#credits`) qui vise la carte, ou un élément qu'elle contient, la déplie à l'arrivée.
 * Présentation seulement : aucun réglage ni aucune donnée ne passe par ce composant.
 */
export function CartePliante({ id, icone, titre, resume, ouverte = false, children }: { id: string; icone: NomIcone; titre: string; resume?: string; ouverte?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function ouvrirSiVise(hash: string) {
      const el = ref.current;
      let ancre = "";
      try {
        ancre = decodeURIComponent(hash.replace(/^#/, ""));
      } catch {
        return;
      }
      if (!ancre || !el) return;
      const cible = document.getElementById(ancre);
      if (cible && el.contains(cible) && !el.open) {
        el.open = true;
        cible.scrollIntoView({ block: "start" });
      }
    }
    const suivreAdresse = () => ouvrirSiVise(window.location.hash);
    // Un `Link` Next vers /reglages#x pendant qu'on est déjà sur la page change l'adresse avec history.pushState, qui ne
    // déclenche ni hashchange ni popstate : on lit donc l'ancre dans le lien cliqué (même page seulement).
    function suivreClic(e: MouseEvent) {
      const lien = (e.target as Element | null)?.closest?.("a[href*='#']") as HTMLAnchorElement | null;
      if (!lien) return;
      const u = new URL(lien.href, window.location.href);
      if (u.origin === window.location.origin && u.pathname === window.location.pathname) ouvrirSiVise(u.hash);
    }
    suivreAdresse();
    window.addEventListener("hashchange", suivreAdresse);
    window.addEventListener("popstate", suivreAdresse);
    document.addEventListener("click", suivreClic, true);
    return () => {
      window.removeEventListener("hashchange", suivreAdresse);
      window.removeEventListener("popstate", suivreAdresse);
      document.removeEventListener("click", suivreClic, true);
    };
  }, []);

  return (
    <details ref={ref} id={id} open={ouverte} className="group scroll-mt-24 rounded-carte border border-trait bg-surface-1 shadow-carte">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-texte-faible">
          <Icone nom={icone} size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg text-texte">{titre}</h3>
          {resume && <span className="mt-0.5 block text-sm text-texte-doux">{resume}</span>}
        </div>
        <Icone nom="chevron-bas" size={18} className="shrink-0 text-texte-faible transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-trait p-4 sm:p-5">{children}</div>
    </details>
  );
}
