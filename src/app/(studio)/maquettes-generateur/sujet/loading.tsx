import { Squelette } from "@/components/ui";

/** Chargement de l'écran Sujet : l'idée, puis les réglages. */
export default function ChargementSujet() {
  return (
    <div role="status" aria-label="Chargement" className="mx-auto max-w-2xl space-y-4">
      <Squelette className="h-9 w-52" />
      <Squelette className="h-36 w-full rounded-carte" />
      <Squelette className="h-12 w-full rounded-carte" />
      <div className="grid grid-cols-2 gap-2">
        <Squelette className="col-span-2 h-[72px] rounded-carte" />
        {[0, 1, 2, 3].map((i) => (
          <Squelette key={i} className="h-[72px] rounded-carte" />
        ))}
      </div>
    </div>
  );
}
