"use client";

import type { IdReseau, Ratio } from "@/domaine/types";
import { cn } from "@/lib/cn";
import { obtenirReseau, zoneProtegeeCombinee } from "@/reseaux";

/**
 * Calque des zones protégées des réseaux (AV2.3-2) : à poser par-dessus une image de vidéo
 * (parent `relative`). Hachure ambre là où l'interface du réseau recouvre l'image.
 * `deborde` : témoin orange quand un texte à l'écran touche une zone.
 */
export function CalqueZonesReseaux({
  ratio,
  reseaux = ["tiktok", "instagram", "youtube-shorts"],
  visible = true,
  deborde,
  className,
}: {
  ratio: Ratio;
  reseaux?: IdReseau[];
  visible?: boolean;
  deborde?: boolean;
  className?: string;
}) {
  const zone = zoneProtegeeCombinee(ratio, reseaux);
  if (!visible || !zone) return null;
  const hachure = "bg-[repeating-linear-gradient(135deg,var(--ambre-doux)_0_6px,transparent_6px_12px)] border-ambre/60";
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 z-20", className)}>
      <div className={cn("absolute inset-x-0 top-0 border-b border-dashed", hachure)} style={{ height: `${zone.haut}%` }} />
      <div className={cn("absolute inset-x-0 bottom-0 border-t border-dashed", hachure)} style={{ height: `${zone.bas}%` }} />
      <div className={cn("absolute right-0 border-l border-dashed", hachure)} style={{ top: `${zone.haut}%`, bottom: `${zone.bas}%`, width: `${zone.droite}%` }} />
      <div className={cn("absolute left-0 border-r border-dashed", hachure)} style={{ top: `${zone.haut}%`, bottom: `${zone.bas}%`, width: `${zone.gauche}%` }} />
      <div className="absolute left-2 top-2 flex flex-wrap gap-1">
        {reseaux.map((r) => (
          <span key={r} className="rounded bg-fond/80 px-1.5 py-0.5 text-[10px] font-bold text-ambre">
            {obtenirReseau(r).monogramme}
          </span>
        ))}
      </div>
      {deborde && <div className="absolute inset-0 rounded-[inherit] ring-2 ring-inset ring-orange-vif" />}
    </div>
  );
}
