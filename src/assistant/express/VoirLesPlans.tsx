"use client";

/**
 * « Voir les plans » (lot M3 ; plan PARTIE A §2 étape 5, B.1 « Maquette », B.9) : la maquette fabrique la VRAIE voix
 * (quelques centimes, gardée pour la vidéo : pas repayée), puis découpe les plans définitifs. La bande de plans est
 * composée DANS LE NAVIGATEUR (`MaquetteNavigateur`, livré par le lot M1, intégré tel quel) : aucune vidéo fabriquée.
 * Un moteur qui produit encore un fichier de maquette (formats simulés) est lu par le lecteur vidéo.
 */
import { useState } from "react";
import { maquetteAction, plansMaquetteAction } from "@/app/(studio)/nouvelle/[format]/actions";
import { MaquetteNavigateur, type PlanMaquette } from "@/components/creation/MaquetteNavigateur";
import { Bouton } from "@/components/ui/Bouton";
import { FeuilleBas } from "@/components/ui/FeuilleBas";
import { LecteurVideo } from "@/components/ui/LecteurVideo";
import { notifier } from "@/components/ui/Toast";
import type { Ratio, SegmentSousTitres } from "@/domaine/types";
import { avecConfirmationPrix } from "@/components/ui/ConfirmationPrix";

type Maquette =
  | { genre: "navigateur"; plans: PlanMaquette[]; sousTitres: SegmentSousTitres[]; audioUrl: string; dureeSec: number; ratio: Ratio }
  | { genre: "fichier"; url: string; vignette: string; ratio: Ratio };

export function VoirLesPlans({ enregistrer, desactive }: { enregistrer: () => Promise<string | null>; desactive?: boolean }) {
  const [occupe, setOccupe] = useState(false);
  const [maquette, setMaquette] = useState<Maquette | null>(null);

  async function voir() {
    setOccupe(true);
    try {
      const id = await enregistrer();
      if (!id) return;
      let r = await maquetteAction(id);
      r = await avecConfirmationPrix(r, (accord) => maquetteAction(id, accord));
      if (!r.ok) return notifier.erreur(r.message);
      if (r.donnees.audioUrl) {
        const p = await plansMaquetteAction(r.donnees.versionId);
        if (!p.ok) return notifier.erreur(p.message);
        setMaquette({ genre: "navigateur", plans: p.donnees.plans, sousTitres: p.donnees.sousTitres, audioUrl: r.donnees.audioUrl, dureeSec: r.donnees.dureeSec, ratio: r.donnees.ratio });
      } else if (r.donnees.url) {
        setMaquette({ genre: "fichier", url: r.donnees.url, vignette: r.donnees.vignette, ratio: r.donnees.ratio });
      } else notifier.info("Les plans arrivent avec la fabrication");
    } finally {
      setOccupe(false);
    }
  }

  return (
    <>
      <Bouton variante="contour" icone="film" essai pleineLargeur chargement={occupe} disabled={desactive} onClick={() => void voir()}>
        Voir les plans
      </Bouton>
      <FeuilleBas ouverte={!!maquette} onOuverteChange={(o) => !o && setMaquette(null)} titre="Les plans" description="Sur votre vraie voix : ce que vous voyez est ce qui sera fabriqué.">
        {maquette?.genre === "navigateur" && <MaquetteNavigateur plans={maquette.plans} audioUrl={maquette.audioUrl} dureeSec={maquette.dureeSec} sousTitres={maquette.sousTitres} ratio={maquette.ratio} className="mx-auto max-w-[320px] pb-4" />}
        {maquette?.genre === "fichier" && <LecteurVideo src={maquette.url} affiche={maquette.vignette} ratio={maquette.ratio} titre="Les plans" autoLecture className="mx-auto max-h-[60dvh]" />}
      </FeuilleBas>
    </>
  );
}
