"use client";

import { forwardRef, useId, useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";
import { useSaisieGardee } from "@/hooks/useSaisieGardee";
import { cn } from "@/lib/cn";

export interface ProprietesZoneTexte extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  libelle: string;
  libelleMasque?: boolean;
  aide?: string;
  erreur?: string;
  /** Affiche « 120 / 2200 » et passe en ambre au-delà. */
  longueurMax?: number;
  /** Façon de compter la longueur du compteur (par défaut : les caractères bruts). */
  compter?: (texte: string) => number;
  /** Hauteur automatique selon le contenu. */
  auto?: boolean;
}

/** Zone de texte, hauteur automatique, compteur de caractères optionnel. */
export const ZoneTexte = forwardRef<HTMLTextAreaElement, ProprietesZoneTexte>(function ZoneTexte(
  { libelle, libelleMasque, aide, erreur, longueurMax, compter, auto = true, className, id: idFourni, value, ...props },
  ref,
) {
  const idAuto = useId();
  const id = idFourni ?? idAuto;
  const interne = useRef<HTMLTextAreaElement | null>(null);
  // Page ouverte avant une mise en ligne : le texte saisi est gardé au rechargement, puis remis dans le champ vide
  // (événement « input » natif : le `onChange` du formulaire le reçoit comme une frappe).
  useSaisieGardee(
    props.readOnly || props.disabled ? null : (idFourni ?? libelle),
    () => interne.current?.value ?? "",
    (texte) => {
      const el = interne.current;
      if (!el || el.value.trim()) return;
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(el, texte);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    },
  );
  useLayoutEffect(() => {
    const el = interne.current;
    if (!auto || !el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value, auto]);
  const longueur = typeof value === "string" ? (compter ? compter(value) : value.length) : 0;
  // L'erreur (ou l'aide) est reliée au champ : le lecteur d'écran la lit avec lui.
  const idMessage = erreur || aide ? `${id}-message` : undefined;
  const decritPar = [props["aria-describedby"], idMessage].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className={cn("text-sm font-semibold text-texte-doux", libelleMasque && "sr-only")}>
          {libelle}
        </label>
        {longueurMax && (
          <span className={cn("text-xs tabular-nums", longueur > longueurMax ? "font-bold text-ambre" : "text-texte-faible")}>
            {longueur} / {longueurMax}
          </span>
        )}
      </div>
      <textarea
        ref={(n) => {
          interne.current = n;
          if (typeof ref === "function") ref(n);
          else if (ref) ref.current = n;
        }}
        id={id}
        value={value}
        rows={3}
        aria-invalid={!!erreur || undefined}
        className={cn(
          "block w-full resize-none rounded-champ border bg-surface-1 px-3.5 py-3 text-[15px] leading-relaxed text-texte outline-none transition-colors placeholder:text-texte-faible focus:border-orange",
          erreur ? "border-brique" : "border-trait hover:border-trait-fort",
        )}
        {...props}
        aria-describedby={decritPar}
      />
      {erreur ? (
        <p id={idMessage} className="mt-1.5 text-sm text-brique">
          {erreur}
        </p>
      ) : (
        aide && (
          <p id={idMessage} className="mt-1.5 text-sm text-texte-faible">
            {aide}
          </p>
        )
      )}
    </div>
  );
});
