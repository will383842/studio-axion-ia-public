/**
 * Écran de remplacement (R1a) : dessine n'importe quel type avec les pièces du socle — fond, marque, étiquette,
 * affiche mot par mot, lignes, puces, objets, fil d'étapes, éclair — à partir de la mise en page de la brique
 * `ecrans-motion`. Les tâches R1 à R4 remplacent chaque type par sa composition propre.
 */
import { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { disposer, imagesEcran, type IdObjet, type ProprietesEcran } from "../../../../src/briques/ecrans-motion";
import { OBJETS } from "../objets/registre";
import { heureEvenement, instant, planEntreeEcran, progres } from "../plans/commun";
import { Biais } from "./Biais";
import { Eclair } from "./Eclair";
import { Etiquette } from "./Etiquette";
import { FilEtapes } from "./FilEtapes";
import { Fond } from "./Fond";
import { Ligne } from "./Ligne";
import { Marque } from "./Marque";
import { MotParMot } from "./MotParMot";
import { ObjetProvisoire } from "./ObjetProvisoire";
import { Puce } from "./Puce";
import { Surgir } from "./Surgir";

/** Objet redessiné porté implicitement par une boîte d'objet du gabarit. */
const OBJET_DE_BOITE: Record<string, IdObjet> = {
  liste: "liste-taches",
  bouclier: "bouclier-coche",
  champ: "champ-commentaire",
  bulle: "bulle-lien",
  anneau: "chrono",
  "barre-avant": "barres-avant-apres",
  "barre-maintenant": "barres-avant-apres",
};

export function EcranProvisoire({ p }: { p: ProprietesEcran }) {
  const image = useCurrentFrame();
  const t = instant(image, p.fps);
  const tVideo = t + p.debutMs / 1000;
  const mise = useMemo(() => disposer(p), [p]);
  const entree = planEntreeEcran(p, t);
  const avance = progres(image, 0, Math.max(1, imagesEcran(p) - 1));
  const visuel = p.type === "etape" || p.type === "objet" ? p.visuel : null;
  let rangAffiche = 0;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Fond fond={p.fond} largeur={p.largeur} hauteur={p.hauteur} />
      <AbsoluteFill style={{ opacity: entree.opacite, transform: `scale(${entree.echelle})` }}>
        {mise.boites.objets.map((o, i) => {
          const id = visuel && "objet" in visuel ? visuel.objet : OBJET_DE_BOITE[o.nom];
          const Composant = id ? OBJETS[id] : ObjetProvisoire;
          const proprietes = { boite: { ...o.boite, x: 0, y: 0 }, t, tVideo, fond: p.fond, ...(visuel && "objet" in visuel && visuel.textes ? { textes: visuel.textes } : {}), ...(visuel && "capture" in visuel && o.nom === "visuel" ? { capture: visuel.capture } : {}) };
          return (
            <Biais key={o.nom} boite={o.boite} entree={progres(t, 0.1 + i * 0.1, 0.4)} tVideo={tVideo}>
              <Composant {...proprietes} />
            </Biais>
          );
        })}
        {mise.textes.map((pose) => {
          if (pose.nom === "marque") return <Marque key={pose.nom} p={p} boite={pose.boite} />;
          if (pose.nom.startsWith("etiquette")) return <Etiquette key={pose.nom} pose={pose} fond={p.fond} t={t} />;
          if (pose.nom.startsWith("puce-")) {
            const debut = heureEvenement(p, pose.nom) ?? 0.6 + Number(pose.nom.slice(5)) * 0.3;
            return (
              <div key={pose.nom} style={{ position: "absolute", left: pose.boite.x, top: pose.boite.y, width: pose.boite.largeur, textAlign: "center" }}>
                <Surgir x={progres(t, debut, 0.3)} rotation={pose.nom.endsWith("1") ? -4 : 4}>
                  <Puce texte={pose.texte} taille={pose.tailleRendue} />
                </Surgir>
              </div>
            );
          }
          if (pose.police === "anton") {
            const debut = heureEvenement(p, pose.nom) ?? 0.1 * rangAffiche++;
            return <MotParMot key={pose.nom} pose={pose} fond={p.fond} ecoule={t - debut} />;
          }
          return <Ligne key={pose.nom} pose={pose} fond={p.fond} t={t} debut={heureEvenement(p, pose.nom) ?? 0.35} />;
        })}
        {p.type === "etape" && mise.boites.fil ? <FilEtapes boite={mise.boites.fil} numero={p.numero} nombreEtapes={p.nombreEtapes} avance={avance} /> : null}
      </AbsoluteFill>
      <Eclair t={t} debut={heureEvenement(p, "eclair")} />
    </AbsoluteFill>
  );
}
