import { TEXTES_FIXES_L9 } from "../../../../src/briques/visuels/textes-fixes";
import { BORDURE_CARTE, BORD_DROIT_TEXTE, COULEURS, FOND_CARTE_CLAIR, MARGE, OMBRE_CARTE, OMBRE_DECALAGE, GRIS, POLICE_CORPS, POLICE_TITRE } from "../commun/constantes";
import { PageBase } from "../commun/PageBase";
import { Picto } from "../commun/Picto";
import { k, moinsK, Remplir } from "../commun/Remplir";
import { BORD_DROIT_TEXTE_BAS, largeurTexteMax } from "../commun/zones";
import { chargerPoliceArchivoBlack, chargerPoliceInter } from "../polices";

interface Proprietes {
  titre: string;
  lignes: { sans: string; avec: string }[];
  index: number;
  total: number;
}

/** Colonnes : SANS (plus étroite, le « froid » en encre et gris) et AVEC (plus large, le « chaud »). */
const LARGEUR_SANS = 400;
const ECART = 18;
const REMPLISSAGE = 18;
const ICONE = 52;
/** Icône d'une case empilée : grande à trois lignes, plus petite à quatre ou cinq lignes. */
const iconeEmpile = (n: number) => (n <= EMPILE_MAX ? 68 : n === 4 ? 46 : 40);
const X_SANS = MARGE + BORDURE_CARTE + REMPLISSAGE + ICONE + 14;
const X_AVEC = MARGE + LARGEUR_SANS + ECART + BORDURE_CARTE + REMPLISSAGE + ICONE + 14;

/** Largeur (px) du texte d'une case SANS : la case, moins bordures, remplissages, icône et espace. */
const LARGEUR_TEXTE_SANS = LARGEUR_SANS - 2 * BORDURE_CARTE - 2 * REMPLISSAGE - ICONE - 14;
/** Largeur moyenne d'une lettre minuscule d'Inter SemiBold, en part du corps, prise large (un mot ne se coupe pas : il doit tenir seul sur sa ligne). */
const CHASSE_LETTRE = 0.62;
/** Jusqu'à trois lignes, une case empilée a plus d'air (icône plus grande, remplissage plus large). */
const EMPILE_MAX = 3;
/** Largeur (px) du texte d'une case SANS empilée : la case, moins bordures et remplissages. */
const LARGEUR_TEXTE_SANS_EMPILE = LARGEUR_SANS - 2 * BORDURE_CARTE - 2 * REMPLISSAGE;
const X_SANS_EMPILE = MARGE + BORDURE_CARTE + REMPLISSAGE;
const X_AVEC_EMPILE = MARGE + LARGEUR_SANS + ECART + BORDURE_CARTE + REMPLISSAGE;
/**
 * Largeur (px) de la case de texte la PLUS ÉTROITE d'une mise en page : la case SANS, ou la case AVEC des dernières lignes, qui s'arrête
 * avant le compteur de Meta (x = 860). Le facteur de remplissage est borné par elle (un mot ne se coupe jamais).
 */
const LARGEUR_MOT_LIGNE = Math.min(LARGEUR_TEXTE_SANS, largeurTexteMax(X_AVEC, BORD_DROIT_TEXTE_BAS));
const LARGEUR_MOT_EMPILE = Math.min(LARGEUR_TEXTE_SANS_EMPILE, largeurTexteMax(X_AVEC_EMPILE, BORD_DROIT_TEXTE_BAS));

/** Longueur (lettres) du plus long mot des cases. */
const motLePlusLong = (lignes: readonly { sans: string; avec: string }[]) => Math.max(...lignes.flatMap((l) => [...l.sans.split(/\s+/), ...l.avec.split(/\s+/)].map((m) => m.length)));

/**
 * Corps (px) des cases selon le nombre de lignes ; des cases toutes courtes (14 signes au plus) prennent un cran de plus au lieu de flotter.
 * Le corps baisse si le mot le plus long ne tiendrait pas seul dans la case SANS (jamais sous 30 px : `MOT_CASE_MAX` lettres au plus, contrôlé par la porte).
 */
function taille(lignes: readonly { sans: string; avec: string }[], largeur: number): number {
  const n = lignes.length;
  const courtes = lignes.every((l) => l.sans.length <= 14 && l.avec.length <= 14);
  const base = (n <= 3 ? 36 : n === 4 ? 33 : 30) + (courtes ? 6 : 0);
  return Math.max(30, Math.min(base, Math.floor(largeur / (motLePlusLong(lignes) * CHASSE_LETTRE))));
}

/**
 * Facteur de remplissage maximal : 1,5, et jamais au point qu'un mot de la case la plus étroite ne tienne plus seul sur sa ligne (en ligne,
 * l'icône grandit aussi et prend de la largeur au texte ; empilée, elle est au-dessus et ne prend rien : `icone` = 0).
 */
function facteurMax(lignes: readonly { sans: string; avec: string }[], corps: number, largeur: number, icone: number): number {
  return Math.max(1, Math.min(1.5, (largeur + icone) / (corps * motLePlusLong(lignes) * CHASSE_LETTRE + icone)));
}

function EnTete({ texte, fond, couleur, largeur }: { texte: string; fond: string; couleur: string; largeur?: number }) {
  return (
    <div style={{ boxSizing: "border-box", width: largeur, flex: largeur ? "none" : 1, height: k(84), display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 22, background: fond, border: `${BORDURE_CARTE}px solid ${COULEURS.encre}`, fontFamily: POLICE_TITRE, fontSize: k(46), letterSpacing: 4, color: couleur }}>
      {texte}
    </div>
  );
}

/**
 * T24 — comparaison sans / avec : deux colonnes face à face, en-tête encre « SANS » et en-tête orange « AVEC », 3 à 5 lignes courtes. Les
 * rangées gardent la hauteur de leur contenu ; le tableau grandit pour remplir la page (`Remplir`).
 */
export function T24({ titre, lignes, index, total }: Proprietes) {
  chargerPoliceArchivoBlack();
  chargerPoliceInter();
  const corpsLigne = taille(lignes, LARGEUR_TEXTE_SANS);
  const corpsEmpile = taille(lignes, LARGEUR_MOT_EMPILE);
  // Variante 0 : cases EN LIGNE (icône à gauche du texte) ; variante 1 : cases EMPILÉES. `Remplir` garde la première dont le vide reste
  // sous le seuil visé, sinon la moins vide (mots longs, peu de lignes : le texte en ligne ne peut pas grandir).
  const estEmpile = (v: number) => v === 1;
  return (
    <PageBase titre={titre} index={index} total={total} type="T24">
      <Remplir
        variantes={2}
        max={(v) => (estEmpile(v) ? facteurMax(lignes, corpsEmpile, LARGEUR_MOT_EMPILE, 0) : facteurMax(lignes, corpsLigne, LARGEUR_MOT_LIGNE, ICONE))}
        ecart={12}
        style={{ paddingRight: OMBRE_DECALAGE, paddingBottom: OMBRE_DECALAGE }}
      >
        {(v) => {
          const empile = estEmpile(v);
          const corps = empile ? corpsEmpile : corpsLigne;
          const icone = empile ? k(iconeEmpile(lignes.length)) : k(ICONE);
          const remplissageVertical = !empile ? k(10) : lignes.length <= EMPILE_MAX ? k(14) : k(8);
          const texteSans = (bord: number) => (empile ? largeurTexteMax(X_SANS_EMPILE, bord) : moinsK(largeurTexteMax(X_SANS, bord), ICONE));
          const texteAvec = (bord: number) => (empile ? largeurTexteMax(X_AVEC_EMPILE, bord) : moinsK(largeurTexteMax(X_AVEC, bord), ICONE));
          return (
            <>
              <div style={{ flex: "none", display: "flex", gap: ECART }}>
                <EnTete texte={TEXTES_FIXES_L9.t24Sans} fond={COULEURS.encre} couleur={COULEURS.creme} largeur={LARGEUR_SANS} />
                <EnTete texte={TEXTES_FIXES_L9.t24Avec} fond={COULEURS.orange} couleur={COULEURS.encre} />
              </div>
              {lignes.map((l, i) => {
                // Les dernières lignes peuvent descendre sous y = 1080 : leur texte s'arrête alors avant le compteur de Meta.
                const bord = i >= lignes.length - 2 ? BORD_DROIT_TEXTE_BAS : BORD_DROIT_TEXTE;
                const caseStyle = { boxSizing: "border-box" as const, display: "flex", flexDirection: empile ? ("column" as const) : ("row" as const), alignItems: empile ? "flex-start" : "center", justifyContent: empile ? "center" : "flex-start", gap: empile ? k(lignes.length <= EMPILE_MAX ? 8 : 4) : 14, padding: `${remplissageVertical} ${REMPLISSAGE}px`, borderRadius: 22, border: `${BORDURE_CARTE}px solid ${COULEURS.encre}` };
                return (
                  <div key={i} style={{ flex: "none", display: "flex", gap: ECART }}>
                    <div style={{ ...caseStyle, width: LARGEUR_SANS, flex: "none", background: FOND_CARTE_CLAIR }}>
                      <Picto nom="croix" taille={icone} />
                      <div style={{ maxWidth: texteSans(bord), fontFamily: POLICE_CORPS, fontWeight: 600, fontSize: k(corps), lineHeight: 1.2, color: GRIS }}>{l.sans}</div>
                    </div>
                    <div style={{ ...caseStyle, flex: 1, background: COULEURS.pale, boxShadow: OMBRE_CARTE }}>
                      <Picto nom="coche" taille={icone} />
                      <div style={{ maxWidth: texteAvec(bord), fontFamily: POLICE_CORPS, fontWeight: 700, fontSize: k(corps), lineHeight: 1.2, color: COULEURS.encre }}>{l.avec}</div>
                    </div>
                  </div>
                );
              })}
            </>
          );
        }}
      </Remplir>
    </PageBase>
  );
}
