import type { VueCarrouselFiche } from "@/domaine/visuels/contrats";
import { urlSure } from "../../domaine/visuels/depot";
import { cn } from "@/lib/cn";

/** Pages d'un carrousel à taille de téléphone (270 px de large, 4:5), en défilement horizontal. */
export function RangeePages({
  pages,
  titre,
  className,
}: {
  pages: VueCarrouselFiche["pages"];
  titre: string;
  className?: string;
}) {
  return (
    // Base 1 à l'écran : le service de rendu numérote à partir de 0 (p.index), on affiche p.index + 1.
    <ul
      aria-label="Pages du carrousel"
      className={cn(
        "sans-barre -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2",
        className,
      )}
    >
      {pages.map((p) => {
        const n = p.index + 1;
        const url = urlSure(p.urlX1);
        return (
          <li key={p.index} className="w-[270px] shrink-0 snap-start">
            <div className="aspect-[4/5] w-[270px] overflow-hidden rounded-carte border border-trait bg-surface-2">
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element -- page déjà rendue à sa taille, adresse fournie par le service
                <img
                  src={url}
                  alt={`Page ${n} : ${titre}`}
                  width={270}
                  height={337}
                  loading="lazy"
                  className="size-full object-cover"
                />
              ) : (
                <div
                  role="img"
                  aria-label={`Page ${n} : ${titre} (pas encore rendue)`}
                  className="grid size-full place-items-center text-sm text-texte-faible"
                >
                  Page {n}
                </div>
              )}
            </div>
            <p aria-hidden="true" className="mt-1.5 text-xs text-texte-faible">
              Page {n}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
