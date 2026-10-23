import { TEXTES_FIXES_L9 } from "../../../../src/briques/visuels/textes-fixes";
import { BORDURE_CARTE, COULEURS, FOND_CARTE_CLAIR, MARGE, OMBRE_ORANGE, OMBRE_ORANGE_DECALAGE, GRIS, POLICE_CORPS, POLICE_MANUSCRITE, POLICE_TITRE, TAILLE_MANUSCRITE } from "../commun/constantes";
import { PageBase } from "../commun/PageBase";
import { Dessin, Picto } from "../commun/Picto";
import { k, moinsK, Remplir } from "../commun/Remplir";
import { BORD_DROIT_TEXTE_BAS, largeurTexteMax } from "../commun/zones";
import { chargerPoliceArchivoBlack, chargerPoliceInter, chargerPoliceKalam } from "../polices";

interface Proprietes {
  titre: string;
  mythe: string;
  realite: string;
  index: number;
  total: number;
}

const ICONE = 116;
const REMPLISSAGE = 34;
const ECART_ICONE = 30;
/** Abscisse du début du texte d'une carte : marge, bordure, remplissage, icône, espace. */
const X_TEXTE = MARGE + BORDURE_CARTE + REMPLISSAGE + ICONE + ECART_ICONE;
/** Corps (px) des deux textes selon leur longueur (la réalité est plus forte que le mythe) : un texte court est grand, un texte long reste lisible. */
const tailleMythe = (t: string) => (t.length <= 30 ? 54 : t.length <= 40 ? 46 : 40);
/** Barre du mythe : FINE (un vingtième du corps, 3 px au moins), l'idée reçue se lit encore sous le trait. */
const EPAISSEUR_BARRE = "max(3px, 0.05em)";
const tailleRealite = (t: string) => (t.length <= 36 ? 58 : t.length <= 50 ? 50 : 42);

function Etiquette({ texte, fond, couleur }: { texte: string; fond: string; couleur: string }) {
  return (
    <div style={{ alignSelf: "flex-start", padding: `${k(6)} ${k(22)}`, borderRadius: 999, background: fond, color: couleur, fontFamily: POLICE_TITRE, fontSize: k(30), lineHeight: 1.2, letterSpacing: 2 }}>{texte}</div>
  );
}

/** Grande flèche dessinée à main levée : elle descend du mythe et pointe la réalité. */
function Fleche() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 190 128" role="img" aria-hidden>
      <path d="M24 6 C 18 60, 60 104, 150 104" fill="none" stroke={COULEURS.encre} strokeWidth="12" strokeLinecap="round" />
      <path d="M122 76 L156 104 L120 126" fill="none" stroke={COULEURS.encre} strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * T22 — mythe / réalité : carte blanche « MYTHE » (texte gris, barré fin d'orange : l'idée reçue reste LISIBLE, ✗), grande flèche annotée à la
 * main (Kalam, encre), carte pâle « RÉALITÉ » à ombre orange décalée (✓). Les cartes gardent la hauteur de leur contenu ; le groupe grandit
 * pour remplir la page (`Remplir`), jamais de carte étirée sur du vide.
 * Les étiquettes sont posées par le code (`TEXTES_FIXES_L9`).
 */
export function T22({ titre, mythe, realite, index, total }: Proprietes) {
  chargerPoliceArchivoBlack();
  chargerPoliceInter();
  chargerPoliceKalam();
  const carte = { flex: "none", boxSizing: "border-box" as const, display: "flex", alignItems: "center", gap: ECART_ICONE, padding: `${k(30)} ${REMPLISSAGE}px`, borderRadius: 30, border: `${BORDURE_CARTE}px solid ${COULEURS.encre}` };
  return (
    <PageBase titre={titre} index={index} total={total} type="T22">
      <Remplir max={1.8} style={{ paddingRight: OMBRE_ORANGE_DECALAGE, paddingBottom: OMBRE_ORANGE_DECALAGE }}>
        <div style={{ ...carte, background: FOND_CARTE_CLAIR }}>
          <Picto nom="croix" taille={k(ICONE)} />
          <div style={{ display: "flex", flexDirection: "column", gap: k(16), maxWidth: moinsK(largeurTexteMax(X_TEXTE), ICONE) }}>
            <Etiquette texte={TEXTES_FIXES_L9.t22Mythe} fond={COULEURS.encre} couleur={COULEURS.creme} />
            <div
              style={{
                fontFamily: POLICE_CORPS,
                fontWeight: 600,
                fontSize: k(tailleMythe(mythe)),
                lineHeight: 1.3,
                color: GRIS,
                textDecorationLine: "line-through",
                textDecorationColor: COULEURS.orange,
                textDecorationThickness: EPAISSEUR_BARRE,
              }}
            >
              {mythe}
            </div>
          </div>
        </div>
        <div style={{ flex: "none", height: k(132), display: "flex", alignItems: "center", gap: k(18), paddingLeft: k(56) }}>
          <Dessin nom="fleche-bascule" style={{ width: k(190), height: k(128) }}>
            <Fleche />
          </Dessin>
          <div style={{ fontFamily: POLICE_MANUSCRITE, fontWeight: 700, fontSize: k(TAILLE_MANUSCRITE + 10), lineHeight: 1, color: COULEURS.encre, transform: "rotate(-3deg)" }}>{TEXTES_FIXES_L9.t22Bascule}</div>
        </div>
        <div style={{ ...carte, background: COULEURS.pale, boxShadow: OMBRE_ORANGE }}>
          <Picto nom="coche" taille={k(ICONE)} />
          <div style={{ display: "flex", flexDirection: "column", gap: k(16), maxWidth: moinsK(largeurTexteMax(X_TEXTE, BORD_DROIT_TEXTE_BAS), ICONE) }}>
            <Etiquette texte={TEXTES_FIXES_L9.t22Realite} fond={COULEURS.orange} couleur={COULEURS.encre} />
            <div style={{ fontFamily: POLICE_CORPS, fontWeight: 700, fontSize: k(tailleRealite(realite)), lineHeight: 1.25, color: COULEURS.encre }}>{realite}</div>
          </div>
        </div>
      </Remplir>
    </PageBase>
  );
}
