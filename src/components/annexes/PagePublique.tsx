import Image from "next/image";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Cadre commun des pages vues par des personnes extérieures (/v/...) : charte publique du site
 * (ivoire, noir, terracotta, Manrope) avec le vrai logo du site et le halo terracotta. Aucun élément du studio
 * (ni barre, ni bleu, ni le mot « Studio »). Les couleurs viennent des jetons de charte figés (.charte-publique).
 */
export function CadrePublic({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <main className={cn("charte-publique relative isolate flex min-h-dvh flex-col items-center px-4 pb-8 pt-5", className)}>
      <div aria-hidden className="halo-public absolute inset-x-0 top-0 -z-10 h-[70vh]" />
      {children}
    </main>
  );
}

/** Vrai logo du site public (logo-axion-ia.png). */
export function LogoPublic({ className }: { className?: string }) {
  return <Image src="/logo-axion-ia.png" alt="Axion-IA" width={72} height={72} priority className={cn("size-[72px] shrink-0", className)} />;
}

/** Message centré d'un lien inactif ou introuvable : un rond noir, un titre, une phrase, aucun bouton vers la console. */
export function MessagePublic({ icone, titre, phrase }: { icone: ReactNode; titre: string; phrase: string }) {
  return (
    <div className="flex w-full max-w-sm flex-1 flex-col items-center justify-center text-center">
      <span aria-hidden className="mb-6 grid size-14 place-items-center rounded-full bg-texte text-fond">
        {icone}
      </span>
      <h1 className="text-[28px] leading-tight text-texte">{titre}</h1>
      <p className="mt-3 text-texte-doux">{phrase}</p>
    </div>
  );
}
