import Link from "next/link";
import { lienFiltres, type FiltresMesVideos as Filtres, type ParametresAdresse } from "@/domaine/filtres-mes-videos";
import { ETAPES_EDITORIALES } from "@/domaine/libelles";
import type { EtapeEditoriale, IdReseau } from "@/domaine/types";
import { cn } from "@/lib/cn";
import { obtenirReseau } from "@/reseaux";

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

function Rangee({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-xs font-bold uppercase tracking-wider text-texte-faible">{titre}</span>
      <nav aria-label={titre} className="sans-barre -mr-4 flex gap-1.5 overflow-x-auto pb-1 pr-4 sm:mr-0 sm:flex-wrap sm:overflow-visible sm:pr-0">
        {children}
      </nav>
    </div>
  );
}

const PLURIEL: Record<EtapeEditoriale, string> = { a_relire: "À relire", validee: "Validées", programmee: "Programmées", publiee: "Publiées" };

/**
 * Deux rangées de puces (lot M) : Réseau (seulement ceux qui ont une vidéo, avec leur nombre) et Étape.
 * Ce sont des liens d'adresse : aucun état caché, le partage et le rechargement rouvrent la même vue. Composant serveur.
 */
export function FiltresMesVideos({
  base,
  params,
  filtres,
  reseaux,
  className,
}: {
  base: string;
  params: ParametresAdresse;
  filtres: Filtres;
  reseaux: { reseau: IdReseau; nombre: number }[];
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {(reseaux.length > 0 || filtres.reseau) && (
        <Rangee titre="Réseau">
          <Puce href={lienFiltres(base, params, { reseau: undefined })} actif={!filtres.reseau}>
            Tous
          </Puce>
          {reseaux.map(({ reseau, nombre }) => (
            <Puce key={reseau} href={lienFiltres(base, params, { reseau })} actif={filtres.reseau === reseau}>
              {obtenirReseau(reseau).nom}
              <span className="text-[11px] tabular-nums text-texte-faible">{nombre}</span>
            </Puce>
          ))}
        </Rangee>
      )}
      <Rangee titre="Étape">
        <Puce href={lienFiltres(base, params, { etape: undefined })} actif={!filtres.etape}>
          Toutes
        </Puce>
        {(Object.keys(ETAPES_EDITORIALES) as EtapeEditoriale[]).map((e) => (
          <Puce key={e} href={lienFiltres(base, params, { etape: e })} actif={filtres.etape === e}>
            {PLURIEL[e]}
          </Puce>
        ))}
      </Rangee>
    </div>
  );
}
