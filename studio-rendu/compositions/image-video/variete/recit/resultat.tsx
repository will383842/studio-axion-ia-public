import React from "react";
/**
 * REC-B · Résultat puis « comment » (maquettes REC-B-1, REC-B-2). Sur le résultat dit d'abord, le « comment » monte
 * déjà du bas (la demande, la flèche, la carte qui répond, coche) ; au début de l'explication, le résultat reste rangé
 * dans une pastille encre (« 80 % »), et les mêmes cartes ferment le bas. Pixels de l'écran 1080 × 1920.
 */
import { HAUT_ENTETE } from "../../plan-objets";
import { MISE_EN_PAGE_IV } from "../../../../../src/briques/schema-motion/types";
import { ANTON } from "./typo";
import { a, Appoint, Bulle, C, CartePleine, Coche, horsEnsemble, pastilleDe, Points } from "./objets";
import type { CarteAppointRecit } from "./donnees";

const doux = (x: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);

/** Le « comment » en vraies cartes, sans texte : la demande (bulle), flèche, la carte qui agit (coche). */
export function CommentEnCartes({ cartes, fond, montee, appoint = true }: { cartes: readonly CarteAppointRecit[]; fond: "sombre" | "ivoire"; montee: number; appoint?: boolean }) {
  const agit = cartes[1] ?? cartes[0];
  if (!agit || !appoint) return null;
  const p = pastilleDe(agit.couleur, fond);
  const fleche = fond === "sombre" ? C.orangeVif : C.orange;
  return (
    <Appoint montee={montee}>
      <Bulle x={72} y={1318} l={330} h={150} ombre={false}>
        <Points taille={20} />
      </Bulle>
      <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0 }}>
        <path d="M424 1393H468" stroke={fleche} strokeWidth={8} strokeLinecap="round" />
        <path d="M452 1375L470 1393L452 1411" stroke={fleche} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
      <CartePleine x={500} y={1310} l={440} h={200} fond={fond} icone={agit.icone} pastille={p.pastille} iconeCouleur={p.icone}>
        <Points taille={20} couleur={fond === "sombre" ? C.encre : C.gris} />
      </CartePleine>
      <Coche x={926} y={1342} r={34} echelle={doux((montee - 0.6) / 0.4)} />
    </Appoint>
  );
}

/** Sur le résultat dit d'abord : le « comment » monte du bas. */
export function RecitResultat({ t, fond, cartes, appoint }: { t: number; fond: "sombre" | "ivoire"; cartes: readonly CarteAppointRecit[]; appoint: boolean }) {
  return <CommentEnCartes cartes={cartes} fond={fond} montee={doux((t - 0.3) / 0.6)} appoint={appoint} />;
}

/**
 * Pastille « 80 % » de REC-B : posée dans la bande ENTRE la marque et l'étiquette de l'en-tête, à droite (même règle que
 * le repère « k/3 » de REC-D, `REPERE_RECIT_D`). Avant (top 414, hauteur 112, bas 526), elle mordait le titre de l'en-tête
 * (bas à 470) et touchait « CHATBOT IA » (répétition générale du 17/10/2026). `droite` : hors de la zone protégée de droite
 * (18 % de 1080 = 194,4 px). Test : `tests/image-video/variete/defauts-repetition.test.ts`.
 */
export const PASTILLE_RECIT_B = Object.freeze({ hauteur: 92, taille: 72, droite: 195 });

/** Haut (px du format) de la pastille : centrée dans la bande entre le bas de la marque et le haut de l'étiquette. */
export function hautPastilleRecitB(format: "9:16" | "4:5"): number {
  const m = MISE_EN_PAGE_IV[format];
  const H = format === "4:5" ? 1350 : 1920;
  const basMarque = (m.hautMarque + 0.03) * H;
  const hautEtiquette = (format === "9:16" ? HAUT_ENTETE : m.entete.haut) * H;
  return Math.round((basMarque + hautEtiquette - PASTILLE_RECIT_B.hauteur) / 2);
}

/** Au début de l'explication : le résultat rangé dans une pastille encre à droite, entre la marque et l'étiquette de
 *  l'en-tête (`hautPastilleRecitB`), jusqu'à `jusqua` ; effacée pendant les vues d'ensemble (`masques`). */
export function RecitComment({ t, fond, resultat, jusqua, cartes, appoint, haut, masques }: { t: number; fond: "sombre" | "ivoire"; resultat: string; jusqua: number; cartes: readonly CarteAppointRecit[]; appoint: boolean; haut: number; masques: readonly { debut: number; fin: number }[] }) {
  const entree = doux(t / 0.5);
  const sortie = doux((t - (jusqua - 0.4)) / 0.4);
  const o = entree * (1 - sortie) * horsEnsemble(masques, t);
  return (
    <>
      {o > 0 ? (
        <div style={{ position: "absolute", right: PASTILLE_RECIT_B.droite, top: haut, height: PASTILLE_RECIT_B.hauteur, padding: "0 30px", borderRadius: PASTILLE_RECIT_B.hauteur / 2, background: C.encre, display: "flex", alignItems: "center", opacity: o, transform: `translateY(${(1 - entree) * -12}px)`, boxShadow: `0 14px 34px ${a(C.encre, 0.12)}` }}>
          <div style={{ ...ANTON, fontSize: PASTILLE_RECIT_B.taille, color: C.blanc, whiteSpace: "nowrap" }}>{resultat}</div>
        </div>
      ) : null}
      <CommentEnCartes cartes={cartes} fond={fond} montee={1} appoint={appoint} />
    </>
  );
}
