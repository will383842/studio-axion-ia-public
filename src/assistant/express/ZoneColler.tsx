"use client";

/**
 * « Coller » un texte à soi (lot M3, B.0 §16) : le texte est découpé en blocs de la recette par le générateur central
 * (`decouper`), SANS qu'un mot soit réécrit. Coller compte pour une seule action : le découpage part tout seul.
 * « Importer un fichier » (B6) : .txt et .md lus dans le navigateur, .docx et .pdf lus par le serveur (5 Mo au plus),
 * puis le même découpage. Un texte de moins de 3 mots le dit (B13), il n'est plus ignoré en silence.
 */
import { useEffect, useRef, useState } from "react";
import { decouperTexteAction } from "@/app/(studio)/nouvelle/[format]/actions";
import { Bouton } from "@/components/ui/Bouton";
import { notifier } from "@/components/ui/Toast";
import { ZoneTexte } from "@/components/ui/ZoneTexte";
import type { BlocScript } from "@/domaine/types";
import { BoutonImporterTexte } from "./BoutonImporterTexte";
import { verifierTexteColle } from "./texte-colle";

export function ZoneColler({ formatId, onBlocs, autoFocus, libelle = "Votre texte" }: { formatId: string; onBlocs: (blocs: BlocScript[], texte: string) => void; autoFocus?: boolean; libelle?: string }) {
  const [texte, setTexte] = useState("");
  const [occupe, setOccupe] = useState(false);
  // E2E-2 parcours n° 12 : un texte tapé ou dicté n'est jamais perdu. Si la feuille se ferme (« OK ») sans « Utiliser ce
  // texte », il est utilisé quand même. `utilise` : le dernier texte déjà envoyé (pas deux fois).
  const dernier = useRef({ texte: "", utilise: "" });
  const changer = (t: string) => {
    dernier.current.texte = t;
    setTexte(t);
  };

  async function utiliser(source: string, silencieux = false) {
    const v = verifierTexteColle(source);
    if (!v.ok) {
      if (!silencieux) notifier.info(v.message);
      return;
    }
    const propre = v.texte;
    dernier.current.utilise = propre;
    setOccupe(true);
    const r = await decouperTexteAction(formatId, propre);
    setOccupe(false);
    if (!r.ok) return notifier.erreur(r.message);
    if (!r.donnees.length) return notifier.info("Ce texte est trop court.");
    onBlocs(r.donnees, propre);
  }

  const utiliserRef = useRef(utiliser);
  useEffect(() => {
    utiliserRef.current = utiliser;
  });
  useEffect(
    () => () => {
      const { texte: reste, utilise } = dernier.current;
      if (reste.trim() && reste.trim() !== utilise) void utiliserRef.current(reste, true);
    },
    [],
  );

  return (
    <div className="space-y-3">
      <ZoneTexte
        libelle={libelle}
        libelleMasque
        autoFocus={autoFocus}
        rows={5}
        value={texte}
        placeholder="Collez ou écrivez votre texte ici"
        onChange={(e) => changer(e.target.value)}
        onPaste={(e) => {
          // Coller = une seule action : le texte collé est découpé aussitôt.
          const colle = e.clipboardData.getData("text");
          if (!colle.trim()) return;
          e.preventDefault();
          const suite = texte ? `${texte} ${colle}` : colle;
          changer(suite);
          void utiliser(suite);
        }}
        className="[&_textarea]:min-h-32"
      />
      <BoutonImporterTexte
        onTexte={(t) => {
          changer(t);
          void utiliser(t);
        }}
      />
      {texte.trim() && (
        <Bouton variante="secondaire" icone="coche" pleineLargeur chargement={occupe} onClick={() => void utiliser(texte)}>
          Utiliser ce texte
        </Bouton>
      )}
    </div>
  );
}
