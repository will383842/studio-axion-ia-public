import Link from "next/link";
import type { IdReseau } from "@/domaine/types";
import { cn } from "@/lib/cn";
import { plageMois } from "@/lib/calendrier-plages";
import { RESEAUX_CALENDRIER } from "./BarreFiltres";
import { libelleJour } from "./BarreVue";
import { RepereReseau, jourLisible, nomReseau, type EntreeCarte } from "./CarteEntreeCalendrier";

export interface ProprietesGrilleMois {
  /** Mois à montrer, « AAAA-MM » ; vide ou illisible : le mois d'aujourd'hui. */
  mois: string;
  /** Jour de Paris d'aujourd'hui (AAAA-MM-JJ), fourni par l'appelant. */
  aujourdhui: string;
  entrees: readonly EntreeCarte[];
  /** Réseaux allumés (défaut : les quatre de la maquette) : un repère par réseau dans chaque jour. */
  reseaux?: readonly IdReseau[];
  /** Ouvrir un jour : par lien (rendu serveur) ou par geste (rendu client). */
  lienJour?: (jour: string) => string;
  onOuvrirJour?: (jour: string) => void;
  className?: string;
}

const EN_TETES = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];
const MOIS = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Mois en 6 lignes de 7 jours, lundi d'abord. Aujourd'hui est marqué, les jours des mois voisins sont estompés.
 * Chaque jour porte un repère par réseau : picto, nombre de publications (les idées ne comptent pas).
 */
export function GrilleMois({ mois, aujourdhui, entrees, reseaux = RESEAUX_CALENDRIER, lienJour, onOuvrirJour, className }: ProprietesGrilleMois) {
  const cle = MOIS.test(mois) ? mois : jourLisible(aujourdhui) ? aujourdhui.slice(0, 7) : null;
  if (!cle) return <div className={cn("rounded-xl border border-dashed border-trait-fort bg-surface-1 p-5 text-center text-sm text-texte-doux", className)}>Mois illisible. Revenez à aujourd&apos;hui.</div>;
  const plage = plageMois(`${cle}-01`);
  const comptees = entrees.filter((e) => e.etat !== "idee" && reseaux.includes(e.reseau));

  const jourDe = (jour: string) => {
    const duJour = comptees.filter((e) => e.jour === jour);
    const estAujourdhui = jour === aujourdhui;
    const horsMois = !jour.startsWith(plage.mois);
    // Le libellé remplace le contenu à l'oral : le détail par réseau y est donc redit (il n'est plus seulement dans `title`).
    const detail = reseaux.flatMap((reseau) => {
      const nombre = duJour.filter((e) => e.reseau === reseau).length;
      return nombre ? [`${nomReseau(reseau)} ${nombre}`] : [];
    });
    const libelle = `${libelleJour(jour)}, ${duJour.length} publication${duJour.length > 1 ? "s" : ""}${detail.length ? ` : ${detail.join(", ")}` : ""}`;
    const classes = cn(
      "block min-h-[78px] w-full rounded-[10px] border p-1.5 text-left",
      // Hors du mois : contour en pointillé et fond plus doux, jamais d'opacité (elle ferait passer le texte sous 4,5:1).
      estAujourdhui ? "border-orange bg-orange-doux" : horsMois ? "border-dashed border-trait-fort bg-surface-2" : "border-trait bg-surface-1",
      (lienJour || onOuvrirJour) && "hover:border-orange",
    );
    const commun = { "data-jour": jour, "data-hors-mois": horsMois ? "true" : undefined, "aria-current": estAujourdhui ? ("date" as const) : undefined, "aria-label": libelle, className: classes };
    const contenu = (
      <>
        <b className={cn("tabular-nums", horsMois ? "text-texte-faible" : "text-texte")}>{Number(jour.slice(8))}</b>
        <span className="mt-1.5 flex flex-wrap gap-1">
          {reseaux.map((reseau) => {
            const nombre = duJour.filter((e) => e.reseau === reseau).length;
            if (!nombre) return null;
            return <RepereReseau key={reseau} reseau={reseau} nombre={nombre} />;
          })}
        </span>
      </>
    );
    if (lienJour) {
      return (
        <Link href={lienJour(jour)} {...commun}>
          {contenu}
        </Link>
      );
    }
    if (onOuvrirJour) {
      return (
        <button type="button" onClick={() => onOuvrirJour(jour)} {...commun}>
          {contenu}
        </button>
      );
    }
    return (
      <div role="group" {...commun}>
        {contenu}
      </div>
    );
  };

  return (
    <div className={className}>
      <div role="table" aria-label="Mois" className="grid grid-cols-7 gap-1">
        <div role="row" className="contents">
          {EN_TETES.map((j) => (
            <div key={j} role="columnheader" className="px-1 py-0.5 text-[11px] font-bold uppercase text-texte-faible">
              {j}
            </div>
          ))}
        </div>
        {plage.semaines.map((semaine) => (
          <div key={semaine[0]} role="row" data-semaine={semaine[0]} className="contents">
            {semaine.map((jour) => (
              <div key={jour} role="cell" className="min-w-0">
                {jourDe(jour)}
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-texte-faible">
        Chaque pastille donne le nombre de publications d&apos;un réseau.
        {(lienJour || onOuvrirJour) && " Cliquez sur un jour pour l'ouvrir."}
      </p>
    </div>
  );
}
