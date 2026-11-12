/**
 * L9a · composants Remotion 3 : bénéfices et récapitulatif (A, B), bandeau des chiffres, repère « 2/3 », recherche,
 * alerte Telegram, e-mail structuré, dossiers, sources, phrase-choc mot à mot avec lueur, scène « Ensemble » lisible
 * (C et faux schéma à 16 nœuds). Plans PURS testés directement ; aucun texte sous le plancher, aucune personne de la
 * photo de l'image A, rien d'inventé. Déterministe.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { motsBalises } from "@/briques/ecrans-motion";
import { chevauche, nombreDeMots } from "@/briques/schema-motion";
import type { CarteImage } from "@/domaine/image-video/carte";
import { iconeDe } from "@/domaine/image-video/icones";
import { sceneGalerieC } from "../../studio-rendu/compositions/image-video/donnees-galerie";
import { zoneUtile } from "../../studio-rendu/compositions/image-video/mise-en-page";
import { beneficesA, beneficesB, galerieA, galerieB, galerieObjets, type MomentGalerie } from "../../studio-rendu/compositions/image-video/donnees-galerie-l9a";
import {
  ajusterTexte,
  chiffreCompte,
  coupePhraseChoc,
  couperEquilibre,
  etatBenefices,
  planAlerte,
  planBandeau,
  planCarteBenefice,
  planDossiers,
  planEmail,
  planEnsemble,
  planPaperboard,
  planPhraseChoc,
  planRecap,
  planRecherche,
  planRepere,
  planSources,
  PLANCHER_PX,
  secousseAlerte,
  SIGNES,
} from "../../studio-rendu/compositions/image-video/plan-objets";
import { libelleCourt } from "../../src/briques/schema-motion/plan-objets";

/** Zone utile en pixels (haut et bas). */
const BAS_ZONE = { haut: zoneUtile().y, bas: zoneUtile().y + zoneUtile().hauteur };
const lire = (nom: string): CarteImage => JSON.parse(readFileSync(join(process.cwd(), "tests/image-video/fixtures/cartes", `${nom}.json`), "utf8"));
const H = 1920;
const W = 1080;

/** Toutes les alertes de lisibilité d'un moment de galerie, à quelques instants. */
function alertesDuMoment(m: MomentGalerie): string[] {
  const instants = [m.debut, (m.debut + m.fin) / 2, m.fin - 0.01];
  return instants.flatMap((t) => {
    switch (m.sorte) {
      case "paperboard":
        return planPaperboard(m.etapes, t, m.debut).alertes;
      case "benefices":
        return m.benefices.flatMap((b) => planCarteBenefice(b).alertes);
      case "recap":
        return planRecap(m.benefices, t, m.debut).alertes;
      case "bandeau":
        return planBandeau(m.chiffres, t).alertes;
      case "recherche":
        return planRecherche({ requete: m.requete, debut: m.frappe, trouve: m.trouve }, t).alertes;
      case "alerte":
        return planAlerte({ source: m.source, moment: m.moment, message: m.message, t: m.t0 }, t).alertes;
      case "email":
        return planEmail({ champs: m.champs, debut: m.debut }, t).alertes;
      case "dossiers":
        return planDossiers({ dossiers: m.dossiers, debut: m.debut }, t).alertes;
      case "sources":
        return planSources({ sources: m.sources, cible: m.cible }, t).alertes;
      case "phrase-choc":
        return planPhraseChoc({ phrase: m.phrase, debut: m.debut, heures: m.heures }, t).alertes;
      case "ensemble":
        return planEnsemble(m.schema, m.options).alertes;
    }
  });
}

describe("mesure des textes", () => {
  it("coupe équilibrée : la plus longue ligne est la plus courte possible", () => {
    expect(couperEquilibre(["Gain", "de", "temps", "immédiat"], 2)).toEqual([["Gain", "de", "temps"], ["immédiat"]]);
    expect(couperEquilibre(["a"], 3)).toEqual([["a"]]);
  });
  it("un texte rétrécit jusqu'au plancher, passe à la ligne, puis lève une alerte — jamais sous le plancher", () => {
    const court = ajusterTexte("Clients", { largeur: 400, tailleMax: 80, signe: SIGNES.inter });
    expect(court).toMatchObject({ taille: 80, lignes: [["Clients"]], alerte: null });
    const deux = ajusterTexte("Réponse sous deux heures", { largeur: 500, tailleMax: 80, signe: SIGNES.inter });
    expect(deux.lignes).toHaveLength(2);
    expect(deux.taille).toBeGreaterThanOrEqual(PLANCHER_PX);
    const trop = ajusterTexte("Anticonstitutionnellement", { largeur: 300, tailleMax: 80, signe: SIGNES.inter });
    expect(trop.alerte).toMatch(/plancher de lisibilité/);
    expect(trop.taille).toBe(PLANCHER_PX);
  });
});

describe("K10 · cartes bénéfices et récapitulatif (A, B)", () => {
  for (const [nom, benefices] of [
    ["A", beneficesA()],
    ["B", beneficesB()],
  ] as const) {
    it(`${nom} : textes exacts de la carte, icônes de la table de L1, cinq cartes`, () => {
      const carte = lire(nom);
      const attendus = carte.noeuds.filter((n) => n.role === "benefice").sort((a, b) => a.ordre - b.ordre);
      expect(benefices).toHaveLength(5);
      expect(benefices.map((b) => [b.id, b.titre, b.ligne, b.icone])).toEqual(attendus.map((n) => [n.id, n.libelle, n.detail, iconeDe(n.icone!)]));
    });
    it(`${nom} : chaque carte et le récapitulatif tiennent au plancher, sans alerte, dans la zone utile`, () => {
      for (const b of benefices) {
        const p = planCarteBenefice(b);
        expect(p.alertes, b.titre).toEqual([]);
        expect(p.titre.taille).toBeGreaterThanOrEqual(PLANCHER_PX);
        expect(p.ligne!.taille).toBeGreaterThanOrEqual(PLANCHER_PX);
        expect(p.boite.y).toBeGreaterThanOrEqual(BAS_ZONE.haut - 1e-6);
        expect((p.microObjet ? p.microObjet.y + p.microObjet.hauteur : p.boite.y + p.boite.hauteur)).toBeLessThanOrEqual(BAS_ZONE.bas + 1e-6);
      }
      const r = planRecap(benefices, 10, 0);
      expect(r.alertes).toEqual([]);
      expect(r.lignes).toHaveLength(5);
      for (let i = 1; i < r.lignes.length; i++) expect(r.lignes[i].y).toBeGreaterThanOrEqual(r.lignes[i - 1].y + r.lignes[i - 1].hauteur);
      expect(r.lignes[4].y + r.lignes[4].hauteur).toBeLessThanOrEqual(BAS_ZONE.bas + 1e-6);
      for (const l of r.lignes) expect(l.titre.taille).toBeGreaterThanOrEqual(PLANCHER_PX);
    });
  }
  it("une carte par heure : la courante entre, la précédente sort ; le récapitulatif entre en cascade", () => {
    const heures = [1, 3, 5];
    expect(etatBenefices(heures, 0.5).courante).toBe(-1);
    expect(etatBenefices(heures, 1.2)).toMatchObject({ courante: 0, sortie: 0 });
    const e = etatBenefices(heures, 3);
    expect(e.courante).toBe(1);
    expect(e.entree).toBeGreaterThan(0);
    expect(e.sortie).toBeGreaterThan(0);
    expect(etatBenefices(heures, 9)).toMatchObject({ courante: 2, entree: 1, sortie: 1 });
    const r = planRecap(beneficesB(), 0.2, 0);
    expect(r.lignes.map((l) => l.entree > 0)).toEqual([true, true, false, false, false]);
  });
  it("image A : AUCUNE personne de la photo — le paperboard est redessiné à partir des mots seuls", () => {
    const carte = lire("A");
    const photo = carte.noeuds.find((n) => n.photoPersonnes)!;
    const g = galerieA();
    const paperboard = g.moments.find((m) => m.sorte === "paperboard") as Extract<MomentGalerie, { sorte: "paperboard" }>;
    expect(paperboard.etapes).toEqual(photo.sousElements);
    expect(planPaperboard(paperboard.etapes, 5, 0).alertes).toEqual([]);
    // Aucune image (ni chemin, ni source) dans les données de la galerie A.
    expect(JSON.stringify(g)).not.toMatch(/"(src|image|photo|imageSource)"|\.(png|jpe?g|webp)/i);
  });
});

describe("K12 · bandeau des chiffres", () => {
  const chiffres = [
    { texte: "80 %", legende: "résolus tout de suite", t: 1 },
    { texte: "0", legende: "demande perdue", t: 2 },
    { texte: "24h/24", legende: "sans pause", t: 3 },
  ];
  it("un chiffre simple compte, un chiffre composé claque tel quel", () => {
    expect(chiffreCompte("80 %", 0)).toBe("0 %");
    expect(chiffreCompte("80 %", 1)).toBe("80 %");
    expect(chiffreCompte("4,5 h", 1)).toBe("4,5 h");
    expect(chiffreCompte("24h/24", 0.3)).toBe("24h/24");
    expect(chiffreCompte("23h14", 0.3)).toBe("23h14");
    expect(chiffreCompte("0", 0.3)).toBe("0");
  });
  it("les chiffres claquent un par un sur leur heure ; le premier est orange ; tout tient au plancher", () => {
    const avant = planBandeau(chiffres, 0.9);
    expect(avant.rangees.map((r) => r.claque.opacite)).toEqual([0, 0, 0]);
    const milieu = planBandeau(chiffres, 1.2);
    expect(milieu.rangees[0].claque.opacite).toBeGreaterThan(0);
    expect(milieu.rangees[0].texte).toBe("80 %");
    expect(milieu.rangees[1].claque.opacite).toBe(0);
    const fin = planBandeau(chiffres, 5);
    expect(fin.rangees.map((r) => r.texte)).toEqual(["80 %", "0", "24H/24"]);
    expect(fin.rangees.map((r) => r.orange)).toEqual([true, false, false]);
    expect(fin.alertes).toEqual([]);
    for (const r of fin.rangees) {
      expect(r.chiffre.taille).toBeGreaterThanOrEqual(PLANCHER_PX);
      expect(r.legende!.taille).toBeGreaterThanOrEqual(PLANCHER_PX);
    }
  });
  it("hors de 2 à 4 chiffres : alerte", () => {
    expect(planBandeau([chiffres[0]], 5).alertes.some((a) => /2 à 4/.test(a))).toBe(true);
  });
});

describe("K13 · repère de progression", () => {
  const changements = [
    { t: 0, numero: 1 },
    { t: 10, numero: 2 },
    { t: 20, numero: 3 },
  ];
  it("« 2/3 » après le 2ᵉ changement, l'ancien « 1/3 » sort pendant la bascule, segments remplis", () => {
    expect(planRepere(changements, 3, -1)).toBeNull();
    const r = planRepere(changements, 3, 10.1)!;
    expect(r.texte).toBe("2/3");
    expect(r.ancien).toBe("1/3");
    expect(r.bascule).toBeGreaterThan(0);
    expect(r.bascule).toBeLessThan(1);
    expect(planRepere(changements, 3, 12)!.segments).toEqual([1, 1, 0]);
    expect(planRepere(changements, 3, 12)!.taille).toBeGreaterThanOrEqual(PLANCHER_PX);
    expect(planRepere([{ t: 0, numero: 3 }], 5, 1, "Étape")!.texte).toBe("Étape 3/5");
  });
});

describe("K14 · recherche", () => {
  it("le texte se tape, puis « Trouvé — 3 secondes » et la coche", () => {
    const p = { requete: "bon de commande Martin", debut: 1, trouve: { texte: "Trouvé — 3 secondes", t: 3 } };
    expect(planRecherche(p, 0.9).frappe.texte).toBe("");
    const tape = planRecherche(p, 1.3).frappe.texte;
    expect(tape.length).toBeGreaterThan(0);
    expect("bon de commande Martin".startsWith(tape)).toBe(true);
    expect(planRecherche(p, 2.5).frappe).toMatchObject({ texte: "bon de commande Martin", fini: true });
    expect(planRecherche(p, 2.9).resultat).toBe(0);
    expect(planRecherche(p, 4).resultat).toBe(1);
    expect(planRecherche(p, 4).alertes).toEqual([]);
  });
});

describe("K15 · alerte Telegram", () => {
  it("la notification tombe, l'écran tremble à l'arrivée (amorti, borné), puis se calme", () => {
    const p = { source: "Telegram", moment: "maintenant", message: "Intervention requise", t: 1 };
    expect(planAlerte(p, 0.9).opacite).toBe(0);
    expect(planAlerte(p, 1.1).decalageY).toBeLessThan(0);
    expect(planAlerte(p, 2.5).decalageY).toBeCloseTo(0, 9);
    expect(planAlerte(p, 2.5).etiquette).toBe("Telegram · maintenant");
    expect(planAlerte(p, 2.5).alertes).toEqual([]);
    expect(secousseAlerte(1.2, 1)).toEqual({ x: 0, y: 0 });
    expect(secousseAlerte(2, 1)).toEqual({ x: 0, y: 0 });
    const pendant = [1.4, 1.5, 1.6].map((t) => secousseAlerte(t, 1));
    expect(pendant.some((s) => s.x !== 0)).toBe(true);
    for (const s of pendant) expect(Math.abs(s.x)).toBeLessThanOrEqual(18);
  });
});

describe("K16 · e-mail structuré", () => {
  it("les lignes se remplissent chacune sur son mot ; sans valeur sur l'image, aucun texte inventé", () => {
    const champs = [
      { nom: "Objet", t: 1 },
      { nom: "Contexte", t: 2 },
      { nom: "Demande", t: 3 },
      { nom: "Urgence", t: 4 },
    ];
    const m = planEmail({ champs, debut: 0.5 }, 2.2);
    expect(m.champs.map((c) => c.nom)).toEqual(["Objet", "Contexte", "Demande", "Urgence"]);
    expect(m.champs.map((c) => c.remplissage > 0)).toEqual([true, true, false, false]);
    expect(m.champs.every((c) => c.valeur === null && c.frappe === null)).toBe(true);
    expect(m.alertes).toEqual([]);
    const avecValeur = planEmail({ champs: [{ nom: "Objet", valeur: "Commande en retard", t: 1 }], debut: 0 }, 5);
    expect(avecValeur.champs[0].frappe!.texte).toBe("Commande en retard");
    expect(avecValeur.champs[0].valeur!.taille).toBeGreaterThanOrEqual(PLANCHER_PX);
  });
});

describe("K17 · dossiers", () => {
  it("4 dossiers en 2 × 2 ; chaque feuille vole dans le sien sur son mot ; noms au plancher", () => {
    const dossiers = lire("E").noeuds.find((n) => n.id === "n09")!.sousElements!.map((nom, i) => ({ nom, t: 2 + i }));
    const p = (t: number) => planDossiers({ dossiers, debut: 1 }, t);
    expect(p(1.9).dossiers[0].feuille.visible).toBe(true);
    expect(p(2.3).dossiers[0].rangee).toBe(true);
    expect(p(2.3).dossiers[1].rangee).toBe(false);
    const fin = p(9);
    expect(fin.alertes).toEqual([]);
    expect(fin.dossiers.every((d) => d.rangee && d.ouverture === 0)).toBe(true);
    for (const d of fin.dossiers) {
      expect(d.cote).toBeGreaterThan(150);
      expect(d.nom.taille).toBeGreaterThanOrEqual(PLANCHER_PX);
      expect(d.y + d.cote * 0.78 + 22 + d.nom.lignes.length * d.nom.taille * 1.1).toBeLessThanOrEqual(BAS_ZONE.bas + 1e-6);
    }
    const rects = fin.dossiers.map((d, i) => ({ id: String(i), x: d.cx - d.cote / 2, y: d.y, largeur: d.cote, hauteur: d.cote }));
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) expect(chevauche(rects[i], rects[j])).toBe(false);
  });
});

describe("K18 · sources", () => {
  it("une source par mot, la feuille glisse jusqu'à la cible qui bat ; un nom trop long au plancher lève une alerte", () => {
    const sources = ["mail", "document", "document", "message", "document"].map((icone, i) => ({ icone, t: 1 + i * 0.5 }));
    const p = (t: number) => planSources({ sources, cible: { icone: "etincelles" } }, t);
    expect(p(0.8).sources.map((s) => s.entree > 0)).toEqual([false, false, false, false, false]);
    expect(p(1.6).sources[0].feuille.visible).toBe(true);
    expect(p(9).cible.recus).toBe(5);
    expect(p(9).alertes).toEqual([]);
    // En quinconce, chaque nom a la largeur de deux cases : « WhatsApp » tient au plancher ; un nom trop long alerte.
    const nommees = planSources({ sources: sources.map((s, i) => ({ ...s, nom: ["Email", "Scan", "Drive", "WhatsApp", "USB"][i] })), cible: { icone: "etincelles" } }, 9);
    expect(nommees.alertes).toEqual([]);
    expect(nommees.sources[1].y).toBeGreaterThan(nommees.sources[0].y);
    const long = planSources({ sources: sources.map((s, i) => ({ ...s, nom: i === 3 ? "Messagerie interne de l'entreprise" : "Mail" })), cible: { icone: "etincelles" } }, 9);
    expect(long.alertes.some((a) => a.includes("Messagerie"))).toBe(true);
  });
});

describe("K19 · phrase-choc mot à mot avec lueur", () => {
  for (const nom of ["A", "B", "C", "D", "E", "F"]) {
    it(`${nom} : tous les mots, dans l'ordre, au plancher ou au-dessus, 4 lignes au plus`, () => {
      const phrase = lire(nom).phraseChoc;
      const p = planPhraseChoc({ phrase, debut: 0 }, 60);
      expect(p.alertes).toEqual([]);
      expect(p.taille).toBeGreaterThanOrEqual(PLANCHER_PX);
      expect(p.lignes.length).toBeLessThanOrEqual(4);
      expect(p.lignes.flat().map((m) => m.mot)).toEqual(motsBalises(phrase).map((m) => m.mot));
      expect(p.lignes.flat().every((m) => m.opacite === 1)).toBe(true);
    });
  }
  it("chaque mot entre à son heure, le dernier s'allume ensuite, puis la marque apparaît", () => {
    const phrase = "Même à *3h* du matin.";
    const heures = [1, 1.3, 1.6, 1.9, 2.2];
    const tot = planPhraseChoc({ phrase, debut: 0, heures }, 1.6);
    expect(tot.lignes.flat().map((m) => m.opacite > 0)).toEqual([true, true, true, false, false]);
    expect(tot.lueur).toBe(0);
    expect(tot.lignes.flat().find((m) => m.mot === "3h")!.accent).toBe(true);
    const tard = planPhraseChoc({ phrase, debut: 0, heures }, 4);
    expect(tard.lueur).toBe(1);
    expect(tard.marque).toBe(1);
    expect(planPhraseChoc({ phrase, debut: 0, heures: [1, 2] }, 4).alertes.some((a) => /5 mots/.test(a))).toBe(true);
  });
  it("chaque proposition commence une ligne quand la phrase en a plusieurs (« Comprendre. Former. Transformer. »)", () => {
    expect(coupePhraseChoc(["COMPRENDRE.", "FORMER.", "TRANSFORMER."]).lignes).toEqual([["COMPRENDRE."], ["FORMER."], ["TRANSFORMER."]]);
  });
});

describe("K21 · scène « Ensemble » : tout le schéma, lisible, sans texte sous le plancher", () => {
  for (const nom of ["C", "faux-16-noeuds"]) {
    it(`${nom} : chaque nœud a son bloc, dans la zone utile et les marges, sans chevauchement ; libellés ≤ 3 mots et ≥ plancher`, () => {
      const carte = lire(nom);
      const p = planEnsemble(carte);
      // 25/10/2026 (D3, compositions-iv/12) : l'écart minimal entre rangées est de 16 px. Ordre des remèdes : vue serrée (chiffres-clés gardés), puis
      // retrait des chiffres-clés (alerte), puis paires, puis vue réduite (libellés raccourcis, alerte). Voir « D3 · alertes exactes » plus bas.
      expect(p.ecart).toBeGreaterThanOrEqual(16);
      expect(p.blocs.map((x) => x.id).sort()).toEqual(carte.noeuds.map((n) => n.id).sort());
      for (const x of p.blocs) {
        expect(x.x).toBeGreaterThanOrEqual(0.05 * W - 1e-6);
        expect(x.x + x.largeur).toBeLessThanOrEqual(0.95 * W + 1e-6);
        expect(x.y).toBeGreaterThanOrEqual(BAS_ZONE.haut - 1e-6);
        expect(x.y + x.hauteur).toBeLessThanOrEqual(BAS_ZONE.bas + 1e-6);
        expect(x.libelle.taille).toBeGreaterThanOrEqual(PLANCHER_PX);
        expect(x.libelle.lignes.length).toBeGreaterThan(0);
      }
      const tous = [...p.blocs.map((b) => ({ ...b })), ...p.chiffres.map((c) => ({ id: c.texte, x: c.x, y: c.y, largeur: c.largeur, hauteur: c.hauteur }))];
      for (let i = 0; i < tous.length; i++) for (let j = i + 1; j < tous.length; j++) expect(chevauche(tous[i], tous[j]), `${tous[i].id}/${tous[j].id}`).toBe(false);
      for (const c of p.chiffres) {
        expect(nombreDeMots(c.texte)).toBeLessThanOrEqual(3);
        expect(c.taille * H).toBeGreaterThanOrEqual(PLANCHER_PX);
      }
    });
  }
  // D3 (25/10/2026, compositions-iv/12) : LISTE EXACTE des alertes de chaque carte (la zone utile fait 605 px : avec 16 px entre rangées, les
  // chiffres-clés de A, C, E et F ne tiennent pas même en vue serrée ; ils restent montrés quand ils sont dits). Chaque libellé raccourci est signalé.
  const RETIRE = (t: string) => `« ${t} » : chiffre-clé retiré de la vue d'ensemble (place) ; il reste montré quand il est dit.`;
  const RACCOURCI = (id: string, de: string, vers: string) => `Libellé de ${id} raccourci (vue réduite, place) : « ${de} » → « ${vers} ».`;
  const ATTENDU: Record<string, string[]> = {
    A: [RETIRE("1er jour")],
    B: [],
    C: [RETIRE("2h"), RETIRE("4 sec"), RETIRE("23h14"), RACCOURCI("n08", "Envoyé équipe concernée", "Envoyé équipe")],
    D: [],
    E: [RETIRE("3 secondes"), RETIRE("23 min"), RACCOURCI("n06", "Documents en vrac", "Documents"), RACCOURCI("n10", "Bon de commande", "Bon")],
    F: [RETIRE("5 min"), RETIRE("6 min"), RETIRE("8 min"), RACCOURCI("n01", "Commande reçue", "Commande")],
  };
  for (const nom of Object.keys(ATTENDU)) {
    it(`D3 · carte ${nom} : alertes exactes, écart ≥ 16, libellés identiques au texte de la carte sauf ceux signalés`, () => {
      const carte = lire(nom);
      const p = planEnsemble(carte);
      expect([...p.alertes].sort()).toEqual([...ATTENDU[nom]].sort());
      expect(p.ecart).toBeGreaterThanOrEqual(16);
      for (const b of p.blocs) {
        // Un mot abrégé faute de place (compositions-iv/13) est comparé au texte abrégé DÉCLARÉ dans `abrege`.
        const attendu = b.libelle.abrege?.[0]?.apres ?? libelleCourt(carte.noeuds.find((n) => n.id === b.id)!).toUpperCase();
        const pose = b.libelle.lignes.map((l) => l.join(" ")).join(" ");
        if (pose !== attendu) expect(p.alertes.some((a) => a.startsWith(`Libellé de ${b.id} raccourci`)), `${b.id} raccourci sans alerte`).toBe(true);
      }
    });
  }

  it("C : les parts « 80 % » et « 20 % » en tête de leur branche, à sa couleur (orange à gauche)", () => {
    const s = sceneGalerieC();
    const p = planEnsemble(s.schema, { chiffresCles: ["20 %", "80 %"] });
    expect(p.chiffres.map((c) => c.texte)).toEqual(["80 %", "20 %"]);
    expect(p.chiffres[0].x).toBeLessThan(p.chiffres[1].x);
    expect(p.chiffres[0].couleur).not.toBe(p.chiffres[1].couleur);
    const n03 = p.blocs.find((b) => b.id === "n03")!;
    expect(p.chiffres[0].y + p.chiffres[0].hauteur).toBeLessThanOrEqual(n03.y);
  });
  it("faux schéma : bloc courant allumé, le reste atténué ; même résultat 20 fois", () => {
    const carte = lire("faux-16-noeuds");
    const allumes = ["n07", "n08", "n09", "n10"];
    const p = planEnsemble(carte, { allumes });
    expect(p.blocs.filter((x) => x.allume).map((x) => x.id).sort()).toEqual(allumes);
    const premier = JSON.stringify(planEnsemble(carte, { allumes }).blocs);
    for (let i = 0; i < 20; i++) expect(JSON.stringify(planEnsemble(carte, { allumes }).blocs)).toBe(premier);
  });
});

/** Alertes d'INFORMATION de la vue d'ensemble (chiffre-clé retiré, libellé raccourci : listées carte par carte dans « D3 · carte »), pas des défauts de lisibilité. */
const informative = (a: string) => !/chiffre-clé retiré de la vue d'ensemble|raccourci \(vue réduite/.test(a);

describe("galeries L9a (A, B, objets de C et E)", () => {
  it("aucune alerte de lisibilité, à aucun moment", () => {
    for (const g of [galerieA(), galerieB(), galerieObjets()]) for (const m of g.moments) expect(alertesDuMoment(m).filter(informative), `${m.sorte} ${m.debut}`).toEqual([]);
  });
  it("moments contigus, du début à la fin de la vidéo ; repère « 2/3 » visible dans la galerie des objets", () => {
    for (const g of [galerieA(), galerieB(), galerieObjets()]) {
      expect(g.moments[0].debut).toBe(0);
      for (let i = 1; i < g.moments.length; i++) expect(g.moments[i].debut).toBe(g.moments[i - 1].fin);
      expect(g.moments[g.moments.length - 1].fin).toBe(g.dureeSec);
    }
    const o = galerieObjets();
    expect(planRepere(o.repere!.changements, o.repere!.total, 12)!.texte).toBe("2/3");
  });
  it("phrases-chocs et alerte : textes exacts des cartes", () => {
    const phrase = (g: ReturnType<typeof galerieA>) => (g.moments.find((m) => m.sorte === "phrase-choc") as Extract<MomentGalerie, { sorte: "phrase-choc" }>).phrase.replace(/\*/g, "");
    expect(phrase(galerieA())).toBe(lire("A").phraseChoc);
    expect(phrase(galerieB())).toBe(lire("B").signature ?? lire("B").phraseChoc);
    expect(phrase(galerieObjets())).toBe(lire("C").phraseChoc);
    const alerte = galerieObjets().moments.find((m) => m.sorte === "alerte") as Extract<MomentGalerie, { sorte: "alerte" }>;
    expect(lire("C").noeuds.find((n) => n.id === "n09")!.detail).toContain(alerte.message);
    const e = lire("E").noeuds;
    const recherche = galerieObjets().moments.find((m) => m.sorte === "recherche") as Extract<MomentGalerie, { sorte: "recherche" }>;
    expect(recherche.requete).toBe(e.find((n) => n.id === "n10")!.libelle);
    expect(recherche.trouve!.texte).toBe(e.find((n) => n.id === "n11")!.libelle);
  });
});
