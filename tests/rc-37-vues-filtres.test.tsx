/**
 * RC-37 : vues, filtres et lisibilité du calendrier avec beaucoup de publications.
 * Rendu serveur seulement (renderToStaticMarkup), données fictives, aucun appel réel. Sans glisser-déposer (correctif).
 */
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Filtres, TYPES_FILTRE } from "@/components/calendrier/Filtres";
import { VueListe } from "@/components/calendrier/Vues";
import type { EntreeCarte, TypeContenu } from "@/components/calendrier/CarteEntreeCalendrier";
import { GrilleSemaine } from "@/components/calendrier/GrilleSemaine";
import { LIBELLES_ETAT } from "@/components/calendrier/PastilleStatutPlan";
import { basculer, chargeParJour, filtrerEntrees, nombreFiltres, regrouper, replier, type CriteresFiltre } from "@/domaine/calendrier/regroupement";
import type { IdReseau } from "@/domaine/types";

const rendre = (el: ReactElement) => renderToStaticMarkup(el);
const compter = (html: string, motif: string) => html.split(motif).length - 1;
const AUJOURDHUI = "2026-11-11";
const JOURS = ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"];
const RESEAUX: IdReseau[] = ["linkedin", "instagram", "facebook", "tiktok", "youtube"];
const TYPES: TypeContenu[] = ["video", "carrousel", "infographie", "image"];
const ETATS = ["brouillon", "a_valider", "programme", "publie", "a_corriger", "idee"];
const AUCUN: CriteresFiltre = { types: [], etats: [] };

/** 40 publications fictives sur une semaine, 5 réseaux ; le mardi est chargé (12 cartes). */
function quarante(): EntreeCarte[] {
  return Array.from({ length: 40 }, (_, i) => ({
    cle: `p${i}`,
    jour: i < 12 ? JOURS[1] : JOURS[(i * 3) % 7],
    reseau: RESEAUX[i % 5],
    type: TYPES[i % 4],
    etat: ETATS[i % 6],
    heure: `${String(7 + (i % 12)).padStart(2, "0")}:15`,
    titre: i % 7 === 0 ? `Sujet devis ${i}` : `Sujet ${i}`,
  }));
}

describe("RC-37 : filtres combinables", () => {
  const E = quarante();
  it("sans filtre, rien n'est retiré et la liste reçue n'est pas modifiée", () => {
    const copie = [...E];
    expect(filtrerEntrees(E, AUCUN)).toHaveLength(40);
    expect(E).toEqual(copie);
  });
  it("chaque filtre réduit la liste correctement (réseau, type, état, mot-clé)", () => {
    for (const r of RESEAUX) expect(filtrerEntrees(E, { ...AUCUN, reseaux: [r] }).every((e) => e.reseau === r)).toBe(true);
    expect(filtrerEntrees(E, { ...AUCUN, reseaux: ["linkedin"] })).toHaveLength(E.filter((e) => e.reseau === "linkedin").length);
    expect(filtrerEntrees(E, { ...AUCUN, types: ["video"] })).toHaveLength(E.filter((e) => e.type === "video").length);
    expect(filtrerEntrees(E, { ...AUCUN, etats: ["publie"] })).toHaveLength(E.filter((e) => e.etat === "publie").length);
    expect(filtrerEntrees(E, { ...AUCUN, motCle: "DEVIS" })).toHaveLength(E.filter((e) => e.titre?.includes("devis")).length);
    expect(filtrerEntrees(E, { ...AUCUN, motCle: "devis" }).length).toBeGreaterThan(0);
  });
  it("les groupes se combinent : ET entre groupes, OU dans un groupe", () => {
    const deux = filtrerEntrees(E, { ...AUCUN, types: ["video", "image"] });
    expect(deux).toHaveLength(E.filter((e) => e.type === "video" || e.type === "image").length);
    const croise = filtrerEntrees(E, { reseaux: ["instagram"], types: ["video", "image"], etats: ["programme", "brouillon"], motCle: "" });
    expect(croise.every((e) => e.reseau === "instagram" && ["video", "image"].includes(e.type) && ["programme", "brouillon"].includes(e.etat))).toBe(true);
  });
  it("cas limites : aucun résultat, liste vide, mot-clé blanc, réseaux vides = tous masqués", () => {
    expect(filtrerEntrees(E, { ...AUCUN, motCle: "zzzz" })).toEqual([]);
    expect(filtrerEntrees([], { ...AUCUN, types: ["video"] })).toEqual([]);
    expect(filtrerEntrees(E, { ...AUCUN, motCle: "   " })).toHaveLength(40);
    expect(filtrerEntrees(E, { ...AUCUN, reseaux: [] })).toEqual([]);
  });
  it("nombreFiltres compte types, états et mot-clé ; basculer ajoute et retire sans toucher la liste", () => {
    expect(nombreFiltres(AUCUN)).toBe(0);
    expect(nombreFiltres({ types: ["video", "image"], etats: ["publie"], motCle: "" })).toBe(3);
    expect(nombreFiltres({ ...AUCUN, motCle: "devis" })).toBe(1);
    expect(nombreFiltres({ ...AUCUN, motCle: "  " })).toBe(0);
    const base = ["video"] as const;
    expect(basculer(base, "image")).toEqual(["video", "image"]);
    expect(basculer(["video", "image"], "video")).toEqual(["image"]);
    expect(base).toEqual(["video"]);
  });
});

describe("RC-37 : regroupement et jours chargés", () => {
  const E = quarante();
  it("regrouper par réseau, type ou jour : aucune carte perdue ni doublée", () => {
    for (const par of ["reseau", "type", "jour"] as const) {
      const groupes = regrouper(E, par);
      const cles = groupes.flatMap((g) => g.entrees.map((e) => e.cle));
      expect(cles).toHaveLength(40);
      expect(new Set(cles).size).toBe(40);
    }
    expect(regrouper(E, "reseau").map((g) => g.cle)).toEqual(RESEAUX);
    expect(regrouper(E, "type")[0].libelle).toBe("Vidéo");
    expect(regrouper([], "jour")).toEqual([]);
  });
  it("un groupe est trié par jour puis heure", () => {
    const g = regrouper(E, "reseau")[0].entrees;
    const ordre = g.map((e) => `${e.jour} ${e.heure}`);
    expect(ordre).toEqual([...ordre].sort());
  });
  it("replier garde les premières et compte le reste ; limite invalide ou à la limite exacte : tout reste visible", () => {
    const dix = E.slice(0, 10);
    expect(replier(dix, 4)).toMatchObject({ reste: 6 });
    expect(replier(dix, 4).visibles).toHaveLength(4);
    expect(replier(dix, 10)).toMatchObject({ reste: 0 });
    expect(replier(dix, 0).reste).toBe(0);
    expect(replier(dix, 2.5).reste).toBe(0);
    expect(replier(dix, Number.NaN).visibles).toHaveLength(10);
    expect(replier([], 3)).toEqual({ visibles: [], reste: 0 });
  });
  it("chargeParJour compte par jour, une même clé n'est comptée qu'une fois", () => {
    const charge = chargeParJour(E);
    expect(charge[JOURS[1]]).toBeGreaterThanOrEqual(12);
    expect(Object.values(charge).reduce((a, b) => a + b, 0)).toBe(40);
    expect(chargeParJour([...E, E[0]])[E[0].jour]).toBe(charge[E[0].jour]);
  });
});

describe("RC-37 : grille de la semaine avec 40 publications", () => {
  it("les jours chargés affichent « + N » nommé, et chaque filtre réduit les cartes montrées", () => {
    const E = quarante();
    const html = rendre(<GrilleSemaine semaineDu={AUJOURDHUI} aujourdhui={AUJOURDHUI} entrees={E} reseaux={RESEAUX} maxParCase={1} onVoirPlus={() => {}} />);
    expect(html).toContain('data-plus="linkedin|2026-11-10"');
    expect(html).toContain("+ 2 autres");
    const tout = rendre(<GrilleSemaine semaineDu={AUJOURDHUI} aujourdhui={AUJOURDHUI} entrees={E} reseaux={RESEAUX} />);
    expect(compter(tout, "data-carte=")).toBe(40);
    expect(compter(html, "data-carte=")).toBeLessThan(40);
    const filtre = filtrerEntrees(E, { ...AUCUN, types: ["video"] });
    const apres = rendre(<GrilleSemaine semaineDu={AUJOURDHUI} aujourdhui={AUJOURDHUI} entrees={filtre} reseaux={RESEAUX} filtresActifs />);
    expect(compter(apres, "data-carte=")).toBe(filtre.length);
    expect(compter(apres, "data-carte=")).toBeLessThan(40);
    expect(rendre(<GrilleSemaine semaineDu={AUJOURDHUI} aujourdhui={AUJOURDHUI} entrees={[]} reseaux={RESEAUX} filtresActifs />)).toContain("Aucune publication avec ces filtres.");
  });
});

describe("RC-37 : Filtres (maquette validée)", () => {
  const props = { criteres: AUCUN, onChanger: () => {} };
  it("Filtrer ouvre deux groupes de cases : Type (Vidéo, Carrousel, Infographie, Image) et État (libellés de la table d'états)", () => {
    const html = rendre(<Filtres {...props} />);
    expect(html).toContain("Filtrer");
    expect(html).toContain("Type");
    expect(html).toContain("État");
    expect(TYPES_FILTRE.map((t) => t.libelle)).toEqual(["Vidéo", "Carrousel", "Infographie", "Image"]);
    for (const mot of ["Vidéo", "Carrousel", "Infographie", "Image"]) expect(html).toContain(mot);
    for (const etat of Object.values(LIBELLES_ETAT)) expect(html).toContain(etat.libelle.replace("'", "&#x27;"));
    expect(compter(html, 'type="checkbox"')).toBe(4 + 6);
  });
  it("les cases cochées reflètent les critères", () => {
    const html = rendre(<Filtres criteres={{ types: ["carrousel"], etats: ["publie"] }} onChanger={() => {}} />);
    expect(compter(html, "checked")).toBe(2);
    expect(compter(rendre(<Filtres {...props} />), "checked")).toBe(0);
  });
  it("« Effacer les filtres (N) » n'apparaît que si un filtre est actif, avec le bon nombre", () => {
    expect(rendre(<Filtres {...props} />)).not.toContain("Effacer les filtres");
    expect(rendre(<Filtres criteres={{ types: ["video", "image"], etats: ["publie"] }} onChanger={() => {}} />)).toContain("Effacer les filtres (3)");
  });
  it("Effacer remet tout à zéro, sans toucher aux réseaux", () => {
    let recu: CriteresFiltre | null = null;
    const el = Filtres({ criteres: { reseaux: ["linkedin"], types: ["video"], etats: ["publie"], motCle: "devis" }, onChanger: (c) => (recu = c) }) as ReactElement<{ children: unknown }>;
    const bouton = trouver(el, (p) => typeof p["aria-label"] === "string" && String(p["aria-label"]).startsWith("Effacer les filtres"));
    expect(bouton).toBeTruthy();
    (bouton!.onClick as () => void)();
    expect(recu).toEqual({ reseaux: ["linkedin"], types: [], etats: [], motCle: "" });
  });
  it("cocher et décocher une case rend les nouveaux critères", () => {
    let recu: CriteresFiltre | null = null;
    const el = Filtres({ criteres: { types: ["video"], etats: [] }, onChanger: (c) => (recu = c) }) as ReactElement;
    const caseImage = trouver(el, (p) => p["data-ft"] === "image");
    (caseImage!.onChange as () => void)();
    expect(recu!.types).toEqual(["video", "image"]);
    const caseVideo = trouver(el, (p) => p["data-ft"] === "video");
    (caseVideo!.onChange as () => void)();
    expect(recu!.types).toEqual([]);
    const caseEtat = trouver(el, (p) => p["data-fe"] === "publie");
    (caseEtat!.onChange as () => void)();
    expect(recu!.etats).toEqual(["publie"]);
  });
});

/** Cherche, dans un arbre d'éléments non rendu, le premier dont les propriétés satisfont `test`. */
function trouver(noeud: unknown, test: (p: Record<string, unknown>) => boolean): Record<string, unknown> | null {
  if (Array.isArray(noeud)) {
    for (const n of noeud) {
      const r = trouver(n, test);
      if (r) return r;
    }
    return null;
  }
  if (noeud && typeof noeud === "object" && "props" in noeud) {
    const p = (noeud as { props: Record<string, unknown> }).props;
    if (test(p)) return p;
    return trouver(p.children, test);
  }
  return null;
}

describe("RC-37 : VueListe", () => {
  const E = quarante();
  it("montre le type par icône ET libellé sur chaque carte, jamais par la couleur seule", () => {
    const html = rendre(<VueListe entrees={E} aujourdhui={AUJOURDHUI} par="reseau" />);
    expect(compter(html, "data-carte=")).toBe(40);
    for (const mot of ["Vidéo", "Carrousel", "Infographie", "Image"]) expect(html).toContain(mot);
    expect(compter(html, "<svg")).toBeGreaterThanOrEqual(40);
  });
  it("regroupe par réseau avec un titre et un compteur par groupe", () => {
    const html = rendre(<VueListe entrees={E} aujourdhui={AUJOURDHUI} par="reseau" />);
    expect(compter(html, "data-groupe=")).toBe(5);
    expect(html).toContain("LinkedIn");
    const parType = rendre(<VueListe entrees={E} aujourdhui={AUJOURDHUI} par="type" />);
    expect(compter(parType, "data-groupe=")).toBe(4);
  });
  it("un groupe chargé se replie : « + N » nommé, les cartes cachées restent dans le document", () => {
    const html = rendre(<VueListe entrees={E} aujourdhui={AUJOURDHUI} par="reseau" maxParGroupe={3} />);
    expect(html).toContain("<details");
    expect(html).toContain("+ 5 autres");
    expect(compter(html, "data-carte=")).toBe(40);
    const sansLimite = rendre(<VueListe entrees={E} aujourdhui={AUJOURDHUI} par="reseau" />);
    expect(sansLimite).not.toContain("<details");
  });
  it("liste vide : message selon qu'un filtre est actif ou non", () => {
    expect(rendre(<VueListe entrees={[]} aujourdhui={AUJOURDHUI} par="reseau" filtresActifs />)).toContain("Aucune publication avec ces filtres.");
    expect(rendre(<VueListe entrees={[]} aujourdhui={AUJOURDHUI} par="reseau" />)).toContain("Rien de prévu");
  });
});
