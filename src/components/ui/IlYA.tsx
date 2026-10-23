"use client";

import { ilYA } from "@/lib/dates";

/**
 * Date relative (« il y a 5 min »). Calculée deux fois (serveur puis navigateur) avec deux « maintenant »
 * différents : l'écart éventuel du texte est attendu, on ne le signale pas (évite l'erreur React #418).
 */
export function IlYA({ iso, className }: { iso: string; className?: string }) {
  return (
    <time dateTime={iso} className={className} suppressHydrationWarning>
      {ilYA(iso)}
    </time>
  );
}
