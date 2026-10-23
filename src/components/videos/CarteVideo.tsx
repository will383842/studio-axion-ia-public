import Link from "next/link";
import { Icone } from "@/components/ui/Icone";
import { insecable } from "@/lib/textes";
import { PastilleEtat } from "@/components/ui/PastilleEtat";
import { VignetteVideo } from "@/components/ui/VignetteVideo";
import { cn } from "@/lib/cn";
import type { VueVideoCarte } from "@/services/vues";
import { adresseFicheVideo, nomCourtFormat } from "@/formats";
import { IlYA } from "@/components/ui/IlYA";

/**
 * Carte d'une vidéo (Accueil, Mes vidéos, onglets de format, Calendrier).
 * Vignette au ratio principal, état, titre sur deux lignes, format en petit.
 */
export function CarteVideo({
  video: v,
  href,
  afficherFormat = true,
  ratioForce,
  prioritaire,
  className,
}: {
  video: VueVideoCarte;
  href?: string;
  afficherFormat?: boolean;
  /** Force un ratio d'affichage (grilles homogènes). */
  ratioForce?: VueVideoCarte["ratioPrincipal"];
  prioritaire?: boolean;
  className?: string;
}) {
  const lien = href ?? adresseFicheVideo(v);
  const enCours = v.travail && (v.travail.statut === "en_cours" || v.travail.statut === "en_file");
  const enEchec = v.statut === "echec";
  return (
    <Link href={lien} className={cn("group block", className)}>
      <VignetteVideo
        src={v.vignette}
        titre={v.titre}
        ratio={ratioForce ?? v.ratioPrincipal}
        ratioImage={v.ratioPrincipal}
        dureeSec={v.statut === "prete" ? v.dureeSec : undefined}
        dureeEnviron={v.dureeEstimee}
        progression={enCours ? v.travail!.progression : enEchec ? (v.travail?.progression ?? 0) : undefined}
        enEchec={enEchec}
        lecture={v.statut === "prete"}
        prioritaire={prioritaire}
        coin={
          v.statut === "prete" && v.etapeEditoriale ? (
            <PastilleEtat type="editorial" statut={v.etapeEditoriale} className="bg-fond/80 backdrop-blur" />
          ) : v.statut !== "prete" ? (
            <PastilleEtat type="video" statut={v.statut} className="bg-fond/80 backdrop-blur" />
          ) : undefined
        }
      />
      <div className="mt-2 px-0.5">
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-texte group-hover:text-orange-vif">{insecable(v.titre)}</p>
        <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-texte-faible">
          {afficherFormat && (
            <>
              <Icone nom={v.format.icone} size={12} />
              <span className="truncate">{nomCourtFormat(v.format)}</span>
              <span>·</span>
            </>
          )}
          <span className="shrink-0"><IlYA iso={v.modifieLe} /></span>
        </p>
      </div>
    </Link>
  );
}
