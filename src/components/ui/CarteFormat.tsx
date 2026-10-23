import Image from "next/image";
import Link from "next/link";
import type { Ratio } from "@/domaine/types";
import { libelleDuree, nomCourtFormat } from "@/formats";
import { cn } from "@/lib/cn";
import { ApercuVideoSurvol } from "./ApercuVideoSurvol";
import { Icone, type NomIcone } from "./Icone";
import { Pastille } from "./Pastille";
import { FormeRatio } from "./SelecteurPastilles";

export interface DonneesCarteFormat {
  id: string;
  nom: string;
  accroche: string;
  icone: NomIcone;
  statut: "actif" | "bientot" | "masque";
  durees: number[];
  ratios: Ratio[];
  nbVideos?: number;
  exemple?: { vignette: string; video: string; ratio: string };
  /** Format en essai chez Will : carte normale (cliquable), pastille « Essai ». */
  essai?: boolean;
}

/**
 * Carte d'un format (Nouvelle vidéo, Formats). Aperçu animé (vidéo en boucle au survol
 * sur ordinateur, vignette sinon), durées et ratios en pastilles. « Bientôt » : grisé, non cliquable, pastille visible (aussi en compacte).
 */
export type ProprietesCarteFormat = { compacte?: boolean; className?: string } & (
  | { format: DonneesCarteFormat & { statut: "actif" }; href: string }
  | { format: DonneesCarteFormat & { statut: "bientot" | "masque" }; href?: never }
);

export function CarteFormat({ format, href, compacte, className }: ProprietesCarteFormat) {
  const bientot = format.statut !== "actif";
  const classes = cn(
    "group relative isolate flex overflow-hidden rounded-carte border bg-surface-1 shadow-carte transition-[border-color,transform] duration-200 ease-studio",
    bientot ? "cursor-not-allowed border-trait opacity-70" : "border-trait hover:-translate-y-0.5 hover:border-orange/60",
    compacte ? "items-center gap-3 p-3" : "flex-col",
    className,
  );
  const contenu = (
    <>
      {!compacte && (
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-surface-2 sm:aspect-[4/3]">
          {format.exemple && format.exemple.ratio !== "16:9" ? (
            // Exemple vertical : montré ENTIER dans un cadre de téléphone sur la lueur (jamais recadré).
            <>
              <div className="absolute inset-0 lueur-forte" />
              <div className={cn("absolute bottom-0 right-6 top-5 aspect-[9/16] overflow-hidden rounded-t-2xl border border-b-0 border-trait-fort shadow-carte transition-transform duration-300 group-hover:-translate-y-1", bientot && "opacity-50 grayscale-[40%]")}>
                <Image src={format.exemple.vignette} alt="" fill sizes="200px" className="object-cover" />
                {!bientot && <ApercuVideoSurvol src={format.exemple.video} />}
              </div>
            </>
          ) : format.exemple ? (
            <>
              <Image src={format.exemple.vignette} alt="" fill sizes="(max-width: 640px) 100vw, 320px" className={cn("object-cover transition-opacity duration-300", bientot && "opacity-50 grayscale-[40%]")} />
              {!bientot && <ApercuVideoSurvol src={format.exemple.video} />}
            </>
          ) : (
            <div className="absolute inset-0 lueur-forte" />
          )}
          <div aria-hidden className="absolute inset-0 bg-linear-to-t from-surface-1 via-surface-1/10 to-transparent" />
          <span className={cn("absolute left-3 top-3 grid size-11 place-items-center rounded-2xl backdrop-blur", bientot ? "bg-surface-2/80 text-texte-doux" : "bg-orange text-sur-orange shadow-orange")}>
            <Icone nom={format.icone} size={22} />
          </span>
          {bientot && (
            <Pastille ton="neutre" className="absolute right-3 top-3">
              Bientôt
            </Pastille>
          )}
          {!bientot && format.essai && (
            <Pastille ton="ambre" className="absolute right-3 top-3">
              Essai
            </Pastille>
          )}
        </div>
      )}
      {compacte && (
        <span className={cn("grid size-12 shrink-0 place-items-center rounded-2xl", bientot ? "bg-surface-2 text-texte-doux" : "bg-orange text-sur-orange")}>
          <Icone nom={format.icone} size={22} />
        </span>
      )}
      <div className={cn("flex min-w-0 flex-1 flex-col", !compacte && "gap-3 p-4 pt-1")}>
        <div className="min-w-0">
          <h3 className={cn("truncate text-texte", compacte ? "text-base" : "text-lg")}>{nomCourtFormat(format)}</h3>
          <p className="truncate text-sm text-texte-doux">{format.accroche}</p>
        </div>
        {!compacte && (
          <div className="flex flex-wrap items-center gap-1.5">
            {format.durees.slice(0, 4).map((d) => (
              <span key={d} className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-texte-doux">
                {libelleDuree(d)}
              </span>
            ))}
            <span className="mx-1 h-3 w-px bg-trait" />
            {format.ratios.map((r) => (
              <span key={r} className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-texte-doux">
                <FormeRatio ratio={r} className="scale-[0.6]" />
                {r}
              </span>
            ))}
          </div>
        )}
      </div>
      {compacte && bientot && <Pastille ton="neutre">Bientôt</Pastille>}
      {compacte && !bientot && format.essai && <Pastille ton="ambre">Essai</Pastille>}
      {compacte && format.nbVideos !== undefined && <span className="font-titre text-lg tabular-nums text-texte-doux">{format.nbVideos}</span>}
      {compacte && !bientot && <Icone nom="chevron-droite" size={18} className="text-texte-faible" />}
    </>
  );
  // Un générateur pas encore fait reste visible (grisé, « Bientôt ») mais n'est pas un lien.
  return href === undefined ? (
    <div aria-disabled="true" className={classes}>
      {contenu}
    </div>
  ) : (
    <Link href={href} className={classes}>
      {contenu}
    </Link>
  );
}
