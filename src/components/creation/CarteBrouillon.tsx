import Link from "next/link";
import { META_ETAPES, estCleEtape, type CleEtape } from "@/assistant/etapes/meta";
import { insecable } from "@/lib/textes";
import { Icone } from "@/components/ui/Icone";
import { trouverFormat } from "@/formats";
import type { VueVideoCarte } from "@/services/vues";
import { IlYA } from "@/components/ui/IlYA";

/**
 * Carte « Reprendre le brouillon » : format, titre, étape atteinte en segments, ancienneté.
 * Un brouillon n'a pas encore d'image : on montre où il en est plutôt qu'une vignette vide.
 */
export function CarteBrouillon({ video }: { video: VueVideoCarte }) {
  const format = trouverFormat(video.format.id);
  const etapes: CleEtape[] = (format?.etapes ?? []).filter((e) => e !== "fabrication");
  const cle = video.etapeAssistant && estCleEtape(video.etapeAssistant) ? video.etapeAssistant : "sujet";
  const position = Math.max(0, etapes.indexOf(cle));
  return (
    <Link
      href={`/nouvelle/${video.format.id}?brouillon=${video.id}`}
      className="group relative isolate flex h-full min-h-40 flex-col overflow-hidden rounded-carte border border-trait bg-surface-1 p-3.5 transition-[border-color,transform] duration-200 ease-studio hover:-translate-y-0.5 hover:border-trait-fort"
    >
      <span aria-hidden className="absolute -right-8 -top-8 -z-10 size-24 rounded-full bg-orange/10 blur-2xl transition-transform duration-500 group-hover:scale-150" />
      <span className="flex items-center gap-1.5 text-xs font-semibold text-texte-faible">
        <span className="grid size-7 place-items-center rounded-full bg-surface-2 text-orange-vif">
          <Icone nom={video.format.icone} size={14} />
        </span>
        <span className="truncate"><IlYA iso={video.modifieLe} /></span>
      </span>
      <span className="mt-3 line-clamp-3 text-[15px] font-semibold leading-snug text-texte">{insecable(video.titre)}</span>
      <span className="mt-auto pt-3">
        <span className="flex gap-1" aria-hidden>
          {etapes.map((e, i) => (
            <span key={e} className={i <= position ? "h-1 flex-1 rounded-full bg-orange" : "h-1 flex-1 rounded-full bg-surface-3"} />
          ))}
        </span>
        <span className="mt-2 flex items-center justify-between text-xs font-semibold">
          <span className="text-texte-doux">{META_ETAPES[cle].court}</span>
          <span className="flex items-center gap-1 text-orange-vif">
            Reprendre
            <Icone nom="fleche-droite" size={13} className="transition-transform group-hover:translate-x-0.5" />
          </span>
        </span>
      </span>
    </Link>
  );
}
