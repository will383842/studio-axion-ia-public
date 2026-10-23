/**
 * M8c (cas concret) : finitions de la chaîne et de l'image, d'après la planche de la vidéo refaite.
 *  - point 2 : une seule liste fermée des noms d'événements (dans `fiche.ts`), lue par la fiche et comparée à ce que les
 *    plans des compositions lisent réellement ;
 *  - point 3 : texte des barres du résultat tiré des faits du cas, jamais calculé ;
 *  - point 5 : le point final du texte dit gardé sur l'affiche d'un écran `chiffre` ou `titre` ;
 *  - point 6 : décalage vertical de départ d'une page entière, porté jusqu'à la composition ;
 *  - point 7 : une seule bande des sous-titres du format.
 * Doubles seulement, aucun appel réel.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { controlerProprietes, proprietesEcrans, textesEcran, type CaptureEcran, type ProprietesEcran } from "@/briques/ecrans-motion";
import { BANDE_SOUS_TITRES_CAS_CONCRET } from "@/formats/cas-concret";
import { CATALOGUE, trouverCas } from "@/formats/cas-concret/catalogue";
import { ficheParGabarit } from "@/moteurs/montage-cas-concret/ecriture";
import { avecPointFinal, contenuEcran, departDePage, ecransCales, texteBarre } from "@/moteurs/montage-cas-concret/etapes";
import { EVENEMENT_DE_L_OBJET, EVENEMENTS_CAS_CONCRET, evenementConnu, validerSchemaFiche, type EcranCorps, type FicheEcrans } from "@/moteurs/montage-cas-concret/fiche";
import { contexteVisuel, planObjet } from "../../../studio-rendu/compositions/cas-concret/plans/Objet";
import { planTelephoneCapture } from "../../../studio-rendu/compositions/cas-concret/plans/TelephoneCapture";

const RACINE = join(__dirname, "../../..");
const FIXE = { videoId: "video-cc", versionId: "v1", habillage: "charte-duo/1", origine: "porte-a" as const };
const ZONE = { haut: 14, droite: 18, bas: 30, gauche: 6 };
const cas = trouverCas("recrutement-apporteurs")!;

/* ------------------------------------------------------------------ */
/* Point 2 · noms d'événements                                          */
/* ------------------------------------------------------------------ */

/** Noms d'événements que lisent réellement les plans des compositions (lecture des sources). */
function nomsLusParLesCompositions(): { fixes: Set<string>; numerotes: Set<string> } {
  const dossier = join(RACINE, "studio-rendu/compositions/cas-concret/plans");
  const fixes = new Set<string>();
  const numerotes = new Set<string>();
  for (const f of readdirSync(dossier).filter((x) => x.endsWith(".ts"))) {
    const src = readFileSync(join(dossier, f), "utf8");
    for (const m of src.matchAll(/(?:heureEvenement|heureObjet)\(\s*p\s*,\s*"([a-z0-9-]+)"/g)) fixes.add(m[1]);
    for (const m of src.matchAll(/\bev\(\s*"([a-z0-9-]+)"/g)) fixes.add(m[1]);
    // Noms formés : `tache-${i + 1}` (rang) ou `barre-${variante}` (les variantes écrites dans le même fichier).
    for (const m of src.matchAll(/(?:heureEvenement|heureObjet)\(\s*p\s*,\s*`([a-z-]+)-\$\{(\w+)/g)) {
      if (m[2] === "variante") for (const v of src.matchAll(/\bbarre\(\s*"([a-z]+)"/g)) fixes.add(`${m[1]}-${v[1]}`);
      else numerotes.add(m[1]);
    }
    if (/heureEvenement\(\s*p\s*,\s*nom\s*\)/.test(src)) for (const m of src.matchAll(/const nom = `([a-z-]+)-\$\{/g)) numerotes.add(m[1]);
  }
  return { fixes, numerotes };
}

describe("M8c · point 2 : une seule liste des noms d'événements", () => {
  it("la liste du format est exactement ce que lisent les plans des compositions", () => {
    const lus = nomsLusParLesCompositions();
    expect([...EVENEMENTS_CAS_CONCRET.fixes].sort()).toEqual([...lus.fixes].sort());
    expect([...EVENEMENTS_CAS_CONCRET.numerotes].sort()).toEqual([...lus.numerotes].sort());
  });

  it("un visuel sans événement propre lit `objet` : une impulsion visible, que l'écriture emploie comme relais", () => {
    const base = { id: "e05", fond: "ivoire", debutMs: 0, finMs: 3000, type: "objet", titre: "Le *rapport*", ligne: "Un rapport écrit.", visuel: { objet: "rapport" } } as const;
    const [sans, avec] = [[], [{ cible: "objet", ms: 1000 }]].map((evenements) => proprietesEcrans({ ecrans: [{ ...base, evenements }], captures: {}, zoneProtegee: ZONE })[0] as Extract<ProprietesEcran, { type: "objet" }>);
    const image = Math.round(1.17 * 25);
    expect(planObjet(avec, image).visuel.echelle).toBeGreaterThan(planObjet(sans, image).visuel.echelle * 1.04);
    expect(planObjet(avec, 2 * 25).visuel.echelle).toBeCloseTo(planObjet(sans, 2 * 25).visuel.echelle, 6);
    const audit = ficheParGabarit(trouverCas("audit-une-journee")!, FIXE);
    expect(audit.ecrans.some((e) => e.evenements.some((ev) => ev.cible === "objet"))).toBe(true);
  });

  it("noms connus et inconnus", () => {
    for (const n of ["titre-2", "tache-4", "puce-1", "pastille-3", "notification-2", "barre-maintenant", "chrono", "eclair", "question", "objet"]) expect(evenementConnu(n), n).toBe(true);
    for (const n of ["ligne-2", "visuel", "barres", "titre-0", "tache-", "barre-apres"]) expect(evenementConnu(n), n).toBe(false);
    for (const n of Object.values(EVENEMENT_DE_L_OBJET)) expect(evenementConnu(n), n).toBe(true);
  });

  it("la fiche refuse un nom d'événement inconnu, en le nommant", () => {
    const f = ficheParGabarit(cas, FIXE);
    const e = { ...f.ecrans[0], evenements: [{ cible: "ligne-2", surMot: 1, avanceMs: 0 }] } as EcranCorps;
    const v = validerSchemaFiche({ ...f, ecrans: [e, ...f.ecrans.slice(1)] });
    expect(v.ok).toBe(false);
    expect(v.ok ? "" : v.problemes.map((p) => p.message).join("\n")).toContain("ligne-2");
  });

  it("l'écriture par gabarit n'emploie que des noms connus, pour tous les cas du catalogue", () => {
    for (const c of CATALOGUE) {
      const f = ficheParGabarit(c, FIXE);
      const v = validerSchemaFiche(f);
      expect(v.ok, `${c.id} : ${v.ok ? "" : v.problemes.map((p) => p.message).join(" ; ")}`).toBe(true);
      for (const e of f.ecrans) for (const ev of e.evenements) expect(evenementConnu(ev.cible), `${c.id} ${e.id} ${ev.cible}`).toBe(true);
    }
    // Les lignes de l'accroche sont lues sous le nom `titre-<n>`.
    const accroche = ficheParGabarit(cas, FIXE).ecrans[0];
    expect(accroche.evenements.map((e) => e.cible)).toContain("titre-2");
  });
});

/* ------------------------------------------------------------------ */
/* Point 3 · barres du résultat                                          */
/* ------------------------------------------------------------------ */

describe("M8c · point 3 : barres du résultat tirées des faits du cas", () => {
  it("« +1 H » et « 15 MIN » pour le cas recrutement-apporteurs", () => {
    expect(texteBarre({ libelle: "Avant", valeur: 1, faitId: "plus-d-une-heure" }, cas.faits)).toBe("+1 H");
    expect(texteBarre({ libelle: "Maintenant", valeur: 15, faitId: "visio-quinze-minutes" }, cas.faits)).toBe("15 MIN");
  });

  it("un nombre absent des faits n'est jamais affiché", () => {
    expect(texteBarre({ libelle: "Avant", valeur: 100 }, cas.faits)).toBe("");
    // 20 est la valeur d'un fait (« delai-invitation »), mais la barre ne le désigne pas : rien n'est affiché.
    expect(texteBarre({ libelle: "Maintenant", valeur: 20 }, cas.faits)).toBe("");
    expect(texteBarre({ libelle: "Avant", valeur: 60, faitId: "plus-d-une-heure" }, cas.faits)).toBe("");
    expect(texteBarre({ libelle: "Avant", valeur: 1, faitId: "fait-inconnu" }, cas.faits)).toBe("");
  });

  it("la chaîne écrit sur les barres les textes des faits, jamais le libellé ni un calcul", () => {
    const f = ficheParGabarit(cas, FIXE);
    const r = f.ecrans.find((e) => e.type === "resultat") as Extract<EcranCorps, { type: "resultat" }>;
    expect([r.avant.faitId, r.maintenant.faitId]).toEqual(["plus-d-une-heure", "visio-quinze-minutes"]);
    const c = contenuEcran(r, null, {}, cas.faits);
    expect(c).toMatchObject({ type: "resultat", avant: "+1 H", maintenant: "15 MIN" });
    // Sans fait désigné : la barre porte son libellé, aucun nombre écrit, et l'écran reste accepté par le contrôle avant rendu.
    const sans = { ...r, avant: { libelle: "Avant", valeur: 100 }, maintenant: { libelle: "Maintenant", valeur: 20 }, debutMs: 0, finMs: 3000 } as EcranCorps;
    const p = proprietesEcrans({ ecrans: ecransCales([sans], [], null, {}, cas.faits), captures: {}, zoneProtegee: ZONE, bandeSousTitres: BANDE_SOUS_TITRES_CAS_CONCRET })[0];
    expect(Object.values(textesEcran(p)).join(" "), JSON.stringify(textesEcran(p))).not.toMatch(/\d/);
    expect(controlerProprietes(p)).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* Point 5 · point final                                                 */
/* ------------------------------------------------------------------ */

describe("M8c · point 5 : le point final du texte dit reste sur l'affiche", () => {
  it("ajouté quand le texte dit finit par un point et l'affiche non ; jamais doublé, gardé dans l'accent", () => {
    expect(avecPointFinal("quinze minutes. Oui, quinze minutes.", "minutes")).toBe("minutes.");
    expect(avecPointFinal("C'est notre seul travail.", "*travail*")).toBe("*travail.*");
    expect(avecPointFinal("C'est notre seul travail.", "*travail.*")).toBe("*travail.*");
    expect(avecPointFinal("Alors on a tout automatisé. La personne", "tout *automatisé*")).toBe("tout *automatisé*");
    expect(avecPointFinal("Et dans votre entreprise ?", "entreprise ?")).toBe("entreprise ?");
  });

  it("écrans `chiffre` et `titre` de la chaîne", () => {
    const chiffre = { id: "e02", type: "chiffre", fond: "sombre", marque: "axion-ia.com", texteDit: "quinze minutes. Oui, quinze minutes.", avanceMs: 0, evenements: [], valeur: 15, unite: "minutes", faitId: "visio-quinze-minutes", pastilles: [], variante: "simple" } as EcranCorps;
    expect(contenuEcran(chiffre, null, {})).toMatchObject({ unite: "minutes." });
    const titre = { id: "e12", type: "titre", fond: "sombre", marque: "axion-ia.com", texteDit: "C'est notre seul travail.", avanceMs: 0, evenements: [], lignes: ["Notre seul", "travail"], orange: ["travail"] } as EcranCorps;
    expect(contenuEcran(titre, null, {})).toMatchObject({ lignes: ["Notre seul", "*travail.*"] });
  });
});

/* ------------------------------------------------------------------ */
/* Point 6 · page entière : décalage de départ                           */
/* ------------------------------------------------------------------ */

describe("M8c · point 6 : une page longue montre d'emblée sa partie utile", () => {
  const fiche = (): FicheEcrans => {
    const f = ficheParGabarit(cas, FIXE);
    const i = f.ecrans.findIndex((e) => e.type === "etape" && e.visuel.sorte === "ecran");
    const e = f.ecrans[i] as Extract<EcranCorps, { type: "etape" }>;
    const ecrans = [...f.ecrans];
    ecrans[i] = { ...e, visuel: { ...(e.visuel as Extract<typeof e.visuel, { sorte: "ecran" }>), departPage: 0.46 } };
    return { ...f, ecrans: ecrans as FicheEcrans["ecrans"] };
  };

  it("la fiche porte le décalage (part de la page, de 0 à 1) ; la chaîne le reprend pour la capture", () => {
    const f = fiche();
    expect(validerSchemaFiche(f).ok).toBe(true);
    const id = f.ecrans.find((e) => e.type === "etape" && e.visuel.sorte === "ecran")!.id;
    expect(departDePage(f, id)).toBe(0.46);
    expect(departDePage(ficheParGabarit(cas, FIXE), id)).toBeUndefined();
    const hors = { ...f, ecrans: f.ecrans.map((e) => (e.id === id && e.type === "etape" && e.visuel.sorte === "ecran" ? { ...e, visuel: { ...e.visuel, departPage: 1.2 } } : e)) };
    expect(validerSchemaFiche(hors).ok).toBe(false);
  });

  it("la composition part du décalage, puis défile jusqu'au bas de la page", () => {
    const capture = { src: "rdv.jpg", cle: "rdv", sorte: "page-entiere", largeur: 1080, hauteur: 3276, departY: 0.3 } as CaptureEcran & { departY: number };
    const [p] = proprietesEcrans({
      ecrans: [{ id: "e09", fond: "ivoire", debutMs: 0, finMs: 3000, evenements: [], type: "etape", numero: 4, nombreEtapes: 6, titre: "Le *rendez-vous*", ligne: "Elle le choisit elle-même.", visuel: { capture: { cle: "rdv" } }, puces: [] }],
      captures: { rdv: capture },
      zoneProtegee: ZONE,
      bandeSousTitres: BANDE_SOUS_TITRES_CAS_CONCRET,
    }) as Extract<ProprietesEcran, { type: "etape" }>[];
    const boite = { x: 0, y: 0, largeur: 400, hauteur: 780 };
    const ctx = contexteVisuel(p, boite, 0);
    expect(ctx.capture).toMatchObject({ departY: 0.3 });
    const debut = planTelephoneCapture(ctx).capture!.boite;
    const fin = planTelephoneCapture(contexteVisuel(p, boite, 3)).capture!.boite;
    const sansDecalage = planTelephoneCapture({ ...ctx, capture: { ...ctx.capture!, departY: undefined } }).capture!.boite;
    expect(sansDecalage.y).toBeCloseTo(0, 6);
    expect(debut.y).toBeCloseTo(-0.3 * debut.hauteur, 3);
    expect(fin.y).toBeLessThan(debut.y);
    expect(fin.y + fin.hauteur).toBeGreaterThanOrEqual(planTelephoneCapture(ctx).ecran.hauteur - 0.5);
  });
});

/* ------------------------------------------------------------------ */
/* Point 7 · bande des sous-titres                                       */
/* ------------------------------------------------------------------ */

describe("M8c · point 7 : une seule bande des sous-titres du format", () => {
  it("la constante est dans le format ; chaîne, contrôles et fiche témoin la lisent, sans copie locale", () => {
    expect(BANDE_SOUS_TITRES_CAS_CONCRET).toBe(0.08);
    const lire = (f: string) => readFileSync(join(RACINE, f), "utf8");
    expect(lire("src/formats/cas-concret/index.ts")).toMatch(/export const BANDE_SOUS_TITRES_CAS_CONCRET = 0\.08;/);
    for (const f of ["src/moteurs/montage-cas-concret/fabriquer.ts", "src/moteurs/montage-cas-concret/controles.ts", "tests/cas-concret/temoin/fiche-temoin.ts", "tests/cas-concret/temoin/temoin.test.ts", "tests/cas-concret/temoin/planche.mts"]) {
      const src = lire(f);
      expect(src, f).toMatch(/BANDE_SOUS_TITRES_CAS_CONCRET/);
      expect(src, f).not.toMatch(/BANDE_SOUS_TITRES_TEMOIN|=\s*0\.08\b/);
    }
    expect(lire("src/moteurs/montage-cas-concret/fiche.ts")).not.toMatch(/BANDE_SOUS_TITRES/);
  });
});
