import { TEXTES_FIXES_L9 } from "../../../../src/briques/visuels/textes-fixes";
import { BORD_DROIT_TEXTE, COULEURS, FILET, MARGE, POLICE_CORPS } from "../commun/constantes";
import { filetAuDessus } from "../commun/editorial";
import { DANS_LA_COLONNE, PageBase } from "../commun/PageBase";
import { Dessin } from "../commun/Picto";
import { k, moinsK, Remplir } from "../commun/Remplir";
import { BORD_DROIT_TEXTE_BAS, largeurTexteMax } from "../commun/zones";
import { chargerPoliceInter } from "../polices";

interface Proprietes {
  titre: string;
  lignes: { texte: string }[];
  index: number;
  total: number;
}

/** Case à cocher dessinée, VIDE (le lecteur répond lui-même) : carré à filet de 3 px, coins doux. */
const CASE = 48;
const ECART = 26;
const X_TEXTE = MARGE + CASE + ECART;
const JAUGE = { largeur: 200, hauteur: 96 } as const;

/** Case à cocher NEUTRE : carré crème cerné d'encre, aucune coche, aucun orange. Sans texte. */
function CaseACocher() {
  return (
    <svg width={CASE} height={CASE} viewBox={`0 0 ${CASE} ${CASE}`} role="img" aria-hidden>
      <rect x="1.5" y="1.5" width={CASE - 3} height={CASE - 3} rx="10" fill={COULEURS.blanc} stroke={COULEURS.encre} strokeWidth="3" />
    </svg>
  );
}

/**
 * Jauge sans texte qui se lit « peu → beaucoup » : cinq barres de plus en plus hautes, de la crème à l'encre (dégradé linéaire de la charte),
 * posées sur une ligne de base. Aucune barre « allumée » : la page ne répond pas à la place du lecteur.
 */
function Jauge() {
  const { largeur: l, hauteur: h } = JAUGE;
  const barres = 5;
  const pas = l / barres;
  return (
    <svg width={l} height={h} viewBox={`0 0 ${l} ${h}`} role="img" aria-hidden>
      <defs>
        <linearGradient id="t27-jauge" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={l} y2="0">
          <stop offset="0" stopColor={COULEURS.creme} />
          <stop offset="1" stopColor={COULEURS.encre} />
        </linearGradient>
      </defs>
      {Array.from({ length: barres }, (_, i) => {
        const haut = 16 + ((h - 26) * (i + 1)) / barres;
        return <rect key={i} x={i * pas + 4} y={h - 4 - haut} width={pas - 12} height={haut} rx="4" fill="url(#t27-jauge)" stroke={COULEURS.encre} strokeWidth="2" />;
      })}
      <rect x="0" y={h - FILET} width={l} height={FILET} fill={COULEURS.encre} />
    </svg>
  );
}

/**
 * T27 — checklist, style ÉDITORIAL (A, ART-1) : 4 à 5 affirmations séparées par des filets de 2 px, chacune devant une case à cocher VIDE (le
 * lecteur coche dans sa tête) ; en bas, un bandeau orange à fond perdu porte une jauge « peu → beaucoup » sans texte et la phrase générique
 * posée par le code. Les lignes gardent la hauteur de leur contenu ; le groupe grandit pour remplir la page (`Remplir`).
 */
export function T27({ titre, lignes, index, total }: Proprietes) {
  chargerPoliceInter();
  const corps = lignes.length <= 4 ? 36 : 33;
  return (
    <PageBase titre={titre} index={index} total={total} type="T27" fondPerdu>
      <Remplir max={1.6} ecart={22}>
        {lignes.map((l, i) => (
          <div key={i} style={{ ...DANS_LA_COLONNE }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: ECART, width: BORD_DROIT_TEXTE - MARGE, ...filetAuDessus(i === 0, 22) }}>
              <Dessin nom="case-a-cocher" grandit={{ largeur: CASE, hauteur: CASE }}>
                <CaseACocher />
              </Dessin>
              <div style={{ maxWidth: moinsK(largeurTexteMax(X_TEXTE, BORD_DROIT_TEXTE), CASE), paddingTop: k(2), fontFamily: POLICE_CORPS, fontWeight: 600, fontSize: k(corps), lineHeight: 1.25, color: COULEURS.encre }}>{l.texte}</div>
            </div>
          </div>
        ))}
        <div style={{ ...DANS_LA_COLONNE, display: "flex", alignItems: "center", gap: 32, marginTop: k(14), paddingTop: k(30), paddingBottom: k(30), background: COULEURS.orange }}>
          <Dessin nom="jauge" grandit={JAUGE}>
            <Jauge />
          </Dessin>
          <div style={{ maxWidth: moinsK(largeurTexteMax(MARGE + JAUGE.largeur + 32, BORD_DROIT_TEXTE_BAS), JAUGE.largeur), fontFamily: POLICE_CORPS, fontWeight: 700, fontSize: k(32), lineHeight: 1.22, color: COULEURS.encre }}>{TEXTES_FIXES_L9.t27Jauge}</div>
        </div>
      </Remplir>
    </PageBase>
  );
}
