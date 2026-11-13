import Link from "next/link";
import { Icone } from "@/components/ui/Icone";
import { cn } from "@/lib/cn";
import { PictoReseau } from "./PictoReseau";
import { TYPES_CONTENU, heureLisible, nomReseau, styleReseau, type EntreeCarte } from "./CarteEntreeCalendrier";

export interface ProprietesCarteProposition {
  entree: EntreeCarte;
  /** Raison donnée par l'équipe IA ; absente ou vide : la ligne « Pourquoi ici » n'est pas montrée. */
  pourquoi?: string;
  /** Publication proche déjà au calendrier ; absente ou vide : la ligne « Ressemble à » n'est pas montrée. */
  ressembleA?: string;
  /** Écran « À valider » de l'usine : l'UNIQUE lieu de validation (décision Q4). */
  lienAValider: string;
  className?: string;
}

/**
 * Proposition de l'équipe IA : carte pointillée avec le libellé « Proposée » (le réseau et le type se lisent aussi par le texte et
 * l'icône, jamais par la couleur seule). Le Studio ne la programme, ne la valide ni ne la refuse : un seul lien mène à l'écran
 * « À valider » de l'usine. Aucun bouton, rien n'est envoyé.
 */
export function CarteProposition({ entree, pourquoi, ressembleA, lienAValider, className }: ProprietesCarteProposition) {
  const type = TYPES_CONTENU[entree.type] ?? TYPES_CONTENU.video;
  const heure = heureLisible(entree.heure);
  const raison = pourquoi?.trim();
  const proche = ressembleA?.trim();
  const libelle = ["Proposée", nomReseau(entree.reseau), type.libelle, heure].filter(Boolean).join(", ");
  return (
    <div data-proposition={entree.cle} data-reseau={entree.reseau} style={styleReseau(entree.reseau)} aria-label={libelle} role="group" className={cn("flex w-full flex-col gap-1 rounded-[9px] border-[1.5px] border-dashed border-trait-fort border-l-[5px] border-l-[color:var(--c)] bg-surface-1 px-1.5 py-1 text-left", className)}>
      <span className="flex items-center gap-1.5">
        <PictoReseau reseau={entree.reseau} taille="sm" className="text-xs font-bold text-texte" />
        {heure && <span className="text-sm font-extrabold tabular-nums text-texte">{heure}</span>}
        <span className="ml-auto rounded-full border border-dashed border-trait-fort px-1.5 text-xs font-bold text-texte">Proposée</span>
      </span>
      <span className="flex items-center gap-1 text-xs font-semibold text-texte-doux">
        <Icone nom={type.icone} size={12} />
        {type.libelle}
      </span>
      {raison && (
        <span className="text-xs text-texte-doux">
          <b className="text-texte">Pourquoi ici :</b> {raison}
        </span>
      )}
      {proche && (
        <span className="text-xs text-texte-doux">
          <b className="text-texte">Ressemble à :</b> {proche}
        </span>
      )}
      <Link href={lienAValider} className="inline-flex min-h-[44px] items-center text-xs font-bold text-texte underline hover:text-orange-vif">
        Voir dans « À valider »
      </Link>
    </div>
  );
}
