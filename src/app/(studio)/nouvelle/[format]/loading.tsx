import { Squelette } from "@/components/ui/Squelette";

/** Chargement de l'assistant : barre d'étapes, titre, champs. */
export default function ChargementAssistant() {
  return (
    <div role="status" aria-label="Chargement" className="mx-auto max-w-2xl space-y-6">
      <Squelette className="h-5 w-40" />
      <div className="flex gap-1.5">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Squelette key={i} className="h-1.5 flex-1 rounded-full" />
        ))}
      </div>
      <div className="flex items-center gap-3">
        <Squelette className="size-11 rounded-2xl" />
        <Squelette className="h-8 w-56" />
      </div>
      <Squelette className="h-14 w-full rounded-champ" />
      <div className="flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Squelette key={i} className="h-14 w-20 rounded-full" />
        ))}
      </div>
    </div>
  );
}
