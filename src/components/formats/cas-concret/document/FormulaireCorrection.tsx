"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { ZoneTexte } from "@/components/ui/ZoneTexte";
import { corrigerDocumentAction } from "./actions";
import { BUDGET_DEUX_PAGES } from "./texte";

/** Will relit le premier jet, le corrige, l'enregistre. Une correction remet le document en brouillon. */
export function FormulaireCorrection({ videoId, texte }: { videoId: string; texte: string }) {
  const routeur = useRouter();
  const [valeur, setValeur] = useState(texte);
  const [attente, demarrer] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [fait, setFait] = useState(false);
  return (
    <div className="space-y-3">
      <ZoneTexte
        libelle="Le texte du document"
        aide="Les titres commencent par # ou ##. Aucun prix, aucun chiffre sans source, aucun client nommé."
        value={valeur}
        longueurMax={BUDGET_DEUX_PAGES}
        onChange={(e) => {
          setValeur(e.target.value);
          setFait(false);
        }}
      />
      <Bouton
        variante="secondaire"
        chargement={attente}
        onClick={() =>
          demarrer(async () => {
            const r = await corrigerDocumentAction(videoId, valeur);
            if (r.ok) {
              setMessage(null);
              setFait(true);
              routeur.refresh();
            } else setMessage(r.message);
          })
        }
      >
        Enregistrer mes corrections
      </Bouton>
      {fait && <p role="status" className="text-sm text-texte-doux">Corrections enregistrées. Relisez, puis validez.</p>}
      {message && <p role="alert" className="text-sm text-brique">{message}</p>}
    </div>
  );
}
