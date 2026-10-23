import type { Metadata } from "next";
import { Logo } from "@/components/coquille/Logo";
import { Icone } from "@/components/ui/Icone";

export const metadata: Metadata = { title: "Lien expiré", robots: { index: false, follow: false } };

/**
 * Lien privé expiré, révoqué ou inconnu (B.8 #10). Page soignée, une phrase, aucun bouton
 * vers la console (le visiteur n'y a pas accès).
 */
export default function LienExpire() {
  return (
    <main className="relative isolate flex min-h-dvh flex-col items-center px-4 py-6">
      <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-[60vh] lueur" />
      <Logo className="self-start sm:self-center" />
      <div className="flex max-w-sm flex-1 flex-col items-center justify-center text-center">
        <div aria-hidden className="relative mb-7">
          <div className="absolute -inset-10 -z-10 rounded-full bg-orange/20 blur-3xl" />
          <div className="relative grid aspect-[9/16] w-28 place-items-center overflow-hidden rounded-[20px] border border-trait-fort bg-surface-1 shadow-carte">
            <div className="absolute inset-x-3 top-4 h-2 rounded-full bg-surface-3" />
            <div className="absolute inset-x-3 top-8 h-2 w-12 rounded-full bg-surface-2" />
            <span className="grid size-12 place-items-center rounded-full bg-orange text-sur-orange shadow-orange">
              <Icone nom="sablier" size={22} />
            </span>
          </div>
        </div>
        <h1 className="text-[28px] leading-tight text-texte">Ce lien n&apos;est plus actif</h1>
        <p className="mt-3 text-texte-doux">Demandez un nouveau lien à la personne qui vous l&apos;a envoyé.</p>
      </div>
    </main>
  );
}
