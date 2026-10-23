import type { Metadata } from "next";
import { Logo } from "@/components/coquille/Logo";
import { Icone } from "@/components/ui/Icone";

export const metadata: Metadata = { title: "Hors ligne" };

/** Page servie par le service de cache quand le réseau manque (PWA). Publique, statique. */
export default function PageHorsLigne() {
  return (
    <main className="relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 text-center">
      <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-[60vh] lueur" />
      <Logo className="mb-10" />
      <span className="grid size-20 place-items-center rounded-full bg-ambre-doux text-ambre">
        <Icone nom="hors-ligne" size={36} />
      </span>
      <h1 className="mt-6 text-2xl text-texte">Pas de réseau</h1>
      <p className="mt-2 max-w-xs text-texte-doux">Le studio revient dès que la connexion revient.</p>
      {/* Rechargement complet volontaire : la navigation client échouerait sans réseau. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/" className="mt-8 inline-flex min-h-12 items-center rounded-full bg-orange px-6 font-semibold text-sur-orange shadow-orange">
        Réessayer
      </a>
    </main>
  );
}
