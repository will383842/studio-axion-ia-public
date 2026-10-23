import Link from "next/link";
import { Icone } from "@/components/ui/Icone";
import { bandeauCredit } from "@/domaine/credits";
import { cn } from "@/lib/cn";
import type { CarteCredit } from "@/services/credits";

/**
 * Bandeau discret de l'Accueil (lot « alertes claires ») : tant qu'un fournisseur est épuisé ou à ≈ 10 vidéos
 * (10 scripts pour Claude) ou moins. Rien sinon. Le lien mène à Réglages › Crédits.
 */
export function BandeauCredits({ cartes }: { cartes: CarteCredit[] }) {
  const b = bandeauCredit(cartes);
  if (!b) return null;
  return (
    <Link
      href="/reglages#credits"
      role="status"
      className={cn("flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm font-semibold", b.epuise ? "border-brique/50 bg-brique/10 text-brique" : "border-ambre/50 bg-ambre/10 text-ambre")}
    >
      <Icone nom="sablier" size={16} className="mt-0.5 shrink-0" />
      <span className="min-w-0 flex-1">
        {b.lignes.map((l) => (
          <span key={l} className="block">
            {l}
          </span>
        ))}
      </span>
      <span className="shrink-0 underline underline-offset-2">Crédits</span>
    </Link>
  );
}
