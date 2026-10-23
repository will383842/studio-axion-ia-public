/**
 * STYLE « blocs/2 » DU TABLEAU ANIMÉ (vidéo modèle « Formation ») : fiche, mise en page des écrans dans les quatre
 * formats, charte (contraste, orange jamais en texte), zone sûre, crayon, rythme, bruitages, fin, replis. Aucun appel.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TRACES_DESSINS } from "../../../src/briques/dessins/traces";
import { describe, expect, it } from "vitest";
import { controlerProprietes, proprietesScenes } from "../../../src/briques/tableau-scene/proprietes";
import type { MiseEnPageTableau as MiseBrique, ProprietesTableauScene, SceneCalee } from "../../../src/briques/tableau-scene/types";
import { encreTexte, empreinteCrayon, motsVisibles, planifierEcranV2, poseCrayonV2 } from "../../../src/briques/tableau-scene/v2/animation";
import { COULEURS_V2, FIN_V2, SIGNATURE_V2, TENUE_FIN_TOTALE_MS, contraste, contrasteExige } from "../../../src/briques/tableau-scene/v2/charte";
import { cleMotV2, largeurTenue } from "../../../src/briques/tableau-scene/v2/disposition";
import { REGLAGES_GEOMETRIE_V2, dansRect, recouvre } from "../../../src/briques/tableau-scene/v2/geometrie";
import { RECETTE_STYLE_BLOCS_2, bruitagesVideoV2 } from "../../../src/briques/tableau-scene/v2/recette";
import { sousTitreA } from "../../../src/briques/tableau-scene/v2/sous-titres";
import type { EcranPlace, GeometrieV2 } from "../../../src/briques/tableau-scene/v2/types";
import { polygoneDans, polygoneTouche } from "../../../src/briques/stylo/empreinte";
import { SONS_TABLEAU } from "../../../src/donnees/bruitages";
import { CONSIGNE_DECOUPAGE, habillageDe } from "../../../src/moteurs/montage-tableau/decoupage";
import { GABARITS_ECRAN, STYLE_PAR_DEFAUT_TABLEAU, validerFicheTableau, type FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { IDS_FORMATS_SORTIE, type IdFormatSortie } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { descriptionsEcrans, mettreEnPage } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { contexteExemple, EXEMPLES } from "../regles/exemples";
import { contexteFormation, ficheFormation, ficheFormationCalee, motsFormation } from "./temoin-formation";

const calage = ficheFormationCalee();
/** Dans la zone haute du vertical : marge droite du haut (`hautLarge`), et fini au-dessus de `titresLarges.basMax`. */
const dansZoneHaute = (r: { x: number; y: number; largeur: number; hauteur: number }, g: GeometrieV2) =>
  !!g.titresLarges && r.y + r.hauteur <= g.titresLarges.basMax && dansRect(r, { ...g.zoneSure, largeur: g.largeur * (1 - REGLAGES_GEOMETRIE_V2.hautLarge.droite / 100) - g.zoneSure.x });
const mots = motsFormation();
const mise = (f: IdFormatSortie, fiche: FicheTableau = calage.fiche) => mettreEnPage(fiche, f === "vertical" ? {} : { format: f });
const props = (f: IdFormatSortie): ProprietesTableauScene[] =>
  proprietesScenes({ miseEnPage: mise(f) as unknown as MiseBrique, scenes: calage.fiche.scenes as SceneCalee[], heures: calage.elements, stylo: calage.fiche.stylo, mots });

/** Plans de tous les écrans d'un format (une fois chacun). */
function plans(f: IdFormatSortie) {
  const vus = new Map<string, { ecran: EcranPlace; plan: ReturnType<typeof planifierEcranV2>; g: GeometrieV2 }>();
  for (const p of props(f)) {
    const v = p.v2!;
    for (const e of v.ecrans) {
      if (vus.has(e.id)) continue;
      vus.set(e.id, { ecran: e, g: v.geometrie, plan: planifierEcranV2({ ecran: e, geometrie: v.geometrie, debutMs: v.temps[e.id].debutMs, finMs: v.temps[e.id].finMs, heures: v.heures, finVoixMs: v.finVoixMs, mots: v.mots, stylo: p.stylo }) });
    }
  }
  return [...vus.values()];
}

describe("fiche « blocs/2 »", () => {
  it("la fiche témoin « Formation » est valide, calée, et garde son style ; les nouvelles fiches naissent en « reference/3 » (gabarit par parties, 14/10)", () => {
    const v = validerFicheTableau(ficheFormation(), contexteFormation());
    expect(v.ok ? [] : v.problemes.map((p) => p.message)).toEqual([]);
    expect(STYLE_PAR_DEFAUT_TABLEAU).toBe("reference/3");
    expect(habillageDe({})).toBe("reference/3");
    expect(habillageDe({ habillage: "blocs/2" })).toBe("blocs/2");
    expect(habillageDe({ habillage: "charte-video/1" })).toBe("charte-video/1");
  });

  it("les fiches existantes restent valides et gardent la page écrite (aucun écran, mise en page d'avant)", () => {
    for (const f of Object.values(EXEMPLES)) {
      const v = validerFicheTableau(f, contexteExemple(f));
      expect(v.ok).toBe(true);
      expect(mettreEnPage(f).styleV2).toBeUndefined();
    }
  });

  it("le champ « ecrans » est facultatif et exact : un champ inconnu est refusé", () => {
    const f = ficheFormation();
    (f.scenes[0].ecrans![0] as Record<string, unknown>).couleur = "rouge";
    const v = validerFicheTableau(f, contexteFormation());
    expect(v.ok).toBe(false);
    expect(v.ok ? "" : v.problemes[0].message).toMatch(/inconnu/);
  });

  it("un mot fort qui n'est pas écrit dans la scène est refusé (références internes)", () => {
    const f = ficheFormation();
    f.scenes[0].ecrans![0].motsForts = ["inventé"];
    const v = validerFicheTableau(f, contexteFormation());
    expect(v.ok ? [] : v.problemes.map((p) => p.message).join(" ")).toMatch(/mot fort « inventé »/);
  });

  it("l'appel « Écrivez CINQ en commentaire » n'est permis que sur l'écran d'appel de la dernière scène", () => {
    const f = ficheFormation();
    f.scenes[9].ecrans = [f.scenes[9].ecrans![0]];
    const v = validerFicheTableau(f, contexteFormation());
    expect(v.ok ? [] : v.problemes.map((p) => p.regle)).toContain("aucune phrase d'appel");
  });
});

describe("mise en page des écrans, quatre formats", () => {
  for (const f of IDS_FORMATS_SORTIE) {
    it(`${f} : 11 écrans, textes dans la zone sûre, aucun débordement, aucun mot coupé, aucun texte sur un autre`, () => {
      const m = mise(f);
      const v = m.styleV2!;
      expect(v.ecrans).toHaveLength(11);
      const g = v.geometrie;
      const lignes = new Map(calage.fiche.scenes.flatMap((s) => s.elements.flatMap((e) => (e.type === "ligne" ? [[e.id, e.texte] as const] : []))));
      for (const e of v.ecrans) {
        for (const t of e.textes) {
          // Vertical : un titre du haut peut prendre plus de largeur à droite tant qu'il finit au-dessus de `basMax`.
          expect(dansRect(t, g.zoneSure) || dansZoneHaute(t, g), `${e.id} « ${t.texte} » hors de la zone sûre`).toBe(true);
          // Mot entier : chaque mot d'un texte de titre est un mot de sa ligne.
          const ligne = lignes.get(t.source.replace(/~(mot|apres)$/, ""));
          if (ligne) for (const mot of t.texte.split(/\s+/).map(cleMotV2).filter(Boolean)) expect(ligne.split(/\s+/).map(cleMotV2), `${e.id} : « ${t.texte} » coupe un mot`).toContain(mot);
        }
        for (const x of e.formes.filter((x) => !x.horsZone)) expect(dansRect({ ...x, largeur: x.largeur - 0.5, hauteur: x.hauteur - 0.5 }, { x: 0, y: 0, largeur: g.largeur, hauteur: g.hauteur }), `${e.id} forme ${x.id} hors de l'image`).toBe(true);
        const droiteTrait = (y: number) => (g.titresLarges && y <= g.titresLarges.basMax ? g.titresLarges.droite + 30 : g.zoneSure.x + g.zoneSure.largeur + 30);
        for (const tr of e.traits) for (const s of tr.segments) for (const pt of s) expect(pt.x >= g.zoneSure.x - 30 && pt.x <= droiteTrait(pt.y) && pt.y >= g.zoneSure.y && pt.y <= g.zoneSure.y + g.zoneSure.hauteur, `${e.id} trait ${tr.id} hors de la zone sûre`).toBe(true);
        if (g.titresLarges) expect(largeurTenue(e, g), `${e.id} : plus large que la marge droite sous la limite des titres du haut`).toBe(true);
        // Deux textes visibles en même temps ne se recouvrent jamais (les groupes de titres défilent à la même place).
        const ts = e.textes.filter((t) => !t.rotation);
        for (let i = 0; i < ts.length; i++)
          for (let j = i + 1; j < ts.length; j++) {
            const a = ts[i];
            const b = ts[j];
            if (a.groupe !== undefined && b.groupe !== undefined && a.groupe !== b.groupe) continue;
            if (a.source === "~fin-voix" || b.source === "~fin-voix") continue;
            expect(recouvre(encreTexte(a), encreTexte(b), 1), `${e.id} : « ${a.texte} » recouvre « ${b.texte} »`).toBe(false);
          }
      }
    });
  }

  it("pages des contrôles d'avant : chaque scène passe le contrôle de ses propriétés (quatre formats)", () => {
    for (const f of IDS_FORMATS_SORTIE) for (const p of props(f)) expect(controlerProprietes(p), `${f} ${p.scene.id}`).toEqual([]);
  });
});

describe("charte", () => {
  it("l'orange n'est JAMAIS une couleur de texte (correction de « 1 SEULE CHOSE » : encre, souligné d'orange)", () => {
    for (const f of IDS_FORMATS_SORTIE) for (const e of mise(f).styleV2!.ecrans) for (const t of e.textes) expect(t.couleur, `${f} ${e.id} « ${t.texte} »`).not.toBe(COULEURS_V2.orange);
    const e3 = mise("vertical").styleV2!.ecrans.find((e) => e.sceneId === "s07")!;
    const seule = e3.textes.find((t) => t.texte === "SEULE")!;
    expect(e3.fond).toBe("ivoire");
    expect(seule.couleur).toBe(COULEURS_V2.encre);
    expect(e3.traits.some((t) => t.sorte === "souligne" && t.couleur === COULEURS_V2.orange && t.source === seule.source)).toBe(true);
  });

  it("contraste suffisant sur les trois fonds (grand texte 3:1, petit texte 4,5:1)", () => {
    const fonds = new Set<string>();
    for (const f of IDS_FORMATS_SORTIE) {
      const v = mise(f).styleV2!;
      for (const e of v.ecrans) {
        fonds.add(e.fond);
        for (const t of e.textes) expect(contraste(t.couleur, t.fond), `${f} ${e.id} « ${t.texte} » ${t.taille} px`).toBeGreaterThanOrEqual(contrasteExige(t.taille, v.geometrie.k));
      }
    }
    expect([...fonds].sort()).toEqual(["encre", "ivoire", "orange"]);
  });

  it("mots forts en blocs, étiquettes de section, barre des étapes, grand numéro, gabarits variés", () => {
    const v = mise("vertical").styleV2!;
    expect(v.ecrans.flatMap((e) => e.formes.filter((x) => x.sorte === "bloc")).length).toBeGreaterThanOrEqual(5);
    expect(v.ecrans.map((e) => e.etiquette)).toEqual(expect.arrayContaining(["Le constat", "Le vrai problème", "La méthode", "Exemple", "En résumé", "À vous"]));
    expect(v.etapes.map((x) => x.n)).toEqual([1, 2, 3, 4]);
    for (const e of v.ecrans.filter((x) => x.moment === "etape")) expect(e.formes.some((x) => x.id.endsWith("#num"))).toBe(true);
    expect(new Set(v.ecrans.map((e) => e.gabarit)).size).toBeGreaterThanOrEqual(8);
    expect(v.ecrans.find((e) => e.moment === "exemple")!.textes.some((t) => t.texte === "Exemple illustratif")).toBe(true);
    // Fonds qui alternent : jamais deux écrans de suite sur le même fond.
    for (let i = 1; i < v.ecrans.length; i++) expect(v.ecrans[i].fond).not.toBe(v.ecrans[i - 1].fond);
  });

  it("aucun personnage ni main : ni image ni illustration, seulement du texte, des formes, les pictogrammes de la banque et le crayon", () => {
    for (const e of mise("vertical").styleV2!.ecrans)
      for (const x of e.formes) {
        expect(["bloc", "carte", "case", "pastille", "barre-sable", "rond", "numero", "jauge", "deco", "bouton", "bulle", "dessin"]).toContain(x.sorte);
        // Relecture du 12/10/2026 : un pictogramme de la fiche en grand plutôt qu'une carte vide — seulement les
        // pictogrammes d'objets de la banque (aucun personnage, aucune main).
        if (x.sorte === "dessin") expect(Object.keys(TRACES_DESSINS)).toContain(x.dessin);
      }
    const rendu = readFileSync(join(process.cwd(), "studio-rendu/compositions/tableau/v2/EcranV2.tsx"), "utf8");
    expect(rendu).not.toMatch(/DessinTrace|<img|personnage|main\.svg/);
  });
});

describe("signature axion-ia.com", () => {
  it("petite et fixe en haut à droite de chaque écran, dans la zone sûre de chaque format ; en grand sur l'écran de fin ; jamais dite", () => {
    for (const f of IDS_FORMATS_SORTIE) {
      const v = mise(f).styleV2!;
      const g = v.geometrie;
      for (const e of v.ecrans) {
        const s = e.textes.find((t) => t.id === "sig")!;
        expect(s.texte).toBe(SIGNATURE_V2);
        expect(dansRect(s, g.zoneSure)).toBe(true);
        expect(s.x + s.largeur).toBeGreaterThan(g.zoneSure.x + g.zoneSure.largeur - 40 * g.k);
        expect(s.y).toBeLessThan(g.zoneSure.y + 80 * g.k);
      }
      const fin = v.ecrans[v.ecrans.length - 1].textes.find((t) => t.id === "signature-fin")!;
      expect(fin.taille).toBeGreaterThan(v.ecrans[0].textes.find((t) => t.id === "sig")!.taille * 1.8);
      expect(dansRect(fin, g.zoneSure)).toBe(true);
    }
    expect(calage.fiche.scenes.some((s) => /axion/i.test(s.texteDit))).toBe(false);
  });
});

describe("animation", () => {
  for (const f of IDS_FORMATS_SORTIE) {
    it(`${f} : le crayon ne passe jamais sur un mot visible et se range dans la zone sûre`, () => {
      for (const { ecran, plan, g } of plans(f)) {
        const repos = empreinteCrayon(g, { x: g.repos.x, y: g.repos.y }, g.repos.angle);
        expect(polygoneDans(repos, g.zoneSure), `${ecran.id} repos hors de la zone sûre`).toBe(true);
        for (let t = plan.debutMs; t < plan.finMs; t += 40) {
          const c = poseCrayonV2(plan, ecran, g, t);
          if (c.opacite <= 0.02) continue;
          const poly = empreinteCrayon(g, c, c.angle);
          const touche = motsVisibles(ecran, plan.apparitions, t).find((b) => polygoneTouche(poly, b));
          expect(touche, `${ecran.id} à ${t} ms : le crayon couvre un mot`).toBeUndefined();
        }
      }
    });
  }

  it("quelque chose change à l'écran au moins toutes les 2 secondes, du début à la fin (tenue comprise)", () => {
    for (const { ecran, plan } of plans("vertical")) {
      const pts = [...plan.changements, plan.finMs];
      for (let i = 1; i < pts.length; i++) expect(pts[i] - pts[i - 1], `${ecran.id} entre ${pts[i - 1]} et ${pts[i]} ms`).toBeLessThanOrEqual(2000);
    }
  });

  it("sous-titres mot à mot dans leur pastille, dans la bande de la zone sûre ; effacés après la voix", () => {
    for (const f of IDS_FORMATS_SORTIE) {
      const p = props(f)[3];
      const v = p.v2!;
      for (let t = 0; t < v.finVoixMs; t += 250) {
        const s = sousTitreA(v.mots ?? mots.map((m) => ({ mot: m.mot, debutMs: m.debutSec * 1000, finMs: m.finSec * 1000 })), v.geometrie, t, v.finVoixMs);
        if (!s) continue;
        expect(dansRect(s.boite, v.geometrie.bande), `${f} à ${t} ms`).toBe(true);
        expect(s.mots.length).toBeLessThanOrEqual(4);
      }
      expect(sousTitreA(v.mots!, v.geometrie, v.finVoixMs + 600, v.finVoixMs)).toBeNull();
    }
  });
});

describe("bruitages", () => {
  const sons = bruitagesVideoV2(props("vertical"));

  it("les trois familles de la vidéo modèle, déclarées avec leur instant, jamais sur chaque mot", () => {
    expect(new Set(sons.map((s) => s.famille))).toEqual(new Set(["trait", "toc", "validation"]));
    expect(sons.length).toBeLessThan(mots.length / 3);
    for (const fam of ["trait", "toc", "validation"]) {
      const t = sons.filter((s) => s.famille === fam).map((s) => s.sec);
      for (let i = 1; i < t.length; i++) expect(t[i] - t[i - 1]).toBeGreaterThanOrEqual(0.3 - 1e-6);
    }
    // Un « toc » à l'arrivée de chaque numéro d'étape.
    expect(sons.filter((s) => s.famille === "toc" && s.source.endsWith("#num"))).toHaveLength(4);
    expect(RECETTE_STYLE_BLOCS_2.bruitagesPlan.musique).toBe(false);
  });

  it("au moins 18 dB sous la voix en crête : crête du fichier (mesurée) + gain ≤ −1 dBFS − 18 dB ; une seule banque", () => {
    for (const s of SONS_TABLEAU) {
      const b = readFileSync(join(process.cwd(), "public", s.cleStockage));
      const data = b.indexOf("data") + 8;
      let crete = 0;
      for (let i = data; i + 1 < b.length; i += 2) crete = Math.max(crete, Math.abs(b.readInt16LE(i)) / 32768);
      const creteDb = 20 * Math.log10(crete);
      expect(Math.abs(creteDb - s.creteDb)).toBeLessThan(0.3);
      expect(creteDb + s.gainDb).toBeLessThanOrEqual(-1 - RECETTE_STYLE_BLOCS_2.bruitagesPlan.sousVoixDbMin);
      expect(RECETTE_STYLE_BLOCS_2.bruitagesPlan.sons[s.famille].cleStockage).toBe(s.cleStockage);
    }
  });
});

describe("fin", () => {
  it("l'écran de fin reste au moins 2,5 s après la voix, puis 0,4 s de fondu d'image ; exposé par la recette", () => {
    const fin = calage.fiche.scenes.at(-1)!.finMs!;
    expect(fin - Math.round(mots.at(-1)!.finSec * 1000)).toBeGreaterThanOrEqual(TENUE_FIN_TOTALE_MS);
    expect(RECETTE_STYLE_BLOCS_2.finTenue).toEqual({ apresVoixSec: FIN_V2.tenueApresVoixMs / 1000, fonduImageSec: FIN_V2.fonduImageMs / 1000 });
    expect(FIN_V2.tenueApresVoixMs).toBeGreaterThanOrEqual(2500);
    expect(FIN_V2.fonduImageMs).toBe(400);
    // Style d'avant : aucune tenue ajoutée.
    const ex = EXEMPLES.demonstration;
    expect(ex.habillage).toBe("charte-video/1");
  });
});

describe("replis : aucune fiche ne fait échouer le rendu", () => {
  it("une fiche « blocs/2 » sans aucun écran déclaré se met en page dans les quatre formats", () => {
    for (const ex of Object.values(EXEMPLES)) {
      const f: FicheTableau = { ...structuredClone(ex), habillage: "blocs/2" };
      for (const fmt of IDS_FORMATS_SORTIE) expect(() => mettreEnPage(f, fmt === "vertical" ? {} : { format: fmt })).not.toThrow();
      expect(descriptionsEcrans(f).every((d) => !!d.gabarit)).toBe(true);
    }
  });

  it("chaque gabarit, imposé à chaque scène de la fiche témoin, se met en page (ou se replie) dans les quatre formats", () => {
    for (const gabarit of GABARITS_ECRAN) {
      const f = ficheFormation();
      for (const s of f.scenes) for (const e of s.ecrans ?? []) e.gabarit = gabarit;
      for (const fmt of IDS_FORMATS_SORTIE) expect(() => mettreEnPage(f, fmt === "vertical" ? {} : { format: fmt }), `${gabarit} ${fmt}`).not.toThrow();
    }
  }, 30_000);
});

describe("découpage automatique", () => {
  it("la consigne demande les écrans (moment, gabarit, étiquette, mots forts, liste) pour le style « blocs/2 »", () => {
    for (const mot of ["ecrans", "moment", "gabarit", "etiquette", "motsForts", "liste", "motCommentaire", ...GABARITS_ECRAN]) expect(CONSIGNE_DECOUPAGE).toContain(mot);
  });
});
