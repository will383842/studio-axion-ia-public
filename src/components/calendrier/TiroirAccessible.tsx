"use client";

/**
 * Tiroir du calendrier (CAL-12) : un élément <dialog> natif ouvert par showModal(). Échap le ferme, le focus reste dedans
 * (le reste de la page est inerte, et Tab boucle), puis revient à la carte d'origine. À droite sur ordinateur ; sur
 * téléphone (860 px et moins, comme la maquette validée) c'est une feuille qui monte du bas. Si le système demande moins
 * d'animations, il s'ouvre sans glissement.
 */
import {
  useEffect,
  useRef,
  type HTMLAttributes,
  type KeyboardEvent as ToucheReact,
  type MouseEvent as ClicReact,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";

const FOCALISABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), video[controls], [tabindex]:not([tabindex="-1"])';

/** Glissement à l'ouverture ; aucun glissement si le système demande moins d'animations. */
export const CSS_TIROIR = `
@keyframes tiroir-droite { from { transform: translateX(105%); } to { transform: none; } }
@keyframes tiroir-bas { from { transform: translateY(105%); } to { transform: none; } }
dialog[data-tiroir][open] { animation: tiroir-droite .2s ease-out; }
@media (max-width: 860px) { dialog[data-tiroir][open] { animation-name: tiroir-bas; } }
@media (prefers-reduced-motion: reduce) { dialog[data-tiroir][open] { animation: none; } }
`;

/** Ouvre le dialogue en modal (une seule fois) et rend l'élément qui avait le focus : la carte d'origine. */
export function ouvrirTiroir(
  dialogue: HTMLDialogElement,
  doc: Document,
): HTMLElement | null {
  const origine = (doc.activeElement as HTMLElement | null) ?? null;
  if (!dialogue.open) dialogue.showModal();
  return origine;
}

/** Ferme le dialogue (s'il est ouvert) puis rend le focus à la carte d'origine, ou à la carte de même clé si la grille a été redessinée. */
export function fermerTiroir(
  dialogue: HTMLDialogElement,
  origine: HTMLElement | null,
  doc: Document,
): void {
  if (dialogue.open) dialogue.close();
  if (!origine) return;
  if (origine.isConnected) return void origine.focus();
  const cle = origine.getAttribute("data-carte");
  if (!cle) return;
  const remplacante = doc.querySelector<HTMLElement>(
    `[data-carte="${cle.replace(/["\\]/g, "\\$&")}"]`,
  );
  remplacante?.focus();
}

type ToucheTab = { key: string; shiftKey: boolean; preventDefault: () => void };

/** Piège du focus : Tab sur le dernier élément revient au premier, Maj+Tab sur le premier va au dernier ; un focus sorti est ramené dedans. */
export function bouclerFocus(
  e: ToucheTab,
  dialogue: HTMLDialogElement,
  doc: Document,
): void {
  if (e.key !== "Tab") return;
  const liste = Array.from(
    dialogue.querySelectorAll<HTMLElement>(FOCALISABLES),
  );
  if (liste.length === 0) {
    e.preventDefault();
    dialogue.focus();
    return;
  }
  const premier = liste[0];
  const dernier = liste[liste.length - 1];
  const actif = doc.activeElement;
  if (!liste.includes(actif as HTMLElement)) {
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

export interface ProprietesTiroir extends Omit<
  HTMLAttributes<HTMLDialogElement>,
  "onKeyDown" | "role"
> {
  /** Demande de fermeture : Échap, clic sur le voile ou bouton. Le tiroir ne se ferme jamais seul. */
  onFermer: () => void;
  /** Gestes de l'appelant (flèches…), appelés avant le piège du focus. */
  onKeyDown?: (e: ToucheReact<HTMLDialogElement>) => void;
  children?: ReactNode;
}

/** Le tiroir : monté, il s'ouvre ; démonté, il se ferme et rend le focus. */
export function TiroirAccessible({
  onFermer,
  onKeyDown,
  children,
  className,
  ...reste
}: ProprietesTiroir): ReactNode {
  const ref = useRef<HTMLDialogElement | null>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const origine = ouvrirTiroir(d, document);
    return () => fermerTiroir(d, origine, document);
  }, []);

  return (
    <>
      <style>{CSS_TIROIR}</style>
      <dialog
        {...reste}
        ref={ref}
        data-tiroir=""
        role="dialog"
        aria-modal="true"
        onCancel={(e) => {
          e.preventDefault();
          onFermer();
        }}
        onClick={(e: ClicReact<HTMLDialogElement>) => {
          if (e.target === e.currentTarget) onFermer();
        }}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          bouclerFocus(e, e.currentTarget, document);
        }}
        className={cn(
          "fixed inset-y-0 right-0 left-auto m-0 h-full max-h-none w-[min(440px,100%)] max-w-none overflow-y-auto border-0 border-l border-trait bg-surface-2 p-4 text-texte shadow-[-12px_0_40px_rgb(40_30_20/0.18)] backdrop:bg-voile",
          "max-[860px]:inset-x-0 max-[860px]:bottom-0 max-[860px]:top-auto max-[860px]:h-auto max-[860px]:max-h-[90vh] max-[860px]:w-full max-[860px]:rounded-t-[18px] max-[860px]:border-l-0 max-[860px]:pb-[calc(16px+env(safe-area-inset-bottom,0px))]",
          className,
        )}
      >
        {children}
      </dialog>
    </>
  );
}
