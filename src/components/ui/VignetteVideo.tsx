import Image from "next/image";
import type { Ratio } from "@/domaine/types";
import { cn } from "@/lib/cn";
import { chrono } from "@/lib/dates";
import { Icone } from "./Icone";

const ASPECT: Record<Ratio, string> = { "9:16": "aspect-[9/16]", "1:1": "aspect-square", "4:5": "aspect-[4/5]", "16:9": "aspect-video" };

/**
 * Vignette d'une vidéo, aux proportions de son ratio. Durée en bas à droite,
 * progression en surimpression si la vidéo est en fabrication.
 */
export function VignetteVideo({
  src,
  titre,
  ratio = "9:16",
  ratioImage,
  dureeSec,
  dureeEnviron,
  progression,
  enEchec,
  lecture,
  coin,
  className,
  prioritaire,
  tailles = "(max-width: 640px) 50vw, 240px",
}: {
  src: string | null;
  titre: string;
  ratio?: Ratio;
  /** Ratio réel de l'image : si son orientation diffère du cadre, elle est montrée ENTIÈRE sur un fond flou. */
  ratioImage?: Ratio;
  dureeSec?: number;
  /** Durée estimée (pas encore mesurée sur la vidéo montée) : « ≈ 1:53 ». */
  dureeEnviron?: boolean;
  /** 0–100 : surimpression « en fabrication ». */
  progression?: number;
  enEchec?: boolean;
  /** Affiche le bouton lecture au centre. */
  lecture?: boolean;
  /** Élément en haut à gauche (pastille d'état, case de sélection…). */
  coin?: React.ReactNode;
  className?: string;
  prioritaire?: boolean;
  tailles?: string;
}) {
  const paysage = (r: Ratio) => r === "16:9";
  const entiere = !!ratioImage && paysage(ratioImage) !== paysage(ratio);
  return (
    <div className={cn("group relative isolate w-full overflow-hidden rounded-carte border border-trait bg-surface-2", ASPECT[ratio], className)}>
      {src && entiere ? (
        <>
          <Image src={src} alt="" aria-hidden fill sizes="64px" className="scale-125 object-cover opacity-60 blur-xl" />
          <Image src={src} alt={titre} fill sizes={tailles} priority={prioritaire} className="object-contain transition-transform duration-500 ease-studio group-hover:scale-[1.03]" />
        </>
      ) : src ? (
        <Image src={src} alt={titre} fill sizes={tailles} priority={prioritaire} className="object-cover transition-transform duration-500 ease-studio group-hover:scale-[1.03]" />
      ) : (
        <div className="absolute inset-0 grid place-items-center lueur">
          <Icone nom="film" size={28} className="text-texte-faible" />
        </div>
      )}
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-fond/80 to-transparent" />
      {coin && <div className="absolute left-2 top-2 z-10">{coin}</div>}
      {dureeSec !== undefined && (
        <span className="absolute bottom-2 right-2 rounded-md bg-fond/75 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-texte backdrop-blur">{dureeEnviron ? `≈ ${chrono(dureeSec)}` : chrono(dureeSec)}</span>
      )}
      {lecture && progression === undefined && (
        <span className="absolute left-1/2 top-1/2 grid size-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-fond/60 text-texte backdrop-blur transition-transform group-hover:scale-110">
          <Icone nom="lecture" size={20} className="translate-x-0.5" fill="currentColor" />
        </span>
      )}
      {progression !== undefined && (
        <div className="absolute inset-0 grid place-items-center bg-fond/55 backdrop-blur-[2px]">
          <div className="flex flex-col items-center gap-2">
            <span className={cn("font-titre text-2xl tabular-nums", enEchec ? "text-brique" : "text-texte")}>{enEchec ? "!" : `${progression} %`}</span>
            <div className="h-1 w-16 overflow-hidden rounded-full bg-surface-3">
              <div className={cn("h-full rounded-full transition-[width] duration-700", enEchec ? "bg-brique" : "bg-orange")} style={{ width: `${progression}%` }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
