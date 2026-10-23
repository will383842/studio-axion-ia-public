import type { NomIcone } from "../../../../src/briques/visuels/registre-illustrations";
import { BORDURE_CARTE, BORD_DROIT_TEXTE, COULEURS, MARGE, OMBRE_CARTE, OMBRE_DECALAGE, POLICE_CORPS } from "../commun/constantes";
import { PageBase } from "../commun/PageBase";
import { Dessin, Picto } from "../commun/Picto";
import type { NoeudSpec } from "../commun/types";
import { BORD_DROIT_TEXTE_BAS, largeurTexteMax } from "../commun/zones";
import { chargerPoliceArchivoBlack, chargerPoliceInter } from "../polices";

interface Proprietes {
  titre: string;
  noeuds: NoeudSpec[];
  index: number;
  total: number;
}

/** Icônes par défaut d'un nœud sans icône choisie : départ, traitement, contrôle, envoi, arrivée. */
const ICONES_DEFAUT: readonly NomIcone[] = ["document", "engrenage", "loupe", "envoyer", "coche-cercle"];
const LARGEUR_NOEUD = 760;
/** Décalage (px) d'un nœud sur deux : le schéma serpente de gauche à droite. */
const DECALAGE = 196;
const REMPLISSAGE = 24;
const ECART_ICONE = 22;

/** Hauteur d'un nœud et corps de son texte selon le nombre de nœuds. */
function format(n: number): { hauteur: number; icone: number; corps: number } {
  return n <= 3 ? { hauteur: 168, icone: 104, corps: 44 } : n === 4 ? { hauteur: 138, icone: 90, corps: 40 } : { hauteur: 104, icone: 72, corps: 36 };
}

/** Flèche coudée d'un nœud au suivant : elle part du bas du nœud courant et entre par le haut du suivant (gauche → droite ou l'inverse). */
function Liaison({ versLaDroite }: { versLaDroite: boolean }) {
  const l = LARGEUR_NOEUD + DECALAGE;
  const depart = versLaDroite ? 150 : l - 150;
  const arrivee = versLaDroite ? l - 150 : 150;
  const sens = versLaDroite ? 1 : -1;
  return (
    <svg width={l} height="100%" viewBox={`0 0 ${l} 100`} preserveAspectRatio="none" role="img" aria-hidden style={{ display: "block" }}>
      <path d={`M${depart} 0 V44 H${arrivee} V86`} fill="none" stroke={COULEURS.encre} strokeWidth="8" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <path d={`M${arrivee - 14 * sens} 70 L${arrivee} 98 L${arrivee + 14 * sens} 70`} fill="none" stroke={COULEURS.encre} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/**
 * T28 — schéma de flux : 3 à 5 nœuds reliés par des flèches coudées, en serpentin. Le texte est DANS chaque nœud (HTML), à côté d'une icône
 * de la banque ; le dernier nœud, l'aboutissement, est la grande surface orange de la page.
 */
export function T28({ titre, noeuds, index, total }: Proprietes) {
  chargerPoliceArchivoBlack();
  chargerPoliceInter();
  const f = format(noeuds.length);
  return (
    <PageBase titre={titre} index={index} total={total} type="T28">
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", paddingBottom: OMBRE_DECALAGE }}>
        {noeuds.map((n, i) => {
          const gauche = i % 2 === 1 ? DECALAGE : 0;
          const dernier = i === noeuds.length - 1;
          const xTexte = MARGE + gauche + BORDURE_CARTE + REMPLISSAGE + f.icone + ECART_ICONE;
          // Le dernier nœud peut descendre sous y = 1080 : son texte s'arrête avant le compteur de Meta.
          const bord = dernier || i >= noeuds.length - 2 ? BORD_DROIT_TEXTE_BAS : BORD_DROIT_TEXTE;
          return (
            <div key={i} style={{ display: "contents" }}>
              <div
                style={{
                  flex: "none",
                  boxSizing: "border-box",
                  marginLeft: gauche,
                  width: LARGEUR_NOEUD,
                  height: f.hauteur,
                  display: "flex",
                  alignItems: "center",
                  gap: ECART_ICONE,
                  padding: `0 ${REMPLISSAGE}px`,
                  borderRadius: f.hauteur / 2,
                  border: `${BORDURE_CARTE}px solid ${COULEURS.encre}`,
                  background: dernier ? COULEURS.orange : i % 2 === 0 ? COULEURS.blanc : COULEURS.pale,
                  boxShadow: dernier ? OMBRE_CARTE : undefined,
                }}
              >
                <Picto nom={n.icone ?? ICONES_DEFAUT[i % ICONES_DEFAUT.length]} taille={f.icone} couleurs={dernier ? { orange: COULEURS.blanc } : undefined} />
                <div style={{ maxWidth: largeurTexteMax(xTexte, bord), fontFamily: POLICE_CORPS, fontWeight: 700, fontSize: f.corps, lineHeight: 1.15, color: COULEURS.encre }}>{n.texte}</div>
              </div>
              {!dernier && (
                <Dessin nom="liaison" style={{ flex: 1, minHeight: 36, lineHeight: "normal" }}>
                  <Liaison versLaDroite={i % 2 === 0} />
                </Dessin>
              )}
            </div>
          );
        })}
      </div>
    </PageBase>
  );
}
