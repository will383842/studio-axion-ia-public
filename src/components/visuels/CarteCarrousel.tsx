import Link from "next/link";
import type { VueCarrouselCarte } from "@/domaine/visuels/contrats";
import { libellePages } from "@/domaine/visuels/statuts";
import { urlSure } from "../../domaine/visuels/depot";
import { Voyant } from "./Voyants";

/** « Supprimé dans N jours » (un carrousel, masculin) ; « Supprimé aujourd'hui » à 0 jour ou moins. */
export function phraseCorbeille(jours: number): string {
  if (jours <= 0) return "Supprimé aujourd'hui";
  return `Supprimé dans ${jours} ${jours > 1 ? "jours" : "jour"}`;
}

/** Une carte de la liste : vignette, titre, statut, voyant. Toute la carte est un lien (≥ 44 px). */
export function CarteCarrousel({ carrousel: c, href }: { carrousel: VueCarrouselCarte; href?: string }) {
  return (
    <Link
      href={href ?? `/carrousels/${encodeURIComponent(c.id)}`}
      className="flex min-h-24 items-center gap-4 rounded-carte border border-trait bg-surface-1 p-3 transition-colors hover:border-trait-fort hover:bg-surface-2"
    >
      <div className="aspect-[4/5] w-16 shrink-0 overflow-hidden rounded-xl bg-surface-2">
        {urlSure(c.vignetteUrl) ? (
          // eslint-disable-next-line @next/next/no-img-element -- vignette déjà à sa taille
          <img src={urlSure(c.vignetteUrl)} alt="" width={64} height={80} loading="lazy" className="size-full object-cover" />
        ) : (
          <div aria-hidden className="size-full" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[15px] font-semibold text-texte">{c.titre}</h3>
        <p className="mt-0.5 text-sm text-texte-doux">
          {c.libelleStatut} · {libellePages(c)}
        </p>
        {c.joursRestantsCorbeille !== undefined && <p className="mt-0.5 text-sm font-semibold text-ambre">{phraseCorbeille(c.joursRestantsCorbeille)}</p>}
      </div>
      {c.verdict && c.statut !== "echec_rendu" && <Voyant niveau={c.verdict} avecPorte />}
    </Link>
  );
}
