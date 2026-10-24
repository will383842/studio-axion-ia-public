import { TEXTES_FIXES_L9 } from "../../../../src/briques/visuels/textes-fixes";
import { BORD_DROIT_TEXTE, COULEURS, FILET, FORMAT, GRIS, MARGE, OMBRE_DOUCE, POLICE_CORPS, RAYON_DOUX, TAILLE_SIGNATURE } from "../commun/constantes";
import { Etiquette } from "../commun/editorial";
import { DANS_LA_COLONNE, PageBase } from "../commun/PageBase";
import { Picto, Scene } from "../commun/Picto";
import { colonne } from "../commun/geometrie";
import { k, largeurColonne, Remplir } from "../commun/Remplir";
import { BORD_DROIT_TEXTE_BAS } from "../commun/zones";
import { chargerPoliceInter } from "../polices";

interface Proprietes {
  titre: string;
  avant: string[];
  avec: string[];
  outils?: string[];
  vous: string;
  index: number;
  total: number;
}

/** Titre plus bas que sur les autres pages : le cas concret porte deux blocs et un bandeau. */
const HAUTEUR_TITRE = 210;
const ICONE = 44;
const ECART_ICONE = 16;
/** Illustration de la banque à droite de chaque bloc (sablier : le temps perdu ; cible : le résultat visé) ; le texte s'arrête avant elle. */
const SCENE = 150;
const REMPLISSAGE_SURFACE = 32;
const TAILLE_LIGNE = 34;
const X_AVANT = MARGE + ICONE + ECART_ICONE;
const X_AVEC = MARGE + REMPLISSAGE_SURFACE + ICONE + ECART_ICONE;
const ECART_SCENE = 24;
export const FACTEUR_MAX_T26 = 1.6;

/**
 * Colonnes de texte (`geometrie.ts`) : lignes AVANT, lignes AVEC NOUS et pastilles d'outils. L'icône à gauche grandit (le début avance),
 * l'illustration à droite aussi (le bord recule) ; les pastilles, sous l'illustration, vont jusqu'au bord du bas de page (x = 860).
 */
export const COLONNES_T26 = {
  avant: colonne(X_AVANT, BORD_DROIT_TEXTE - SCENE - ECART_SCENE, ICONE, SCENE),
  avec: colonne(X_AVEC, BORD_DROIT_TEXTE - REMPLISSAGE_SURFACE - SCENE - ECART_SCENE, ICONE, SCENE),
  outils: colonne(X_AVEC, BORD_DROIT_TEXTE_BAS, ICONE),
} as const;

/** Bandeau « VOUS » : corps (px, avant remplissage), écart entre l'étiquette et le texte, remplissage droit (le texte s'arrête à x = 860). */
const TAILLE_VOUS = 36;
const ECART_VOUS = 16;
export const REMPLISSAGE_DROIT_BANDEAU = FORMAT.largeur - BORD_DROIT_TEXTE_BAS;

/**
 * Boîte du texte du bandeau « VOUS » pour une étiquette de `largeurEtiquette` px (mesurée au rendu : 138 px × f en Inter Bold) au facteur
 * `f` : le texte prend la place laissée (`flex: 1 1 0`) et s'arrête au remplissage droit, quelle que soit l'étiquette. Fonction PURE.
 */
export function texteBandeauT26(largeurEtiquette: number, f: number): { gauche: number; droite: number } {
  return { gauche: MARGE + largeurEtiquette + ECART_VOUS * f, droite: FORMAT.largeur - REMPLISSAGE_DROIT_BANDEAU };
}

function Ligne({ texte, bon, largeur }: { texte: string; bon: boolean; largeur: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: ECART_ICONE }}>
      <Picto nom={bon ? "coche" : "croix"} taille={k(ICONE)} />
      <div style={{ maxWidth: largeur, fontFamily: POLICE_CORPS, fontWeight: bon ? 700 : 600, fontSize: k(TAILLE_LIGNE), lineHeight: 1.22, color: bon ? COULEURS.encre : GRIS }}>{texte}</div>
    </div>
  );
}

/**
 * T26 — cas concret, style ÉDITORIAL (A + B, ART-1) : étiquette « Scénario type · exemple illustratif » posée PAR LE CODE (le cas est inventé),
 * bloc AVANT en lignes grises (✗) sous un filet, bloc AVEC NOUS sur une surface douce (rayon, ombre floue légère : l'accent B de la page) avec
 * les outils en pastilles de TEXTE (jamais de logo), et un bandeau orange à fond perdu « VOUS : … ». Les blocs gardent la hauteur de leur
 * contenu ; le groupe grandit pour remplir la page (`Remplir`).
 */
export function T26({ titre, avant, avec, outils = [], vous, index, total }: Proprietes) {
  chargerPoliceInter();
  return (
    <PageBase titre={titre} index={index} total={total} type="T26" etiquette={TEXTES_FIXES_L9.t26Etiquette} hauteurTitre={HAUTEUR_TITRE} fondPerdu>
      <Remplir max={FACTEUR_MAX_T26} ecart={28}>
        <div style={{ ...DANS_LA_COLONNE, display: "flex", alignItems: "center", justifyContent: "space-between", width: BORD_DROIT_TEXTE + MARGE, boxSizing: "border-box" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: k(14) }}>
            <Etiquette texte={TEXTES_FIXES_L9.t26Avant} couleur={GRIS} taille={k(28)} />
            {avant.map((l, i) => (
              <Ligne key={i} texte={l} bon={false} largeur={largeurColonne(COLONNES_T26.avant)} />
            ))}
          </div>
          <Scene id="I10" taille={k(SCENE)} />
        </div>
        <div style={{ ...DANS_LA_COLONNE }}>
          <div style={{ width: BORD_DROIT_TEXTE - MARGE, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: k(14), padding: `${k(26)} ${REMPLISSAGE_SURFACE}px`, borderRadius: RAYON_DOUX, background: COULEURS.blanc, boxShadow: OMBRE_DOUCE }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: k(14) }}>
                <Etiquette texte={TEXTES_FIXES_L9.t26AvecNous} taille={k(28)} />
                {avec.map((l, i) => (
                  <Ligne key={i} texte={l} bon largeur={largeurColonne(COLONNES_T26.avec)} />
                ))}
              </div>
              <Scene id="I09" taille={k(SCENE)} />
            </div>
            {/* Pastilles d'outils SOUS la rangée texte + illustration : elles prennent la largeur de la surface (jusqu'à x = 860). */}
            {outils.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: k(10), maxWidth: largeurColonne(COLONNES_T26.outils), marginLeft: `calc(${k(ICONE)} + ${ECART_ICONE}px)` }}>
                {outils.map((o, i) => (
                  <div key={i} style={{ padding: `${k(2)} ${k(16)}`, borderRadius: 999, border: `${FILET}px solid ${COULEURS.encre}`, fontFamily: POLICE_CORPS, fontWeight: 600, fontSize: k(TAILLE_SIGNATURE + 2), lineHeight: 1.3, color: COULEURS.encre, whiteSpace: "nowrap" }}>
                    {o}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        {/* Le texte prend la place laissée par l'étiquette, quelle que soit sa largeur, et s'arrête au remplissage droit (x = 860 : compteur de Meta). */}
        <div style={{ display: "flex", alignItems: "baseline", gap: k(ECART_VOUS), paddingTop: k(26), paddingBottom: k(26), paddingLeft: MARGE, paddingRight: REMPLISSAGE_DROIT_BANDEAU, background: COULEURS.orange }}>
          <div style={{ flex: "none", fontFamily: POLICE_CORPS, fontWeight: 700, fontSize: k(TAILLE_VOUS), letterSpacing: "0.06em", color: COULEURS.encre }}>{TEXTES_FIXES_L9.t26Vous}</div>
          <div style={{ flex: "1 1 0", minWidth: 0, fontFamily: POLICE_CORPS, fontWeight: 700, fontSize: k(TAILLE_VOUS), lineHeight: 1.2, color: COULEURS.encre }}>{vous}</div>
        </div>
      </Remplir>
    </PageBase>
  );
}
