"use client";

import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icone, type NomIcone } from "./Icone";

export interface ProprietesChamp extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  libelle: string;
  libelleMasque?: boolean;
  /** Une ligne d'aide, au plus. */
  aide?: ReactNode;
  erreur?: string;
  icone?: NomIcone;
  /** Mot de passe : ajoute le bouton « œil ». */
  motDePasse?: boolean;
  suffixe?: ReactNode;
  grand?: boolean;
}

/** Champ de saisie avec libellé, aide et erreur. Hauteur ≥ 48 px. */
export const Champ = forwardRef<HTMLInputElement, ProprietesChamp>(function Champ(
  { libelle, libelleMasque, aide, erreur, icone, motDePasse, suffixe, grand, className, id: idFourni, type, ...props },
  ref,
) {
  const idAuto = useId();
  const id = idFourni ?? idAuto;
  const [visible, setVisible] = useState(false);
  return (
    <div className={className}>
      <label htmlFor={id} className={cn("mb-1.5 block text-sm font-semibold text-texte-doux", libelleMasque && "sr-only")}>
        {libelle}
      </label>
      <div
        className={cn(
          "flex items-center gap-2 rounded-champ border bg-surface-1 px-3.5 transition-colors focus-within:border-orange",
          grand ? "min-h-14" : "min-h-12",
          erreur ? "border-brique" : "border-trait hover:border-trait-fort",
        )}
      >
        {icone && <Icone nom={icone} size={18} className="shrink-0 text-texte-faible" />}
        <input
          ref={ref}
          id={id}
          type={motDePasse ? (visible ? "text" : "password") : type}
          aria-invalid={!!erreur || undefined}
          aria-describedby={erreur ? `${id}-e` : aide ? `${id}-a` : undefined}
          className={cn("min-w-0 flex-1 bg-transparent text-texte outline-none placeholder:text-texte-faible", grand ? "text-lg" : "text-[15px]")}
          {...props}
        />
        {suffixe}
        {motDePasse && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="-mr-2 grid size-11 shrink-0 place-items-center rounded-full text-texte-doux hover:text-texte"
            aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          >
            <Icone nom={visible ? "oeil-barre" : "oeil"} size={20} />
          </button>
        )}
      </div>
      {erreur ? (
        <p id={`${id}-e`} role="alert" className="mt-1.5 flex items-center gap-1.5 text-sm text-brique">
          <Icone nom="attention" size={14} />
          {erreur}
        </p>
      ) : (
        aide && (
          <p id={`${id}-a`} className="mt-1.5 text-sm text-texte-faible">
            {aide}
          </p>
        )
      )}
    </div>
  );
});
