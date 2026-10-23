"use client";

import { useState } from "react";
import { Icone, Onglets, Pastille, Portrait, type Onglet } from "@/components/ui";
import { NATURES_PERSONNAGE } from "@/domaine/libelles";
import type { VueFichePersonnage } from "@/services/B-personnages-bibliotheque";
import { OngletAccord } from "./OngletAccord";
import { OngletVisages } from "./OngletVisages";
import { OngletVoix } from "./OngletVoix";

export type OngletFiche = "visages" | "voix" | "accord";

/** FICHE PERSONNAGE (B.8 #14) : en-tête visuel + onglets Visages · Voix · Accord (personne réelle). */
export function FichePersonnage({ fiche, texteALire, ongletInitial }: { fiche: VueFichePersonnage; texteALire: string; ongletInitial: OngletFiche }) {
  const reel = fiche.personnage.nature === "reel";
  const [onglet, setOnglet] = useState<OngletFiche>(ongletInitial === "accord" && !reel ? "visages" : ongletInitial);
  const verrouille = !fiche.accordValide;
  const nature = NATURES_PERSONNAGE[fiche.personnage.nature];
  const ouvrirAccord = () => {
    setOnglet("accord");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onglets: Onglet[] = [
    {
      valeur: "visages",
      libelle: "Visages",
      icone: "visage",
      compteur: fiche.visages.length,
      contenu: <OngletVisages fiche={fiche} verrouille={verrouille} onOuvrirAccord={ouvrirAccord} />,
    },
    {
      valeur: "voix",
      libelle: "Voix",
      icone: "micro",
      contenu: <OngletVoix key={fiche.voix[0]?.id ?? "aucune"} fiche={fiche} texteALire={texteALire} verrouille={verrouille} onOuvrirAccord={ouvrirAccord} />,
    },
    ...(reel ? [{ valeur: "accord", libelle: "Accord", icone: verrouille ? ("cadenas" as const) : ("bouclier" as const), contenu: <OngletAccord fiche={fiche} /> }] : []),
  ];

  return (
    <div>
      <header className="relative isolate -mx-4 mb-5 overflow-hidden px-4 pb-5 pt-2 sm:mx-0 sm:rounded-carte sm:border sm:border-trait sm:bg-surface-1 sm:p-6">
        <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-40 lueur" />
        <div className="flex items-center gap-4">
          <Portrait nom={fiche.personnage.nom} photo={fiche.photo} taille="xl" anneau={fiche.personnage.nature === "moi"} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[28px] leading-tight text-texte sm:text-4xl">{fiche.personnage.nom}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-texte-doux">
              <Icone nom={nature.icone} size={14} />
              {fiche.personnage.role ?? nature.libelle}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {fiche.utilisable ? (
                <Pastille ton="sauge" icone="valide">
                  Prêt à tourner
                </Pastille>
              ) : (
                fiche.alertes.map((a) => (
                  <Pastille key={a} ton={a.startsWith("Accord") ? "ambre" : "neutre"} icone={a.startsWith("Accord") ? "cadenas" : "attention"}>
                    {a}
                  </Pastille>
                ))
              )}
            </div>
          </div>
        </div>
      </header>
      <Onglets libelle="Sections du personnage" onglets={onglets} valeur={onglet} onChange={(v) => setOnglet(v as OngletFiche)} />
    </div>
  );
}
