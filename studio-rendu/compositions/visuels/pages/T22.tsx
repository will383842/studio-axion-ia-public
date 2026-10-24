import { TEXTES_FIXES_L9 } from "../../../../src/briques/visuels/textes-fixes";
import { BORD_DROIT_TEXTE, COULEURS, GRIS, MARGE, POLICE_CORPS, POLICE_MANUSCRITE, TAILLE_MANUSCRITE } from "../commun/constantes";
import { Etiquette } from "../commun/editorial";
import { PageBase } from "../commun/PageBase";
import { Picto } from "../commun/Picto";
import { k, moinsK, Remplir } from "../commun/Remplir";
import { BORD_DROIT_TEXTE_BAS, largeurTexteMax } from "../commun/zones";
import { chargerPoliceInter, chargerPoliceKalam } from "../polices";

interface Proprietes {
  titre: string;
  mythe: string;
  realite: string;
  index: number;
  total: number;
}

/** Corps (px, avant remplissage) des deux textes selon leur longueur : la réalité est plus forte que le mythe. */
const tailleMythe = (t: string) => (t.length <= 30 ? 50 : t.length <= 45 ? 44 : 38);
const tailleRealite = (t: string) => (t.length <= 36 ? 58 : t.length <= 55 ? 50 : 42);
/** Barre du mythe : FINE (un vingtième du corps, 3 px au moins), orange : l'idée reçue se lit encore sous le trait. */
const EPAISSEUR_BARRE = "max(3px, 0.05em)";
/** Filet vertical orange, épais, qui tient la réalité (style C : un bloc plein, pas une carte). */
const FILET_REALITE = 14;
const ECART_FILET = 32;
const X_REALITE = MARGE + FILET_REALITE + ECART_FILET;
/** Icône « coche » de la banque (PR 618) : la réalité est la bonne réponse. */
const ICONE = 72;

/**
 * T22 — mythe / réalité, style TYPOGRAPHIQUE (C, ART-1) : « MYTHE » et l'idée reçue en grand, grise et barrée fin d'orange (elle reste
 * lisible) ; une annotation manuscrite (Kalam, encre) ; puis « RÉALITÉ » et la réalité en très grand, en encre, tenue par un épais filet
 * orange à gauche et marquée d'une coche (icône de la banque). Ni carte, ni ombre. Étiquettes posées par le code (`TEXTES_FIXES_L9`).
 */
export function T22({ titre, mythe, realite, index, total }: Proprietes) {
  chargerPoliceInter();
  chargerPoliceKalam();
  return (
    <PageBase titre={titre} index={index} total={total} type="T22">
      <Remplir max={2.6}>
        <div style={{ display: "flex", flexDirection: "column", gap: k(14) }}>
          <Etiquette texte={TEXTES_FIXES_L9.t22Mythe} couleur={GRIS} taille={k(28)} />
          <div
            style={{
              maxWidth: largeurTexteMax(MARGE, BORD_DROIT_TEXTE),
              fontFamily: POLICE_CORPS,
              fontWeight: 600,
              fontSize: k(tailleMythe(mythe)),
              lineHeight: 1.25,
              color: GRIS,
              textDecorationLine: "line-through",
              textDecorationColor: COULEURS.orange,
              textDecorationThickness: EPAISSEUR_BARRE,
            }}
          >
            {mythe}
          </div>
        </div>
        <div style={{ alignSelf: "flex-start", padding: `${k(28)} 0 ${k(28)}`, fontFamily: POLICE_MANUSCRITE, fontWeight: 700, fontSize: k(TAILLE_MANUSCRITE + 8), lineHeight: 1.1, color: COULEURS.encre, transform: "rotate(-2deg)", transformOrigin: "left center" }}>
          {TEXTES_FIXES_L9.t22Bascule}
        </div>
        <div style={{ display: "flex", gap: ECART_FILET }}>
          <div style={{ flex: "none", width: FILET_REALITE, background: COULEURS.orange }} />
          <div style={{ display: "flex", flexDirection: "column", gap: k(14), padding: `${k(6)} 0` }}>
            <div style={{ display: "flex", alignItems: "center", gap: k(16) }}>
              <Picto nom="coche" taille={k(ICONE)} />
              <Etiquette texte={TEXTES_FIXES_L9.t22Realite} taille={k(28)} />
            </div>
            <div style={{ maxWidth: moinsK(largeurTexteMax(X_REALITE, BORD_DROIT_TEXTE_BAS), 0), fontFamily: POLICE_CORPS, fontWeight: 700, fontSize: k(tailleRealite(realite)), lineHeight: 1.18, color: COULEURS.encre }}>{realite}</div>
          </div>
        </div>
      </Remplir>
    </PageBase>
  );
}
