import { Squelette } from "@/components/ui/Squelette";

/** Chargement de /bibliotheque : tuiles par type + aperçu. */
export default function Chargement() {
  return (
    <div role="status" aria-label="Chargement" className="space-y-6">
      <div className="space-y-3">
        <Squelette className="h-9 w-52" />
        <Squelette className="h-4 w-72" />
      </div>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 9 }, (_, i) => (
            <Squelette key={i} className="h-24 w-full rounded-carte" />
          ))}
        </div>
        <Squelette className="aspect-video w-full rounded-carte" />
      </div>
    </div>
  );
}
