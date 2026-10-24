/**
 * La barre d'onglets de la page « Cas concret MD » : trois LIENS serveur (aucun état dans le navigateur) dans une navigation,
 * l'onglet actif porte `aria-current="page"` (ce sont des liens de page, pas des onglets à bascule : aucun rôle tab), lisible à
 * 360 px (les onglets défilent si besoin). La liste est rendue par la page, dans une section nommée par le lien actif.
 */
import { cn } from "@/lib/cn";
import { lienOnglet, ONGLETS, phraseSyntheseOnglets, type OngletId } from "./onglets";

export const ID_PANNEAU_CAS = "panneau-cas";
export const idOnglet = (id: OngletId): string => `onglet-${id}`;

export function OngletsCasConcret({ actif, nombres, synthese }: { actif: OngletId; nombres: Record<OngletId, number>; synthese: { aFaire: number; faits: number; valides: number } }) {
  return (
    <div className="mt-4">
      <nav aria-label="Listes des cas">
        <div className="flex gap-1 overflow-x-auto border-b border-trait">
          {ONGLETS.map((o) => {
            const choisi = o.id === actif;
            return (
              <a
                key={o.id}
                id={idOnglet(o.id)}
                aria-current={choisi ? "page" : undefined}
                href={lienOnglet(o.id)}
                className={cn(
                  "inline-flex min-h-11 shrink-0 items-center whitespace-nowrap border-b-2 px-4 text-[15px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-orange-vif",
                  choisi ? "border-orange text-texte" : "border-transparent text-texte-doux hover:text-texte",
                )}
              >
                {o.libelle} ({nombres[o.id]})
              </a>
            );
          })}
        </div>
      </nav>
      <p className="mt-3 text-[13px] text-texte-doux">{phraseSyntheseOnglets(synthese)}</p>
    </div>
  );
}
