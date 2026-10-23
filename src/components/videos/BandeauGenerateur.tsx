import Link from "next/link";
import { cn } from "@/lib/cn";
import { Icone } from "@/components/ui/Icone";
import { PastilleEssai } from "@/components/ui/PastilleEssai";
import { adresseCreationFormat, formatEnEssai, trouverFormat } from "@/formats";

/**
 * Bandeau « générateur » en haut des pages de suivi d'une vidéo : icône et nom court du registre (comme la barre
 * latérale, les onglets et la grille `/nouvelle`), « Essai » si besoin, lien vers l'écran de création.
 * Hauteur fixe (pas de décalage de mise en page). Format inconnu : rien.
 */
export function BandeauGenerateur({ formatId, className }: { formatId: string | null | undefined; className?: string }) {
  const format = formatId ? trouverFormat(formatId) : undefined;
  if (!format) return null;
  return (
    <Link
      href={adresseCreationFormat(format)}
      data-bandeau="generateur"
      className={cn("mb-3 inline-flex min-h-8 max-w-full items-center gap-2 rounded-full border border-trait bg-surface-1 px-3 py-1 text-sm font-semibold text-texte-doux hover:text-texte", className)}
    >
      <Icone nom={format.icone} size={16} className="shrink-0 text-orange" />
      <span className="truncate">{format.nomCourt}</span>
      {formatEnEssai(format) && <PastilleEssai />}
    </Link>
  );
}
