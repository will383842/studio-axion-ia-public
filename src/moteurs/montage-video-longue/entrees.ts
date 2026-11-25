/**
 * ENTRÉES DE LA VIDÉO LONGUE (fiche VL-04) — lues dans `commande.entrees.videoLongue` (R-8, jamais `fabrication.ts`).
 * Le script VALIDÉ par l'utilisateur est lu TEL QUEL : aucun mot n'est ajouté, retiré ni changé ici.
 * Tolérant : ce qui est mal formé est ignoré ; l'absence de tout chapitre est signalée par le moteur (jamais une exception).
 */
import type { CommandeFabrication } from "@/domaine/types";
import type { ChapitreScript } from "@/briques/voix-longue";
import { normaliserChapitres, titreDeduit, titreManquant } from "./decoupage";

export interface ChapitreVideoLongue extends ChapitreScript {
  /** Titre du chapitre (il deviendra le chapitre YouTube). */
  titre: string;
}

export interface EntreesVideoLongue {
  chapitres: ChapitreVideoLongue[];
  /** Mode « Sans voix » : `sansVoix === true` EXACT. Même vidéo, silence total, sous-titres et texte à l'écran ; 0 appel HeyGen, 0 €. */
  sansVoix: boolean;
  /** Question de la vidéo (200 caractères au plus) : elle ouvre la vidéo sur un carton de titre. Absente des vidéos déjà créées. */
  question?: string;
}

const chaine = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v : undefined);

export function lireEntreesVideoLongue(commande: CommandeFabrication): EntreesVideoLongue {
  const brut = (commande.entrees as Record<string, unknown> | undefined)?.videoLongue as { chapitres?: unknown; sansVoix?: unknown; question?: unknown } | undefined;
  const liste = Array.isArray(brut?.chapitres) ? (brut!.chapitres as unknown[]) : [];
  const chapitres: ChapitreVideoLongue[] = [];
  liste.forEach((c, i) => {
    const o = (c ?? {}) as Record<string, unknown>;
    const texte = chaine(o.texte);
    if (!texte) return;
    chapitres.push({ id: chaine(o.id) ?? `c${i + 1}`, titre: chaine(o.titre) ?? "", texte });
  });
  const question = (chaine(brut?.question) ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
  // Même règle de découpage que l'écran : une ligne-titre devenue chapitre redevient le titre du suivant, aucun chapitre < 10 s.
  const propres = normaliserChapitres(chapitres, { question: question !== "" }).map((c) => ({ ...c, titre: titreManquant(c.titre) ? titreDeduit(c.texte) || c.titre.trim() : c.titre }));
  return { chapitres: propres, sansVoix: brut?.sansVoix === true, ...(question ? { question } : {}) };
}
