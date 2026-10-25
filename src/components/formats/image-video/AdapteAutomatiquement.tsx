/**
 * IMAGE → VIDÉO · R5 · Bloc « Adapté automatiquement, à vérifier » de l'écran de résultat. AFFICHAGE SEUL : il liste
 * `carte.adaptations` (ce que le code a réparé ou adapté sans rien demander). Rien ne se modifie ici, et le schéma
 * d'exemple reste un exemple. Partie pure (le lecteur de l'état est dans `AdapteAutomatiquementServeur.tsx`).
 */
import { Carte } from "@/components/ui/Carte";
import type { CarteImage } from "@/domaine/image-video/carte";

const PREFIXE = "Adapté automatiquement : ";

/** Les adaptations à montrer, sans le préfixe technique, dans l'ordre, sans doublon. PUR. */
export function phrasesAdaptees(carte: Pick<CarteImage, "adaptations"> | null | undefined): string[] {
  return [...new Set((carte?.adaptations ?? []).map((a) => (a.startsWith(PREFIXE) ? a.slice(PREFIXE.length) : a)))];
}

export function BlocAdapteAutomatiquement({ phrases }: { phrases: readonly string[] }) {
  if (phrases.length === 0) return null;
  return (
    <Carte as="section" aria-label="Adapté automatiquement" className="space-y-2">
      <h2 className="font-titre text-base text-texte">Adapté automatiquement, à vérifier</h2>
      <p className="text-sm text-texte-doux">Le studio a réparé ou adapté ces points tout seul, sans rien vous demander. Le schéma d'exemple reste un exemple.</p>
      <ul className="list-disc space-y-1 pl-5 text-sm text-texte-doux">
        {phrases.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
    </Carte>
  );
}
