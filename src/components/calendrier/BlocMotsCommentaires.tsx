/**
 * Mot-clé, guide associé et nombre de commentaires d'une publication (RC-38), en LECTURE SEULE dans l'aperçu.
 * Le bloc est sans état et ne lit rien lui-même : l'appelant lui fournit les données (jamais depuis fiches.json).
 * Mots de la maquette validée (docs/maquettes/calendrier/calendrier-du-studio.html). Aucun bouton, aucune saisie.
 */
import type { ReactNode } from "react";

export interface MotsPublication {
  /** Le mot-clé déclencheur, ou null / vide : aucun. */
  mot: string | null;
  /** Le titre du guide associé, ou null / vide : aucun. */
  guide: string | null;
  /** Nombre de commentaires ; null ou valeur invalide : inconnu. */
  commentaires: number | null;
}

export interface ProprietesBlocMotsCommentaires {
  /** Identifiant du réseau de la publication (« instagram », « linkedin »…). */
  reseau: string;
  mots?: MotsPublication | null;
}

/** Réseaux où la réponse aux commentaires reste toujours manuelle. */
const NOMS_A_LA_MAIN: Record<string, string> = { linkedin: "LinkedIn", tiktok: "TikTok" };

const net = (v: string | null | undefined): string | null => {
  const t = typeof v === "string" ? v.trim() : "";
  return t === "" ? null : t;
};

/** Phrase du nombre de commentaires ; jamais de chiffre inventé. */
export function phraseCommentaires(n: number | null | undefined): string {
  if (typeof n !== "number" || !Number.isInteger(n) || n < 0) return "Nombre de commentaires indisponible.";
  if (n === 0) return "Aucun commentaire";
  return n === 1 ? "1 commentaire" : `${n} commentaires`;
}

export function BlocMotsCommentaires({ reseau, mots }: ProprietesBlocMotsCommentaires): ReactNode {
  const mot = net(mots?.mot);
  const guide = net(mots?.guide);
  const aLaMain = NOMS_A_LA_MAIN[reseau];
  const reponses = aLaMain
    ? `toujours à la main sur ${aLaMain}.`
    : mot
      ? "réponse automatique au mot-clé (bientôt)."
      : null;
  return (
    <section aria-label="Mots-clés et commentaires" className="mt-2 text-sm text-texte-2">
      {mot ? (
        <>
          <p>Mot-clé : {mot}</p>
          <p>{guide ? `Guide associé : ${guide}` : "Aucun guide associé"}</p>
          <p>{phraseCommentaires(mots?.commentaires)}</p>
        </>
      ) : (
        <p>Aucun mot-clé sur cette publication.</p>
      )}
      {reponses ? <p className="mt-1">Réponses aux commentaires : {reponses}</p> : null}
    </section>
  );
}
