/* eslint-disable @next/next/no-img-element -- vignettes de la Bibliothèque : fichiers du studio, tailles connues */
import { cn } from "@/lib/cn";

/**
 * Vignette d'un décor SUR le double (lot B1) : la vignette calculée par la brique `composition` si elle existe ; sinon
 * le décor avec le double simulé posé devant (même cadre), jamais un décor vide quand on a de quoi montrer le double.
 */
export function VignetteDecor({ surDouble, image, silhouette, teinte, alt, className }: { surDouble: string | null; image: string | null; silhouette?: string; teinte?: string; alt: string; className?: string }) {
  return (
    <div className={cn("relative aspect-[9/16] w-full overflow-hidden rounded-xl bg-surface-2", className)} style={teinte && !surDouble && !image ? { backgroundColor: teinte } : undefined}>
      {surDouble ? (
        <img src={surDouble} alt={alt} loading="lazy" className="absolute inset-0 size-full object-cover" />
      ) : (
        <>
          {image && <img src={image} alt={alt} loading="lazy" className="absolute inset-0 size-full scale-105 object-cover blur-[3px]" />}
          {silhouette && <img src={silhouette} alt="" aria-hidden loading="lazy" className="absolute inset-0 size-full object-cover" />}
        </>
      )}
    </div>
  );
}
