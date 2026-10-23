"use client";

/**
 * « Son » d'UN plan (lot du 02/10, D1) : Automatique (le chef d'orchestre décide), Aucun son (retirer), ou un son
 * choisi (ajouter). Ne refait que le mixage : gratuit. Utilisé à l'Aperçu et dans la fiche vidéo.
 */
import { SelecteurPastilles } from "@/components/ui/SelecteurPastilles";
import type { ChoixBruitagePlan, DeclencheurBruitage } from "@/domaine/types";

const NOMS: Record<DeclencheurBruitage, string> = { chiffre: "Tic", document: "Papier", telephone: "Vibration", "illustration-forte": "Souffle", impact: "Pop" };

type Valeur = "auto" | "retire" | DeclencheurBruitage;

export function valeurDuChoix(choix: ChoixBruitagePlan | null | undefined): Valeur {
  return !choix ? "auto" : choix.mode === "retire" ? "retire" : choix.declencheur;
}

export function SonDuPlan({ choix, prevu, onChange, desactive }: { choix: ChoixBruitagePlan | null | undefined; prevu?: DeclencheurBruitage; onChange: (c: ChoixBruitagePlan | null) => void; desactive?: boolean }) {
  const options: { valeur: Valeur; libelle: string; icone?: "volume" }[] = [
    { valeur: "auto", libelle: prevu ? `Auto · ${NOMS[prevu]}` : "Auto" },
    { valeur: "retire", libelle: "Aucun son" },
    ...(Object.keys(NOMS) as DeclencheurBruitage[]).map((d) => ({ valeur: d, libelle: NOMS[d], icone: "volume" as const })),
  ];
  return (
    <fieldset disabled={desactive} className="min-w-0">
      <SelecteurPastilles
        libelle="Son"
        defilement
        options={options}
        valeur={valeurDuChoix(choix)}
        onChange={(v) => onChange(v === "auto" ? null : v === "retire" ? { mode: "retire" } : { mode: "ajoute", declencheur: v })}
      />
    </fieldset>
  );
}
