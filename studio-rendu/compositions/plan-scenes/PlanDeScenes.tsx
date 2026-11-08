/**
 * COMPOSITION GÉNÉRIQUE « PlanDeScenes » (lot C) : rend un plan de scènes VALIDÉ (`validerPlan`, côté studio).
 * Le dessin est dans `src/briques/plan-scenes/rendu.tsx` (pur) ; ici : l'image courante et Manrope chargée en local.
 */
import { AbsoluteFill, continueRender, delayRender, useCurrentFrame } from "remotion";
import { ImagePlan, dureeImagesPlan } from "../../../src/briques/plan-scenes/rendu";
import type { PlanValide } from "../../../src/briques/plan-scenes/schema";
import manrope from "../../../src/app/polices/manrope-latin.woff2";

export type ProprietesPlanDeScenes = {
  plan: PlanValide;
};

let chargement: Promise<void> | null = null;
function chargerManrope(): void {
  if (chargement || typeof document === "undefined") return;
  const attente = delayRender("Police Manrope");
  const face = new FontFace("Manrope", `url(${manrope})`, { weight: "200 800" });
  chargement = face
    .load()
    .then(() => {
      document.fonts.add(face);
    })
    .finally(() => continueRender(attente));
}

export function PlanDeScenes({ plan }: ProprietesPlanDeScenes) {
  chargerManrope();
  const image = useCurrentFrame();
  return (
    <AbsoluteFill>
      <ImagePlan plan={plan} image={image} />
    </AbsoluteFill>
  );
}

export const metaPlanDeScenes = ({ props }: { props: ProprietesPlanDeScenes }) => ({
  durationInFrames: dureeImagesPlan(props.plan),
  fps: props.plan.format.fps,
  width: props.plan.format.largeur,
  height: props.plan.format.hauteur,
});

/** Propriétés vides (une légende de 3 s) : le vrai plan arrive par la demande de rendu. */
export const PLAN_VIDE: ProprietesPlanDeScenes = {
  plan: {
    version: "plan-scenes-1",
    format: { largeur: 1080, hauteur: 1920, fps: 25 },
    facecam: false,
    dureeMs: 3000,
    habillage: { fond: "ivoire", accent: "terracotta" },
    mots: [],
    scenes: [
      { id: "s1", version: 1, empreinte: "0000000000000000", mots: { premier: 0, dernier: 0 }, debutMs: 0, finMs: 3000, niveau: 1, position: "centre", transition: { entree: "fondu", sortie: "fondu", dureeMs: 400 }, piece: "legende", parametres: { texte: "Axion IA", sousTexte: "", style: "titre" } },
    ],
  },
};
