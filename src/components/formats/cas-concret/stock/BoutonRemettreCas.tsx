"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { remettreCasAction } from "@/app/(studio)/cas-concret/actions";
import { Bouton } from "@/components/ui/Bouton";

/** « Remettre ce cas » : le cas est de nouveau proposé. Demande une confirmation avant d'agir ; ne fabrique ni ne dépense rien. */
export function BoutonRemettreCas({ casId, titre }: { casId: string; titre: string }) {
  const routeur = useRouter();
  const [attente, demarrer] = useTransition();
  const [confirmer, setConfirmer] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const oui = useRef<HTMLButtonElement>(null);
  // Le clavier suit le geste : après « Remettre ce cas », le focus passe sur la confirmation.
  useEffect(() => {
    if (confirmer) oui.current?.focus();
  }, [confirmer]);
  if (!confirmer) {
    return (
      <Bouton variante="contour" aria-label={`Remettre ce cas : ${titre}`} onClick={() => setConfirmer(true)}>
        Remettre ce cas
      </Bouton>
    );
  }
  return (
    <div className="flex flex-col gap-2" role="group" aria-label="Confirmer la remise du cas">
      <p className="text-[13px] text-texte-doux">Ce cas sera de nouveau proposé. Rien n&apos;est dépensé.</p>
      <div className="flex flex-wrap gap-2">
        <Bouton
          ref={oui}
          chargement={attente}
          onClick={() =>
            demarrer(async () => {
              const r = await remettreCasAction(casId);
              if (r.ok) routeur.refresh();
              else setMessage(r.message);
            })
          }
        >
          Oui, le remettre
        </Bouton>
        <Bouton variante="fantome" disabled={attente} onClick={() => setConfirmer(false)}>
          Annuler
        </Bouton>
      </div>
      {message && <p role="alert" className="text-sm text-brique">{message}</p>}
    </div>
  );
}
