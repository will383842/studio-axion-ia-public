import { Icone } from "@/components/ui";
import type { IdReseau } from "@/domaine/types";
import { cn } from "@/lib/cn";
import { obtenirReseau } from "@/reseaux";
import { RESEAUX_GENERATEUR, type EtatCase, type LigneGrille } from "../_demo";
import { ETATS_CASE } from "../_lexique";

const TONS_CASE: Record<EtatCase, string> = {
  vide: "border border-dashed border-trait-fort bg-transparent",
  "a-relire": "bg-ambre-doux text-ambre",
  valide: "bg-sauge-doux text-sauge",
  publie: "bg-orange-doux text-orange-vif",
  probleme: "bg-brique-doux text-brique",
};

/** Une case de la mini-grille : une couleur ET un signe (lisible sans les couleurs). */
export function CaseReseau({ etat, reseau, className }: { etat: EtatCase; reseau?: IdReseau; className?: string }) {
  const e = ETATS_CASE[etat];
  return (
    <span
      role="img"
      aria-label={reseau ? `${obtenirReseau(reseau).nom} : ${e.libelle}` : e.libelle}
      className={cn("grid size-9 place-items-center rounded-lg font-titre text-sm leading-none", TONS_CASE[etat], className)}
    >
      {etat === "a-relire" && <span className="size-2 rounded-full bg-current" />}
      {etat === "probleme" && "!"}
      {e.icone && <Icone nom={e.icone} size={16} />}
    </span>
  );
}

/** Mini-grille d'un sujet : une ligne par format (et par façon de parler), une colonne par réseau. */
export function MiniGrille({ lignes, reseauActif }: { lignes: LigneGrille[]; reseauActif?: IdReseau | null }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_repeat(5,2.25rem)] items-center gap-x-1.5 gap-y-1.5">
      <span aria-hidden />
      {RESEAUX_GENERATEUR.map((r) => (
        <span
          key={r}
          aria-hidden
          className={cn("text-center font-titre text-[10px] leading-none", reseauActif && reseauActif !== r ? "text-texte-faible/40" : "text-texte-faible", reseauActif === r && "text-orange-vif")}
        >
          {obtenirReseau(r).monogramme}
        </span>
      ))}
      {lignes.map((l) => (
        <Ligne key={l.libelle} ligne={l} reseauActif={reseauActif} />
      ))}
    </div>
  );
}

function Ligne({ ligne, reseauActif }: { ligne: LigneGrille; reseauActif?: IdReseau | null }) {
  return (
    <>
      <span className="text-[13px] font-semibold leading-tight text-texte-doux">{ligne.libelle}</span>
      {RESEAUX_GENERATEUR.map((r) => (
        <CaseReseau key={r} reseau={r} etat={ligne.cases[r] ?? "vide"} className={cn(reseauActif && reseauActif !== r && "opacity-25")} />
      ))}
    </>
  );
}

/** Légende repliable des cases. */
export function LegendeGrille() {
  return (
    <details className="group rounded-carte border border-trait bg-surface-1 px-4">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between text-sm font-semibold text-texte-doux">
        Légende
        <Icone nom="chevron-bas" size={16} className="transition-transform group-open:rotate-180" />
      </summary>
      <ul className="grid grid-cols-2 gap-3 pb-4">
        {(Object.keys(ETATS_CASE) as EtatCase[]).map((e) => (
          <li key={e} className="flex items-center gap-2 text-sm text-texte">
            <CaseReseau etat={e} />
            {ETATS_CASE[e].libelle}
          </li>
        ))}
      </ul>
    </details>
  );
}
