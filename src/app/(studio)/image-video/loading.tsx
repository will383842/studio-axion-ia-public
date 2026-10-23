import { Squelette } from "@/components/ui/Squelette";

/** Image → vidéo en chargement : titre, barre d'étapes, zone de dépôt. */
export default function ChargementImageVideo() {
  return (
    <div role="status" aria-label="Chargement" className="mx-auto max-w-2xl">
      <Squelette className="mb-6 h-9 w-48" />
      <Squelette rond className="mb-6 h-11 w-full" />
      <Squelette className="h-64 w-full" />
    </div>
  );
}
