import type { NomIcone } from "../../../../src/briques/visuels/registre-illustrations";
import type { TypeMini } from "../../../../src/briques/visuels/registre-mini";
import { BORD_DROIT_TEXTE, COULEURS, MARGE, POLICE_CORPS } from "../commun/constantes";
import { filetAuDessus, Numero } from "../commun/editorial";
import { PageBase } from "../commun/PageBase";
import { Picto } from "../commun/Picto";
import { colonne, type Colonne } from "../commun/geometrie";
import { k, largeurColonne, Remplir } from "../commun/Remplir";
import type { CarteSpec } from "../commun/types";
import { BORD_DROIT_TEXTE_BAS } from "../commun/zones";
import { chargerPoliceInter, chargerPoliceTitre } from "../polices";

interface Proprietes {
  titre: string;
  cartes: CarteSpec[];
  index: number;
  total: number;
}

/** Nombre de colonnes selon le nombre de cartes : 1 à 3 cartes en colonne unique, 4 à 6 sur deux colonnes. */
export function colonnesCartes(n: number): number {
  return n <= 3 ? 1 : 2;
}

/** Icône Lucide (banque d’icônes de la PR 618) qui porte le SENS de chaque mini-visuel du spec ; W01 (pastille numérotée) n'en a pas : c'est un rang. */
export const ICONE_DU_MINI: Record<Exclude<TypeMini, "W01">, NomIcone> = { W02: "coche", W03: "fleche", W06: "graphique", W07: "hausse", W25: "etoile" };

/**
 * UN seul système de repère par page : toutes les cartes avec une icône si CHAQUE carte a un mini-visuel qui en porte une (aucun W01), sinon
 * toutes numérotées (« 01 », « 02 »…). Jamais une pastille « 1 » à côté d'icônes.
 */
export function systemeReperes(cartes: readonly CarteSpec[]): "icones" | "numeros" {
  return cartes.every((c) => c.mini && c.mini !== "W01") ? "icones" : "numeros";
}

/** Grille de la page : la colonne de texte (x = 64 → 912), deux colonnes de 404 px séparées de 40 px. */
const LARGEUR_GRILLE = BORD_DROIT_TEXTE - MARGE;
const GOUTTIERE = 40;
const LARGEUR_COLONNE = (LARGEUR_GRILLE - GOUTTIERE) / 2;
/** Colonne du repère d'une carte large (une colonne) : numéro ou icône à gauche, texte à droite. */
const REPERE_LIGNE = 104;
const ECART_REPERE = 28;

/**
 * Colonne de texte de chaque carte (`geometrie.ts`), pour `n` cartes : en colonne unique, après le repère (qui grandit) ; sur deux colonnes,
 * dans sa colonne de la grille. La dernière rangée s'arrête avant le compteur de Meta. Fonction PURE.
 */
export function colonnesT02(n: number): Colonne[] {
  const colonnes = colonnesCartes(n);
  const rangees = Math.ceil(n / colonnes);
  return Array.from({ length: n }, (_, i) => {
    const bord = Math.floor(i / colonnes) === rangees - 1 ? BORD_DROIT_TEXTE_BAS : BORD_DROIT_TEXTE;
    if (colonnes === 1) return colonne(MARGE + REPERE_LIGNE + ECART_REPERE, bord, REPERE_LIGNE);
    const gauche = MARGE + (i % 2) * (LARGEUR_COLONNE + GOUTTIERE);
    return colonne(gauche, Math.min(gauche + LARGEUR_COLONNE, bord));
  });
}

function Repere({ systeme, rang, mini, taille }: { systeme: "icones" | "numeros"; rang: number; mini?: TypeMini; taille: number }) {
  if (systeme === "icones" && mini && mini !== "W01") return <Picto nom={ICONE_DU_MINI[mini]} taille={k(taille)} />;
  return <Numero rang={rang} taille={k(taille)} />;
}

/**
 * T02 — page dense, style ÉDITORIAL (A, ART-1) : 2 à 6 éléments séparés par des filets de 2 px (le premier rang est sous le filet du titre), repère (numéro OU icône, un seul système par
 * page), titre en Inter Bold, texte en Inter SemiBold. Sur deux colonnes, chaque carte est une sous-grille de trois rangées (repère, titre,
 * texte) : les titres d'une même rangée restent alignés même si l'un passe sur deux lignes. Les éléments gardent la hauteur de leur contenu ;
 * le groupe grandit pour remplir la page (`Remplir`, vide ≤ 25 %).
 */
export function T02({ titre, cartes, index, total }: Proprietes) {
  chargerPoliceInter();
  chargerPoliceTitre();
  const colonnes = colonnesCartes(cartes.length);
  const systeme = systemeReperes(cartes);
  const rangees = Math.ceil(cartes.length / colonnes);
  const cols = colonnesT02(cartes.length);
  const texteTitre = (taille: number) => ({ fontFamily: POLICE_CORPS, fontWeight: 700, fontSize: k(taille), lineHeight: 1.15, color: COULEURS.encre });
  const texteCorps = (taille: number) => ({ fontFamily: POLICE_CORPS, fontWeight: 600, fontSize: k(taille), lineHeight: 1.3, color: COULEURS.encre });
  return (
    <PageBase titre={titre} index={index} total={total} type="T02">
      <Remplir max={colonnes === 1 ? 2.4 : 1.9}>
        {colonnes === 1 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: k(36), width: LARGEUR_GRILLE }}>
            {cartes.map((c, i) => {
              const largeur = largeurColonne(cols[i]);
              return (
                <div key={i} style={{ display: "flex", gap: ECART_REPERE, ...filetAuDessus(i === 0, 24) }}>
                  <div style={{ flex: "none", width: k(REPERE_LIGNE) }}>
                    <Repere systeme={systeme} rang={i + 1} mini={c.mini} taille={systeme === "icones" ? 88 : 72} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: k(12), paddingTop: k(4) }}>
                    <div style={{ ...texteTitre(42), maxWidth: largeur }}>{c.titre}</div>
                    <div style={{ ...texteCorps(32), maxWidth: largeur }}>{c.corps}</div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ display: "grid", width: LARGEUR_GRILLE, gridTemplateColumns: `repeat(2, ${LARGEUR_COLONNE}px)`, gridTemplateRows: `repeat(${rangees * 3}, auto)`, columnGap: GOUTTIERE, rowGap: 0 }}>
            {cartes.map((c, i) => {
              const rangee = Math.floor(i / 2);
              const derniere = rangee === rangees - 1;
              const largeur = largeurColonne(cols[i]);
              return (
                <div
                  key={i}
                  style={{
                    gridColumn: (i % 2) + 1,
                    gridRow: `${rangee * 3 + 1} / span 3`,
                    display: "grid",
                    gridTemplateRows: "subgrid",
                    rowGap: k(12),
                    alignContent: "start",
                    marginBottom: derniere ? 0 : k(36),
                    ...filetAuDessus(rangee === 0, 20),
                  }}
                >
                  <Repere systeme={systeme} rang={i + 1} mini={c.mini} taille={systeme === "icones" ? 64 : 56} />
                  <div style={{ ...texteTitre(36), maxWidth: largeur }}>{c.titre}</div>
                  <div style={{ ...texteCorps(30), maxWidth: largeur }}>{c.corps}</div>
                </div>
              );
            })}
          </div>
        )}
      </Remplir>
    </PageBase>
  );
}
