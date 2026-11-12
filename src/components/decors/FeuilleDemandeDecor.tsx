"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Bouton, FeuilleBas, notifier, ZoneTexte } from "@/components/ui";
import { demanderDecorAction } from "./actions";

const EXEMPLES = ["Un bureau en bois avec une bibliothèque", "Une salle de réunion lumineuse", "Un atelier avec des lumières chaudes"];

/**
 * « Demander un décor » (lot B1) : une phrase → 3 propositions montrées sur le double. Aucune personne
 * n'est jamais fabriquée dans un décor.
 */
export function FeuilleDemandeDecor({ ouverte, onOuverteChange }: { ouverte: boolean; onOuverteChange: (v: boolean) => void }) {
  const router = useRouter();
  const [texte, setTexte] = useState("");
  const [enCours, demarrer] = useTransition();

  function fermer(v: boolean) {
    onOuverteChange(v);
  }

  function lancer() {
    demarrer(async () => {
      // Le toucher du bouton vaut confirmation.
      const r = await demanderDecorAction(texte, true);
      if (!r.ok) return void notifier.erreur(r.message);
      notifier.succes(`${r.donnees.propositionIds.length} propositions prêtes : gardez celle qui vous plaît`);
      setTexte("");
      fermer(false);
      router.refresh();
    });
  }

  return (
    <FeuilleBas
      ouverte={ouverte}
      onOuverteChange={fermer}
      titre="Demander un décor"
      description="Décrivez le lieu en une phrase."
      pied={
        <Bouton pleineLargeur taille="lg" icone="etincelles" disabled={texte.trim().length < 3} chargement={enCours} onClick={lancer}>
          Créer 3 propositions
        </Bouton>
      }
    >
      <div className="space-y-3">
        <ZoneTexte
          libelle="Le décor"
          libelleMasque
          rows={2}
          maxLength={200}
          placeholder="Un bureau en bois avec une bibliothèque"
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
        />
        {!texte && (
          <div className="flex flex-wrap gap-2">
            {EXEMPLES.map((x) => (
              <button key={x} type="button" onClick={() => setTexte(x)} className="min-h-11 rounded-full border border-trait px-3 text-sm text-texte-doux hover:text-texte">
                {x}
              </button>
            ))}
          </div>
        )}
        <p className="rounded-xl bg-surface-2 px-3 py-2.5 text-sm text-texte-doux">
          Trois ambiances (dorée, jour, soir), sans personne, montrées sur votre double.
        </p>
      </div>
    </FeuilleBas>
  );
}
