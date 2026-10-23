import React from "react";
/**
 * Élément 10 `CarteCommande` (lot 2, motif récurrent) : en-tête « COMMANDE », grille de 4 boutons, champ « Tapez une commande… » avec bouton
 * d'envoi. « Une seule commande » → étiquette BLANC qui déborde sur l'en-tête, les boutons rétrécissent ; texte tapé + menu d'autocomplétion ;
 * envoi (CLAQUE) → bulle ; réponse tapée à 2 caractères par image.
 * `decl` = [boutons, étiquette, début de la frappe, envoi, réponse] (images locales des mots qui les déclenchent).
 */
import { Easing } from "remotion";
import { useCurrentFrame } from "remotion";
import { accents, CARTE, CoqueCarte, COULEURS, courbe, corpsH, Curseur, Ico, PastilleEntete, PastilleRonde, Plaque, Pop, pulsation, ressort, Sons, SONS_CLICK, styleInter, tape, TRAIT } from "./commun-lot2";
import { vieEntre } from "./commun-lot2";
import type { Palette } from "./commun-lot2";

const { ENCRE, BLANC } = COULEURS;

export type PropsCarteCommande = {
  palette: Palette;
  duree: number;
  decl: number[];
  commandes?: string[];
  commande?: string;
  etiquette?: string;
  reponse?: string;
  avecSons?: boolean;
};

export function evenementsCommande(decl: number[], duree: number): number[] {
  const [b, u, t, e, r] = decl;
  return [0, b, b + 2, b + 4, b + 6, u, u + 5, t, t + 3, t + 6, t + 9, e, e + 4, r, r + 8, r + 16, duree - 3];
}

export function CarteCommande({ palette, duree, decl, commandes = ["/relance", "/devis", "/rdv", "/facture"], commande = "/relance", etiquette = "UNE SEULE COMMANDE", reponse = "L'agent relance s'en occupe", avecSons = true }: PropsCarteCommande) {
  const i = useCurrentFrame();
  const { ACCENT_1, ACCENT_2 } = accents(palette);
  const [iB, iU, iT, iE, iR] = decl;
  const H = corpsH();
  const yChamp = H - 24 - 84;
  const finFrappe = iT + Math.ceil(commande.length / 2);
  const vie = vieEntre(evenementsCommande(decl, duree), duree);
  const menu = courbe(i, finFrappe + 4, 3, Easing.in(Easing.cubic));
  const menuVisible = i >= iT + 2 && menu < 1 && i < iE + 1;
  const envoi = i >= iE ? (i - iE < 4 ? 1 - 0.15 * Math.sin((Math.PI * (i - iE)) / 4) : 1) : 1;
  const texteChamp = i < iE ? tape(commande, i, iT, 2) : "";
  const bulleReponse = tape(reponse, i, iR + 3, 2);
  const sons: [number, string, number?][] = [[0, "whoosh-in", 0.9], [iU, "select_002", 0.2]];
  for (let c = 0; c < commande.length / 3; c++) sons.push([iT + c * 3, SONS_CLICK[c % 3], 0.22]);
  sons.push([iE, "whoosh-out", 0.8], [iR + 3, "confirmation_002", 0.16]);
  return (
    <>
      <CoqueCarte
        palette={palette}
        titre="COMMANDE"
        i={i}
        duree={duree}
        vie={vie}
        pastille={<PastilleEntete>EN LIGNE</PastilleEntete>}
        debord={
          <Pop i={i} i0={iU} x={CARTE.largeur - 330} y={26} rotation={-3} sortie={undefined}>
            <Plaque fond={BLANC} corps={40} texte={etiquette} />
          </Pop>
        }
      >
        {/* grille de boutons : cascade de 2 i, puis rétrécissement 1 i par bouton quand « une seule commande » est dit */}
        {commandes.map((c, k) => {
          const entree = ressort("POP", i - (iB + 2 * k));
          const sortie = courbe(i, iU + 4 + k, 3, Easing.in(Easing.back(1.6)));
          if (i <= iB + 2 * k || sortie >= 1) return null;
          const col = k % 2;
          const lig = Math.floor(k / 2);
          return (
            <div key={k} style={{ position: "absolute", left: 38 + col * 430, top: 34 + lig * 112, width: 408, height: 92, boxSizing: "border-box", display: "flex", alignItems: "center", gap: 16, padding: "0 22px", background: k === 0 ? ACCENT_1 : BLANC, border: `${TRAIT.FIN}px solid ${ENCRE}`, borderRadius: 12, boxShadow: "5px 6px 0 0 " + ENCRE, transform: `scale(${(0.3 + 0.7 * entree) * (1 - sortie)})` }}>
              <Ico nom="eclair" taille={44} fond={k === 0 ? BLANC : ACCENT_1} />
              <div style={styleInter(36, 700)}>{c}</div>
            </div>
          );
        })}
        {/* bulles de conversation */}
        {i >= iE && (
          <div style={{ position: "absolute", right: 38, top: 34, transform: `translateY(${(1 - ressort("GLISSE", i - iE)) * (yChamp - 34)}px) scale(${0.6 + 0.4 * ressort("POP", i - iE)})`, transformOrigin: "100% 100%" }}>
            <div style={{ boxSizing: "border-box", background: ACCENT_1, border: `${TRAIT.FIN}px solid ${ENCRE}`, borderRadius: 22, boxShadow: "5px 6px 0 0 " + ENCRE, padding: "14px 28px", ...styleInter(38, 700) }}>{commande}</div>
          </div>
        )}
        {i >= iR && (
          <div style={{ position: "absolute", left: 38, top: 140, display: "flex", alignItems: "center", gap: 16, transform: `scale(${(0.6 + 0.4 * ressort("POP", i - iR)) * pulsation(i, vie, 0.05)})`, transformOrigin: "0% 50%" }}>
            <PastilleRonde taille={64} fond={ACCENT_2}>
              <Ico nom="personne" taille={36} fond={BLANC} />
            </PastilleRonde>
            <div style={{ boxSizing: "border-box", background: BLANC, border: `${TRAIT.FIN}px solid ${ENCRE}`, borderRadius: 22, boxShadow: "5px 6px 0 0 " + ENCRE, padding: "14px 26px", minWidth: 120, ...styleInter(34, 700) }}>
              {bulleReponse || "…"}
              {bulleReponse.length < reponse.length && <Curseur i={i} corps={34} />}
            </div>
          </div>
        )}
        {/* menu d'autocomplétion au-dessus du champ */}
        {menuVisible && (
          <div style={{ position: "absolute", left: 38, width: 520, bottom: H - yChamp + 10, transform: `scaleY(${1 - menu})`, transformOrigin: "50% 100%", boxSizing: "border-box", background: BLANC, border: `${TRAIT.FIN}px solid ${ENCRE}`, borderRadius: 12, overflow: "hidden" }}>
            {[commande, "/devis", "/rdv"].map((c, k) => (
              <div key={k} style={{ height: 56, display: "flex", alignItems: "center", padding: "0 22px", background: k === 0 && i >= finFrappe ? ACCENT_1 : BLANC, ...styleInter(32, 700) }}>
                {c}
              </div>
            ))}
          </div>
        )}
        {/* champ de saisie + bouton d'envoi */}
        <div style={{ position: "absolute", left: 38, right: 38, top: yChamp, height: 84, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "space-between", background: BLANC, border: `${TRAIT.FIN}px solid ${ENCRE}`, borderRadius: 12, padding: "0 12px 0 24px" }}>
          <div style={styleInter(texteChamp || i >= iT ? 38 : 28, texteChamp ? 700 : 600, { color: texteChamp ? ENCRE : COULEURS.GRIS })}>
            {texteChamp || (i >= iT && i < iE ? "" : "Tapez une commande…")}
            {i >= iT && i < iE && <Curseur i={i} corps={38} />}
          </div>
          <div style={{ transform: `scale(${envoi})` }}>
            <PastilleRonde taille={64} fond={ACCENT_1}>
              <Ico nom="envoi" taille={40} />
            </PastilleRonde>
          </div>
        </div>
      </CoqueCarte>
      <Sons actif={avecSons && i < duree} liste={sons} />
    </>
  );
}
