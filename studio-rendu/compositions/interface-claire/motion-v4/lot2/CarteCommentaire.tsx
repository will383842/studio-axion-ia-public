import React from "react";
/**
 * Élément 11 `CarteCommentaire` (lot 2) : le parcours du spectateur. En-tête « COMMENTAIRES » ; champ ; le mot-clé est tapé ; publication
 * (le texte monte dans une ligne avec pictogramme personne + cœur ACCENT_2 qui pop) ; la notification ENCRE « Nouveau message : votre guide »
 * arrive de la droite en 5 i sous le commentaire.
 * `decl` = [début de la frappe, publication, notification].
 */
import { useCurrentFrame } from "remotion";
import { accents, CoqueCarte, COULEURS, courbe, Curseur, Ico, LISERE, PastilleEntete, PastilleRonde, pulsation, ressort, Rouleau, secousse, Sons, styleInter, tape, TRAIT, vieEntre } from "./commun-lot2";
import type { Palette } from "./commun-lot2";

const { ENCRE, BLANC, GRIS } = COULEURS;

export type PropsCarteCommentaire = {
  palette: Palette;
  duree: number;
  decl: number[];
  motCle?: string;
  notification?: string;
  avecSons?: boolean;
};

export function evenementsCommentaire(decl: number[], duree: number): number[] {
  const [t, p, n] = decl;
  return [0, t, t + 3, p, p + 4, p + 8, n, n + 5, n + 9, duree - 3];
}

export function CarteCommentaire({ palette, duree, decl, motCle = "RELANCE", notification = "Nouveau message : votre guide", avecSons = true }: PropsCarteCommentaire) {
  const i = useCurrentFrame();
  const { ACCENT_1, ACCENT_2 } = accents(palette);
  const [iT, iP, iN] = decl;
  const saisi = i < iP ? tape(motCle, i, iT, 2) : "";
  const pub = courbe(i, iP, 4);
  const claque = i >= iP && i < iP + 6 ? 1 - 0.15 * Math.sin((Math.PI * (i - iP)) / 6) : 1;
  const notif = ressort("GLISSE", i - iN);
  const vibre = secousse(i - iN - 6, 7);
  const vie = vieEntre(evenementsCommentaire(decl, duree), duree);
  const sons: [number, string, number?][] = [[0, "whoosh-in", 0.9]];
  for (let c = 0; c < motCle.length / 3; c++) sons.push([iT + c * 3, `click_00${(c % 3) + 1}`, 0.22]);
  sons.push([iP, "click_001", 0.28], [iN, "confirmation_002", 0.18], [iN + 8, "vibreur", 0.16]);
  return (
    <>
      <CoqueCarte
        palette={palette}
        titre="COMMENTAIRES"
        i={i}
        duree={duree}
        vie={vie}
        pastille={
          <PastilleEntete>
            <Rouleau valeurs={["0", "1"]} frames={[0, iP + 3]} i={i} hauteur={56} />
          </PastilleEntete>
        }
      >
        {/* champ de saisie */}
        <div style={{ position: "absolute", left: 38, right: 38, top: 60, height: 84, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "space-between", background: BLANC, border: `${TRAIT.FIN}px solid ${ENCRE}`, borderRadius: 12, padding: "0 12px 0 24px" }}>
          <div style={styleInter(saisi ? 40 : 28, saisi ? 800 : 600, { color: saisi ? ENCRE : GRIS, letterSpacing: saisi ? "0.04em" : undefined })}>
            {saisi || (i >= iT && i < iP ? "" : "Écrire un commentaire…")}
            {i >= iT && i < iP && <Curseur i={i} corps={40} />}
          </div>
          <div style={{ transform: `scale(${claque})`, boxSizing: "border-box", background: ACCENT_1, border: `${TRAIT.MOYEN}px solid ${ENCRE}`, borderRadius: 999, padding: "10px 24px", display: "flex", alignItems: "center", gap: 10, ...styleInter(30, 800) }}>
            PUBLIER
          </div>
        </div>
        {/* le commentaire publié */}
        <div style={{ position: "absolute", left: 38, right: 38, top: 166, height: 100 * pub, overflow: "hidden" }}>
          <div style={{ boxSizing: "border-box", height: 100, display: "flex", alignItems: "center", gap: 20, padding: "0 22px", background: BLANC, border: `${TRAIT.FIN}px solid ${ENCRE}`, borderRadius: 12, borderLeft: `8px solid ${ACCENT_1}` }}>
            <PastilleRonde taille={64} fond={ACCENT_1}>
              <Ico nom="personne" taille={38} fond={BLANC} />
            </PastilleRonde>
            <div style={{ flex: 1 }}>
              <div style={styleInter(28, 700, { opacity: 0.7 })}>Vous</div>
              <div style={styleInter(40, 800, { letterSpacing: "0.04em", transform: `scale(${0.85 + 0.15 * ressort("POP", i - iP - 1)})`, transformOrigin: "0% 50%" })}>{motCle}</div>
            </div>
            <div style={{ transform: `scale(${(i >= iP + 8 ? 0.3 + 0.7 * ressort("POP", i - iP - 8) : 0) * pulsation(i, vie, 0.15)})` }}>
              <Ico nom="coeur" taille={56} fond={ACCENT_2} epaisseur={2} />
            </div>
          </div>
        </div>
        {/* notification : arrive de la droite, glisse sous le commentaire */}
        {i >= iN && (
          <div style={{ position: "absolute", left: 38, right: 38, top: 288, height: 104, transform: `translate(${(1 - notif) * 1080 + vibre}px, 0) rotate(${(1 - notif) * 4}deg)`, boxSizing: "border-box", display: "flex", alignItems: "center", gap: 20, padding: "0 24px", background: ENCRE, border: `${TRAIT.FIN}px solid ${ENCRE}`, borderRadius: 18, boxShadow: `${LISERE}, 5px 6px 0 0 ${ENCRE}` }}>
            <PastilleRonde taille={64} fond={ACCENT_1}>
              <Ico nom="mail" taille={40} />
            </PastilleRonde>
            <div style={styleInter(34, 800, { color: BLANC })}>{notification}</div>
          </div>
        )}
      </CoqueCarte>
      <Sons actif={avecSons && i < duree} liste={sons} />
    </>
  );
}
