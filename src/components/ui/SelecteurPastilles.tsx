"use client";

import { motion } from "motion/react";
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icone, type NomIcone } from "./Icone";

export interface OptionPastille<V extends string | number> {
  valeur: V;
  libelle: ReactNode;
  /** Petite ligne sous le libellé (« TikTok, Reels »). */
  detail?: ReactNode;
  icone?: NomIcone;
  /** Visuel personnalisé à gauche (ex. forme d'un ratio). */
  visuel?: ReactNode;
  desactive?: boolean;
  /** Raison affichée en infobulle si désactivée (capacités du moteur, AV2.2-7). */
  raison?: string;
}

interface Commun<V extends string | number> {
  options: OptionPastille<V>[];
  libelle: string;
  /** Cache le libellé visuellement (reste lu par les lecteurs d'écran). */
  libelleMasque?: boolean;
  taille?: "md" | "lg";
  /** Défilement horizontal sur mobile au lieu du retour à la ligne. */
  defilement?: boolean;
  className?: string;
}

type Proprietes<V extends string | number> =
  | (Commun<V> & { multiple?: false; valeur: V | undefined; onChange: (v: V) => void })
  | (Commun<V> & { multiple: true; valeur: V[]; onChange: (v: V[]) => void; minimum?: number });

/**
 * Sélecteur en pastilles (durées, ratios, réseaux…). Simple ou multiple.
 * Accessible : groupe radio ou cases, navigation au clavier, cibles ≥ 44 px.
 */
export function SelecteurPastilles<V extends string | number>(props: Proprietes<V>) {
  const id = useId();
  const choisies = props.multiple ? props.valeur : props.valeur === undefined ? [] : [props.valeur];

  function basculer(v: V) {
    if (props.multiple) {
      const deja = props.valeur.includes(v);
      if (deja && props.valeur.length <= (props.minimum ?? 0)) return;
      props.onChange(deja ? props.valeur.filter((x) => x !== v) : [...props.valeur, v]);
    } else {
      props.onChange(v);
    }
  }

  return (
    // Choix unique : groupe radio (chaque option porte aria-checked) ; choix multiple : groupe de cases.
    <div role={props.multiple ? "group" : "radiogroup"} aria-labelledby={`${id}-l`} className={cn(props.defilement && "min-w-0", props.className)}>
      <p id={`${id}-l`} className={cn("mb-2 text-sm font-semibold text-texte-doux", props.libelleMasque && "sr-only")}>
        {props.libelle}
      </p>
      <div className={cn("flex gap-2", props.defilement ? "sans-barre -mx-4 overflow-x-auto px-4 pb-1" : "flex-wrap")}>
        {props.options.map((o, i) => {
          const actif = choisies.includes(o.valeur);
          // La raison d'une option grisée est dite aux lecteurs d'écran, pas seulement en infobulle.
          const idRaison = o.desactive && o.raison ? `${id}-r${i}` : undefined;
          return (
            <button
              key={String(o.valeur)}
              type="button"
              role={props.multiple ? "checkbox" : "radio"}
              aria-checked={actif}
              disabled={o.desactive}
              title={o.desactive ? o.raison : undefined}
              aria-describedby={idRaison}
              onClick={() => basculer(o.valeur)}
              className={cn(
                "relative flex shrink-0 items-center gap-2 rounded-full border text-left font-semibold transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40",
                props.taille === "lg" ? "min-h-14 px-5 text-base" : "min-h-11 px-4 text-sm",
                actif ? "border-orange text-sur-orange" : "border-trait bg-surface-1 text-texte hover:border-trait-fort hover:bg-surface-2",
              )}
            >
              {actif && (
                <motion.span
                  layoutId={props.multiple ? undefined : `${id}-fond`}
                  className="absolute inset-0 -z-0 rounded-full bg-orange"
                  transition={{ type: "spring", stiffness: 500, damping: 38 }}
                />
              )}
              <span className="relative flex items-center gap-2">
                {o.visuel}
                {o.icone && <Icone nom={o.icone} size={16} />}
                <span className="flex flex-col leading-tight">
                  <span>{o.libelle}</span>
                  {o.detail && <span className={cn("text-[11px] font-medium", actif ? "text-sur-orange" : "text-texte-faible")}>{o.detail}</span>}
                </span>
                {props.multiple && actif && <Icone nom="coche" size={14} />}
              </span>
              {idRaison && (
                <span id={idRaison} className="sr-only">
                  {o.raison}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Petit rectangle aux proportions d'un ratio (visuel des pastilles de ratio). */
export function FormeRatio({ ratio, className }: { ratio: string; className?: string }) {
  const [l, h] = ratio.split(":").map(Number);
  const echelle = 18 / Math.max(l, h);
  return <span aria-hidden className={cn("inline-block rounded-[3px] border-2 border-current", className)} style={{ width: l * echelle, height: h * echelle }} />;
}
