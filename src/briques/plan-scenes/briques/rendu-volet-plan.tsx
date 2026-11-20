/**
 * N-05-VOLET-c : rendu PUR du volet « avant / après » dans le plan de scènes. Pose les deux captures découpées par le trait,
 * puis le dessin du volet par-dessus. Sans les deux adresses (non vides, différentes) : RIEN. Aucun hook, aucun Remotion. Aucun importeur.
 */
import type { JSX } from "react";
import type { ProprietesObjet } from "../../motion/petits-objets/contrat";
import { phaseObjet } from "../../motion/petits-objets/progres";
import { geometrieVolet, OBJET_VOLET_AVANT_APRES, type ParametresVoletAvantApres, type SensVolet } from "../../motion/petits-objets/volet-avant-apres";

type Entree = { avant?: unknown; apres?: unknown; sens?: SensVolet; etiquettes?: boolean };

export function RenduVoletPlan(p: ProprietesObjet<Entree>): JSX.Element {
  const { avant, apres } = p.parametres ?? {};
  if (typeof avant !== "string" || typeof apres !== "string" || avant.trim() === "" || apres.trim() === "" || avant === apres) return <></>;
  const sens = p.parametres.sens ?? "gauche-droite";
  const pct = geometrieVolet(p.image, p.dureeImages, sens).coupure * 100;
  // « avant » occupe le côté du bord de départ ; « après » l'autre côté.
  const clipAvant = sens === "gauche-droite" ? `inset(0 ${100 - pct}% 0 0)` : `inset(0 0 0 ${pct}%)`;
  const clipApres = sens === "gauche-droite" ? `inset(0 0 0 ${pct}%)` : `inset(0 ${100 - pct}% 0 0)`;
  const style = (clip: string) => ({ position: "absolute" as const, inset: 0, width: "100%", height: "100%", objectFit: "cover" as const, clipPath: clip });
  const parametres: ParametresVoletAvantApres = { avant, apres };
  if (p.parametres.sens !== undefined) parametres.sens = p.parametres.sens;
  if (p.parametres.etiquettes !== undefined) parametres.etiquettes = p.parametres.etiquettes;
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <div style={{ position: "absolute", inset: 0, opacity: phaseObjet(p.image, p.dureeImages).opacite, borderRadius: "2.8%", overflow: "hidden" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- capture déjà signée posée dans une toile de rendu */}
        <img src={avant} alt="" style={style(clipAvant)} />
        {/* eslint-disable-next-line @next/next/no-img-element -- capture déjà signée posée dans une toile de rendu */}
        <img src={apres} alt="" style={style(clipApres)} />
      </div>
      {OBJET_VOLET_AVANT_APRES.Rendu({ ...p, parametres })}
    </div>
  );
}
