"use client";

/**
 * RAP-3 · vignette d'un post repris du diffuseur. L'adresse reçue est celle du STUDIO (il lit l'image pour nous) ; dimensions réservées
 * (aucun décalage de la page) ; si l'image ne vient pas, elle disparaît : jamais d'icône cassée, la carte reste une carte texte.
 */
import { useState } from "react";
import { cn } from "@/lib/cn";

export function VignetteDiffuseur({ src, alt, taille = 40, grande, className }: { src: string; alt: string; taille?: number; grande?: boolean; className?: string }) {
  const [absente, setAbsente] = useState(false);
  if (absente) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- image lue et filtrée par le serveur du Studio (route miniature), pas d'optimiseur
    <img
      src={src}
      alt={alt}
      width={taille}
      height={taille}
      loading="lazy"
      decoding="async"
      onError={() => setAbsente(true)}
      className={cn(grande ? "max-h-[60vh] w-full object-contain" : "shrink-0 rounded-md border border-trait object-cover", className)}
      style={grande ? undefined : { width: taille, height: taille }}
    />
  );
}
