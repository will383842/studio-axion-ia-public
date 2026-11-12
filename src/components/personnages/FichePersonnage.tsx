"use client";

import { useState } from "react";
import { EnTetePage, Icone, Onglets, Pastille, Portrait, type Onglet } from "@/components/ui";
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
      <div className="mb-8 flex items-center gap-4">
        <Portrait nom={fiche.personnage.nom} photo={fiche.photo} taille="xl" anneau={fiche.personnage.nature === "moi"} />
        <EnTetePage
          className="mb-0 min-w-0 flex-1 sm:items-center"
          titre={<span className="block truncate">{fiche.personnage.nom}</span>}
          sousTitre={
            <span className="flex items-center gap-1.5 text-sm">
              <Icone nom={nature.icone} size={14} />
              {fiche.personnage.role ?? nature.libelle}
            </span>
          }
          actions={
            fiche.utilisable ? (
              <Pastille ton="sauge" icone="valide">
                Prêt à tourner
              </Pastille>
            ) : (
              fiche.alertes.map((a) => (
                <Pastille key={a} ton={a.startsWith("Accord") ? "ambre" : "neutre"} icone={a.startsWith("Accord") ? "cadenas" : "attention"}>
                  {a}
                </Pastille>
              ))
            )
          }
        />
      </div>
      <Onglets libelle="Sections du personnage" onglets={onglets} valeur={onglet} onChange={(v) => setOnglet(v as OngletFiche)} />
    </div>
  );
}
