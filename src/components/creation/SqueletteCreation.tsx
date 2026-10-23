import { Squelette } from "@/components/ui/Squelette";

/** Chargement d'un écran de création : même squelette que le gabarit (en-tête, barre, deux blocs). */
export function SqueletteCreation({ avecEtapes = false }: { avecEtapes?: boolean }) {
  return (
    <div role="status" aria-label="Chargement" data-gabarit="creation-chargement" className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-3">
        <Squelette className="h-9 w-56" />
        <Squelette className="h-4 w-72" />
      </div>
      {avecEtapes && <Squelette className="h-11 w-full" />}
      <Squelette className="h-40 w-full rounded-carte" />
      <Squelette className="h-32 w-full rounded-carte" />
    </div>
  );
}
