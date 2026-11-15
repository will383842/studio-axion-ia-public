"use client";

import { creerEntreeStockAction } from "@/app/(studio)/ecrire/stock/actions";
import { Bouton } from "@/components/ui/Bouton";
import type { ElementMenu } from "@/components/ui/Menu";
import { notifier } from "@/components/ui/Toast";
import { RESEAUX_TAXONOMIE } from "@/domaine/taxonomie-contenu";

/**
 * Geste « Mettre en stock » : met un texte de côté dans « Mes textes ».
 * Ne déplace, n'archive et ne supprime jamais la source. La clé de rejeu (une par source) évite le doublon au double clic.
 */
export async function mettreEnStock(texte: string, cle: string) {
  return creerEntreeStockAction({ texte, reseaux: [...RESEAUX_TAXONOMIE], priorite: "normale", cle });
}

async function lancer(texte: string, cle: string) {
  const r = await mettreEnStock(texte, cle);
  if (r.ok) notifier.succes("Ajouté à Mes textes");
  else notifier.erreur(r.message);
}

/** Entrée de menu « Mettre en stock » (menu d'une idée, menu d'un script). */
export function elementMettreEnStock(texte: string, cle: string): ElementMenu {
  return { libelle: "Mettre en stock", icone: "archive", onSelect: () => void lancer(texte, cle) };
}

/** Bouton « Mettre en stock » pour un emplacement hors menu. */
export function BoutonMettreEnStock({ texte, cle }: { texte: string; cle: string }) {
  return (
    <Bouton variante="secondaire" icone="archive" onClick={() => void lancer(texte, cle)}>
      Mettre en stock
    </Bouton>
  );
}
