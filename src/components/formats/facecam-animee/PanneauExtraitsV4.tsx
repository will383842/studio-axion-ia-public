"use client";

/**
 * FACE CAMÉRA ANIMÉE v4 · petit panneau « Changer un extrait ». Composant seul : monté nulle part, il ne fait que fabriquer
 * la demande et la rendre à `surDemande`. Aucune action serveur, aucun montant, aucune police neuve (Manrope héritée).
 */
import { useState } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { Champ } from "@/components/ui/Champ";
import {
  demandeDuPanneauV4,
  PHRASES_PANNEAU_EXTRAITS_V4 as P,
  type ActionPanneauV4,
  type DemandePanneauV4,
  type SourcePanneauV4,
  type TelephonePanneauV4,
} from "./extraits-v4";

export interface ProprietesPanneauExtraitsV4 {
  telephones: TelephonePanneauV4[];
  sources: SourcePanneauV4[];
  occupe?: boolean;
  surDemande: (d: DemandePanneauV4) => void;
}

export function PanneauExtraitsV4({ telephones, sources, occupe, surDemande }: ProprietesPanneauExtraitsV4) {
  const [rang, setRang] = useState<number | null>(null);
  const [recherche, setRecherche] = useState("");
  const [sourceVideoId, setSourceVideoId] = useState("");
  const [debut, setDebut] = useState("");
  const [fin, setFin] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  if (telephones.length === 0) {
    return <p className="text-[15px] text-texte-doux">{P.aucunTelephone}</p>;
  }

  function envoyer(action: ActionPanneauV4) {
    const r = demandeDuPanneauV4(action, { rang, recherche, sourceVideoId, debut, fin }, sources);
    if ("erreur" in r) return setErreur(r.erreur);
    setErreur(null);
    surDemande(r.demande);
  }

  return (
    <section aria-label={P.titre} className="space-y-4">
      <h3 className="text-base font-semibold text-texte">{P.titre}</h3>
      <div role="radiogroup" aria-label="Téléphone" className="space-y-2">
        {telephones.map((t) => (
          <button
            key={t.rang}
            type="button"
            role="radio"
            aria-checked={rang === t.rang}
            onClick={() => setRang(t.rang)}
            className={`min-h-11 w-full rounded-2xl border px-4 py-2 text-left text-[15px] font-semibold ${rang === t.rang ? "border-accent bg-accent-doux text-texte" : "border-trait bg-surface-1 text-texte-doux"}`}
          >
            {t.libelle}
          </button>
        ))}
      </div>
      <Champ libelle={P.champTexte} value={recherche} maxLength={80} onChange={(e) => setRecherche(e.target.value)} />
      <div>
        <label htmlFor="extrait-v4-source" className="mb-1.5 block text-sm font-semibold text-texte-doux">
          {P.champVideo}
        </label>
        <select
          id="extrait-v4-source"
          value={sourceVideoId}
          onChange={(e) => setSourceVideoId(e.target.value)}
          className="min-h-12 w-full rounded-champ border border-trait bg-surface-1 px-3.5 text-[15px] text-texte"
        >
          <option value="">{P.nImporteLaquelle}</option>
          {sources.map((s) => (
            <option key={s.videoId} value={s.videoId}>
              {s.titre}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Champ libelle={P.champDebut} inputMode="decimal" value={debut} onChange={(e) => setDebut(e.target.value)} />
        <Champ libelle={P.champFin} inputMode="decimal" value={fin} onChange={(e) => setFin(e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Bouton variante="principal" disabled={occupe} onClick={() => envoyer("remplacer")}>
          {P.remplacer}
        </Bouton>
        <Bouton variante="secondaire" disabled={occupe} onClick={() => envoyer("retirer")}>
          {P.retirer}
        </Bouton>
        <Bouton variante="secondaire" disabled={occupe} onClick={() => envoyer("deplacer")}>
          {P.deplacer}
        </Bouton>
      </div>
      {erreur && (
        <p role="alert" className="text-sm font-semibold text-brique">
          {erreur}
        </p>
      )}
    </section>
  );
}
