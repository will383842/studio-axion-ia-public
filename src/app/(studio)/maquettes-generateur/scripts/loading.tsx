import { Squelette } from "@/components/ui";

/** Chargement de la liste Scripts : rangée de logos, puis cartes à mini-grille. */
export default function ChargementScripts() {
  return (
    <div role="status" aria-label="Chargement" className="mx-auto max-w-2xl space-y-4">
      <Squelette className="h-9 w-36" />
      <div className="flex gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <Squelette key={i} className="size-11 rounded-xl" />
        ))}
        <Squelette className="ml-auto h-11 w-24 rounded-full" />
      </div>
      {[0, 1, 2].map((i) => (
        <Squelette key={i} className="h-40 w-full rounded-carte" />
      ))}
    </div>
  );
}
