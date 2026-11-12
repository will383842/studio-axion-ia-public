import type { Metadata } from "next";
import { Logo } from "@/components/coquille/Logo";
import { Bouton } from "@/components/ui/Bouton";
import { Icone } from "@/components/ui/Icone";

export const metadata: Metadata = { title: "Hors ligne" };

/** Page servie par le service de cache quand le réseau manque (PWA). Publique, statique. */
export default function PageHorsLigne() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <Logo className="mb-10" />
      <span className="grid size-20 place-items-center rounded-full bg-ambre-doux text-ambre">
        <Icone nom="hors-ligne" size={36} />
      </span>
      <h1 className="mt-6 text-2xl text-texte">Pas de réseau</h1>
      <p className="mt-2 max-w-xs text-texte-doux">Le studio revient dès que la connexion revient.</p>
      {/* Rechargement complet volontaire : la navigation client échouerait sans réseau. */}
      <Bouton asChild taille="lg" icone="actualiser" className="mt-8">
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/">Réessayer</a>
      </Bouton>
    </main>
  );
}
