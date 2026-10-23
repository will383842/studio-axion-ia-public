/**
 * L6 · mises en page branchées (maquettes v2 validées, #308) : catalogue et données demandées, règles du tirage (jamais
 * deux fois la même mise en page de suite, fonds alternés, aplat orange ≤ 2, raccords compatibles, historique de 42,
 * même graine = même vidéo), v4 exacte quand le tirage est la v4, textes courts ET longs sans débordement en 9:16 et en
 * 4:5, et aucun chiffre ni texte écrit en dur : tout ce qui est montré vient de l'écran.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { motsBalises, proprietesEcrans, sansBalises, type EcranCale, type ProprietesEcran } from "@/briques/ecrans-motion";
import { APLATS_ORANGE, CODES_L6, eligible, estCodeDuType, finitSurUneCoche, MISE_EN_PAGE_V4, MISES_EN_PAGE_L6, misesEnPageEligibles, NAIT_D_UNE_COCHE, ON_ENTRE_DANS, type CodeMiseEnPageL6 } from "@/briques/ecrans-motion/mises-en-page";
import { BANDE_SOUS_TITRES_CAS_CONCRET, ZONE_PLEINE_IMAGE_CAS_CONCRET } from "@/formats/cas-concret";
import { ajouterAHistorique, entreeHistorique, fondsAlternes, jeuDeLEcran, mettre, schemaMise, tirer, TIRAGE_V4, TAILLE_HISTORIQUE, type EcranAMettre, type EntreeHistorique, type Mise } from "@/moteurs/montage-cas-concret/variete";
import { exemplesEcrans } from "../../../studio-rendu/compositions/cas-concret/exemples";
import { disposition } from "../../../studio-rendu/compositions/cas-concret/mises-en-page/dispositions";
import { cadre, debordements } from "../../../studio-rendu/compositions/cas-concret/mises-en-page/geo";

/* ------------------------------------------------------------------ */
/* Écrans d'essai : contenus courts (exemples) et longs                  */
/* ------------------------------------------------------------------ */

const LONGS: Record<string, Record<string, unknown>> = {
  accroche: { etiquette: "Recrutement · un cas réel chez nous cette semaine", lignes: ["On recrute nos collaborateurs en quinze minutes", "Sans jamais trier un seul CV de 200 pages", "*Vraiment tout seul…*"] },
  titre: { lignes: ["Alors on a automatisé absolument tout le processus", "de recrutement *automatisé.*"] },
  "liste-avant": { etiquette: "Avant, à la main, chaque semaine", titre: "C'était vraiment *tout ça*, chaque semaine", taches: ["Trier toutes les candidatures reçues par mail", "Répondre à chacun individuellement", "Relancer ceux qui ne répondent pas", "Caler un rendez-vous avec chacun", "Envoyer le contrat de collaboration", "Courir après la signature électronique"], total: { valeur: "+1 H 30 par personne", ligne: "pour chaque nouvelle personne recrutée" } },
  etape: { numero: 6, nombreEtapes: 7, titre: "La *signature* électronique du contrat", ligne: "Elle signe sur son téléphone, sans imprimer, sans scanner, sans renvoyer quoi que ce soit.", puces: ["Envoyé tout seul", "Signé en deux minutes"] },
  objet: { titre: "Elle *oublie* son rendez-vous de demain ?", ligne: "Le rappel part tout seul" },
  preuve: { etiquette: "Et les données personnelles ?", titre: "Conforme au *RGPD* européen, 13 critères", puces: ["100 % automatique de bout en bout", "0 intervention manuelle nécessaire"] },
  chiffre: { nombre: 45, unite: "minutes gagnées par recrutement", pastilles: ["0 CV à trier", "0 relance", "0 papier à signer"] },
  question: { lignes: ["Et dans votre propre", "*entreprise à vous ?*"], question: "Quelle tâche répétitive pourrait tourner toute seule chez vous dès demain matin ?" },
  resultat: { etiquette: "Résultat après trois mois", titre: "Des heures *gagnées* chaque jour", avant: "+1 H 30", maintenant: "15 MIN", ligne: "à chaque recrutement, chaque jour de la semaine, sans exception" },
};

/** Écrans calés d'essai (sans les champs que `proprietesEcrans` pose lui-même). */
function cales(longs: boolean): EcranCale[] {
  return exemplesEcrans().map((p) => {
    const { zone: _z, dessin: _d, largeur: _l, hauteur: _h, fps: _f, marque: _m, ...reste } = p;
    void [_z, _d, _l, _h, _f, _m];
    return { ...reste, ...(longs ? (LONGS[p.type] ?? {}) : {}) } as unknown as EcranCale;
  });
}
/** Propriétés pleine image du format, en 9:16 (1920) ou 4:5 (1350). */
const proprietes = (longs: boolean, hauteur: number): ProprietesEcran[] => proprietesEcrans({ ecrans: cales(longs), captures: {}, zoneProtegee: { ...ZONE_PLEINE_IMAGE_CAS_CONCRET }, bandeSousTitres: BANDE_SOUS_TITRES_CAS_CONCRET, hauteur });

const CORPS = ["accroche", "titre", "question", "chiffre", "resultat", "etape", "objet", "liste-avant", "preuve"];
/** Une vidéo type de 14 écrans : plusieurs écrans du même type de suite, 4 fonds sombres de suite. */
function videoType(longs = false): EcranAMettre[] {
  const par = Object.fromEntries(cales(longs).map((e) => [e.type, e]));
  const suite: [string, "sombre" | "ivoire"][] = [["accroche", "sombre"], ["chiffre", "sombre"], ["liste-avant", "ivoire"], ["titre", "sombre"], ["etape", "ivoire"], ["etape", "ivoire"], ["etape", "sombre"], ["objet", "sombre"], ["etape", "sombre"], ["titre", "sombre"], ["preuve", "ivoire"], ["chiffre", "ivoire"], ["resultat", "ivoire"], ["question", "sombre"]];
  return suite.map(([type, fond], i) => ({ id: `e${String(i + 1).padStart(2, "0")}`, type: type as EcranAMettre["type"], fond, contenu: { ...par[type]!, fond } as never }));
}

/** Série de vidéos tirées l'une après l'autre (historique cumulé), comme en production. */
function serie(n: number, ecrans = videoType()): { mise: Mise; historique: EntreeHistorique[] }[] {
  let historique: EntreeHistorique[] = [];
  const faites: { mise: Mise; historique: EntreeHistorique[] }[] = [];
  for (let i = 0; i < n; i++) {
    const videoId = `v-l6-${i}`;
    const avant = historique;
    const mise = mettre(tirer({ videoId, canaux: ["instagram"], historique }), ecrans, historique);
    historique = ajouterAHistorique(historique, entreeHistorique(videoId, ["instagram"], mise.tirage, "2026-10-16T12:00:00.000Z"));
    faites.push({ mise, historique: avant });
  }
  return faites;
}

/** Fond effectif d'un écran mis : orange (fond fort, aplat), sinon le fond alterné ou celui de la fiche. */
const fondEffectif = (m: Mise, e: EcranAMettre) => {
  const te = m.ecrans[e.id]!;
  return te.fondFort || (APLATS_ORANGE as readonly string[]).includes(te.miseEnPage) ? "orange" : (te.fondAlterne ?? e.fond);
};

/* ------------------------------------------------------------------ */

describe("L6 · catalogue et données demandées", () => {
  it("23 mises en page de #308 sur 9 types, plus la v4 (variante n° 0) pour chaque type", () => {
    expect(CODES_L6).toHaveLength(23);
    expect(Object.keys(MISES_EN_PAGE_L6).sort()).toEqual([...CORPS].sort());
    for (const t of CORPS) expect(misesEnPageEligibles({ ...cales(false).find((e) => e.type === t)! } as never)[0]).toBe(MISE_EN_PAGE_V4);
    for (const c of CODES_L6) expect(Object.entries(MISES_EN_PAGE_L6).filter(([, l]) => (l as readonly string[]).includes(c))).toHaveLength(1);
  });

  it("une mise en page n'est éligible que si l'écran a ses données (nombre, total, unité, part écrite, jours…)", () => {
    const c = Object.fromEntries(cales(false).map((e) => [e.type, e])) as Record<string, never>;
    const avec = <T extends object>(t: string, x: T) => ({ ...(c[t] as object), ...x }) as never;
    // Duel de tailles : un nombre écrit dans une ligne de l'accroche.
    expect(eligible("acc-duel-tailles", c.accroche)).toBe(false);
    expect(eligible("acc-duel-tailles", avec("accroche", { lignes: ["Un article", "en 15 minutes"] }))).toBe(true);
    // Cadran : le total de la fiche.
    expect(eligible("ava-cadran", avec("liste-avant", { total: undefined }))).toBe(false);
    expect(eligible("ava-cadran", c["liste-avant"])).toBe(true);
    // Jauge du chiffre : une unité qui a un tour (%, heures, minutes) et un nombre dans ce tour.
    expect(eligible("chi-jauge-anneau", c.chiffre)).toBe(true);
    expect(eligible("chi-jauge-anneau", avec("chiffre", { nombre: 90 }))).toBe(false);
    expect(eligible("chi-jauge-anneau", avec("chiffre", { nombre: 3, unite: "rendez-vous" }))).toBe(false);
    expect(eligible("chi-jauge-anneau", avec("chiffre", { nombre: 80, unite: "%" }))).toBe(true);
    // Compter en objets : un entier de 2 à 200.
    expect(eligible("chi-compter-objets", avec("chiffre", { nombre: 1.5 }))).toBe(false);
    expect(eligible("chi-compter-objets", avec("chiffre", { nombre: 900 }))).toBe(false);
    // Jauge de la preuve : une part ÉCRITE (« 100 % », « 75 sur 100 »).
    expect(eligible("pre-jauge-seuil", c.preuve)).toBe(true);
    expect(eligible("pre-jauge-seuil", avec("preuve", { puces: ["Zéro papier", "Tout en ligne"], titre: "Conforme *RGPD.*" }))).toBe(false);
    // Le mois qui se remplit : le texte parle de chaque jour.
    expect(eligible("res-mois-rempli", c.resultat)).toBe(false);
    expect(eligible("res-mois-rempli", avec("resultat", { ligne: "chaque jour" }))).toBe(true);
    // Le mot devient tampon : une dernière ligne courte.
    expect(eligible("tit-mot-objet", c.titre)).toBe(false);
    expect(eligible("tit-mot-objet", avec("titre", { lignes: ["Notre seul", "*travail.*"] }))).toBe(true);
    // L'étiquette qui pend : une ligne courte et un objet de la banque.
    expect(eligible("obj-etiquette-pend", avec("objet", { ligne: undefined }))).toBe(false);
    // Schéma et fantôme : un objet de la banque (un vrai écran filmé n'est jamais caché).
    expect(eligible("eta-schema-feutre", avec("etape", { visuel: { capture: { cle: "x" } } }))).toBe(false);
    expect(eligible("eta-entrer-dedans", avec("etape", { visuel: { capture: { cle: "x" } } }))).toBe(true);
  });
});

describe("L6 · règles du tirage", () => {
  const ECRANS = videoType();
  const SERIE = serie(80);

  it("même graine, même historique = même vidéo ; graines différentes = vidéos différentes", () => {
    const a = mettre(tirer({ videoId: "v-x", canaux: ["instagram"], historique: [] }), ECRANS);
    const b = mettre(tirer({ videoId: "v-x", canaux: ["instagram"], historique: [] }), videoType());
    expect(b).toEqual(a);
    expect(schemaMise.safeParse(a).success).toBe(true);
    expect(new Set(SERIE.map((s) => s.mise.tirage.misesEnPage)).size).toBeGreaterThan(70);
  });

  it("jamais deux écrans de suite avec la même mise en page ; chaque mise en page posée a ses données", () => {
    for (const { mise } of SERIE) {
      ECRANS.forEach((e, i) => {
        const code = mise.ecrans[e.id]!.miseEnPage;
        expect(code === MISE_EN_PAGE_V4 || (estCodeDuType(e.type as Parameters<typeof estCodeDuType>[0], code) && eligible(code as CodeMiseEnPageL6, e.contenu!))).toBe(true);
        if (i > 0 && ECRANS[i - 1]!.type === e.type) expect(code, `${e.id}`).not.toBe(mise.ecrans[ECRANS[i - 1]!.id]!.miseEnPage);
      });
    }
  });

  it("fonds alternés : jamais 3 fois le même fond de suite ; aplat orange (fond fort compris) sur 2 écrans au plus", () => {
    for (const { mise } of SERIE) {
      const f = ECRANS.map((e) => fondEffectif(mise, e));
      for (let i = 2; i < f.length; i++) if (f[i] !== "orange") expect(f[i] === f[i - 1] && f[i] === f[i - 2], f.join(",")).toBe(false);
      expect(f.filter((x) => x === "orange").length).toBeLessThanOrEqual(2);
      // Un fond fort ne reçoit jamais de mise en page L6 (le 3ᵉ fond a ses propres couleurs).
      for (const e of ECRANS) if (mise.ecrans[e.id]!.fondFort) expect(mise.ecrans[e.id]!.miseEnPage).toBe(MISE_EN_PAGE_V4);
    }
    expect(fondsAlternes(["sombre", "sombre", "sombre", "sombre", "ivoire", "ivoire", "ivoire"])).toEqual(["sombre", "ivoire", "sombre", "sombre", "ivoire", "sombre", "ivoire"]);
    // Les aplats servent vraiment (variété).
    expect(SERIE.some((s) => ECRANS.some((e) => s.mise.ecrans[e.id]!.miseEnPage === "chi-aplat-orange"))).toBe(true);
  });

  it("raccords « objet » et « dedans » seulement entre écrans compatibles, 2 au plus, jamais deux sur un écran ; aucun volet, rideau ni éclair", () => {
    let vus = 0;
    for (const { mise } of SERIE) {
      const entrees = ECRANS.map((e, i) => ({ e, i, r: mise.ecrans[e.id]!.raccordEntree })).filter((x) => x.r);
      expect(entrees.length).toBeLessThanOrEqual(2);
      for (const { e, i, r } of entrees) {
        vus++;
        expect(i).toBeGreaterThan(0);
        const avant = ECRANS[i - 1]!;
        expect(mise.ecrans[e.id]!.raccordSortie).toBeUndefined();
        if (r === "objet") {
          expect(finitSurUneCoche(avant.contenu as never) && (NAIT_D_UNE_COCHE as readonly string[]).includes(e.type)).toBe(true);
          expect(mise.ecrans[avant.id]!.raccordSortie).toBe("objet");
        } else {
          expect((ON_ENTRE_DANS as readonly string[]).includes(e.type)).toBe(true);
          expect(r).toBe(`dedans-${fondEffectif(mise, avant)}`);
          expect(fondEffectif(mise, avant)).not.toBe(fondEffectif(mise, e));
        }
      }
      for (const e of ECRANS) expect(["volet-terracotta", "eclair", "rideau"]).not.toContain(jeuDeLEcran(mise, e.id)?.transition);
    }
    expect(vus).toBeGreaterThan(10);
  });

  it("historique : la combinaison n'est jamais celle d'une des 42 vidéos précédentes", () => {
    for (const { mise, historique } of SERIE) {
      const vues = historique.slice(-TAILLE_HISTORIQUE).map((e) => e.tirage.misesEnPage);
      expect(vues).not.toContain(mise.tirage.misesEnPage);
    }
    // Et l'historique la garde (ligne écrite à la fabrication).
    expect(SERIE.at(-1)!.historique.every((e) => typeof e.tirage.misesEnPage === "string")).toBe(true);
  });

  it("tirage v4 : aucune mise en page, aucun fond alterné, aucun raccord ; une mise d'avant L6 ne passe aucune mise en page au rendu", () => {
    const v4 = mettre({ ...TIRAGE_V4, graine: 12 }, ECRANS);
    expect(v4.tirage.misesEnPage).toBeUndefined();
    for (const e of ECRANS) expect(jeuDeLEcran(v4, e.id)).toBeUndefined();
    // Mise d'avant L6 (sans contenu d'écran : valeurs de L2 « gauche », « plein-cadre ») : jamais rendue.
    const ancienne = mettre(SERIE[3]!.mise.tirage, ECRANS.map(({ id, type }) => ({ id, type })));
    for (const e of ECRANS) {
      expect(ancienne.ecrans[e.id]!.miseEnPage).toBe(SERIE[3]!.mise.tirage.miseEnPage[e.type as keyof Mise["tirage"]["miseEnPage"]]);
      expect(jeuDeLEcran(ancienne, e.id)?.miseEnPage).toBeUndefined();
    }
  });
});

describe("L6 · aucun débordement, textes courts ET longs, 9:16 ET 4:5", () => {
  for (const hauteur of [1920, 1350]) {
    for (const longs of [false, true]) {
      it(`${hauteur === 1920 ? "9:16" : "4:5"} · textes ${longs ? "longs" : "courts"} : chaque mise en page éligible tient (sinon le rendu revient à la v4)`, () => {
        let essais = 0;
        for (const p of proprietes(longs, hauteur)) {
          for (const code of CODES_L6) {
            if (!estCodeDuType(p.type, code) || !eligible(code, p)) continue;
            const d = disposition(code, p);
            expect(debordements(d, cadre(p)), `${code}`).toEqual([]);
            expect(d.ok, code).toBe(true);
            essais++;
          }
        }
        expect(essais).toBeGreaterThan(14);
      });
    }
  }

  it("toutes les mises en page sont essayées (écrans aux données complètes), aux deux formats", () => {
    const complets: Record<string, Record<string, unknown>> = {
      accroche: { lignes: ["Un article", "en 15 minutes"] },
      titre: { lignes: ["Notre seul", "*travail.*"] },
      resultat: { ligne: "chaque jour" },
      chiffre: { nombre: 15, unite: "minutes" },
    };
    const vus = new Set<string>();
    for (const hauteur of [1920, 1350]) {
      const ecrans = cales(false).map((e) => ({ ...e, ...(complets[e.type] ?? {}) }) as EcranCale);
      for (const p of proprietesEcrans({ ecrans, captures: {}, zoneProtegee: { ...ZONE_PLEINE_IMAGE_CAS_CONCRET }, bandeSousTitres: BANDE_SOUS_TITRES_CAS_CONCRET, hauteur })) {
        for (const code of CODES_L6) {
          if (!estCodeDuType(p.type, code) || !eligible(code, p)) continue;
          expect(debordements(disposition(code, p), cadre(p)), `${hauteur} ${code}`).toEqual([]);
          vus.add(code);
        }
      }
    }
    expect([...vus].sort()).toEqual([...CODES_L6].sort());
  });

  it("textes longs : la taille baisse (ajustement automatique) au lieu de déborder", () => {
    const court = proprietes(false, 1920).find((p) => p.type === "titre")!;
    const long = proprietes(true, 1920).find((p) => p.type === "titre")!;
    const a = disposition("tit-lignes-magazine", court).textes[0]!;
    const b = disposition("tit-lignes-magazine", long).textes[0]!;
    expect(b.taille).toBeLessThan(a.taille);
  });
});

describe("L6 · contenu : rien d'écrit en dur", () => {
  it("chaque mot montré vient de l'écran (ou des étiquettes de la brique : « Étape », « Avant », « Maintenant »)", () => {
    const permis = new Set(["étape", "avant", "maintenant", "/", "=", ":", "·"]);
    const cle = (m: string) => sansBalises(m).toLocaleLowerCase("fr-FR").replace(/[.,!?…«»"']/g, "");
    for (const hauteur of [1920, 1350]) {
      for (const longs of [false, true]) {
        for (const p of proprietes(longs, hauteur)) {
          const source = new Set(motsBalises(JSON.stringify(p)).flatMap((m) => cle(m.mot).split(/[\s"{}[\],:]+/)).filter(Boolean));
          for (const t of JSON.stringify(p).split(/[\s"{}[\],]+/)) source.add(cle(t));
          for (const code of CODES_L6) {
            if (!estCodeDuType(p.type, code) || !eligible(code, p)) continue;
            for (const t of disposition(code, p).textes) {
              for (const mot of t.lignes.join(" ").split(/\s+/).map(cle).filter(Boolean)) {
                // Un nombre (« 02 » d'« Étape 02 / 6 ») : une valeur de l'écran.
                const ok = permis.has(mot) || source.has(mot) || (/^\d+$/.test(mot) && JSON.stringify(p).includes(String(Number(mot))));
                expect(ok, `${code} · « ${mot} »`).toBe(true);
              }
            }
          }
        }
      }
    }
  });

  it("aucun chiffre ni texte des maquettes dans les sources branchées (« 15 min », « 900 à 1 300 mots », « 8 h-22 h », « ½ journée », « 200 »…)", () => {
    const dossier = join(__dirname, "../../../studio-rendu/compositions/cas-concret/mises-en-page");
    const sources = readdirSync(dossier).map((f) => readFileSync(join(dossier, f), "utf8")).join("\n") + readFileSync(join(__dirname, "../../../src/briques/ecrans-motion/mises-en-page.ts"), "utf8");
    // Chaînes affichées seulement (entre guillemets ou en texte JSX), pas les tailles en px.
    const litteraux = [...sources.matchAll(/"([^"\n]*)"|>([^<>{}\n]+)</g)].map((m) => m[1] ?? m[2] ?? "");
    for (const interdit of [/15 ?min/i, /900/, /1 ?300/, /\b8 h\b/, /22 h/, /½/, /journée/i, /\b200\b/, /\b75\b/, /13 crit/i, /articles?/i, /publié/i, /libre de droits/i, /photographe/i, /votre réponse/i, /Envoyer/, /nouveau/i, /blog/i, /mots interdits/i, /plagiat/i, /doublons/i])
      expect(litteraux.filter((l) => interdit.test(l)), String(interdit)).toEqual([]);
  });
});
