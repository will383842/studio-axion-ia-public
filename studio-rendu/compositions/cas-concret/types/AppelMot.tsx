/** Type d'écran `appel-mot` (R4) : invite, champ de saisie où le mot se tape, suite. Dessine `plans/AppelMot.ts`. */
import { AbsoluteFill, useCurrentFrame } from "remotion";
import type { ProprietesEcran } from "../../../../src/briques/ecrans-motion";
import { ChampCommentaire } from "../objets/ChampCommentaire";
import { BIAIS_CHAMP, planAppelMot } from "../plans/AppelMot";
import { Biais } from "../socle/Biais";
import { Eclair } from "../socle/Eclair";
import { Etiquette } from "../socle/Etiquette";
import { Fond } from "../socle/Fond";
import { Marque } from "../socle/Marque";
import { MotParMot } from "../socle/MotParMot";

export function AppelMot(p: Extract<ProprietesEcran, { type: "appel-mot" }>) {
  const plan = planAppelMot(p, useCurrentFrame());
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Fond fond={p.fond} largeur={p.largeur} hauteur={p.hauteur} />
      <AbsoluteFill style={{ opacity: plan.entree.opacite, transform: `scale(${plan.entree.echelle})` }}>
        <Marque p={p} boite={plan.marque} />
        {plan.etiquette ? <Etiquette pose={plan.etiquette.pose} fond={p.fond} t={plan.t} /> : null}
        <MotParMot pose={plan.invite.pose} fond={p.fond} ecoule={plan.invite.ecoule} pas={plan.invite.pas} />
        <Biais boite={plan.champ.boite} entree={plan.champ.progres} tVideo={plan.tVideo} rotY={BIAIS_CHAMP.rotY} rotX={BIAIS_CHAMP.rotX}>
          <ChampCommentaire {...plan.champ.objet} boite={{ ...plan.champ.boite, x: 0, y: 0 }} />
        </Biais>
        <MotParMot pose={plan.suite.pose} fond={p.fond} ecoule={plan.suite.ecoule} pas={plan.suite.pas} />
      </AbsoluteFill>
      <Eclair t={plan.t} debut={plan.eclair} />
    </AbsoluteFill>
  );
}
