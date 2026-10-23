"use client";

import { useEffect, useState, useTransition } from "react";
import { Bouton, FeuilleBas, Icone, notifier, ZoneTexte } from "@/components/ui";
import type { EtatLigneCollee, LigneCollee } from "@/domaine/prononciations";
import { cn } from "@/lib/cn";
import { ajouterListeAction, apercuListeAction } from "./actions";

const ETATS: Record<EtatLigneCollee, { libelle: string; classe: string }> = {
  nouveau: { libelle: "Nouveau", classe: "bg-sauge-doux text-sauge" },
  "deja-dans-la-liste": { libelle: "Déjà là", classe: "bg-surface-3 text-texte-faible" },
  "doublon-du-collage": { libelle: "En double", classe: "bg-ambre-doux text-ambre" },
  illisible: { libelle: "À revoir", classe: "bg-brique-doux text-brique" },
};

/**
 * « Coller une liste » (n° 4) : une ligne par mot, `mot = prononciation` (option : `| écriture`). Aperçu ligne à ligne
 * avant l'enregistrement ; les doublons (déjà dans la liste ou deux fois dans le collage) sont signalés et ignorés.
 */
export function CollerListe({ ouverte, onOuverteChange }: { ouverte: boolean; onOuverteChange: (v: boolean) => void }) {
  const [texte, setTexte] = useState("");
  const [lignes, setLignes] = useState<LigneCollee[]>([]);
  const [enCours, demarrer] = useTransition();

  useEffect(() => {
    let annule = false;
    const t = setTimeout(async () => {
      if (!texte.trim()) return void (!annule && setLignes([]));
      const r = await apercuListeAction(texte);
      if (!annule && r.ok) setLignes(r.donnees);
    }, 350);
    return () => {
      annule = true;
      clearTimeout(t);
    };
  }, [texte]);

  const nouveaux = lignes.filter((l) => l.etat === "nouveau").length;

  function ajouter() {
    demarrer(async () => {
      const r = await ajouterListeAction(texte);
      if (!r.ok) return void notifier.erreur(r.message);
      notifier.succes(`${r.donnees.ajoutes} mot${r.donnees.ajoutes > 1 ? "s" : ""} ajouté${r.donnees.ajoutes > 1 ? "s" : ""}`, r.donnees.ignores ? `${r.donnees.ignores} ligne${r.donnees.ignores > 1 ? "s" : ""} ignorée${r.donnees.ignores > 1 ? "s" : ""} (doublons ou à revoir).` : undefined);
      setTexte("");
      onOuverteChange(false);
    });
  }

  return (
    <FeuilleBas
      ouverte={ouverte}
      onOuverteChange={onOuverteChange}
      titre="Coller une liste"
      description="Une ligne par mot : mot = prononciation"
      pleinEcran
      pied={
        <Bouton taille="lg" pleineLargeur icone="coche" chargement={enCours} disabled={!nouveaux} onClick={ajouter}>
          {nouveaux ? `Ajouter ${nouveaux} mot${nouveaux > 1 ? "s" : ""}` : "Ajouter"}
        </Bouton>
      }
    >
      <div className="grid gap-4">
        <ZoneTexte libelle="Votre liste" libelleMasque value={texte} onChange={(e) => setTexte(e.target.value)} rows={6} placeholder={"PV = pé-vé\nTeleos = té-lé-osse\n35h = trente-cinq heures | 35 h"} className="font-mono text-[15px]" />
        {lignes.length > 0 && (
          <ul aria-label="Aperçu" className="divide-y divide-trait overflow-hidden rounded-carte border border-trait bg-surface-1">
            {lignes.map((l) => (
              <li key={l.numero} className={cn("flex min-h-12 items-center gap-3 px-3 py-2", l.etat !== "nouveau" && "opacity-70")}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-texte">{l.mot || l.texte}</span>
                  {l.prononciation && (
                    <span className="flex items-center gap-1.5 truncate text-sm text-orange-vif">
                      <Icone nom="son" size={13} className="shrink-0" />« {l.prononciation} »{l.ecriture && <span className="text-texte-faible"> · écrit « {l.ecriture} »</span>}
                    </span>
                  )}
                </span>
                <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold", ETATS[l.etat].classe)}>{ETATS[l.etat].libelle}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </FeuilleBas>
  );
}
