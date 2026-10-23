"use client";

import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { CalqueZonesReseaux } from "@/components/ui/CalqueZonesReseaux";
import { Icone } from "@/components/ui/Icone";
import { TexteEnValeur } from "@/components/ecrire/EditeurBlocs";
import type { MentionIA, Ratio, TexteEcran } from "@/domaine/types";
import { chrono } from "@/lib/dates";
import { cn } from "@/lib/cn";

const ASPECT: Record<Ratio, string> = { "9:16": "aspect-[9/16]", "1:1": "aspect-square", "4:5": "aspect-[4/5]", "16:9": "aspect-video" };
const LARGEUR: Record<Ratio, string> = { "9:16": "w-[64%] max-w-[300px]", "4:5": "w-[78%] max-w-[360px]", "1:1": "w-[84%] max-w-[400px]", "16:9": "w-full max-w-[560px]" };
const COINS: Record<MentionIA["position"], string> = { "haut-gauche": "left-2 top-2", "haut-droite": "right-2 top-2", "bas-gauche": "bottom-2 left-2", "bas-droite": "bottom-2 right-2" };

/** Un texte à l'écran trop long en vertical déborde dans l'interface des réseaux (témoin orange). */
export function texteDeborde(texte: TexteEcran | undefined, ratio: Ratio): boolean {
  if (!texte) return false;
  const parLigne = ratio === "9:16" ? 16 : ratio === "16:9" ? 34 : 22;
  return Math.ceil(texte.texte.length / parLigne) > 2;
}

/**
 * Une image de la vidéo, au ratio choisi : image du plan (cadrage + zoom), grand titre, sous-titre
 * avec mots en valeur, mention IA, et le calque des zones protégées des réseaux (AV2.3-2, AV2.3-9).
 */
export function CadreApercu({
  ratio,
  image,
  cle,
  texteEcran,
  sousTitre,
  motsEnValeur,
  mention,
  zones,
  cadrage,
  debutSec,
  className,
}: {
  ratio: Ratio;
  image: string | null;
  /** Change à chaque plan : relance l'animation. */
  cle: string;
  texteEcran?: TexteEcran;
  sousTitre?: string;
  motsEnValeur?: string[];
  mention?: MentionIA | null;
  zones: boolean;
  cadrage?: { pointInteret: { x: number; y: number }; zoom: number };
  debutSec?: number;
  className?: string;
}) {
  const deborde = zones && texteDeborde(texteEcran, ratio);
  return (
    <motion.div layout transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} className={cn("relative mx-auto overflow-hidden rounded-[20px] border border-trait bg-surface-2 shadow-carte", ASPECT[ratio], LARGEUR[ratio], className)}>
      <AnimatePresence initial={false}>
        <motion.div key={cle} initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.28 }} className="@container absolute inset-0">
          {image ? (
            <Image
              src={image}
              alt=""
              fill
              sizes="(max-width: 640px) 80vw, 400px"
              className="object-cover"
              style={{ objectPosition: `${(cadrage?.pointInteret.x ?? 0.5) * 100}% ${(cadrage?.pointInteret.y ?? 0.4) * 100}%`, transform: `scale(${cadrage?.zoom ?? 1})` }}
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center lueur">
              <Icone nom="visage" size={36} className="text-texte-faible" />
            </div>
          )}
          <div aria-hidden className="absolute inset-0 bg-linear-to-b from-fond/55 via-transparent to-fond/70" />
          {texteEcran && (
            <p
              className={cn(
                "titre-affiche absolute text-center leading-[0.95] text-texte drop-shadow",
                // En 16:9, marges latérales larges : la mention IA (coin) et le visage (centre bas) restent dégagés.
                ratio === "16:9" ? "inset-x-[17%]" : "inset-x-[7%]",
                // Assez haut pour laisser au moins 16 px au-dessus du visage du double.
                texteEcran.position === "haut" ? (ratio === "16:9" ? "top-[18%]" : "top-[8%]") : texteEcran.position === "centre" ? "top-1/2 -translate-y-1/2" : "bottom-[30%]",
                // Taille relative au cadre (unités de conteneur) : le titre ne chevauche jamais les sous-titres.
                ratio === "16:9" ? "line-clamp-2 text-[4.2cqw]" : texteEcran.texte.length > 28 ? "line-clamp-4 text-[8cqw]" : "line-clamp-3 text-[10cqw]",
              )}
            >
              {texteEcran.texte}
            </p>
          )}
          {sousTitre && (
            <p className={cn("absolute inset-x-[8%] text-center font-titre uppercase leading-tight text-texte drop-shadow", ratio === "9:16" ? "bottom-[20%] text-[6cqw]" : ratio === "16:9" ? "bottom-[17%] line-clamp-2 text-[3cqw]" : "bottom-[12%] text-[5cqw]")}>
              <TexteEnValeur texte={sousTitre} mots={motsEnValeur} />
            </p>
          )}
        </motion.div>
      </AnimatePresence>
      {mention?.incrustee && <span className={cn("absolute z-10 rounded bg-fond/70 px-1.5 py-0.5 text-[9px] font-semibold text-texte-doux", COINS[mention.position])}>{mention.texte}</span>}
      {debutSec !== undefined && <span className="absolute bottom-2 left-2 z-10 rounded-md bg-fond/75 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-texte">{chrono(debutSec)}</span>}
      <CalqueZonesReseaux ratio={ratio} visible={zones} deborde={deborde} className="rounded-[20px]" />
    </motion.div>
  );
}
