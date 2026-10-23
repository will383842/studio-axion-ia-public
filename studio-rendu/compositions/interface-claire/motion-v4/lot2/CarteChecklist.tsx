import React from "react";
/**
 * Élément 9 ★ `CarteChecklist` (lot 2, standard v4 § F) : en-tête « CE QUI S'AUTOMATISE » + pastille « n/N », 3 à 5 lignes avec case,
 * qui s'ajoutent au mot cité puis se cochent 6 images plus tard ; dernière coche → puce ACCENT_2 « ✓ FAIT » qui déborde en bas à droite.
 * M2 : chute + descente D2 (gérée par l'enchaînement), sortie S-REMONTE 3 i. `decl[k]` = image (locale) du mot qui cite la ligne k.
 */
import { useCurrentFrame } from "remotion";
import { accents, Case, CARTE, CoqueCarte, corpsH, COULEURS, courbe, Ico, PastilleEntete, Plaque, Pop, pulsation, ressort, Rouleau, Sons, SONS_TICK, styleInter, TRAIT, vieEntre } from "./commun-lot2";
import type { Palette } from "./commun-lot2";

const { ENCRE, BLANC } = COULEURS;
const DELAI_COCHE = 6;

export type PropsCarteChecklist = {
  palette: Palette;
  /** Image locale où la carte a complètement disparu. */
  duree: number;
  /** Image locale du mot qui cite chaque ligne (une par ligne). */
  decl: number[];
  titre?: string;
  lignes?: string[];
  /** Option « mémoire » : pastille « EN MÉMOIRE » sur l'en-tête. */
  memoire?: boolean;
  avecSons?: boolean;
  /** « picto » : coche à la place du compteur « n/N » et de la puce « ✓ FAIT » (chiffres et mot non dits) ; défaut « texte ». */
  pastilles?: "texte" | "picto";
};

/** Images locales des événements graphiques (entrée, lignes, coches, puce, sortie) : sert au contrôle de densité R1. */
export function evenementsChecklist(decl: number[], duree: number): number[] {
  return [0, ...decl, ...decl.map((d) => d + DELAI_COCHE), decl[decl.length - 1] + DELAI_COCHE + 4, duree - 3];
}

export function CarteChecklist({ palette, duree, decl, titre = "CE QUI S'AUTOMATISE", lignes = ["Les relances", "Les devis", "Les rendez-vous"], memoire = false, avecSons = true, pastilles = "texte" }: PropsCarteChecklist) {
  const i = useCurrentFrame();
  const { ACCENT_1 } = accents(palette);
  const n = lignes.length;
  const hLigne = Math.min(92, (corpsH() - 44 - (n - 1) * 10) / n);
  const derniereCoche = decl[n - 1] + DELAI_COCHE;
  const vie = vieEntre(evenementsChecklist(decl, duree), duree);
  const valeurs = ["0/" + n, ...lignes.map((_, k) => `${k + 1}/${n}`)];
  const sons: [number, string, number?][] = [[0, "whoosh-in", 0.9]];
  decl.forEach((d, k) => sons.push([d + DELAI_COCHE, k === n - 1 ? "ding-2" : SONS_TICK[k % 3], k === n - 1 ? 0.2 : 0.3]));
  return (
    <>
      <CoqueCarte
        palette={palette}
        titre={titre}
        i={i}
        duree={duree}
        vie={vie}
        pastille={
          <PastilleEntete>
            {pastilles === "picto" ? <Ico nom="coche" taille={50} /> : <Rouleau valeurs={valeurs} frames={[0, ...decl]} i={i} hauteur={56} />}
          </PastilleEntete>
        }
        debord={
          <>
            {/* puce posée DANS la carte (au moins 29 px d'écart avec la plaque des sous-titres) */}
            <Pop i={i} i0={derniereCoche + 4} x={CARTE.largeur - 190} y={CARTE.hauteurM2 - 74} rotation={5}>
              <div style={{ transform: `scale(${pulsation(i, vie, 0.08)})` }}>
                <Plaque fond={accents(palette).ACCENT_2} corps={40} texte={pastilles === "picto" ? undefined : "✓ FAIT"}>{pastilles === "picto" ? <Ico nom="coche" taille={46} /> : null}</Plaque>
              </div>
            </Pop>
            {memoire && (
              <Pop i={i} i0={decl[0]} x={330} y={-6} rotation={-4}>
                <Plaque fond={ENCRE} couleur={BLANC} corps={30} texte="EN MÉMOIRE" />
              </Pop>
            )}
          </>
        }
      >
        <div style={{ position: "absolute", left: 38, right: 38, top: 22 }}>
          {lignes.map((texte, k) => {
            const d = decl[k];
            const ouverture = courbe(i, d, 3);
            const flash = i >= d && i < d + 12;
            return (
              <div key={k} style={{ height: ouverture * (hLigne + 10), overflow: "hidden" }}>
                <div style={{ boxSizing: "border-box", height: hLigne, display: "flex", alignItems: "center", gap: 22, padding: "0 24px", background: flash ? ACCENT_1 : BLANC, border: `${TRAIT.FIN}px solid ${ENCRE}`, borderLeft: flash ? undefined : `8px solid ${ACCENT_1}`, borderRadius: 12 }}>
                  <Case i={i} i0={d + DELAI_COCHE} fond={ACCENT_1} />
                  <div style={styleInter(38, 700, { transform: `scale(${0.8 + 0.2 * ressort("POP", i - d - 1)})`, transformOrigin: "0% 50%", opacity: i > d ? 1 : 0 })}>{texte}</div>
                </div>
              </div>
            );
          })}
        </div>
      </CoqueCarte>
      <Sons actif={avecSons && i < duree} liste={sons} />
    </>
  );
}
