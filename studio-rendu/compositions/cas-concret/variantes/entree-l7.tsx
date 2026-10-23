import React from "react";
/**
 * Entrée Remotion PROPRE aux planches du lot L7 (animations des objets d'étape) : empaquetée seulement par
 * `outils/maquettes-variete/rendre-l7.mjs`. La racine de production ne l'importe pas.
 * Une composition, `L7Objet` : un écran `objet` d'exemple dont le visuel est l'objet demandé, avec son animation tirée.
 */
import { AbsoluteFill, Composition, registerRoot, useCurrentFrame } from "remotion";
import { proprietesEcrans, type EcranCale, type IdObjet, type ProprietesEcran } from "../../../../src/briques/ecrans-motion";
import { chargerPoliceAnton, chargerPoliceTitre } from "../../commune/polices";
import { Ecran } from "../Ecran";
import { OBJETS } from "../objets/registre";
import { Fond } from "../socle/Fond";

/** Objets des écrans « lien » et « appel-mot » : montés seuls, à leur taille de référence (dans un écran `objet`, ils n'ont pas de proportions). */
const SEULS: Partial<Record<IdObjet, { largeur: number; hauteur: number }>> = { "bulle-lien": { largeur: 860, hauteur: 210 }, "champ-commentaire": { largeur: 800, hauteur: 260 } };

function Seul(e: Entree) {
  chargerPoliceAnton();
  chargerPoliceTitre();
  const t = useCurrentFrame() / 25;
  const b = SEULS[e.objet]!;
  const Visuel = OBJETS[e.objet];
  return (
    <AbsoluteFill>
      <Fond fond={e.fond} largeur={1080} hauteur={1920} />
      <div style={{ position: "absolute", left: (1080 - b.largeur) / 2, top: 1240 - b.hauteur / 2, width: b.largeur, height: b.hauteur }}>
        <Visuel boite={{ x: 0, y: 0, largeur: b.largeur, hauteur: b.hauteur }} t={t} tVideo={t + 3} fond={e.fond} {...(e.textes ? { textes: e.textes } : {})} {...(e.anim ? { anim: e.anim } : {})} />
      </div>
    </AbsoluteFill>
  );
}

type Entree = { objet: IdObjet; anim: number; fond: "sombre" | "ivoire"; textes?: string[]; capture?: { src: string; largeur: number; hauteur: number } };

/**
 * L'écran `objet` d'exemple (`../exemples`, recopié : le dossier `variantes/` ne lit pas les exemples), dans la même zone
 * protégée (union des quatre réseaux) et la même bande de sous-titres.
 */
function exempleObjet(): ProprietesEcran {
  const ecran = { type: "objet", titre: "Elle *oublie ?*", ligne: "Le rappel part tout seul.", visuel: { objet: "telephone-notification", textes: ["Rappel : notre échange demain à 14:00"] }, id: "e06", fond: "ivoire", debutMs: 15000, finMs: 18000, evenements: [] } as unknown as EcranCale;
  return proprietesEcrans({ ecrans: [ecran], captures: {}, zoneProtegee: { haut: 14, droite: 18, bas: 30, gauche: 6 }, bandeSousTitres: 0.08 })[0]!;
}

function proprietes(e: Entree): ProprietesEcran {
  const base = exempleObjet() as Extract<ProprietesEcran, { type: "objet" }>;
  const visuel = e.capture ? { capture: { src: e.capture.src, cle: "planche-l7", sorte: "page-entiere" as const, largeur: e.capture.largeur, hauteur: e.capture.hauteur } } : { objet: e.objet, ...(e.textes ? { textes: e.textes } : {}) };
  return { ...base, fond: e.fond, debutMs: 3000, finMs: 6000, evenements: [], visuel, ...(e.anim ? { jeu: { animObjet: e.anim } } : {}) } as ProprietesEcran;
}

function L7Objet(e: Entree) {
  if (SEULS[e.objet]) return <Seul {...e} />;
  return <Ecran {...proprietes(e)} />;
}

const defaut: Entree = { objet: "calendrier", anim: 0, fond: "ivoire", textes: ["Octobre", "14"] };

function Racine() {
  return <Composition id="L7Objet" component={L7Objet} durationInFrames={75} fps={25} width={1080} height={1920} defaultProps={defaut} />;
}

registerRoot(Racine);
