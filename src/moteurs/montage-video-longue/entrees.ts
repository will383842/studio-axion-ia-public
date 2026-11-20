/**
 * ENTRÉES DE LA VIDÉO LONGUE (fiche VL-04) — lues dans `commande.entrees.videoLongue` (R-8, jamais `fabrication.ts`).
 * Le script VALIDÉ par l'utilisateur est lu TEL QUEL : aucun mot n'est ajouté, retiré ni changé ici.
 * Tolérant : ce qui est mal formé est ignoré ; l'absence de tout chapitre est signalée par le moteur (jamais une exception).
 */
import type { CommandeFabrication } from "@/domaine/types";
import type { ChapitreScript } from "@/briques/voix-longue";

export interface ChapitreVideoLongue extends ChapitreScript {
  /** Titre du chapitre (il deviendra le chapitre YouTube). */
  titre: string;
}

export interface EntreesVideoLongue {
  chapitres: ChapitreVideoLongue[];
  /** Mode « Sans voix » : `sansVoix === true` EXACT. Même vidéo, silence total, sous-titres et texte à l'écran ; 0 appel HeyGen, 0 €. */
  sansVoix: boolean;
}

const chaine = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v : undefined);

export function lireEntreesVideoLongue(commande: CommandeFabrication): EntreesVideoLongue {
  const brut = (commande.entrees as Record<string, unknown> | undefined)?.videoLongue as { chapitres?: unknown; sansVoix?: unknown } | undefined;
  const liste = Array.isArray(brut?.chapitres) ? (brut!.chapitres as unknown[]) : [];
  const chapitres: ChapitreVideoLongue[] = [];
  liste.forEach((c, i) => {
    const o = (c ?? {}) as Record<string, unknown>;
    const texte = chaine(o.texte);
    if (!texte) return;
    chapitres.push({ id: chaine(o.id) ?? `c${i + 1}`, titre: chaine(o.titre) ?? `Chapitre ${i + 1}`, texte });
  });
  return { chapitres, sansVoix: brut?.sansVoix === true };
}
