import Link from "next/link";
import { Logo } from "@/components/coquille/Logo";
import { Bouton } from "@/components/ui/Bouton";
import { cn } from "@/lib/cn";

/**
 * Contenu de la 404 soignée (B.8 #19), version M7 : le grand « 404 » est en bleu d'accent (décision de Williams,
 * 12/11), l'orange reste au seul bouton. `dansLaCoquille` : rendu sous le <main> du studio, donc dans une <section>
 * (jamais deux <main> imbriqués) et sans occuper tout l'écran.
 */
export function Introuvable({ dansLaCoquille = false }: { dansLaCoquille?: boolean }) {
  const Balise = dansLaCoquille ? "section" : "main";
  return (
    <Balise
      aria-labelledby="titre-introuvable"
      className={cn("flex flex-col items-center justify-center px-4 text-center", dansLaCoquille ? "min-h-[70dvh] rounded-carte" : "min-h-dvh")}
    >
      {!dansLaCoquille && <Logo className="mb-10" />}
      <p aria-hidden className="titre-affiche text-[120px] leading-none text-accent sm:text-[160px]">
        404
      </p>
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
