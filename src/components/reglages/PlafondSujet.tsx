"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { definirPlafondSujetAction } from "@/app/(studio)/reglages/actions-plafond-sujet";
import { Bouton } from "@/components/ui/Bouton";
import { Champ } from "@/components/ui/Champ";
import { notifier } from "@/components/ui/Toast";
import { formaterUsd } from "@/domaine/plafond-sujet";

export const TEXTES_PLAFOND_SUJET = {
  libelle: "Plafond d'un sujet (Écrire)",
  explication: "C'est une limite de sécurité calculée au pire cas, pas le prix : une écriture coûte en réalité environ 0,3 à 0,4 $.",
  bornes: "Entre 0,50 $ et 5 $.",
  portee: "Ce plafond s'applique à la chaîne « courte », la seule qui écrit les nouveaux scripts (les chaînes équipe et grande sont verrouillées depuis le 23/10/2026) ; une écriture déjà lancée sur la grande chaîne garde son propre plafond.",
  horsBornes: "Cette valeur est hors des bornes de saisie (elle est tout de même appliquée telle quelle) : enregistrez une valeur entre 0,50 $ et 5 $ pour la remplacer.",
} as const;

/** « 1,5 » ou « 1.50 » → 150 centimes de dollar ENTIERS (lecture du texte, sans flottant) ; autre chose → null. */
export function centimesDepuisTexte(texte: string): number | null {
  const m = /^(\d{1,2})(?:[.,](\d{1,2}))?$/.exec(texte.trim());
  return m ? Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0") || "0") : null;
}

const texteDepuisCentimes = (c: number) => `${Math.floor(c / 100)},${String(c % 100).padStart(2, "0")}`;

/** Réglages › Budget : le plafond d'un sujet de l'écran Écrire, réglé par Will (défaut 1,50 $ tant qu'il n'a rien saisi). */
export function PlafondSujet({ usd, centimes, reglee, horsBornes, chaine }: { usd: number; centimes: number; reglee: boolean; horsBornes: boolean; chaine: "courte" | "equipe" | null }) {
  const router = useRouter();
  const [texte, setTexte] = useState(texteDepuisCentimes(centimes));
  const [enCours, demarrer] = useTransition();
  const saisie = centimesDepuisTexte(texte);

  return (
    <div className="space-y-3">
      <Champ
        libelle={TEXTES_PLAFOND_SUJET.libelle}
        icone="balance"
        inputMode="decimal"
        value={texte}
        onChange={(e) => setTexte(e.target.value)}
        suffixe={<span className="text-texte-faible">$</span>}
        aide={TEXTES_PLAFOND_SUJET.explication}
      />
      <p className="text-xs tabular-nums text-texte-faible">
        Plafond actuel : {formaterUsd(usd)} {reglee ? "" : "(valeur par défaut, jamais modifiée)"}. {TEXTES_PLAFOND_SUJET.bornes}
      </p>
      {horsBornes ? <p className="text-xs text-texte-faible">{TEXTES_PLAFOND_SUJET.horsBornes}</p> : null}
      <p className="text-xs text-texte-faible">
        {TEXTES_PLAFOND_SUJET.portee} Chaîne active : {chaine === "equipe" ? "équipe" : chaine === "courte" ? "courte" : "grande"}.
      </p>
      <Bouton
        variante="secondaire"
        chargement={enCours}
        disabled={saisie === null || saisie === centimes}
        onClick={() =>
          demarrer(async () => {
            if (saisie === null) return;
            let r;
            try {
              r = await definirPlafondSujetAction(saisie);
            } catch {
              notifier.erreur("Le plafond n'a pas été enregistré. Réessayez.");
              return;
            }
            if (!r.ok) {
              notifier.erreur(r.message);
              return;
            }
            notifier.succes("Plafond enregistré");
            router.refresh();
          })
        }
      >
        Enregistrer le plafond
      </Bouton>
    </div>
  );
}
