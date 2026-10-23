import Link from "next/link";
import { Icone } from "@/components/ui/Icone";

/** Affiché quand le générateur de carrousels est éteint : une phrase et le lien pour l'allumer. */
export function BandeauGenerateurEteint() {
  return (
    <div role="status" className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-carte border border-ambre/30 bg-ambre-doux px-4 py-3 text-sm text-ambre">
      <Icone nom="attention" size={18} className="shrink-0" />
      <p className="min-w-0 flex-1 font-semibold">Le générateur de carrousels est éteint : rien ne sera écrit ni rendu pour l&apos;instant.</p>
      <Link href="/reglages/carrousels" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
        Ouvrir les réglages
      </Link>
    </div>
  );
}
