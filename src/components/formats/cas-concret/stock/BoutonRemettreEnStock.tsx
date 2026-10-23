"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { remettreEnStockAction } from "@/app/(studio)/cas-concret/actions";
import { Bouton } from "@/components/ui/Bouton";

/** « Remettre en stock » : le cas redevient disponible. Demande une confirmation avant d'agir ; ne fabrique ni ne dépense rien. */
export function BoutonRemettreEnStock({ casId, titre }: { casId: string; titre: string }) {
  const routeur = useRouter();
  const [attente, demarrer] = useTransition();
  const [confirmer, setConfirmer] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const oui = useRef<HTMLButtonElement>(null);
  // Le clavier suit le geste : après « Remettre en stock », le focus passe sur la confirmation.
  useEffect(() => {
    if (confirmer) oui.current?.focus();
  }, [confirmer]);
  if (!confirmer) {
    return (
      <Bouton variante="contour" aria-label={`Remettre en stock : ${titre}`} onClick={() => setConfirmer(true)}>
        Remettre en stock
      </Bouton>
    );
  }
  return (
    <div className="flex flex-col gap-2" role="group" aria-label="Confirmer la remise en stock">
      <p className="text-[13px] text-texte-doux">Ce cas pourra être refait. Rien n&apos;est supprimé et rien n&apos;est dépensé.</p>
      <div className="flex flex-wrap gap-2">
        <Bouton
          ref={oui}
          chargement={attente}
          onClick={() =>
            demarrer(async () => {
              const r = await remettreEnStockAction(casId);
              if (r.ok) routeur.refresh();
              else setMessage(r.message);
            })
          }
        >
          Oui, remettre en stock
        </Bouton>
        <Bouton variante="fantome" disabled={attente} onClick={() => setConfirmer(false)}>
          Annuler
        </Bouton>
      </div>
      {message && <p role="alert" className="text-sm text-brique">{message}</p>}
    </div>
  );
}
