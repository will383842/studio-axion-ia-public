import Link from "next/link";
import { lienCiblage, type FiltreCiblage } from "@/domaine/ciblage/listes";
import { TYPES_AUTOMATISATION } from "@/domaine/ciblage/types";
import { cn } from "@/lib/cn";

type Parametres = Record<string, string | string[] | undefined>;

function Puce({ href, actif, children }: { href: string; actif: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={actif ? "true" : undefined}
      className={cn(
        "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition-colors",
        actif ? "border-orange/40 bg-orange-doux text-orange-vif" : "border-trait bg-surface-1 text-texte-doux hover:border-trait-fort hover:text-texte",
      )}
    >
      {children}
    </Link>
  );
}

/**
 * Filtre par type d'automatisation et bascule des anciens scripts (liens d'adresse, aucun état caché). Composant serveur.
 * La bascule n'apparaît que s'il y a des anciens à montrer.
 */
export function FiltresCiblage({ base, params, filtre, nbAnciens, className }: { base: string; params: Parametres; filtre: FiltreCiblage; nbAnciens: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-2">
        <span className="w-14 shrink-0 text-xs font-bold uppercase tracking-wider text-texte-faible">Type</span>
        <nav aria-label="Type d'automatisation" className="sans-barre -mr-4 flex gap-1.5 overflow-x-auto pb-1 pr-4 sm:mr-0 sm:flex-wrap sm:overflow-visible sm:pr-0">
          <Puce href={lienCiblage(base, params, { typeAuto: undefined })} actif={!filtre.type}>
            Tous
          </Puce>
          {TYPES_AUTOMATISATION.map((t) => (
            <Puce key={t.id} href={lienCiblage(base, params, { typeAuto: t.id })} actif={filtre.type === t.id}>
              {t.libelle}
            </Puce>
          ))}
          <Puce href={lienCiblage(base, params, { typeAuto: "a-classer" })} actif={filtre.type === "a-classer"}>
            À classer
          </Puce>
        </nav>
      </div>
      {(nbAnciens > 0 || filtre.anciens) && (
        <div>
          <Link
            href={lienCiblage(base, params, { anciens: filtre.anciens ? undefined : "1" })}
            className="inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-texte-doux hover:text-orange-vif"
          >
            {filtre.anciens ? "Masquer les anciens" : "Afficher les anciens"}
            <span className="text-[11px] tabular-nums text-texte-faible">{nbAnciens}</span>
          </Link>
        </div>
      )}
    </div>
  );
}
