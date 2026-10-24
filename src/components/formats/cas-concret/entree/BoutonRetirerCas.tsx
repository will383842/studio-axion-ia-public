"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { retirerCasAction } from "@/app/(studio)/cas-concret/actions";
import { Bouton } from "@/components/ui/Bouton";
import { notifier } from "@/components/ui/Toast";

/**
 * « Retirer ce cas » : le cas n'est plus proposé (réversible : Cas concret MD › Cas retirés › Remettre ce cas). Demande une
 * confirmation avant d'agir ; ne supprime rien, ne fabrique rien, ne dépense rien. `onRetire` : après le succès (ferme la feuille).
 */
export function BoutonRetirerCas({ casId, titre, onRetire }: { casId: string; titre: string; onRetire?: () => void }) {
  const routeur = useRouter();
  const [attente, demarrer] = useTransition();
  const [confirmer, setConfirmer] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const oui = useRef<HTMLButtonElement>(null);
  // Le clavier suit le geste : après « Retirer ce cas », le focus passe sur la confirmation.
  useEffect(() => {
    if (confirmer) oui.current?.focus();
  }, [confirmer]);
  if (!confirmer) {
    return (
      <Bouton variante="fantome" aria-label={`Retirer ce cas : ${titre}`} onClick={() => setConfirmer(true)}>
        Retirer ce cas
      </Bouton>
    );
  }
  return (
    <div className="flex flex-col gap-2" role="group" aria-label="Confirmer le retrait du cas">
      <p className="text-[13px] text-texte-doux">Ce cas ne sera plus proposé. Vous pourrez le remettre depuis Cas retirés. Rien n&apos;est supprimé.</p>
      <div className="flex flex-wrap gap-2">
        <Bouton
          ref={oui}
          chargement={attente}
          onClick={() =>
            demarrer(async () => {
              const r = await retirerCasAction(casId);
              if (r.ok) {
                notifier.succes("Cas retiré", titre);
                routeur.refresh();
                onRetire?.();
              } else setMessage(r.message);
            })
          }
        >
          Oui, retirer
        </Bouton>
        <Bouton variante="fantome" disabled={attente} onClick={() => setConfirmer(false)}>
          Annuler
        </Bouton>
      </div>
      {message && <p role="alert" className="text-sm text-brique">{message}</p>}
    </div>
  );
}
