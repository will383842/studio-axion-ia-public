import { Icone } from "@/components/ui/Icone";
import { LogoReseau, type EtatLogoReseau } from "@/components/ui/LogoReseau";
import { ETATS_RESEAU_GENERATEUR, QUI_PARLE, ADRESSES } from "@/domaine/libelles";
import type { ReseauDeclinaison } from "@/domaine/types";
import { cn } from "@/lib/cn";
import { obtenirReseau } from "@/reseaux";
import { RESEAUX_DECLINAISON } from "@/reseaux/codes";
import type { LigneGrilleAffichee } from "./donnees";

/** Lettres d'une ligne (L, I, V puis T) : comment la version est dite. */
export function lettresLigne(l: Pick<LigneGrilleAffichee, "mode" | "adresse">): string | undefined {
  return QUI_PARLE[l.mode].lettre + ADRESSES[l.adresse].lettre || undefined;
}

/**
 * Mini-grille d'un sujet (B.6.2) : une ligne par format et par corps (« Avocat », « Avocat · je lis »), 5 colonnes
 * réseaux. Chaque case = `LogoReseau` avec `etat` (couleur ET signe) et `lettres`. Tenue à 390 px : 5 × 36 px + libellé.
 */
export function MiniGrille({ lignes, reseauActif }: { lignes: LigneGrilleAffichee[]; reseauActif?: ReseauDeclinaison | null }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_repeat(5,2.25rem)] items-center gap-x-1.5 gap-y-1.5">
      <span aria-hidden />
      {RESEAUX_DECLINAISON.map((r) => (
        <span
          key={r}
          aria-hidden
          className={cn("text-center font-titre text-[10px] leading-none", reseauActif === r ? "text-orange-vif" : reseauActif ? "text-texte-faible/40" : "text-texte-faible")}
        >
          {obtenirReseau(r).monogramme}
        </span>
      ))}
      {lignes.map((l) => (
        <Ligne key={`${l.formatId}-${l.mode}-${l.adresse}`} ligne={l} reseauActif={reseauActif} />
      ))}
    </div>
  );
}

function Ligne({ ligne, reseauActif }: { ligne: LigneGrilleAffichee; reseauActif?: ReseauDeclinaison | null }) {
  const lettres = lettresLigne(ligne);
  return (
    <>
      <span className="text-[13px] font-semibold leading-tight text-texte-doux">{ligne.libelle}</span>
      {RESEAUX_DECLINAISON.map((r) => {
        const etat = (ligne.cases[r]?.etat ?? "absent") as EtatLogoReseau;
        return <LogoReseau key={r} reseau={r} etat={etat} lettres={etat !== "absent" ? lettres : undefined} className={cn(reseauActif && reseauActif !== r && "opacity-25")} />;
      })}
    </>
  );
}

/** Légende repliable des cases. */
export function LegendeGrille() {
  const etats = (["absent", "a-relire", "validee", "en-video", "programmee", "publiee", "probleme"] as const).map((e) => [e, ETATS_RESEAU_GENERATEUR[e]] as const);
  return (
    <details className="group rounded-carte border border-trait bg-surface-1 px-4">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between text-sm font-semibold text-texte-doux">
        Légende
        <Icone nom="chevron-bas" size={16} className="transition-transform group-open:rotate-180" />
      </summary>
      <ul className="grid grid-cols-2 gap-3 pb-3">
        {etats.map(([e, d]) => (
          <li key={e} className="flex items-center gap-2 text-sm text-texte">
            <LogoReseau reseau="tiktok" etat={e} />
            {d.libelle}
          </li>
        ))}
      </ul>
      <p className="pb-4 text-xs text-texte-faible">
        Lettre sur une case : <b>L</b> je lis · <b>I</b> j&apos;improvise · <b>V</b> voix off · <b>T</b> tu
      </p>
    </details>
  );
}
