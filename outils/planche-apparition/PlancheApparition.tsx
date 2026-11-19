/** @jsxRuntime automatic */
/** @jsxImportSource react */
/**
 * PLANCHE D'ATTENTE (C11-T4-v19b) : l'apparition au mot (mot à venir invisible, entrée flou → net) et le gabarit
 * « ligne de contexte + mot-clé seul », à quatre instants. Pur (aucun hook, aucune horloge, aucun hasard). Imports
 * relatifs seulement. Rien n'est branché (C11-T4-b) : aucun fichier de la vidéo n'importe celui-ci.
 */
import type { JSX } from "react";
import { couleursSur, FAMILLE_CSS_AXION, type FondAxion } from "../../src/briques/jetons-motion";
import { etatMotApparition, gabaritContexteMotCle, tailleContexte, tailleMotCle } from "../../src/briques/sous-titres/apparition";

export interface MotPlanche {
  mot: string;
  /** Début du mot, en secondes. */
  debut: number;
}
export interface GroupePlanche {
  mots: MotPlanche[];
}

const groupe = (...mots: string[]): GroupePlanche => ({ mots: mots.map((mot, i) => ({ mot, debut: i * 0.3 })) });
export const PHRASES_PLANCHE: readonly GroupePlanche[] = [
  groupe("Ce", "contrat", "est", "vraiment", "illégal"),
  groupe("Tu", "n'as", "jamais", "payé", "ça"),
  groupe("Ton", "droit", "reste", "gratuit", "ici"),
];

/** Quatre instants relatifs au groupe (début du 1er mot, début du dernier mot) → secondes. */
export const INSTANTS_PLANCHE: readonly ((premier: number, dernier: number) => number)[] = [
  (premier) => premier - 0.2,
  (premier) => premier + 0.1,
  (premier, dernier) => (premier + dernier) / 2,
  (_premier, dernier) => dernier + 0.25,
];
const NOMS_INSTANTS = ["avant le 1er mot", "1er mot + 0,1 s", "milieu", "après le dernier mot"];

export const LARGEUR_PLANCHE = 1080;
export const HAUTEUR_PLANCHE = 1920;
const TAILLE = 56;

export function PlancheApparition({ fond }: { fond: FondAxion }): JSX.Element {
  const pal = couleursSur(fond);
  return (
    <div
      data-planche={`apparition-${fond}`}
      style={{ position: "relative", width: LARGEUR_PLANCHE, height: HAUTEUR_PLANCHE, background: pal.fond, overflow: "hidden", fontFamily: FAMILLE_CSS_AXION, color: pal.texte }}
    >
      <div style={{ padding: "16px 24px", fontSize: 26, color: pal.texteDoux }}>{"A · Apparition au mot"}</div>
      {PHRASES_PLANCHE.map((p, g) =>
        INSTANTS_PLANCHE.map((instantDe, i) => {
          const t = instantDe(p.mots[0].debut, p.mots[p.mots.length - 1].debut);
          return (
            <div key={`${g}-${i}`} data-ligne={`${g}-${i}`} style={{ display: "flex", alignItems: "baseline", gap: 14, padding: "4px 24px", borderBottom: `1px solid ${pal.filet}` }}>
              <span style={{ width: 230, fontSize: 18, color: pal.texteDoux }}>{NOMS_INSTANTS[i]}</span>
              {p.mots.map((m, j) => {
                const e = etatMotApparition(t, m.debut);
                return (
                  <span
                    key={j}
                    data-mot={`${g}-${i}-${j}`}
                    style={{
                      fontSize: TAILLE,
                      fontWeight: 700,
                      opacity: e.opacite,
                      ...(e.flouPx > 0 ? { filter: `blur(${e.flouPx}px)` } : {}),
                      ...(e.visible ? {} : { visibility: "hidden" as const }),
                    }}
                  >
                    {m.mot}
                  </span>
                );
              })}
            </div>
          );
        }),
      )}
      <div style={{ padding: "16px 24px", fontSize: 26, color: pal.texteDoux }}>{"B · Gabarit « ligne de contexte + mot-clé seul »"}</div>
      {PHRASES_PLANCHE.map((p, g) => {
        const gab = gabaritContexteMotCle(p);
        return gab ? (
          <div key={g} data-gabarit={g} style={{ padding: "6px 24px", textAlign: "center" }}>
            <div style={{ fontSize: tailleContexte(TAILLE), color: pal.texteDoux }}>{gab.contexte.map((k) => p.mots[k].mot).join(" ")}</div>
            <div data-cle={g} style={{ fontSize: tailleMotCle(TAILLE, p.mots[gab.cle].mot, 960), fontWeight: 800 }}>
              {p.mots[gab.cle].mot}
            </div>
          </div>
        ) : (
          <div key={g} data-gabarit-absent={g} style={{ padding: "6px 24px", fontSize: 22, color: pal.texteDoux }}>
            {"pas de gabarit (moins de 3 mots ou aucun mot fort)"}
          </div>
        );
      })}
      <div style={{ position: "absolute", left: 24, bottom: 24, fontSize: 24, color: pal.texteDoux }}>
        {"Planche d'attente C11-T4 : rien n'est branché (C11-T4-b)"}
      </div>
    </div>
  );
}
