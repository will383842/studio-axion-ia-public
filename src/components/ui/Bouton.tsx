import { Slot } from "radix-ui";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icone, type NomIcone } from "./Icone";
import { PastilleEssai } from "./PastilleEssai";

export type VarianteBouton = "principal" | "secondaire" | "fantome" | "contour" | "danger";
export type TailleBouton = "md" | "lg" | "xl";

const VARIANTES: Record<VarianteBouton, string> = {
  principal: "bg-orange text-sur-orange shadow-orange hover:bg-orange-vif active:brightness-95",
  secondaire: "bg-surface-2 text-texte hover:bg-surface-3 border border-trait",
  fantome: "bg-transparent text-texte-doux hover:bg-surface-2 hover:text-texte",
  contour: "bg-transparent text-texte border border-trait-fort hover:border-orange hover:text-orange-vif",
  danger: "bg-brique-doux text-brique border border-brique/30 hover:bg-brique hover:text-sur-orange",
};

const TAILLES: Record<TailleBouton, string> = {
  md: "min-h-11 px-4 text-sm gap-2",
  lg: "min-h-12 px-5 text-[15px] gap-2.5",
  xl: "min-h-14 px-6 text-base gap-3",
};

export interface ProprietesBouton extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBouton;
  taille?: TailleBouton;
  icone?: NomIcone;
  iconeDroite?: NomIcone;
  chargement?: boolean;
  /** Action d'un fournisseur simulé : affiche la pastille ambre « Essai » (AV2.4-4). */
  essai?: boolean;
  pleineLargeur?: boolean;
  /** Rend l'enfant (ex. <Link>) avec le style du bouton ; les icônes sont injectées dans l'enfant. */
  asChild?: boolean;
  children?: ReactNode;
}

/** Bouton en pastille. Toujours ≥ 44 px de haut. Une seule variante « principal » par écran. */
export const Bouton = forwardRef<HTMLButtonElement, ProprietesBouton>(function Bouton(
  { variante = "principal", taille = "md", icone, iconeDroite, chargement, essai, pleineLargeur, asChild, className, children, disabled, type, ...props },
  ref,
) {
  const tailleIcone = taille === "xl" ? 20 : 18;
  const classes = cn(
    "relative inline-flex select-none items-center justify-center rounded-full font-semibold transition-[background-color,color,border-color,transform,box-shadow] duration-200 ease-studio active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45",
    VARIANTES[variante],
    TAILLES[taille],
    pleineLargeur && "w-full",
    className,
  );
  if (asChild) {
    return (
      <Slot.Root ref={ref} className={classes} {...props}>
        {icone && <Icone nom={icone} size={tailleIcone} />}
        <Slot.Slottable>{children}</Slot.Slottable>
        {iconeDroite && <Icone nom={iconeDroite} size={tailleIcone} />}
      </Slot.Root>
    );
  }
  return (
    <button ref={ref} type={type ?? "button"} className={classes} disabled={disabled || chargement} aria-busy={chargement || undefined} {...props}>
      {chargement ? <Icone nom="chargement" size={tailleIcone} className="animate-spin" /> : icone && <Icone nom={icone} size={tailleIcone} />}
      {children}
      {iconeDroite && <Icone nom={iconeDroite} size={tailleIcone} />}
      {/* Sur un bouton orange plein, la pastille passe en clair pour rester lisible. */}
      {essai && <PastilleEssai className={cn("ml-1", variante === "principal" && "border-sur-orange/50 bg-fond/35 text-sur-orange")} />}
    </button>
  );
});

export interface ProprietesBoutonIcone extends ButtonHTMLAttributes<HTMLButtonElement> {
  icone: NomIcone;
  /** Libellé obligatoire (lecteurs d'écran + infobulle). */
  libelle: string;
  variante?: "fantome" | "secondaire" | "principal";
  taille?: "md" | "lg";
  /** Petit compteur orange (notifications). */
  compteur?: number;
}

/** Bouton rond à icône seule (44 px). */
export const BoutonIcone = forwardRef<HTMLButtonElement, ProprietesBoutonIcone>(function BoutonIcone(
  { icone, libelle, variante = "fantome", taille = "md", compteur, className, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={libelle}
      title={libelle}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full transition-colors duration-200 disabled:opacity-45",
        taille === "md" ? "size-11" : "size-12",
        variante === "fantome" && "text-texte-doux hover:bg-surface-2 hover:text-texte",
        variante === "secondaire" && "border border-trait bg-surface-2 text-texte hover:bg-surface-3",
        variante === "principal" && "bg-orange text-sur-orange shadow-orange hover:bg-orange-vif",
        className,
      )}
      {...props}
    >
      <Icone nom={icone} size={taille === "md" ? 20 : 22} />
      {!!compteur && (
        <span className="absolute right-1 top-1 grid min-w-[18px] place-items-center rounded-full bg-orange px-1 text-[10px] font-bold leading-[18px] text-sur-orange ring-2 ring-fond">
          {compteur > 9 ? "9+" : compteur}
        </span>
      )}
    </button>
  );
});
