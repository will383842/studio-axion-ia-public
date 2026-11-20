/** @jsxRuntime automatic */
/** @jsxImportSource react */
/**
 * PLANCHE D'ATTENTE (C11-T2-PLANCHE-v19c) : un script d'exemple en deux colonnes. À gauche, tous les groupes ; à droite,
 * ce que garderait le filtre « sélectif » (mot clé ou nombre), minutage inchangé. Pur (aucun hook, aucune horloge, aucun
 * hasard). Imports relatifs seulement. Rien n'est branché : l'appel avec `true` n'est fait qu'ici, en mémoire.
 */
import type { JSX } from "react";
import { couleursSur, FAMILLE_CSS_AXION, type FondAxion } from "../../src/briques/jetons-motion";
import { filtrerSelectif } from "../../src/briques/sous-titres/selectif";
import type { SegmentRendu } from "../../src/briques/sous-titres/types-rendu";

const PAS_MOT_SEC = 0.4;
const r2 = (n: number): number => Math.round(n * 100) / 100;
function groupe(id: string, debut: number, ...mots: string[]): SegmentRendu {
  return {
    id,
    debutSec: r2(debut),
    finSec: r2(debut + mots.length * PAS_MOT_SEC),
    mots: mots.map((mot, i) => ({ mot, debutSec: r2(debut + i * PAS_MOT_SEC), finSec: r2(debut + (i + 1) * PAS_MOT_SEC) })),
  };
}

/** 8 groupes contigus : mot clé, nombre en chiffres, nombre en lettres, piège « neuf », mot clé de deux mots, 3 groupes sans rien. */
const MOTS_GROUPES: string[][] = [
  ["Ton", "visa", "ou", "ton", "contrat"],
  ["Demain", "tu", "dois", "rendre"],
  ["Il", "reste", "30", "jours"],
  ["Dans", "trois", "mois", "exactement"],
  ["Un", "appartement", "neuf", "te", "plaît"],
  ["Ton", "droit", "fiscal", "change", "ici"],
  ["Personne", "ne", "te", "répond"],
  ["Reste", "calme", "et", "respire"],
];
export const GROUPES_SELECTIF: SegmentRendu[] = (() => {
  let t = 0;
  return MOTS_GROUPES.map((mots, i) => {
    const g = groupe(`g${i + 1}`, t, ...mots);
    t = g.finSec;
    return g;
  });
})();

export const MOTS_CLES_SELECTIF = ["visa", "contrat", "droit fiscal"];

export function colonnesSelectif(): { tous: SegmentRendu[]; gardes: SegmentRendu[] } {
  return { tous: GROUPES_SELECTIF, gardes: filtrerSelectif(GROUPES_SELECTIF, MOTS_CLES_SELECTIF, true) };
}

const virgule = (n: number): string => n.toFixed(1).replace(".", ",");

function Colonne({ nom, titre, groupes, fond }: { nom: "tous" | "gardes"; titre: string; groupes: SegmentRendu[]; fond: FondAxion }): JSX.Element {
  const c = couleursSur(fond);
  return (
    <section data-colonne={nom} style={{ flex: 1, minWidth: 360 }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 8px" }}>{titre}</h2>
      {groupes.map((g) => {
        const masque = g.mots.length === 0;
        return (
          <div
            key={g.id}
            data-groupe={g.id}
            data-debut={g.debutSec}
            data-fin={g.finSec}
            {...(nom === "gardes" && masque ? { "data-masque": "1" } : {})}
            style={{
              padding: "8px 12px",
              marginBottom: 8,
              background: c.panneau,
              border: `1px solid ${c.filet}`,
              opacity: nom === "gardes" && masque ? 0.4 : 1,
            }}
          >
            <div style={{ fontSize: 13, color: c.texteDoux }}>{`${virgule(g.debutSec)} – ${virgule(g.finSec)} s`}</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>
              {masque ? <span style={{ fontWeight: 400, fontSize: 16 }}>(sans texte à l&apos;écran)</span> : g.mots.map((m) => m.mot).join(" ")}
            </div>
          </div>
        );
      })}
    </section>
  );
}

export function PlancheSelectif({ fond }: { fond: FondAxion }): JSX.Element {
  const c = couleursSur(fond);
  const { tous, gardes } = colonnesSelectif();
  const n = gardes.filter((g) => g.mots.length > 0).length;
  return (
    <div style={{ fontFamily: FAMILLE_CSS_AXION, padding: 24, background: c.fond, color: c.texte }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 16px" }}>Planche d&apos;attente C11-T2 : rien n&apos;est branché</h1>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        <Colonne nom="tous" titre="Tous les groupes" groupes={tous} fond={fond} />
        <Colonne nom="gardes" titre="Groupes gardés à l'écran" groupes={gardes} fond={fond} />
      </div>
      <p style={{ fontSize: 16, marginTop: 16 }}>{`${n} groupes gardés sur ${tous.length} ; le fichier de sous-titres reste complet`}</p>
    </div>
  );
}
