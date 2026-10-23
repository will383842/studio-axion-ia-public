import React from "react";
/**
 * REC-C · Le parcours d'un cas (maquettes REC-C-1, REC-C-2) : la bulle du message (« 23h14 ») suit le message de
 * nœud en nœud sur la toile, comme un personnage, posée au-dessus du coin droit du nœud dont parle la voix ; le
 * téléphone du client ferme le bas (sa bulle envoyée, puis la réponse cochée quand le résultat arrive).
 * Position à l'écran = celle de la toile passée par la caméra (`cameraA`), comme `Camera.tsx`.
 */
import { cameraA, ECRAN_IV } from "../../../../../src/briques/schema-motion";
import { TEMPS_IV } from "../../../../../src/briques/schema-motion/temps";
import type { SceneCalculee } from "../../plan";
import { ANTON } from "./typo";
import { a, Appoint, Bulle, C, Coche, horsEnsemble, Points, TelephoneClient } from "./objets";

const doux = (x: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);
const BULLE = Object.freeze({ l: 330, h: 140 });
/** Cadre où la bulle reste lisible : sous l'en-tête (haut du cadre de la toile), hors des zones protégées (doc 74 § 3), au-dessus des sous-titres. */
const CADRE = Object.freeze({ gauche: 65, droite: 886, haut: 540, bas: 1110 });
const DEPLACEMENT_S = 0.5;

/** Le nœud suivi à l'instant `t` (le dernier du parcours dont la voix a commencé à parler) et l'heure de ce passage. */
export function noeudSuivi(scene: Pick<SceneCalculee, "premierMot" | "parId">, parcours: readonly string[], depart: string, t: number): { courant: string; precedent: string | null; depuis: number } {
  const passages = parcours
    .filter((id) => scene.parId.has(id) && scene.premierMot.has(id))
    .map((id) => ({ id, t: scene.premierMot.get(id)! - TEMPS_IV.avanceNoeud }))
    .sort((x, y) => x.t - y.t);
  let courant = scene.parId.has(depart) ? depart : (passages[0]?.id ?? depart);
  let precedent: string | null = null;
  let depuis = -Infinity;
  for (const p of passages) {
    if (p.t > t) break;
    if (p.id === courant) continue;
    precedent = courant;
    courant = p.id;
    depuis = p.t;
  }
  return { courant, precedent, depuis };
}

/** Coin haut-gauche de la bulle, à l'écran, pour un nœud : juste au-dessus de lui (sur la flèche qui y arrive, jamais
 *  sur les pastilles de part posées sous les décisions). `null` si le nœud est encore sous le cadre lisible (la caméra
 *  y descend) : la bulle ne se pose jamais au bas du cadre, sur un autre élément (une pastille de part). */
function placeBulle(scene: SceneCalculee, id: string, t: number): { x: number; y: number } | null {
  const b = scene.parId.get(id);
  if (!b) return null;
  const pose = cameraA(scene.trajectoire, t);
  const ecran = (x: number, y: number) => ({ x: (x - pose.cx) * pose.zoom + ECRAN_IV.largeur / 2, y: (y - pose.cy) * pose.zoom + ECRAN_IV.hauteur / 2 });
  const haut = ecran(b.x + b.largeur / 2, b.y);
  const yVoulu = haut.y - BULLE.h - 46;
  if (yVoulu > CADRE.bas - BULLE.h + 40) return null;
  const x = Math.min(CADRE.droite - BULLE.l, Math.max(CADRE.gauche, haut.x - BULLE.l * 0.2));
  const y = Math.min(CADRE.bas - BULLE.h, Math.max(CADRE.haut, haut.y - BULLE.h - 46));
  return { x, y };
}

export function RecitSuivi({ t, fond, scene, libelle, depart, noeuds, reponse, masques, appoint }: { t: number; fond: "sombre" | "ivoire"; scene: SceneCalculee | null; libelle: string | null; depart: string; noeuds: readonly string[]; reponse: number | null; masques: readonly { debut: number; fin: number }[]; appoint: boolean }) {
  let bulle: { x: number; y: number } | null = null;
  if (scene) {
    const s = noeudSuivi(scene, noeuds, depart, t);
    const ici = placeBulle(scene, s.courant, t);
    const avant = s.precedent ? placeBulle(scene, s.precedent, t) : null;
    const u = doux((t - s.depuis) / DEPLACEMENT_S);
    bulle = ici && avant && u < 1 ? { x: avant.x + (ici.x - avant.x) * u, y: avant.y + (ici.y - avant.y) * u } : (ici ?? avant);
  }
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
