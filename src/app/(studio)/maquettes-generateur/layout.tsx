import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { maquettesOuvertes } from "./_garde";

/**
 * Maquettes du lot GM (fausses données de démonstration) : RÉSERVÉES AU DÉVELOPPEMENT (vérification E2E-1 n° 10, 03/10).
 * En production, toute adresse `/maquettes-generateur/…` répond « Cette page n'existe pas » : Will ne peut pas les
 * confondre avec ses vraies données. Rien n'est effacé : le code reste dans l'historique et sert aux captures en local.
 */
export default function GabaritMaquettes({ children }: { children: ReactNode }) {
  if (!maquettesOuvertes()) notFound();
  return children;
}
