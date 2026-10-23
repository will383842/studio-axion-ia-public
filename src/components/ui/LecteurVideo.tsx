"use client";

import { useEffect, useRef, useState } from "react";
import type { Ratio } from "@/domaine/types";
import { cn } from "@/lib/cn";
import { Icone } from "./Icone";

const ASPECT: Record<Ratio, string> = { "9:16": "aspect-[9/16]", "1:1": "aspect-square", "4:5": "aspect-[4/5]", "16:9": "aspect-video" };

/**
 * Lecteur vidéo au ratio réel. Gros bouton lecture, contrôles natifs ensuite.
 * Sur ordinateur, un 9:16 est limité en hauteur (max 78 vh) et centré.
 * Lot M3 : le temps courant est EXPOSÉ (`onTemps`, image par image pendant la lecture) et la lecture peut être
 * déplacée de l'extérieur (`onPret` donne une fonction « aller à ») : les sous-titres sous la vidéo suivent le lecteur.
 */
export function LecteurVideo({
  src,
  affiche,
  ratio = "9:16",
  titre,
  autoLecture,
  enBoucle,
  muet,
  sousTitresVtt,
  onTemps,
  onPret,
  className,
}: {
  src: string;
  affiche?: string | null;
  ratio?: Ratio;
  titre: string;
  autoLecture?: boolean;
  enBoucle?: boolean;
  muet?: boolean;
  /** Adresse d'un fichier .vtt. */
  sousTitresVtt?: string;
  /** Temps courant en secondes (pendant la lecture, et après un déplacement). */
  onTemps?: (t: number) => void;
  /** Reçoit une fonction qui déplace la lecture (toucher un groupe de sous-titres). */
  onPret?: (aller: (t: number) => void) => void;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [demarre, setDemarre] = useState(!!autoLecture);
  const [enLecture, setEnLecture] = useState(false);
  // Vérif V3 : lecture refusée (source illisible, lien expiré) → message, au lieu d'une exception muette.
  const [illisible, setIllisible] = useState(false);
  const rappel = useRef(onTemps);
  useEffect(() => {
    rappel.current = onTemps;
  }, [onTemps]);
  useEffect(() => {
    onPret?.((t) => {
      const v = ref.current;
      if (!v) return;
      v.currentTime = Math.max(0, t);
      rappel.current?.(v.currentTime);
    });
  }, [onPret]);
  // Pendant la lecture : le temps suit la vidéo image par image.
  useEffect(() => {
    if (!enLecture || !rappel.current) return;
    let id = 0;
    const suivre = () => {
      if (ref.current) rappel.current?.(ref.current.currentTime);
      id = requestAnimationFrame(suivre);
    };
    id = requestAnimationFrame(suivre);
    return () => cancelAnimationFrame(id);
  }, [enLecture]);
  return (
    <div
      className={cn(
        "relative isolate mx-auto overflow-hidden rounded-carte border border-trait bg-fond shadow-carte",
        ASPECT[ratio],
        ratio === "9:16" && "h-[62vh] w-auto max-w-full lg:h-[78vh]",
        ratio === "4:5" && "max-h-[78vh]",
        className,
      )}
    >
      <video
        ref={ref}
        src={src}
        poster={affiche ?? undefined}
        controls={demarre}
        playsInline
        autoPlay={autoLecture}
        loop={enBoucle}
        muted={muet}
        preload="metadata"
        aria-label={titre}
        className="absolute inset-0 size-full object-cover"
        onPlay={() => {
          setDemarre(true);
          setEnLecture(true);
        }}
        onPause={() => setEnLecture(false)}
        onError={() => demarre && setIllisible(true)}
        onSeeked={(e) => onTemps?.(e.currentTarget.currentTime)}
      >
        {/* Pas `default` : les vidéos du studio ont leurs sous-titres incrustés ; une piste affichée d'office se superposait (doubles
          sous-titres). Elle reste choisissable dans le menu CC du lecteur. */}
        {sousTitresVtt && <track kind="subtitles" srcLang="fr" label="Français" src={sousTitresVtt} />}
      </video>
      {!demarre && (
        <button
          type="button"
          onClick={() => {
            setDemarre(true);
            setIllisible(false);
            ref.current?.play().catch((e: unknown) => {
              // Une pause demandée avant le début de la lecture n'est pas un échec.
              if (!(e instanceof DOMException && e.name === "AbortError")) setIllisible(true);
            });
          }}
          className="group absolute inset-0 grid place-items-center bg-linear-to-t from-fond/50 to-transparent"
          aria-label={`Lire « ${titre} »`}
        >
          <span className="grid size-16 place-items-center rounded-full bg-orange text-sur-orange shadow-orange transition-transform duration-200 group-hover:scale-110">
            <Icone nom="lecture" size={26} className="translate-x-0.5" fill="currentColor" />
          </span>
        </button>
      )}
      {illisible && (
        <p role="alert" className="absolute inset-x-3 bottom-3 rounded-2xl bg-fond/90 px-4 py-3 text-center text-sm text-texte backdrop-blur">
          Cette vidéo ne se lit pas pour l&apos;instant. Rechargez la page ; si cela continue, téléchargez-la.
        </p>
      )}
    </div>
  );
}
