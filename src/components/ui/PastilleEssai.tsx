import { cn } from "@/lib/cn";

/** Pastille ambre « Essai » : l'action passe par un fournisseur simulé (AV2.4-4). */
export function PastilleEssai({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-ambre/40 bg-ambre-doux px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ambre",
        className,
      )}
      title="Essai : rien n'est réellement envoyé"
    >
      Essai
    </span>
  );
}
