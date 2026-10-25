/**
 * Pied d'une page, posé par le moteur (`[data-pied]`) : « NN / NN », « glisser → » (ou « enregistrer » sur la dernière page), rail de
 * progression, en Inter à chiffres tabulaires (L1 : plus aucune police à chasse fixe). Aucune plaquette ne dessine son pied. Le rail s'arrête à la marge sûre : aucun trait ne touche une couture.
 */
import { alpha, CHARTE_CONTINU as C } from "../../../../../src/briques/visuels/charte-carrousel";
import { LARGEUR_PAGE, MARGE_SURE, PIED, TAILLES_CONTINU } from "../constantes-continu";
import { police, POLICE_TEXTE } from "./Primitives";

const deuxChiffres = (n: number) => String(n).padStart(2, "0");

export function Pied({ index, total, sombre }: { index: number; total: number; sombre: boolean }) {
  const derniere = index === total - 1;
  return (
    <div data-pied="" style={{ position: "absolute", left: index * LARGEUR_PAGE + MARGE_SURE, width: LARGEUR_PAGE - 2 * MARGE_SURE, bottom: PIED.bas, display: "flex", flexDirection: "column", gap: PIED.ecart, zIndex: 10, color: sombre ? C.creme : C.encre }}>
      <div style={{ display: "flex", gap: 30, alignItems: "center", ...police(700, TAILLES_CONTINU.foot, 1, POLICE_TEXTE), letterSpacing: "0.05em", fontVariantNumeric: "tabular-nums" }}>
        <span>{`${deuxChiffres(index + 1)} / ${deuxChiffres(total)}`}</span>
        <span style={{ opacity: 0.55, fontWeight: 500 }}>{derniere ? "enregistrer" : "glisser →"}</span>
      </div>
      <div style={{ height: PIED.rail, borderRadius: 3, background: sombre ? alpha(C.creme, 0.18) : alpha(C.encre, 0.12), position: "relative" }}>
        <u style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${((index + 1) / total) * 100}%`, borderRadius: 3, background: C.orange, display: "block" }} />
      </div>
    </div>
  );
}
