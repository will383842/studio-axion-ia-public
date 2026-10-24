import type { NomIcone } from "../../../../src/briques/visuels/registre-illustrations";
import { BORD_DROIT_TEXTE, COULEURS, MARGE, OMBRE_DOUCE, POLICE_CORPS, RAYON_DOUX } from "../commun/constantes";
import { ATTRIBUT_LIAISON } from "../commun/occupation";
import { PageBase } from "../commun/PageBase";
import { Dessin, Picto } from "../commun/Picto";
import { corpsPourMots } from "../../../../src/briques/visuels/largeur-mot";
import { colonne, largeurAuFacteur1, type Colonne } from "../commun/geometrie";
import { k, largeurColonne, Remplir } from "../commun/Remplir";
import type { NoeudSpec } from "../commun/types";
import { BORD_DROIT_TEXTE_BAS } from "../commun/zones";
import { chargerPoliceInter } from "../polices";

interface Proprietes {
  titre: string;
  noeuds: NoeudSpec[];
  index: number;
  total: number;
}

/** Icônes par défaut d'un nœud sans icône choisie : départ, traitement, contrôle, envoi, arrivée. */
const ICONES_DEFAUT: readonly NomIcone[] = ["document", "engrenage", "loupe", "envoyer", "coche-cercle"];
/** Grille du schéma : la colonne de texte (x = 64 → 912) ; un nœud sur deux est décalé à droite, le schéma serpente. */
const LARGEUR_SCHEMA = BORD_DROIT_TEXTE - MARGE;
const LARGEUR_NOEUD = 640;
const DECALAGE = LARGEUR_SCHEMA - LARGEUR_NOEUD;
const REMPLISSAGE = 28;
const ECART_ICONE = 22;
/** Hauteur (px, avant remplissage) d'une liaison : PLAFONNÉE, une flèche ne s'étire jamais pour remplir la page. */
const HAUTEUR_LIAISON = 56;
const TRAIT = 3;
export const FACTEUR_MAX_T28 = 2.2;
/** Mises en page essayées par `Remplir` : le serpentin (nœuds de 640 px, un sur deux décalé), puis les nœuds pleine largeur (mots longs). */
export const VARIANTES_T28 = 2;
/** Plancher du corps d'un nœud quand un mot long le fait baisser. */
const CORPS_MIN = 30;

/** Corps du texte, côté de l'icône, remplissage vertical d'un nœud et hauteur de liaison selon le nombre de nœuds. */
function format(n: number): { icone: number; corps: number; remplissage: number; liaison: number } {
  return n <= 3 ? { icone: 80, corps: 44, remplissage: 22, liaison: HAUTEUR_LIAISON } : n === 4 ? { icone: 72, corps: 40, remplissage: 20, liaison: HAUTEUR_LIAISON } : { icone: 60, corps: 34, remplissage: 14, liaison: 40 };
}

/** Pleine largeur (mots longs : le corps ne peut plus grandir) : une icône plus grande remplit la page, le nœud large lui laisse la place. */
const ICONE_PLEINE_LARGEUR = 1.5;
const iconeDe = (n: number, v: number) => Math.round(format(n).icone * (v === 1 ? ICONE_PLEINE_LARGEUR : 1));

/** Abscisse (depuis x = 64) et largeur du nœud `i` dans la variante `v` (0 : serpentin, 1 : pleine largeur). */
const noeud = (i: number, v: number) => (v === 1 ? { gauche: 0, largeur: LARGEUR_SCHEMA } : { gauche: i % 2 === 1 ? DECALAGE : 0, largeur: LARGEUR_NOEUD });

/** Colonne de texte de chaque nœud (`geometrie.ts`) : dans le nœud, après l'icône ; les deux derniers s'arrêtent avant le compteur. Fonction PURE. */
export function colonnesT28(n: number, v = 0): Colonne[] {
  const icone = iconeDe(n, v);
  return Array.from({ length: n }, (_, i) => {
    const { gauche, largeur } = noeud(i, v);
    return colonne(MARGE + gauche + REMPLISSAGE + icone + ECART_ICONE, Math.min(MARGE + gauche + largeur - REMPLISSAGE, i >= n - 2 ? BORD_DROIT_TEXTE_BAS : BORD_DROIT_TEXTE), icone);
  });
}

/** Corps (px, avant remplissage) du texte des nœuds : celui du format, plus bas si le plus long mot ne tiendrait pas dans le nœud le plus étroit (jamais sous 30 px). */
export function corpsT28(noeuds: readonly { texte: string }[], v = 0): number {
  const etroite = Math.min(...colonnesT28(noeuds.length, v).map(largeurAuFacteur1));
  return corpsPourMots(noeuds.map((x) => x.texte), etroite, format(noeuds.length).corps, CORPS_MIN);
}

/** Liaison, trait fin de 3 px : du bas du nœud courant (son milieu) au haut du suivant (son milieu), coudée si les deux sont décalés. */
function Liaison({ depart, arrivee }: { depart: number; arrivee: number }) {
  const l = LARGEUR_SCHEMA;
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${l} 100`} preserveAspectRatio="none" role="img" aria-hidden style={{ display: "block" }}>
      <path d={`M${depart} 0 V50 H${arrivee} V96`} fill="none" stroke={COULEURS.encre} strokeWidth={TRAIT} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Pointe de flèche à l'entrée d'un nœud (dessin sans texte). */
function Pointe() {
  return (
    <svg width={22} height={14} viewBox="0 0 22 14" role="img" aria-hidden style={{ display: "block" }}>
      <path d="M1 1 L11 12 L21 1" fill="none" stroke={COULEURS.encre} strokeWidth={TRAIT} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * T28 — schéma de flux, style ÉDITORIAL (A + B, ART-1) : 3 à 5 nœuds en surfaces douces (rayon, ombre floue légère), reliés par des liaisons
 * coudées en trait fin ; le schéma serpente (repli pour les mots longs : nœuds pleine largeur, liaisons droites ; la mise en page la moins
 * vide est gardée). Le texte est DANS chaque nœud, à côté d'une icône de la banque ; le dernier nœud, l'aboutissement,
 * est orange. Les liaisons ont une hauteur PLAFONNÉE et ne comptent pas dans le vide (`ATTRIBUT_LIAISON`) : ce sont les nœuds qui grandissent.
 */
export function T28({ titre, noeuds, index, total }: Proprietes) {
  chargerPoliceInter();
  return (
    <PageBase titre={titre} index={index} total={total} type="T28">
      <Remplir max={FACTEUR_MAX_T28} variantes={VARIANTES_T28}>
        {(v) => <Schema noeuds={noeuds} v={v} />}
      </Remplir>
    </PageBase>
  );
}

/** Le schéma dans la variante `v` : nœuds, pointes et liaisons. */
function Schema({ noeuds, v }: { noeuds: NoeudSpec[]; v: number }) {
  const f = format(noeuds.length);
  const cols = colonnesT28(noeuds.length, v);
  const corps = corpsT28(noeuds, v);
  const milieu = (j: number) => noeud(j, v).gauche + noeud(j, v).largeur / 2;
  return (
    <div style={{ width: LARGEUR_SCHEMA, display: "flex", flexDirection: "column" }}>
      {noeuds.map((n, i) => {
        const { gauche, largeur } = noeud(i, v);
        const dernier = i === noeuds.length - 1;
        return (
          <div key={i} style={{ display: "contents" }}>
            {i > 0 && (
              <div style={{ marginLeft: milieu(i) - 11, marginTop: -2, marginBottom: 6 }}>
                <Dessin nom="pointe">
                  <Pointe />
                </Dessin>
              </div>
            )}
            <div
              style={{
                flex: "none",
                boxSizing: "border-box",
                marginLeft: gauche,
                width: largeur,
                display: "flex",
                alignItems: "center",
                gap: ECART_ICONE,
                padding: `${k(f.remplissage)} ${REMPLISSAGE}px`,
                borderRadius: RAYON_DOUX,
                background: dernier ? COULEURS.orange : COULEURS.blanc,
                boxShadow: OMBRE_DOUCE,
              }}
            >
              <Picto nom={n.icone ?? ICONES_DEFAUT[i % ICONES_DEFAUT.length]} taille={k(iconeDe(noeuds.length, v))} couleurs={dernier ? { orange: COULEURS.blanc } : undefined} />
              <div style={{ maxWidth: largeurColonne(cols[i]), fontFamily: POLICE_CORPS, fontWeight: 700, fontSize: k(corps), lineHeight: 1.15, color: COULEURS.encre }}>{n.texte}</div>
            </div>
            {!dernier && (
              <div {...{ [ATTRIBUT_LIAISON]: "" }} style={{ height: k(f.liaison), marginTop: 6 }}>
                <Dessin nom="liaison" style={{ width: "100%", height: "100%", lineHeight: "normal" }}>
                  <Liaison depart={milieu(i)} arrivee={milieu(i + 1)} />
                </Dessin>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
