import { Squelette } from "@/components/ui/Squelette";

/** Chargement du calendrier (CAL-13) : le mot est visible, la grille se dessine en gris. */
export default function ChargementCalendrier() {
  return (
    <div role="status" data-etat="chargement" className="space-y-4">
      <p className="text-[13px] font-bold text-texte-doux">Chargement du calendrier…</p>
      <Squelette className="h-10 w-full" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {Array.from({ length: 7 }, (_, i) => (
          <Squelette key={i} className="h-40 rounded-carte" />
        ))}
      </div>
    </div>
  );
}
