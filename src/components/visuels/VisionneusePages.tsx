"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { actionClavier, compteur, estClicFond, precedent, suivant, urlGrandeVue } from "../../domaine/visuels/navigation-pages";
import { urlSure } from "../../domaine/visuels/depot";

export interface PageVisionneuse {
  n: number;
  urlX1?: string;
  urlX2?: string;
}

const FOCALISABLES = 'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

/** Grille des pages (vignettes-boutons) + visionneuse plein écran au clic. */
export function VisionneusePages({ pages, titre, className }: { pages: PageVisionneuse[]; titre: string; className?: string }) {
  const [ouvert, setOuvert] = useState<number | null>(null);
  return (
    <>
      <ul aria-label="Pages du carrousel" className={cn("grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4", className)}>
        {pages.map((p, i) => {
          const url = urlSure(p.urlX1);
          return (
            <li key={p.n}>
              {url ? (
                <button type="button" onClick={() => setOuvert(i)} aria-label={`Agrandir la page ${p.n}`} className="block w-full text-left">
                  <span className="relative block aspect-[4/5] w-full overflow-hidden rounded-carte border border-trait bg-surface-2">
                    {/* eslint-disable-next-line @next/next/no-img-element -- page déjà rendue à sa taille, adresse fournie par le service */}
                    <img
                      src={url}
                      alt={`Page ${p.n} : ${titre}`}
                      width={270}
                      height={337}
                      loading={i < 2 ? undefined : "lazy"}
                      className="size-full object-cover"
                    />
                  </span>
                  <span aria-hidden="true" className="mt-1.5 block text-xs text-texte-faible">
                    Page {p.n}
                  </span>
                </button>
              ) : (
                <div>
                  <span className="relative block aspect-[4/5] w-full overflow-hidden rounded-carte border border-trait bg-surface-2">
                    <span role="img" aria-label={`Page ${p.n} : ${titre} (pas encore rendue)`} className="grid size-full place-items-center text-sm text-texte-faible">
                      Page {p.n}
                    </span>
                  </span>
                  <span aria-hidden="true" className="mt-1.5 block text-xs text-texte-faible">
                    Page {p.n}
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {ouvert !== null && createPortal(<Visionneuse pages={pages} titre={titre} index={ouvert} onChange={setOuvert} onFermer={() => setOuvert(null)} />, document.body)}
    </>
  );
}

/** Visionneuse plein écran : navigation clavier, focus piégé et rendu. */
export function Visionneuse({
  pages,
  titre,
  index,
  onChange,
  onFermer,
}: {
  pages: PageVisionneuse[];
  titre: string;
  index: number;
  onChange: (i: number) => void;
  onFermer: () => void;
}) {
  const boite = useRef<HTMLDivElement>(null);
  const total = pages.length;
  const page = pages[index];
  const url = page ? urlSure(urlGrandeVue(page)) : undefined;

  const rappel = useRef({ index, total, onChange, onFermer });
  useLayoutEffect(() => {
    rappel.current = { index, total, onChange, onFermer };
  });

  useEffect(() => {
    const precedentFocus = document.activeElement as HTMLElement | null;
    const boiteEl = boite.current;
    const principal = document.querySelector<HTMLElement>("main");
    boiteEl?.querySelector<HTMLElement>("button")?.focus();
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const inertAvant = principal?.inert ?? false;
    if (principal) principal.inert = true;

    // Écouté sur document : le clavier marche même si le focus est tombé sur le fond ou l'image.
    const surTouche = (e: KeyboardEvent) => {
      const { index: i, total: n, onChange: changer, onFermer: fermer } = rappel.current;
      const action = actionClavier(e.key, i, n);
      if (action?.type === "fermer") {
        e.preventDefault();
        fermer();
      } else if (action?.type === "aller") {
        e.preventDefault();
        changer(action.index);
      } else if (e.key === "Tab") {
        const els = Array.from(boiteEl?.querySelectorAll<HTMLElement>(FOCALISABLES) ?? []);
        if (els.length === 0) return;
        const premier = els[0]!;
        const dernier = els[els.length - 1]!;
        const actif = document.activeElement;
        if (!boiteEl?.contains(actif) || actif === boiteEl) {
          e.preventDefault();
          (e.shiftKey ? dernier : premier).focus();
        } else if (e.shiftKey && actif === premier) {
          e.preventDefault();
          dernier.focus();
        } else if (!e.shiftKey && actif === dernier) {
          e.preventDefault();
          premier.focus();
        }
      }
    };
    document.addEventListener("keydown", surTouche);
    return () => {
      document.removeEventListener("keydown", surTouche);
      document.body.style.overflow = avant;
      if (principal) principal.inert = inertAvant;
      precedentFocus?.focus();
    };
  }, []);

  if (!page) return null;
  const bouton = "rounded-champ border border-trait bg-surface-1 px-4 py-2 text-sm font-semibold text-texte";
  return (
    <div
      ref={boite}
      role="dialog"
      aria-modal="true"
      aria-label={`Pages du carrousel : ${titre}`}
      tabIndex={-1}
      onClick={(e) => estClicFond(e.target, e.currentTarget) && onFermer()}
      className="fixed inset-0 z-50 flex flex-col bg-black/90 p-4 outline-none"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <p aria-live="polite" className="text-sm font-semibold text-white">
          {compteur(index, total)}
        </p>
        <button type="button" onClick={onFermer} className={bouton}>
          Fermer
        </button>
      </div>
      <div onClick={(e) => estClicFond(e.target, e.currentTarget) && onFermer()} className="flex min-h-0 flex-1 items-center justify-center">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- page déjà rendue, adresse fournie par le service
          <img src={url} alt={`Page ${page.n} : ${titre}`} className="max-h-full max-w-full object-contain" />
        ) : (
          <div role="img" aria-label={`Page ${page.n} : ${titre} (pas encore rendue)`} className="grid aspect-[4/5] h-full max-h-[80vh] place-items-center rounded-carte bg-surface-2 text-texte-faible">
            Page {page.n}
          </div>
        )}
      </div>
      <div className="mt-3 flex justify-center gap-3">
        <button type="button" onClick={() => onChange(precedent(index, total))} aria-disabled={index === 0} className={cn(bouton, index === 0 && "opacity-40")}>
          Précédent
        </button>
        <button type="button" onClick={() => onChange(suivant(index, total))} aria-disabled={index >= total - 1} className={cn(bouton, index >= total - 1 && "opacity-40")}>
          Suivant
        </button>
      </div>
    </div>
  );
}
