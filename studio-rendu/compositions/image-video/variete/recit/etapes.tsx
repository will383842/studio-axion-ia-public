import React from "react";
/**
 * REC-D · En 3 étapes annoncées (maquettes REC-D-1, REC-D-2) : le VRAI repère « k/3 » (`RepereChapitre`) reste sur le
 * schéma, posé à gauche, entre la marque et l'en-tête (intégration ; avant : sous le titre, correctif 72 § 7 point 5) ; sur un
 * écran d'objets (e-mail, alerte), à sa place habituelle sous la marque (rien ne doit couvrir l'objet) ; dans le bas, les trois
 * étapes en vraies cartes pleines, sans texte : passées cochées, en cours pleine, à venir en retrait.
 */
import { HAUT_REPERE, planRepere } from "../../plan-objets";
import { RepereChapitre } from "../../RepereChapitre";
import type { CarteAppointRecit } from "./donnees";
import { Appoint, C, CartePleine, Coche, horsEnsemble, pastilleDe, Points } from "./objets";

/**
 * Sur une toile : échelle du repère et coin où il se pose : à gauche, ENTRE la marque et l'étiquette de l'en-tête
 * (y = 156 → 238 px, l'étiquette commence à 0,135 × 1920 = 259 px). Intégration (défaut vu à l'œil : « repère k/3 posé
 * sur l'en-tête ») : à y = 444 il recouvrait le titre (bas jusqu'à 0,245 × 1920 = 470 px depuis l'écart d'étiquette de
 * #331), et sous le titre il n'a pas la place (82 px de haut, 58 px libres avant le cadre de la toile). Jamais de
 * recouvrement : `tests/image-video/variete/defauts-repetition.test.ts`.
 */
export const REPERE_RECIT_D = Object.freeze({ echelle: 1.1, x: 72, y: 156 });

/** Largeur du repère réel (`RepereChapitre`) à l'échelle 1, pour le poser à gauche. */
function largeurRepere(r: NonNullable<ReturnType<typeof planRepere>>, total: number): number {
  return r.largeur + 28 + total * 34 + (total - 1) * 10 + 34;
}

export function RecitEtapes({ t, fond, changements, total, etapes, place, masques, appoint }: { t: number; fond: "sombre" | "ivoire"; changements: { t: number; numero: number }[]; total: number; etapes: readonly CarteAppointRecit[]; place: "toile" | "haut"; masques: readonly { debut: number; fin: number }[]; appoint: boolean }) {
  // Pendant une vue d'ensemble, le schéma entier occupe le haut du cadre : le repère s'efface.
  const visible = horsEnsemble(masques, t);
  const r = planRepere(changements, total, t);
  const numero = r ? Number(r.texte.split("/")[0]) : 0;
  const L = r ? largeurRepere(r, total) : 0;
  const ox = (1080 - L) / 2;
  const oy = HAUT_REPERE * 1920;
  const { echelle, x, y } = REPERE_RECIT_D;
  const l = 296;
  const xs = [60, 392, 724];
  const fleche = fond === "sombre" ? C.grisClair : C.encre;
  return (
    <>
      {r && place === "haut" ? <RepereChapitre changements={changements} total={total} t={t} fond={fond} /> : null}
      {r && place === "toile" && visible > 0 ? (
        <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 1920, opacity: visible, transformOrigin: `${ox}px ${oy}px`, transform: `translate(${x - ox}px, ${y - oy}px) scale(${echelle})` }}>
          <RepereChapitre changements={changements} total={total} t={t} fond={fond} />
        </div>
      ) : null}
      {appoint && numero > 0 ? (
        <Appoint>
          <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0 }} fill="none" stroke={fleche} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round">
            {[0, 1].map((i) => (
              <path key={i} d={`M${xs[i]! + l + 6} 1418H${xs[i + 1]! - 10}`} />
            ))}
          </svg>
          {etapes.slice(0, 3).map((e, i) => {
            const k = i + 1;
            const p = pastilleDe(k === numero ? e.couleur : "noir", fond);
            return (
              <React.Fragment key={i}>
                <CartePleine x={xs[i]!} y={1322} l={l} h={192} fond={fond} icone={e.icone} pastille={k > numero ? C.gris : p.pastille} iconeCouleur={p.icone} opacite={k > numero ? 0.55 : 1}>
                  <Points taille={18} couleur={k === numero ? C.encre : C.gris} />
                </CartePleine>
                {k < numero ? <Coche x={xs[i]! + l - 14} y={1340} r={30} /> : null}
              </React.Fragment>
            );
          })}
        </Appoint>
      ) : null}
    </>
  );
}
