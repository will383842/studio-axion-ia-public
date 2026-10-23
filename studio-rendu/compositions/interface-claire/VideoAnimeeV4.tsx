import React, { useMemo } from "react";
import { AbsoluteFill, OffthreadVideo, useCurrentFrame, useVideoConfig } from "remotion";
import { mediaV4 } from "./motion-v4/communs/medias-v4";
import type { PlanFacecamAnimee } from "../../../src/domaine/facecam-animee/plan";
import { BarreProgression, chargerPolice, COULEURS, grouperMots, SousTitresV4 } from "./motion-v4/communs/briques-v4";
import type { GroupeST, MotDemo } from "./motion-v4/communs/briques-v4";
import { Polices } from "./motion-v4/lot1/commun-lot1";
import { chargerPolicesV4 } from "./motion-v4/lot2/commun-lot2";
import { Polices as PolicesLot3 } from "./motion-v4/lot3/commun-lot3";
import { chargerMontserratBlack } from "./motion-v4/lot4/commun-lot4";
import { bandeSousTitresV4, clesDescenteV4, descenteReelleV4, groupeDoubleV4, positionSousTitresV4, PALETTE_V4, rendreElementV4 } from "./motion-v4/registre-v4";

/**
 * RENDU FINAL v4 du face caméra animé : une vidéo entière à partir d'un PLAN DE MISE EN SCÈNE (`plan-facecam-animee/1`, champ `elementsV4`,
 * écrit par le réalisateur). Aucune donnée en dur : tout vient du plan (props Remotion).
 *  - la prise de Will (voix comprise) est plein cadre, SANS échelle ni recadrage ; seule la descente verticale `translateY(D × H)` sous
 *    une plaquette (puis la remontée) la déplace ; la bande révélée en haut est ivoire ; le fond de la prise n'est jamais modifié ;
 *  - les 26 plaquettes viennent du registre `motion-v4/registre-v4.tsx` (bruitages joués par les composants, aucune musique) ;
 *  - les sous-titres sont `SousTitresV4` des briques communes : 1 à 2 mots, calés sur les instants des mots de la vraie voix, position
 *    recalculée à CHAQUE image depuis la descente réelle de la prise (jamais sur les yeux).
 */
export function VideoAnimeeV4(plan: PlanFacecamAnimee) {
  chargerPolicesV4();
  chargerMontserratBlack();
  chargerPolice();
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const elements = useMemo(() => [...(plan.elementsV4 ?? [])].sort((a, b) => a.debut - b.debut), [plan.elementsV4]);
  const cles = useMemo(() => clesDescenteV4(elements), [elements]);
  const groupes = useMemo(() => groupesDuPlan(plan.groupes, plan.duree), [plan.groupes, plan.duree]);
  const d = descenteReelleV4(frame, cles);

  return (
    <Polices>
      <AbsoluteFill style={{ background: COULEURS.IVOIRE }}>
        <PolicesLot3 />
        <AbsoluteFill>
          <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, transform: `translateY(${d * H}px)` }}>
            <OffthreadVideo src={mediaV4(plan.prise.src)} style={{ position: "absolute", left: 0, top: 0, width: W, height: H, objectFit: "cover" }} pauseWhenBuffering={false} />
          </div>
        </AbsoluteFill>
        {elements.map((e, k) => rendreElementV4(e, { rang: k }))}
        <SousTitresV4 frame={frame} groupes={groupes} palette={PALETTE_V4} position={(f) => positionSousTitresV4(elements, cles, f)} masquer={(g) => groupeDoubleV4(elements, frame, g.mots.map((m) => m.mot))} bande={(f) => bandeSousTitresV4(elements, f)} />
        <BarreProgression frame={frame} duree={Math.round(plan.duree * fps)} palette={PALETTE_V4} />
      </AbsoluteFill>
    </Polices>
  );
}

/** Liste des mots interdits à l'écran (copie de `realisateur/mots.ts`, le conteneur de rendu n'importe rien de `src/` à l'exécution ; test d'égalité : `tests/facecam-animee/mots-interdits-ecran.test.ts`). */
const INTERDIT_ECRAN = /certifexemple|\bcertifi(?:e|ee|es|ees|s|cation|cations)?\b|\bcertifier\b|villeexemple|gains?\s+garantis?/;
const sansAccent = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export function motsInterditsEcran(mots: readonly string[]): Set<number> {
  const bannis = new Set<number>();
  mots.forEach((w, k) => {
    if (INTERDIT_ECRAN.test(sansAccent(w))) { bannis.add(k); return; }
    const suivant = mots[k + 1];
    if (suivant !== undefined && !INTERDIT_ECRAN.test(sansAccent(suivant)) && INTERDIT_ECRAN.test(sansAccent(`${w} ${suivant}`))) { bannis.add(k); bannis.add(k + 1); }
  });
  return bannis;
}

/**
 * Recolle les élisions coupées par la transcription (« l » + « 'IA » → « l'IA ») : copie de `recollerElisions` de `realisateur/mots.ts` (le rendu n'importe rien de `src/` ;
 * test d'égalité : `tests/facecam-animee/apostrophe-rendu.test.ts`). Sans précédent ou après une ponctuation, l'apostrophe de tête est retirée.
 */
export function recollerElisionsRendu<T extends { w: string; a: number; fort?: boolean }>(mots: readonly T[]): T[] {
  const sortie: T[] = [];
  for (const m of mots) {
    if (!/^['’]/.test(m.w)) { sortie.push({ ...m }); continue; }
    const prec = sortie[sortie.length - 1];
    if (prec && !/([.,;:!?…])[\s»"”)]*$/.test(prec.w)) sortie[sortie.length - 1] = { ...prec, w: prec.w + m.w, ...(m.fort || prec.fort ? { fort: true } : {}) };
    else sortie.push({ ...m, w: m.w.replace(/^['’]+/, "") });
  }
  return sortie;
}

/** Mots du plan (début de chaque mot dit) → groupes de 1 à 2 mots de `SousTitresV4` : un mot reste affiché jusqu'au début du suivant (0,7 s au plus). */
export function groupesDuPlan(groupes: PlanFacecamAnimee["groupes"], duree: number): GroupeST[] {
  const plats = recollerElisionsRendu(groupes.flatMap((g) => g.mots));
  // Filet de sécurité (le réalisateur masque déjà ces mots dans `plan.groupes`) : un mot interdit à l'écran n'est jamais dessiné.
  const interditsEcran = motsInterditsEcran(plats.map((m) => m.w));
  const mots: MotDemo[] = plats.map((m, k) => {
    const suivant = plats[k + 1]?.a ?? duree;
    const brut = m.w.replace(/[.,;:!?…«»"“”()]/g, "").trim();
    return { mot: brut.toUpperCase(), debut: m.a, fin: Math.min(suivant, m.a + 0.7), fort: !!m.fort, chiffre: /\d/.test(brut) };
  }).filter((m, k) => m.mot.length > 0 && !interditsEcran.has(k));
  return grouperMots(mots, duree);
}

/** Durée et dimensions lues dans le plan (une vidéo = un plan passé en props). */
export function metaVideoAnimeeV4({ props }: { props: PlanFacecamAnimee }) {
  return { durationInFrames: Math.round(props.duree * props.fps), fps: props.fps, width: props.largeur, height: props.hauteur };
}
