import { Squelette } from "@/components/ui/Squelette";

/** Chargement de /personnages : en-tête, chiffres, cartes. */
export default function Chargement() {
  return (
    <div role="status" aria-label="Chargement" className="space-y-5">
      <div className="space-y-3">
        <Squelette className="h-9 w-48" />
        <Squelette className="h-4 w-64" />
      </div>
      <Squelette className="h-24 w-full rounded-carte" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex flex-col items-center gap-3 rounded-carte border border-trait bg-surface-1 p-5">
            <Squelette rond className="size-24" />
            <Squelette className="h-5 w-24" />
            <Squelette className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
