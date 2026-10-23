import { Squelette } from "@/components/ui/Squelette";

/** Fiche vidéo en chargement : lecteur vertical + titre + chiffres + onglets. */
export default function ChargementVideo() {
  return (
    <div role="status" aria-label="Chargement de la vidéo">
      <Squelette className="mb-3 h-8 w-32" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:gap-10">
        <Squelette className="mx-auto aspect-[9/16] h-[56vh] max-w-full rounded-carte lg:h-[70vh]" />
        <div className="space-y-4">
          <Squelette className="h-5 w-40" />
          <Squelette className="h-9 w-4/5" />
          <div className="grid grid-cols-3 gap-2">
            <Squelette className="h-[72px] rounded-carte" />
            <Squelette className="h-[72px] rounded-carte" />
            <Squelette className="h-[72px] rounded-carte" />
          </div>
          <Squelette className="h-28 rounded-carte" />
          <div className="flex gap-2">
            <Squelette rond className="h-11 w-24" />
            <Squelette rond className="h-11 w-28" />
            <Squelette rond className="h-11 w-24" />
          </div>
          <Squelette className="h-48 rounded-carte" />
        </div>
      </div>
    </div>
  );
}
