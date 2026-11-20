/** @jsxRuntime automatic */
/** @jsxImportSource react */
/**
 * SONS-PLANCHE-ECOUTE-v19c : planche d'écoute des sons EXISTANTS du dépôt, rangés par famille. Pure (aucun hook, aucune
 * horloge, aucun hasard). Imports relatifs seulement. Elle n'ajoute, ne modifie et ne valide aucun son.
 */
import type { JSX } from "react";
import { couleursSur, FAMILLE_CSS_AXION, type FondAxion } from "../../src/briques/jetons-motion";
import { SONS } from "../../src/briques/sons";
import type { EntreeSon } from "../../src/briques/sons/types";

export interface FamilleSons {
  famille: string;
  sons: EntreeSon[];
}

/** Familles triées (ordre alphabétique français) ; sons de chaque famille triés par id. */
export function famillesDesSons(sons: readonly EntreeSon[] = SONS): FamilleSons[] {
  const parFamille = new Map<string, EntreeSon[]>();
  for (const s of sons) parFamille.set(s.famille, [...(parFamille.get(s.famille) ?? []), s]);
  return [...parFamille.keys()]
    .sort((a, b) => a.localeCompare(b, "fr"))
    .map((famille) => ({ famille, sons: [...parFamille.get(famille)!].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)) }));
}

const duree = (n: number): string => `${String(n).replace(".", ",")} s`;

export function PlancheSonsExistants({ racine, fond }: { racine: string; fond: FondAxion }): JSX.Element {
  const c = couleursSur(fond);
  const aEcouter = SONS.filter((s) => s.ecoute === "porte-en-base").length;
  return (
    <div style={{ background: c.fond, color: c.texte, fontFamily: FAMILLE_CSS_AXION, padding: 32, minHeight: "100vh" }}>
      <h1 style={{ fontSize: 28, margin: "0 0 24px" }}>
        {`${SONS.length} sons existants, dont ${aEcouter} à écouter ; aucun son neuf ; rien n’est validé par cette page`}
      </h1>
      {famillesDesSons().map(({ famille, sons }) => (
        <section key={famille} data-famille={famille} style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 22, color: c.accent, borderBottom: `1px solid ${c.filet}`, paddingBottom: 6 }}>{famille}</h2>
          {sons.map((s) => (
            <div key={s.id} data-son={s.id} data-ecoute={s.ecoute} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16, padding: "8px 0", background: s.ecoute === "porte-en-base" ? c.panneauRelief : c.panneau }}>
              <strong style={{ minWidth: 260 }}>{s.id}</strong>
              <span style={{ color: c.texteDoux }}>{s.banque}</span>
              <span>{duree(s.dureeSec)}</span>
              <span>{s.ecoute === "porte-en-base" ? "à écouter (porté en base)" : `validé : ${s.decision ?? "décision"}`}</span>
              <span style={{ color: c.texteDoux }}>{`posable par : ${s.posablePar.join(", ")}`}</span>
              <audio controls preload="none" src={`${racine}/${s.chemin}`} />
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
