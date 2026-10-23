"use client";

import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import { cn } from "@/lib/cn";
import type { ValeurHabillage, ValeurSousTitres } from "./outils";
import { SousTitreAnime } from "./SousTitreAnime";

/**
 * UNE IMAGE DE VIDÉO avec les choix appliqués (LUT + intensité, sous-titres, habillage, logo, mention IA).
 * Purement visuel : la vraie fabrication passe par le moteur.
 */
export function CadreApercu({
  avant,
  apres,
  intensite = 100,
  sousTitres,
  habillage,
  logo,
  mentionIA = true,
  coupure,
  className,
}: {
  /** Image d'origine (non étalonnée). */
  avant: string | null;
  /** Image étalonnée par la LUT ; absente = approximation (LUT importée, pas encore traitée). */
  apres?: string | null;
  /** 0-100 : part de l'image étalonnée. */
  intensite?: number;
  sousTitres?: ValeurSousTitres | null;
  habillage?: ValeurHabillage | null;
  logo?: string | null;
  mentionIA?: boolean;
  /** Comparaison avant / après : position de la coupure en % (l'après est à droite). */
  coupure?: number;
  className?: string;
}) {
  const reduit = useReducedMotion();
  const lutActive = apres !== undefined;
  const clip = coupure !== undefined ? { clipPath: `inset(0 0 0 ${coupure}%)` } : undefined;
  return (
    <div className={cn("@container relative isolate aspect-video w-full overflow-hidden rounded-carte border border-trait bg-fond", className)}>
      {avant ? <Image src={avant} alt="" fill sizes="(max-width: 1024px) 100vw, 640px" className="object-cover" /> : <div className="absolute inset-0 lueur-forte" />}
      {lutActive && avant && (
        <div className="absolute inset-0 transition-opacity duration-200" style={{ opacity: intensite / 100, ...clip }}>
          {apres ? (
            <Image src={apres} alt="" fill sizes="(max-width: 1024px) 100vw, 640px" className="object-cover" />
          ) : (
            <Image src={avant} alt="" fill sizes="(max-width: 1024px) 100vw, 640px" className="object-cover contrast-125 saturate-150 sepia-[.2]" />
          )}
        </div>
      )}

      <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-fond/70 to-transparent" />

      {habillage?.grandTitre && (
        <p className="titre-affiche absolute inset-x-[19%] top-[15%] text-center leading-[0.95] text-texte drop-shadow-lg" style={{ fontSize: "4.6cqw" }}>
          Mon patron peut-il <span className="text-orange-vif">lire mes mails</span> ?
        </p>
      )}

      {logo && (
        <motion.span
          className="absolute left-[3%] top-[4%] block h-[9%] w-[16%]"
          animate={habillage?.logoAnime && !reduit ? { opacity: [0.75, 1, 0.75] } : undefined}
          transition={{ duration: 2.4, repeat: Infinity }}
        >
          <Image src={logo} alt="" fill sizes="120px" className="object-contain object-left" />
        </motion.span>
      )}

      {mentionIA && (
        <span className="absolute right-[3%] top-[4%] rounded-full bg-fond/70 px-[1.4cqw] py-[0.5cqw] font-semibold text-texte" style={{ fontSize: "2cqw" }}>
          Réalisé avec l&apos;IA
        </span>
      )}

      {sousTitres && <SousTitreAnime style={habillage?.grandTitre && sousTitres.position === "haut" ? { ...sousTitres, position: "centre" } : sousTitres} />}

      {coupure !== undefined && (
        <>
          <span aria-hidden className="absolute inset-y-0 w-0.5 bg-texte shadow-carte" style={{ left: `${coupure}%` }}>
            <span className="absolute left-1/2 top-1/2 grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-texte bg-fond/70 text-texte">
              <svg viewBox="0 0 24 24" className="size-4 fill-none stroke-current" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6l-6 6 6 6M15 6l6 6-6 6" />
              </svg>
            </span>
          </span>
          <span className="absolute left-[3%] top-[4%] rounded-full bg-fond/70 px-2 py-0.5 text-xs font-semibold text-texte">Avant</span>
          <span className="absolute right-[3%] top-[4%] rounded-full bg-orange px-2 py-0.5 text-xs font-semibold text-sur-orange">Après</span>
        </>
      )}
    </div>
  );
}
