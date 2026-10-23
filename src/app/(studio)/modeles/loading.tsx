import { Squelette } from "@/components/ui/Squelette";

/** Chargement de « Mes modèles ». */
export default function ChargementModeles() {
  return (
    <div role="status" aria-label="Chargement" className="space-y-6">
      <Squelette className="h-9 w-48" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Squelette key={i} className="h-48 rounded-carte" />
        ))}
      </div>
    </div>
  );
}
