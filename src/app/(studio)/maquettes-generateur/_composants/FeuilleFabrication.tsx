"use client";

import { useState } from "react";
import { Bouton, FeuilleBas, Icone, LogoReseau, notifier } from "@/components/ui";
import type { IdReseau } from "@/domaine/types";
import { cn } from "@/lib/cn";
import { obtenirReseau } from "@/reseaux";
import { FABRICATION_DEMO, RESEAUX_GENERATEUR } from "../_demo";

/**
 * Feuille de confirmation avant de fabriquer (B.6.7) : prix, total du jour, crédits restants,
 * conseil « Commencez par TikTok », alerte au-delà du repère du jour. Le bouton se désactive au premier toucher.
 * En attendant la fabrication groupée : une version à la fois.
 */
export function FeuilleFabrication({ ouverte, onOuverteChange }: { ouverte: boolean; onOuverteChange: (v: boolean) => void }) {
  const [reseau, setReseau] = useState<IdReseau>("tiktok");
  const [envoye, setEnvoye] = useState(false);
  const f = FABRICATION_DEMO;

  return (
    <FeuilleBas
      ouverte={ouverte}
      onOuverteChange={onOuverteChange}
      titre="Fabriquer"
      pied={
        <Bouton
          pleineLargeur
          taille="xl"
          icone="film"
          chargement={envoye}
          onClick={() => {
            setEnvoye(true);
            notifier.info("Maquette : rien n'est fabriqué.");
          }}
        >
          {envoye ? "C'est parti" : `Fabriquer · ${f.prix}`}
        </Bouton>
      }
    >
      <div className="space-y-5">
        {/* Quelle version */}
        <div>
          <div role="radiogroup" aria-label="Version à fabriquer" className="flex justify-between gap-1">
            {RESEAUX_GENERATEUR.map((r) => {
              const actif = r === reseau;
              return (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={actif}
                  aria-label={obtenirReseau(r).nom}
                  onClick={() => setReseau(r)}
                  className={cn("grid size-12 place-items-center rounded-xl", actif ? "bg-orange-doux ring-2 ring-orange" : "hover:bg-surface-2")}
                >
                  <LogoReseau reseau={r} className={cn(actif && "border-orange text-orange-vif")} />
                </button>
              );
            })}
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-[13px] text-texte-doux">
            <Icone nom="info" size={14} className="text-orange-vif" />
            Conseil : commencez par TikTok
          </p>
        </div>

        {/* Le prix, en grand */}
        <div className="rounded-carte bg-surface-2 p-4">
          <p className="font-titre text-5xl leading-none text-texte">{f.prix}</p>
          <p className="mt-1.5 text-sm text-texte-doux">version {obtenirReseau(reseau).nom}, avec votre double</p>
        </div>

        {/* Total du jour et crédits */}
        <dl className="grid grid-cols-3 gap-2">
          <Chiffre libelle="Aujourd'hui" valeur={f.totalJourApres} detail={`avant : ${f.totalJourAvant}`} ambre />
          <Chiffre libelle="Double" valeur={f.creditDouble} detail="crédit HeyGen" />
          <Chiffre libelle="Écriture" valeur={f.creditEcriture} detail="crédit Claude" />
        </dl>

        <p className="flex items-center gap-2 rounded-carte border border-ambre/40 bg-ambre-doux px-3 py-2.5 text-sm font-semibold text-ambre">
          <Icone nom="attention" size={16} className="shrink-0" />
          Au-delà de votre repère du jour ({f.repereJour})
        </p>

        <p className="flex items-center gap-2 text-sm text-texte-faible">
          <Icone nom="horloge" size={14} />
          Fabrication groupée : bientôt
        </p>
      </div>
    </FeuilleBas>
  );
}

function Chiffre({ libelle, valeur, detail, ambre }: { libelle: string; valeur: string; detail: string; ambre?: boolean }) {
  return (
    <div className="rounded-champ border border-trait p-3">
      <dt className="text-[11px] font-bold uppercase tracking-wider text-texte-faible">{libelle}</dt>
      <dd className={cn("mt-1 font-titre text-lg leading-tight tabular-nums", ambre ? "text-ambre" : "text-texte")}>{valeur}</dd>
      <dd className="text-[11px] text-texte-faible">{detail}</dd>
    </div>
  );
}
