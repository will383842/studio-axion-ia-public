import Link from "next/link";
import { EtatVide } from "@/components/ui/EtatVide";
import { PastillesReseaux } from "@/components/videos/PastillesReseaux";
import { filtrerContenus, paginerContenus, type ContenuBibliotheque, type FiltresContenus as Filtres, type PageContenus } from "@/domaine/filtres-contenus";
import { LIBELLES_TYPE_CONTENU, libelleStatutCommun } from "@/domaine/taxonomie-contenu";
import { urlSure } from "@/domaine/visuels/depot";
import { lienContenus, type FiltresLus, type ParametresContenus } from "./FiltresContenus";

/** Vue de l'écran : filtre puis pagine (la logique est celle du service de lecture, rien n'est recalculé ailleurs). */
export function calculerVueContenus(contenus: readonly ContenuBibliotheque[], f: Partial<FiltresLus>): PageContenus {
  const { page, ...filtres } = f;
  return paginerContenus(filtrerContenus(contenus, filtres), page);
}

/** Fiche d'un contenu : la vidéo a la sienne ; images et carrousels s'ouvrent dans l'écran des carrousels. */
export function adresseContenu(c: Pick<ContenuBibliotheque, "id" | "type">): string {
  return `${c.type === "video" ? "/videos" : "/carrousels"}/${encodeURIComponent(c.id)}`;
}

function Carte({ c }: { c: ContenuBibliotheque }) {
  const vignette = urlSure(c.vignetteUrl);
  return (
    <Link
      href={adresseContenu(c)}
      className="flex h-full min-h-24 flex-col gap-3 rounded-carte border border-trait bg-surface-1 p-3 transition-colors hover:border-trait-fort hover:bg-surface-2"
    >
      <div className="aspect-[4/5] w-full overflow-hidden rounded-xl bg-surface-2">
        {vignette ? (
          // eslint-disable-next-line @next/next/no-img-element -- vignette déjà à sa taille
          <img src={vignette} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <div aria-hidden className="size-full" />
        )}
      </div>
      <div className="min-w-0">
        <h3 className="truncate text-[15px] font-semibold text-texte">{c.titre}</h3>
        <p className="mt-0.5 text-sm text-texte-doux">
          {LIBELLES_TYPE_CONTENU[c.type]} · {libelleStatutCommun(c.statut)}
        </p>
      </div>
      <div className="mt-auto">
        {c.reseaux.length > 0 ? <PastillesReseaux reseaux={c.reseaux} precis /> : <span className="text-xs text-texte-faible">Réseau non précisé</span>}
      </div>
    </Link>
  );
}

/** La grille des contenus de la page courante, avec la pagination (liens qui gardent les filtres). Composant serveur. */
export function GrilleContenus({ vue, params, filtres }: { vue: PageContenus; params: ParametresContenus; filtres: Filtres }) {
  if (vue.total === 0) {
    const filtre = !!(filtres.type || filtres.reseau || filtres.statut);
    return (
      <EtatVide
        compact
        icone="grille"
        titre="Aucun contenu"
        phrase={filtre ? "Rien ne correspond à ces choix." : "Ici, vous verrez vos vidéos, images et carrousels dès qu'il y en aura."}
        action={
          filtre ? (
            <Link href="/contenus" className="text-sm font-semibold text-orange-vif">
              Tout afficher
            </Link>
          ) : undefined
        }
      />
    );
  }
  const vers = (n: number) => lienContenus(params, { page: n > 1 ? String(n) : undefined });
  return (
    <div className="space-y-5">
      <p className="text-sm text-texte-doux">{vue.total === 1 ? "1 contenu" : `${vue.total} contenus`}</p>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {vue.elements.map((c) => (
          <li key={`${c.type}-${c.id}`}>
            <Carte c={c} />
          </li>
        ))}
      </ul>
      {vue.pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between gap-3 text-sm">
          {vue.page > 1 ? (
            <Link href={vers(vue.page - 1)} className="font-semibold text-orange-vif">
              Page précédente
            </Link>
          ) : (
            <span />
          )}
          <span className="text-texte-doux">
            Page {vue.page} sur {vue.pages}
          </span>
          {vue.page < vue.pages ? (
            <Link href={vers(vue.page + 1)} className="font-semibold text-orange-vif">
              Page suivante
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
