import { TEXTES_FIXES_L9 } from "../../../../src/briques/visuels/textes-fixes";
import { BORD_DROIT_TEXTE, COULEURS, FILET, FORMAT, GRIS, MARGE, POLICE_CORPS } from "../commun/constantes";
import { Etiquette } from "../commun/editorial";
import { corpsPourMots } from "../../../../src/briques/visuels/largeur-mot";
import { colonne, largeurAuFacteur1, type Colonne } from "../commun/geometrie";
import { PageBase } from "../commun/PageBase";
import { Picto } from "../commun/Picto";
import { k, largeurColonne, Remplir } from "../commun/Remplir";
import { BORD_DROIT_TEXTE_BAS } from "../commun/zones";
import { chargerPoliceInter } from "../polices";

interface Proprietes {
  titre: string;
  lignes: { sans: string; avec: string }[];
  index: number;
  total: number;
}

/**
 * Grille du tableau (page à fond perdu, x = 0 → 1080) : colonne SANS de x = 64 à 448, gouttière, puis colonne AVEC teintée jusqu'au bord de
 * la page ; son texte va jusqu'au bord permis (912, 860 pour les deux dernières lignes : compteur de Meta). Les icônes (croix, coche) sont
 * dans l'en-tête : les rangées gardent toute leur largeur pour le texte.
 */
const LARGEUR_SANS = 384;
const GOUTTIERE = 24;
const REMPLISSAGE_AVEC = 24;
const X_TEINTE = MARGE + LARGEUR_SANS + GOUTTIERE;
const X_AVEC = X_TEINTE + REMPLISSAGE_AVEC;
const ICONE_ENTETE = 44;
/** Variante « pleine largeur » (mots longs) : chaque ligne, SANS au-dessus et AVEC teinté dessous, sur toute la colonne (x = 64 → 912). */
const REMPLISSAGE_PLEIN = 18;
const ICONE_LIGNE = 40;
const ECART_ICONE = 14;
const X_PLEIN = MARGE + REMPLISSAGE_PLEIN + ICONE_LIGNE + ECART_ICONE;
/** Mises en page essayées par `Remplir` : en deux colonnes, puis pleine largeur. */
export const VARIANTES_T24 = 2;
/** Plancher du corps quand un mot long le fait baisser. */
const CORPS_MIN = 30;

/** Les deux dernières lignes peuvent descendre sous y = 1080 : leur texte s'arrête avant le compteur de Meta. */
const bordLigne = (i: number, n: number) => (i >= n - 2 ? BORD_DROIT_TEXTE_BAS : BORD_DROIT_TEXTE);

/** Colonnes de texte de chaque ligne (`geometrie.ts`) pour la variante `v` et `n` lignes. Fonction PURE. */
export function colonnesT24(v: number, n: number): { sans: Colonne; avec: Colonne }[] {
  return Array.from({ length: n }, (_, i) =>
    v === 0 ? { sans: colonne(MARGE, MARGE + LARGEUR_SANS), avec: colonne(X_AVEC, bordLigne(i, n)) } : { sans: colonne(X_PLEIN, bordLigne(i, n), ICONE_LIGNE), avec: colonne(X_PLEIN, bordLigne(i, n), ICONE_LIGNE) },
  );
}

/** Corps (px, avant remplissage) selon le nombre de lignes ; plus bas si le plus long mot ne tiendrait pas seul dans la case la plus étroite (jamais sous 30 px). */
export function tailleT24(lignes: readonly { sans: string; avec: string }[], v: number): number {
  const n = lignes.length;
  const base = n <= 3 ? 46 : n === 4 ? 42 : 38;
  const etroite = Math.min(...colonnesT24(v, n).flatMap((c) => [largeurAuFacteur1(c.sans), largeurAuFacteur1(c.avec)]));
  return corpsPourMots(lignes.flatMap((l) => [l.sans, l.avec]), etroite, base, CORPS_MIN);
}

const texte = (corps: number, avec: boolean) => ({ fontFamily: POLICE_CORPS, fontWeight: avec ? 700 : 600, fontSize: k(corps), lineHeight: 1.22, color: avec ? COULEURS.encre : GRIS });

/** En-tête d'une colonne : icône de la banque (croix ou coche), étiquette en petites capitales ; trait orange du côté AVEC. */
function Entete({ avec }: { avec: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <Picto nom={avec ? "coche" : "croix"} taille={k(ICONE_ENTETE)} />
      <Etiquette texte={avec ? TEXTES_FIXES_L9.t24Avec : TEXTES_FIXES_L9.t24Sans} couleur={avec ? COULEURS.encre : GRIS} taille={k(30)} />
      {avec && <div style={{ flex: "none", width: 48, height: 6, background: COULEURS.orange }} />}
    </div>
  );
}

/** Deux colonnes : en-tête, puis une rangée par ligne ; toutes les rangées ont la MÊME hauteur (`1fr` : celle de la plus haute). */
function DeuxColonnes({ lignes, corps }: { lignes: readonly { sans: string; avec: string }[]; corps: number }) {
  const n = lignes.length;
  const cols = colonnesT24(0, n);
  const filet = `${FILET}px solid ${COULEURS.encre}`;
  return (
    <div style={{ width: FORMAT.largeur, display: "grid", gridTemplateColumns: `${MARGE}px ${LARGEUR_SANS}px ${GOUTTIERE}px 1fr`, gridTemplateRows: `auto repeat(${n}, 1fr)` }}>
      <div style={{ gridColumn: 2, padding: `${k(20)} 0` }}>
        <Entete avec={false} />
      </div>
      <div style={{ gridColumn: 4, padding: `${k(20)} 0 ${k(20)} ${REMPLISSAGE_AVEC}px`, background: COULEURS.pale }}>
        <Entete avec />
      </div>
      {lignes.map((l, i) => {
        const rangee = { borderTop: filet, padding: `${k(22)} 0 ${k(i === n - 1 ? 26 : 22)}`, display: "flex", alignItems: "flex-start" } as const;
        return (
          <div key={i} style={{ display: "contents" }}>
            <div style={{ ...rangee, gridColumn: 2 }}>
              <div style={{ ...texte(corps, false), maxWidth: largeurColonne(cols[i].sans) }}>{l.sans}</div>
            </div>
            <div style={{ ...rangee, gridColumn: 4, paddingLeft: REMPLISSAGE_AVEC, background: COULEURS.pale }}>
              <div style={{ ...texte(corps, true), maxWidth: largeurColonne(cols[i].avec) }}>{l.avec}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Pleine largeur : pour chaque ligne, la case SANS (grise) puis la case AVEC (teintée), chacune sur toute la colonne de texte. */
function PleineLargeur({ lignes, corps }: { lignes: readonly { sans: string; avec: string }[]; corps: number }) {
  const cols = colonnesT24(1, lignes.length);
  const ligne = { display: "flex", alignItems: "flex-start", gap: ECART_ICONE, padding: `${k(14)} ${REMPLISSAGE_PLEIN}px` } as const;
  return (
    <div style={{ marginLeft: MARGE, width: BORD_DROIT_TEXTE - MARGE, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: `0 ${REMPLISSAGE_PLEIN}px ${k(16)}` }}>
        <Etiquette texte={TEXTES_FIXES_L9.t24Sans} couleur={GRIS} taille={k(30)} />
        <div style={{ flex: "none", width: 32, height: FILET, background: COULEURS.encre }} />
        <Etiquette texte={TEXTES_FIXES_L9.t24Avec} taille={k(30)} />
        <div style={{ flex: "none", width: 48, height: 6, background: COULEURS.orange }} />
      </div>
      {lignes.map((l, i) => (
        <div key={i} style={{ borderTop: `${FILET}px solid ${COULEURS.encre}` }}>
          <div style={ligne}>
            <Picto nom="croix" taille={k(ICONE_LIGNE)} />
            <div style={{ ...texte(corps, false), maxWidth: largeurColonne(cols[i].sans) }}>{l.sans}</div>
          </div>
          <div style={{ ...ligne, background: COULEURS.pale }}>
            <Picto nom="coche" taille={k(ICONE_LIGNE)} />
            <div style={{ ...texte(corps, true), maxWidth: largeurColonne(cols[i].avec) }}>{l.avec}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * T24 — comparaison sans / avec, style ÉDITORIAL (A, ART-1, tour 2) : en-têtes « SANS » (croix) et « AVEC » (coche, trait orange) posés par
 * le code, 3 à 5 lignes séparées par des filets de 2 px, de MÊME hauteur ; la colonne AVEC teintée (pâle) court jusqu'au bord de la page, son
 * texte jusqu'au bord permis. Deux mises en page essayées par `Remplir` : deux colonnes, puis chaque ligne sur toute la largeur (SANS
 * au-dessus, AVEC teinté dessous : les mots longs y tiennent) ; la première dont le vide reste sous le seuil est gardée, sinon la moins
 * vide. Un mot qui ne tient pas dans sa case refuse le facteur (`Remplir`).
 */
export function T24({ titre, lignes, index, total }: Proprietes) {
  chargerPoliceInter();
  return (
    <PageBase titre={titre} index={index} total={total} type="T24" fondPerdu>
      <Remplir variantes={VARIANTES_T24} max={1.8}>
        {(v) => (v === 0 ? <DeuxColonnes lignes={lignes} corps={tailleT24(lignes, 0)} /> : <PleineLargeur lignes={lignes} corps={tailleT24(lignes, 1)} />)}
      </Remplir>
    </PageBase>
  );
}
