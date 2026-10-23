import Link from "next/link";
import { cn } from "@/lib/cn";
import { Icone, type NomIcone } from "./Icone";

/** Tuile de grille (feuille « Plus », Bibliothèque sur mobile) : icône, nom, compteur. */
export function Tuile({ href, icone, libelle, compteur, onClick, className }: { href: string; icone: NomIcone; libelle: string; compteur?: number; onClick?: () => void; className?: string }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "group relative isolate flex min-h-24 flex-col justify-between gap-3 overflow-hidden rounded-carte border border-trait bg-surface-1 p-4 transition-[border-color,background-color] duration-200 hover:border-trait-fort hover:bg-surface-2",
        className,
      )}
    >
      <span className="grid size-10 place-items-center rounded-xl bg-orange-doux text-orange-vif transition-transform duration-200 group-hover:scale-105">
        <Icone nom={icone} size={20} />
      </span>
      <span className="flex items-end justify-between gap-2">
        <span className="text-[15px] font-semibold leading-tight text-texte">{libelle}</span>
        {compteur !== undefined && <span className="font-titre text-lg tabular-nums leading-none text-texte-faible">{compteur}</span>}
      </span>
    </Link>
  );
}
