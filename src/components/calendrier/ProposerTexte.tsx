"use client";

/**
 * Bouton « Proposer le texte et le premier commentaire » (CAL-27), pour une vidéo, un carrousel ou une infographie importés.
 * Il PROPOSE seulement : tout reste modifiable, rien n'est écrit ni envoyé ici (validation du fondateur ailleurs).
 * Le bouton n'est jamais obligatoire : les champs se remplissent aussi à la main, et une panne ne bloque rien.
 */
import { useState } from "react";
import type { IdReseau } from "@/domaine/types";
import type { DemandeTexteImporte, ResultatProposition, TypeImporte } from "@/services/texte-post";

export interface TexteReseau {
  texte: string;
  premierCommentaire: string;
}

export interface PropsProposerTexte {
  type: TypeImporte;
  reseaux: IdReseau[];
  /** Fournie par l'hôte (appel serveur). Jamais un appel direct depuis le navigateur. */
  proposer: (d: DemandeTexteImporte) => Promise<ResultatProposition>;
  /** Texte de description du carrousel ou de l'infographie, s'il existe. */
  texteDesPages?: string;
  onChange?: (parReseau: Record<string, TexteReseau>) => void;
}

const LIBELLE_TYPE: Record<TypeImporte, string> = { video: "de votre vidéo", carrousel: "de votre carrousel", infographie: "de votre infographie" };

export function ProposerTexte({ type, reseaux, proposer, texteDesPages, onChange }: PropsProposerTexte) {
  const [description, setDescription] = useState("");
  const [valeurs, setValeurs] = useState<Record<string, TexteReseau>>({});
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [controle, setControle] = useState<Record<string, string[]>>({});

  function majeur(suivant: Record<string, TexteReseau>) {
    setValeurs(suivant);
    onChange?.(suivant);
  }

  async function demander() {
    if (enCours) return;
    setEnCours(true);
    setMessage(null);
    try {
      const r = await proposer({ type, description, reseaux, ...(texteDesPages ? { texteDesPages } : {}) });
      if (!r.ok) {
        setMessage(r.demande);
        return;
      }
      const suivant: Record<string, TexteReseau> = {};
      const echecs: Record<string, string[]> = {};
      for (const p of r.propositions) {
        suivant[p.reseau] = { texte: p.texte, premierCommentaire: p.premierCommentaire ?? "" };
        echecs[p.reseau] = p.controle;
      }
      setControle(echecs);
      majeur(suivant);
      setMessage(r.essai ? "Texte d'essai : le Studio est en simulation, ce texte n'est pas écrit par l'assistant. À relire et modifier." : "Proposition à relire et modifier : rien n'est envoyé sans votre validation.");
    } catch {
      setMessage("La proposition n'est pas disponible pour le moment. Vous pouvez écrire le texte à la main : l'ajout n'est pas bloqué.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <fieldset>
      <legend>Texte et premier commentaire</legend>
      <label>
        Une phrase qui décrit {LIBELLE_TYPE[type]}
        <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <button type="button" disabled={enCours} onClick={() => void demander()}>Proposer le texte et le premier commentaire</button>
      {message && <p role="status">{message}</p>}
      {reseaux.map((reseau) => {
        const v = valeurs[reseau] ?? { texte: "", premierCommentaire: "" };
        return (
          <div key={reseau}>
            <label>
              Texte du post ({reseau})
              <textarea value={v.texte} onChange={(e) => majeur({ ...valeurs, [reseau]: { ...v, texte: e.target.value } })} />
            </label>
            {(controle[reseau] ?? []).length > 0 && <p role="alert">À corriger avant la validation : {(controle[reseau] ?? []).join(" ; ")}.</p>}
            {reseau === "tiktok" ? (
              <p>Pas de premier commentaire sur TikTok.</p>
            ) : (
              <label>
                Premier commentaire ({reseau})
                <textarea value={v.premierCommentaire} onChange={(e) => majeur({ ...valeurs, [reseau]: { ...v, premierCommentaire: e.target.value } })} />
              </label>
            )}
          </div>
        );
      })}
    </fieldset>
  );
}
