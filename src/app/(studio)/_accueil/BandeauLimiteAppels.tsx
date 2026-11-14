import { Icone } from "@/components/ui/Icone";

/**
 * Bandeau discret de l'Accueil (NEW-ARG-05) : visible seulement quand la limite technique du jour est atteinte.
 * Mots simples, aucun montant. Ce que vous lancez vous-même part toujours.
 */
export function BandeauLimiteAppels({ atteinte }: { atteinte: boolean }) {
  if (!atteinte) return null;
  return (
    <div role="status" className="flex items-start gap-2.5 rounded-2xl border border-ambre/50 bg-ambre/10 px-4 py-3 text-sm font-semibold text-ambre">
      <Icone nom="sablier" size={16} className="mt-0.5 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block">Le studio fait une pause pour aujourd&apos;hui : la fabrication automatique reprendra demain.</span>
        <span className="block font-normal">Ce que vous lancez vous-même part toujours.</span>
      </span>
    </div>
  );
}
