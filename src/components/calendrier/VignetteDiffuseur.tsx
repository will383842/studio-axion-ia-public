"use client";

/**
 * RAP-3 · vignette d'un post repris du diffuseur. L'adresse reçue est celle du STUDIO (il lit l'image pour nous) ; dimensions réservées
 * (aucun décalage de la page) ; si l'image ne vient pas, une case vide de même taille la remplace : jamais d'icône cassée, aucun décalage.
 */
import { useState } from "react";
import { cn } from "@/lib/cn";

export function VignetteDiffuseur({ src, alt, taille = 40, grande, className }: { src: string; alt: string; taille?: number; grande?: boolean; className?: string }) {
  const [absente, setAbsente] = useState(false);
  // Case vide de même taille : le texte de la carte ne bouge pas quand l'image ne vient pas.
  if (absente) return <span aria-hidden className={cn("block", grande ? "h-32 w-full rounded-md border border-trait bg-surface-2" : "shrink-0 rounded-md border border-trait bg-surface-2")} style={grande ? undefined : { width: taille, height: taille }} />;
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
