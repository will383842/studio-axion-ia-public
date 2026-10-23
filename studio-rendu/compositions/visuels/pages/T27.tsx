import { TEXTES_FIXES_L9 } from "../../../../src/briques/visuels/textes-fixes";
import { BORDURE_CARTE, BORD_DROIT_TEXTE, COULEURS, MARGE, OMBRE_DECALAGE, POLICE_CORPS } from "../commun/constantes";
import { PageBase } from "../commun/PageBase";
import { Dessin } from "../commun/Picto";
import { k, moinsK, Remplir } from "../commun/Remplir";
import { styleCarte } from "../commun/style-carte";
import { BORD_DROIT_TEXTE_BAS, largeurTexteMax } from "../commun/zones";
import { chargerPoliceArchivoBlack, chargerPoliceInter } from "../polices";

interface Proprietes {
  titre: string;
  lignes: { texte: string }[];
  index: number;
  total: number;
}

const INTERRUPTEUR = { largeur: 112, hauteur: 62 } as const;
const REMPLISSAGE = 26;
const ECART = 26;
const X_TEXTE = MARGE + BORDURE_CARTE + REMPLISSAGE + INTERRUPTEUR.largeur + ECART;
const JAUGE = { largeur: 200, hauteur: 100 } as const;

/** Interrupteur dessiné NEUTRE (le lecteur répond lui-même) : piste claire cernée d'encre, bouton à gauche, aucune coche. Sans texte. */
function Interrupteur() {
  const { largeur: l, hauteur: h } = INTERRUPTEUR;
  return (
    <svg width={l} height={h} viewBox={`0 0 ${l} ${h}`} role="img" aria-hidden>
      <rect x="3" y="3" width={l - 6} height={h - 6} rx={(h - 6) / 2} fill={COULEURS.blanc} stroke={COULEURS.encre} strokeWidth="5" />
      <circle cx={h / 2} cy={h / 2} r={h / 2 - 11} fill={COULEURS.pale} stroke={COULEURS.encre} strokeWidth="5" />
    </svg>
  );
}

/**
 * Jauge sans texte qui se lit « peu → beaucoup » : cinq barres de plus en plus hautes, en dégradé du blanc à l'encre, posées sur une flèche
 * qui va vers la droite. Pas de pointeur, aucune barre « allumée » : la page ne répond pas à la place du lecteur.
 */
function Jauge() {
  const { largeur: l, hauteur: h } = JAUGE;
  const barres = 5;
  const pas = (l - 40) / barres;
  const base = h - 30;
  return (
    <svg width={l} height={h} viewBox={`0 0 ${l} ${h}`} role="img" aria-hidden>
      <defs>
        <linearGradient id="t27-jauge" gradientUnits="userSpaceOnUse" x1="12" y1="0" x2={l - 28} y2="0">
          <stop offset="0" stopColor={COULEURS.blanc} />
          <stop offset="1" stopColor={COULEURS.encre} />
        </linearGradient>
      </defs>
      {Array.from({ length: barres }, (_, i) => {
        const haut = 18 + ((base - 22) * (i + 1)) / barres;
        return <rect key={i} x={12 + i * pas} y={base - haut} width={pas - 12} height={haut} rx="6" fill="url(#t27-jauge)" stroke={COULEURS.encre} strokeWidth="4" />;
      })}
      <path d={`M10 ${h - 12} H${l - 14}`} stroke={COULEURS.encre} strokeWidth="6" strokeLinecap="round" />
      <path d={`M${l - 30} ${h - 24} L${l - 12} ${h - 12} L${l - 30} ${h}`} fill="none" stroke={COULEURS.encre} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * T27 — checklist : 4 à 5 affirmations avec un interrupteur dessiné NEUTRE (le lecteur coche dans sa tête), et en bas un bandeau orange (la
 * grande surface de la page) qui porte une jauge « peu → beaucoup » et la phrase générique posée par le code. Les rangées gardent la hauteur
 * de leur contenu ; le groupe grandit pour remplir la page (`Remplir`).
 */
export function T27({ titre, lignes, index, total }: Proprietes) {
  chargerPoliceArchivoBlack();
  chargerPoliceInter();
  const corps = lignes.length <= 4 ? 34 : 31;
  return (
    <PageBase titre={titre} index={index} total={total} type="T27">
      <Remplir max={1.5} ecart={16} style={{ paddingRight: OMBRE_DECALAGE }}>
        {lignes.map((l, i) => (
          <div key={i} style={{ flex: "none", boxSizing: "border-box", display: "flex", alignItems: "center", gap: ECART, padding: `${k(10)} ${REMPLISSAGE}px`, borderRadius: 24, ...styleCarte(i + 1), border: `${BORDURE_CARTE}px solid ${COULEURS.encre}` }}>
            <Dessin nom="interrupteur" grandit={INTERRUPTEUR}>
              <Interrupteur />
            </Dessin>
            <div style={{ maxWidth: moinsK(largeurTexteMax(X_TEXTE, BORD_DROIT_TEXTE), INTERRUPTEUR.largeur), fontFamily: POLICE_CORPS, fontWeight: 600, fontSize: k(corps), lineHeight: 1.22, color: COULEURS.encre }}>{l.texte}</div>
          </div>
        ))}
        <div style={{ flex: "none", boxSizing: "border-box", display: "flex", alignItems: "center", gap: 24, padding: `${k(18)} 26px`, marginTop: k(6), borderRadius: 28, background: COULEURS.orange, border: `${BORDURE_CARTE}px solid ${COULEURS.encre}` }}>
          <Dessin nom="jauge" style={{ width: JAUGE.largeur, height: JAUGE.hauteur }}>
            <Jauge />
          </Dessin>
          <div style={{ maxWidth: largeurTexteMax(MARGE + BORDURE_CARTE + 26 + JAUGE.largeur + 24, BORD_DROIT_TEXTE_BAS), fontFamily: POLICE_CORPS, fontWeight: 700, fontSize: k(32), lineHeight: 1.2, color: COULEURS.encre }}>
            {TEXTES_FIXES_L9.t27Jauge}
          </div>
        </div>
      </Remplir>
    </PageBase>
  );
}
