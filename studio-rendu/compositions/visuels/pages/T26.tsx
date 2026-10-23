import { TEXTES_FIXES_L9 } from "../../../../src/briques/visuels/textes-fixes";
import { BORDURE_CARTE, BORD_DROIT_TEXTE, COULEURS, FOND_CARTE_CLAIR, FORMAT, GRIS, MARGE, OMBRE_ORANGE, OMBRE_ORANGE_DECALAGE, POLICE_CORPS, POLICE_TITRE, TAILLE_SIGNATURE } from "../commun/constantes";
import { PageBase } from "../commun/PageBase";
import { Dessin, Picto, Scene } from "../commun/Picto";
import { k, moinsK, Remplir } from "../commun/Remplir";
import { BORD_DROIT_TEXTE_BAS, largeurTexteMax } from "../commun/zones";
import { chargerPoliceArchivoBlack, chargerPoliceInter } from "../polices";

interface Proprietes {
  titre: string;
  avant: string[];
  avec: string[];
  outils?: string[];
  vous: string;
  index: number;
  total: number;
}

/** Titre plus bas que sur les autres pages : le cas concret porte deux cartes et un bandeau (le titre reste ≥ 90 px, 3 × le corps). */
const HAUTEUR_TITRE = 236;
const REMPLISSAGE = 28;
const ICONE = 54;
const ECART_ICONE = 18;
const X_LIGNE = MARGE + BORDURE_CARTE + REMPLISSAGE + ICONE + ECART_ICONE;
/** Illustration de la banque à droite de chaque carte (sablier : le temps perdu ; cible : le résultat visé) ; le texte s'arrête avant elle. */
const SCENE = 150;
const BORD_LIGNE = BORD_DROIT_TEXTE - SCENE - 10;
/** L'illustration s'arrête elle aussi à x = 912 : rien d'utile sous la flèche de LinkedIn (bord droit de la carte : 1080 − marge − ombre orange). */
const MARGE_SCENE = FORMAT.largeur - MARGE - OMBRE_ORANGE_DECALAGE - BORDURE_CARTE - REMPLISSAGE - BORD_DROIT_TEXTE;
const TAILLE_LIGNE = 34;

function EnTeteCarte({ texte, plein }: { texte: string; plein: boolean }) {
  return (
    <div
      style={{
        alignSelf: "flex-start",
        padding: `${k(4)} ${k(20)}`,
        borderRadius: 999,
        background: plein ? COULEURS.encre : FOND_CARTE_CLAIR,
        border: `3px ${plein ? "solid" : "dashed"} ${COULEURS.encre}`,
        color: plein ? COULEURS.creme : COULEURS.encre,
        fontFamily: POLICE_TITRE,
        fontSize: k(28),
        lineHeight: 1.25,
        letterSpacing: 2,
      }}
    >
      {texte}
    </div>
  );
}

function Ligne({ texte, bon }: { texte: string; bon: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: ECART_ICONE }}>
      <Picto nom={bon ? "coche" : "croix"} taille={k(ICONE)} />
      <div
        style={{
          maxWidth: moinsK(largeurTexteMax(X_LIGNE, BORD_LIGNE), ICONE + SCENE),
          fontFamily: POLICE_CORPS,
          fontWeight: bon ? 700 : 600,
          fontSize: k(TAILLE_LIGNE),
          lineHeight: 1.2,
          color: bon ? COULEURS.encre : GRIS,
        }}
      >
        {texte}
      </div>
    </div>
  );
}

/** Flèche courte vers le bas, entre les deux cartes. */
function Fleche() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 64 60" role="img" aria-hidden>
      <path d="M32 4 V48 M12 30 L32 52 L52 30" fill="none" stroke={COULEURS.encre} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * T26 — cas concret : étiquette « Scénario type · exemple illustratif » posée PAR LE CODE (le cas est inventé), carte AVANT en tirets (✗),
 * flèche, carte AVEC NOUS à ombre orange (✓, outils en pastilles de TEXTE, jamais de logo), bandeau encre « VOUS : … ». Les cartes gardent la
 * hauteur de leur contenu ; le groupe grandit pour remplir la page (`Remplir`).
 */
export function T26({ titre, avant, avec, outils = [], vous, index, total }: Proprietes) {
  chargerPoliceArchivoBlack();
  chargerPoliceInter();
  const carte = {
    boxSizing: "border-box" as const,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: `${k(16)} ${REMPLISSAGE}px`,
    borderRadius: 28,
  };
  const colonne = {
    display: "flex",
    flexDirection: "column" as const,
    gap: k(12),
  };
  return (
    <PageBase titre={titre} index={index} total={total} type="T26" etiquette={TEXTES_FIXES_L9.t26Etiquette} hauteurTitre={HAUTEUR_TITRE}>
      <Remplir max={1.6} style={{ paddingRight: OMBRE_ORANGE_DECALAGE }}>
        <div
          style={{
            ...carte,
            flex: "none",
            border: `${BORDURE_CARTE}px dashed ${COULEURS.encre}`,
            background: COULEURS.creme,
          }}
        >
          <div style={colonne}>
            <EnTeteCarte texte={TEXTES_FIXES_L9.t26Avant} plein={false} />
            {avant.map((l, i) => (
              <Ligne key={i} texte={l} bon={false} />
            ))}
          </div>
          <div style={{ marginRight: MARGE_SCENE }}>
            <Scene id="I10" taille={k(SCENE)} />
          </div>
        </div>
        <div
          style={{
            flex: "none",
            height: k(72),
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Dessin nom="fleche-avant-avec" style={{ width: k(72), height: k(68) }}>
            <Fleche />
          </Dessin>
        </div>
        <div
          style={{
            ...carte,
            flex: "none",
            border: `${BORDURE_CARTE}px solid ${COULEURS.encre}`,
            background: FOND_CARTE_CLAIR,
            boxShadow: OMBRE_ORANGE,
            marginBottom: OMBRE_ORANGE_DECALAGE + 8,
          }}
        >
          <div style={colonne}>
            <EnTeteCarte texte={TEXTES_FIXES_L9.t26AvecNous} plein />
            {avec.map((l, i) => (
              <Ligne key={i} texte={l} bon />
            ))}
            {outils.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: k(10),
                  maxWidth: moinsK(largeurTexteMax(X_LIGNE, BORD_LIGNE), ICONE + SCENE),
                  marginLeft: `calc(${k(ICONE)} + ${ECART_ICONE}px)`,
                }}
              >
                {outils.map((o, i) => (
                  <div
                    key={i}
                    style={{
                      padding: `${k(2)} ${k(16)}`,
                      borderRadius: 999,
                      background: COULEURS.pale,
                      border: `3px solid ${COULEURS.encre}`,
                      fontFamily: POLICE_CORPS,
                      fontWeight: 700,
                      fontSize: k(TAILLE_SIGNATURE + 2),
                      lineHeight: 1.3,
                      color: COULEURS.encre,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {o}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ marginRight: MARGE_SCENE }}>
            <Scene id="I09" taille={k(SCENE)} />
          </div>
        </div>
        <div
          style={{
            flex: "none",
            boxSizing: "border-box",
            display: "flex",
            alignItems: "baseline",
            gap: 14,
            padding: `${k(18)} 28px`,
            borderRadius: 24,
            background: COULEURS.encre,
          }}
        >
          <div
            style={{
              flex: "none",
              fontFamily: POLICE_TITRE,
              fontSize: k(34),
              color: COULEURS.orange,
              letterSpacing: 1,
            }}
          >
            {TEXTES_FIXES_L9.t26Vous}
          </div>
          <div
            style={{
              maxWidth: moinsK(largeurTexteMax(MARGE + 28 + 130, BORD_DROIT_TEXTE_BAS), 130),
              fontFamily: POLICE_CORPS,
              fontWeight: 700,
              fontSize: k(34),
              lineHeight: 1.2,
              color: COULEURS.creme,
            }}
          >
            {vous}
          </div>
        </div>
      </Remplir>
    </PageBase>
  );
}
