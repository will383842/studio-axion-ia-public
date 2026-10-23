"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { validerDocumentAction } from "./actions";

/** « Je valide ce document » : pose la date de validation. N'envoie rien. */
export function BoutonValider({ videoId }: { videoId: string }) {
  const routeur = useRouter();
  const [attente, demarrer] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <Bouton
        chargement={attente}
        onClick={() =>
          demarrer(async () => {
            const r = await validerDocumentAction(videoId);
            if (r.ok) routeur.refresh();
            else setMessage(r.message);
          })
        }
      >
        Je valide ce document
      </Bouton>
      {message && <p role="alert" className="text-sm text-brique">{message}</p>}
    </div>
  );
}
