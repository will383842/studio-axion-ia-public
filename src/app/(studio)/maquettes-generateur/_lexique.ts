/**
 * Lexique des maquettes (B.6.18 du plan v5) : les seuls mots que Will voit.
 * Il sera repris dans `domaine/libelles.ts` au lot G1b.
 */
import type { NomIcone } from "@/components/ui";
import type { EtatCase } from "./_demo";

export const ETATS_CASE: Record<EtatCase, { libelle: string; icone?: NomIcone }> = {
  vide: { libelle: "pas écrit" },
  "a-relire": { libelle: "à relire" },
  valide: { libelle: "validé", icone: "coche" },
  publie: { libelle: "publié", icone: "envoyer" },
  probleme: { libelle: "problème" },
};

export const BUTS = ["Faire partager", "Faire garder", "Faire réagir", "Rendez-vous"] as const;
export const QUI_PARLE = ["Mon double", "Je lis", "J'improvise", "Voix off"] as const;
export const ADRESSE = ["Vous", "Tu"] as const;
