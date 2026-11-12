import { insecable } from "@/lib/textes";

/** Vrai si le sujet dit autre chose que le titre (sinon le répéter ne sert à rien). */
export function sujetDifferent(titre: string, sujet?: string): sujet is string {
  const s = sujet?.trim();
  return !!s && s !== titre.trim();
}

/** Le sujet de départ, replié : il ne prend de la place que si on le demande. Rien s'il répète le titre. */
export function SujetReplie({ titre, sujet }: { titre: string; sujet?: string }) {
  if (!sujetDifferent(titre, sujet)) return null;
  return (
    <details className="group rounded-carte border border-trait bg-surface-1 px-4 py-3">
      <summary className="cursor-pointer text-sm font-semibold text-texte-doux marker:text-texte-faible">Le sujet de la vidéo</summary>
      <p className="mt-2 whitespace-pre-line text-sm text-texte-doux">{insecable(sujet.trim())}</p>
    </details>
  );
}
