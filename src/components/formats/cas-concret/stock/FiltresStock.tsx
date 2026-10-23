/**
 * Les filtres du stock des cas : une rangée de pastilles par groupe (secteur, taille, offre, état).
 * Deux usages, sans état propre : en liens (`hrefDe`, tableau de bord du serveur) ou en boutons (`onChange`, écran de choix).
 * Toucher la pastille active la retire. Aucun appel, aucune dépense.
 */
import { cn } from "@/lib/cn";
import type { FiltresStock as Filtres } from "@/services/cas-concret-stock-synthese";
import type { GroupeFiltre } from "./filtres-stock";

const BASE = "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-[14px] transition-colors";
const ACTIVE = "border-orange bg-orange text-sur-orange";
const REPOS = "border-trait bg-surface-2 text-texte hover:border-trait-fort";

export function FiltresStock({ groupes, actuels, hrefDe, onChange }: { groupes: readonly GroupeFiltre[]; actuels: Filtres; hrefDe?: (f: Filtres) => string; onChange?: (f: Filtres) => void }) {
  const sans = (cle: keyof Filtres): Filtres => {
    const { [cle]: _retire, ...reste } = actuels;
    void _retire;
    return reste;
  };
  const avec = (cle: keyof Filtres, valeur: string): Filtres => ({ ...actuels, [cle]: valeur }) as Filtres;
  const actif = Object.values(actuels).some(Boolean);

  return (
    <div className="flex flex-col gap-3" role="group" aria-label="Filtres du stock">
      {groupes.map((g) => (
        <div key={g.cle} role="group" aria-labelledby={`filtre-stock-${g.cle}`} className="flex flex-col gap-1.5">
          <span id={`filtre-stock-${g.cle}`} className="text-[13px] font-semibold text-texte-doux">{g.libelle}</span>
          <span className="flex flex-wrap gap-2">
            {g.options.map((o) => {
              const choisi = actuels[g.cle] === o.valeur;
              const cible = choisi ? sans(g.cle) : avec(g.cle, o.valeur);
              const contenu = (
                <>
                  <span>{o.libelle}</span>
                  {o.nombre !== undefined && <span className={cn("text-[13px]", !choisi && "opacity-80")}>{o.nombre}</span>}
                </>
              );
              return hrefDe ? (
                <a key={o.valeur} href={hrefDe(cible)} aria-current={choisi ? "true" : undefined} className={cn(BASE, choisi ? ACTIVE : REPOS)}>{contenu}</a>
              ) : (
                <button key={o.valeur} type="button" aria-pressed={choisi} onClick={() => onChange?.(cible)} className={cn(BASE, choisi ? ACTIVE : REPOS)}>{contenu}</button>
              );
            })}
          </span>
        </div>
      ))}
      {actif && (hrefDe ? (
        <a href={hrefDe({})} className={cn(BASE, REPOS, "self-start")}>Tout afficher</a>
      ) : (
        <button type="button" onClick={() => onChange?.({})} className={cn(BASE, REPOS, "self-start")}>Tout afficher</button>
      ))}
    </div>
  );
}
