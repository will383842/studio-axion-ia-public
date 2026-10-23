import React from "react";
/**
 * REC-C · Le parcours d'un cas (maquettes REC-C-1, REC-C-2) : la bulle du message (« 23h14 ») suit le message de
 * nœud en nœud sur la toile, comme un personnage, posée à côté du nœud dont parle la voix (au-dessus, à droite, à
 * gauche ou en dessous : la première place qui ne recouvre ni nœud ni pastille de part, voir `bulle.ts`) ; le
 * téléphone du client ferme le bas (sa bulle envoyée, puis la réponse cochée quand le résultat arrive).
 * Aucune place ne convient : la bulle n'est pas dessinée (décorative ; « 23h14 » reste écrit dans le premier nœud).
 */
import type { SceneCalculee } from "../../plan";
import { BULLE, positionBulleRecitC } from "./bulle";
import { ANTON } from "./typo";
import { a, Appoint, Bulle, C, Coche, horsEnsemble, Points, TelephoneClient } from "./objets";

const doux = (x: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);

export { noeudSuivi, placeBulleRecitC, positionBulleRecitC } from "./bulle";

export function RecitSuivi({ t, fond, scene, libelle, depart, noeuds, reponse, masques, appoint }: { t: number; fond: "sombre" | "ivoire"; scene: SceneCalculee | null; libelle: string | null; depart: string; noeuds: readonly string[]; reponse: number | null; masques: readonly { debut: number; fin: number }[]; appoint: boolean }) {
  const bulle = scene ? positionBulleRecitC(scene, noeuds, depart, t) : null;
  const entree = doux((t - 0.2) / 0.4) * horsEnsemble(masques, t);
  const repondu = reponse !== null && t >= reponse;
  return (
    <>
      {bulle && entree > 0 ? (
        <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 1920, opacity: entree }}>
          <Bulle x={bulle.x} y={bulle.y} l={BULLE.l} h={BULLE.h} rotation={-4}>
            {libelle ? <div style={{ ...ANTON, fontSize: 96, color: C.encre }}>{libelle}</div> : <Points taille={22} />}
          </Bulle>
        </div>
      ) : null}
      {appoint ? (
        <Appoint montee={doux((t - 0.1) / 0.6)}>
          <TelephoneClient x={150} y={1312} l={700} fond={fond}>
            <div style={{ position: "absolute", right: 34, top: 60, width: 250, height: 92, borderRadius: 34, borderBottomRightRadius: 10, background: fond === "sombre" ? C.orangeVif : C.orange, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Points taille={16} couleur={C.blanc} />
            </div>
            {repondu ? (
              <>
                <div style={{ position: "absolute", left: 34, top: 120, width: 330, height: 92, borderRadius: 34, borderBottomLeftRadius: 10, background: C.blanc, border: `6px solid ${C.vert}`, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Points taille={16} couleur={C.gris} />
                </div>
                <Coche x={364} y={126} r={30} echelle={doux((t - reponse!) / 0.3)} />
              </>
            ) : (
              <div style={{ position: "absolute", left: 34, top: 120, width: 200, height: 92, borderRadius: 34, borderBottomLeftRadius: 10, background: a(C.encre, 0.08) }} />
            )}
          </TelephoneClient>
        </Appoint>
      ) : null}
    </>
  );
}
