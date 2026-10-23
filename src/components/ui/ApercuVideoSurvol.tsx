"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

/**
 * Vidéo muette qui se lance au survol de la carte parente (ordinateur) et s'arrête à la sortie.
 * Sur téléphone (pas de survol), rien ne se charge : la vignette reste affichée.
 */
export function ApercuVideoSurvol({ src, className }: { src: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    const parent = video?.closest("a,article,div[data-carte]");
    if (!video || !parent || !window.matchMedia("(hover: hover)").matches) return;
    const entrer = () => {
      video.preload = "auto";
      void video.play().catch(() => undefined);
    };
    const sortir = () => {
      video.pause();
      video.currentTime = 0;
    };
    parent.addEventListener("pointerenter", entrer);
    parent.addEventListener("pointerleave", sortir);
    return () => {
      parent.removeEventListener("pointerenter", entrer);
      parent.removeEventListener("pointerleave", sortir);
    };
  }, []);
  return (
    <video
      ref={ref}
      src={src}
      muted
      loop
      playsInline
      preload="none"
      aria-hidden
      tabIndex={-1}
      className={cn("absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100", className)}
    />
  );
}
