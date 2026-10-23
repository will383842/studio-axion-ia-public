import Link from "next/link";
import { Logo } from "@/components/coquille/Logo";
import { Bouton } from "@/components/ui/Bouton";
import { cn } from "@/lib/cn";

/**
 * Contenu de la 404 soignée (B.8 #19). `dansLaCoquille` : rendu sous le <main> du studio,
 * donc dans une <section> (jamais deux <main> imbriqués) et sans occuper tout l'écran.
 */
export function Introuvable({ dansLaCoquille = false }: { dansLaCoquille?: boolean }) {
  const Balise = dansLaCoquille ? "section" : "main";
  return (
    <Balise
      aria-labelledby="titre-introuvable"
      className={cn("relative isolate flex flex-col items-center justify-center overflow-hidden px-4 text-center", dansLaCoquille ? "min-h-[70dvh] rounded-carte" : "min-h-dvh")}
    >
      <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-[60vh] lueur-forte" />
      {!dansLaCoquille && <Logo className="mb-10" />}
      <p className="titre-affiche text-[120px] leading-none text-orange-vif sm:text-[160px]">404</p>
      <h1 id="titre-introuvable" className="mt-4 text-2xl text-texte">
        Cette page n&apos;existe pas
      </h1>
      <p className="mt-2 text-texte-doux">Le lien est peut-être ancien.</p>
      <Bouton asChild taille="lg" icone="accueil" className="mt-8">
        <Link href="/">Revenir à l&apos;accueil</Link>
      </Bouton>
    </Balise>
  );
}
