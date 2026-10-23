/** Brique `ecrans-motion` (B1b) : zone utile, boîtes des 12 types, propriétés des écrans, contrôle avant rendu. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BANDE_SOUS_TITRES,
  boiteDans,
  boites,
  charteDuoPour,
  controlerProprietes,
  disposer,
  imagesEcran,
  proprietesEcrans,
  textesEcran,
  TYPES_ECRAN,
  zonesEcran,
  zoneUtile,
  type EcranCale,
  type ProprietesEcran,
} from "../../../src/briques/ecrans-motion";
import { TAILLE_PLANCHER_DUO } from "../../../src/briques/habillage/charte-duo";
import { zoneProtegeeCombinee } from "../../../src/reseaux";

const QUATRE = zoneProtegeeCombinee("9:16", ["facebook", "instagram", "tiktok", "linkedin"])!;

/** Un écran de chaque type, avec les textes de la vidéo de référence (les plus longs pour chaque boîte). */
const CONTENUS: EcranCale[] = [
  { type: "accroche", etiquette: "Recrutement · cas réel", lignes: ["On recrute", "nos collaborateurs", "*en…*"] },
  { type: "chiffre", nombre: 15, unite: "minutes.", pastilles: ["0 CV à trier", "0 relance", "0 papier"], compteur: false },
  { type: "liste-avant", etiquette: "Avant", titre: "C'était *ça.*", taches: ["Trier les candidatures", "Répondre à chacun", "Relancer", "Caler un rendez-vous"], total: { valeur: "+1 H", ligne: "pour chaque personne" } },
  { type: "titre", lignes: ["Alors on a", "tout *automatisé.*"] },
  { type: "etape", numero: 2, nombreEtapes: 6, titre: "L'*inscription*", ligne: "Toute seule. En vingt secondes.", visuel: { capture: { cle: "form" } }, puces: ["Inscrite", "Réservé sans nous"] },
  { type: "objet", titre: "Dossier *classé.*", ligne: "Le rappel part tout seul.", visuel: { objet: "dossier-classe" } },
  { type: "preuve", etiquette: "Et les données ?", titre: "Conforme *RGPD.*", puces: ["100 % automatique", "0 intervention manuelle"] },
  { type: "resultat", etiquette: "Résultat", titre: "Des heures *gagnées.*", avant: "+1 H", maintenant: "15 MIN", ligne: "à chaque recrutement" },
  { type: "question", lignes: ["Et dans votre", "*entreprise ?*"], question: "Quelle tâche pourrait tourner toute seule ?" },
  { type: "appel-mot", etiquette: "Pour la recevoir", invite: "Écrivez", mot: "IA", suite: "en *commentaire.*" },
  { type: "promesse", invite: "On vous envoie", cadeau: "*toute la structure*", ligne: "de cette automatisation, à mettre en place chez vous" },
  { type: "lien", etiquette: "Ou", titre: "Réservez votre *diagnostic gratuit*", lien: "Lien en premier commentaire", signature: "Axion-*IA*" },
].map((c, i) => ({ id: `e${String(i + 1).padStart(2, "0")}`, fond: i % 2 ? "ivoire" : "sombre", debutMs: i * 3000, finMs: i * 3000 + 2800, evenements: [{ cible: "ligne", ms: i * 3000 + 400 }], ...c }) as EcranCale);

const CAPTURES = { form: { src: "captures/form.png", cle: "form", sorte: "image" as const, largeur: 1080, hauteur: 2340 } };

const ecrans = (zone = QUATRE) => proprietesEcrans({ ecrans: CONTENUS, captures: CAPTURES, zoneProtegee: zone });

describe("zone utile", () => {
  it("zone sûre moins la bande des sous-titres (14 % de la hauteur)", () => {
    expect(QUATRE).toEqual({ haut: 14, droite: 18, bas: 30, gauche: 6 });
    const z = zoneUtile(QUATRE, 1080, 1920);
    expect(z.x).toBeCloseTo(64.8, 6);
    expect(z.y).toBeCloseTo(268.8, 6);
    expect(z.largeur).toBeCloseTo(1080 * 0.76, 6);
    expect(z.hauteur).toBeCloseTo(1920 * (1 - 0.44 - BANDE_SOUS_TITRES), 6);
    expect(zoneUtile({ haut: 0, droite: 0, bas: 0, gauche: 0 }, 1080, 1920)).toEqual({ x: 0, y: 0, largeur: 1080, hauteur: 1920 * 0.86 });
  });
});

describe("boîtes des 12 types", () => {
  const zone = zoneUtile(QUATRE, 1080, 1920);
  const charte = charteDuoPour(1920);

  it.each([...TYPES_ECRAN])("%s : toutes les boîtes (marque, textes, objets, fil) dans la zone utile des 4 réseaux", (type) => {
    for (const options of [{}, { lignes: 1, puces: 0, taches: 2, pastilles: 0 }, { lignes: 3, puces: 2, taches: 4, pastilles: 3 }]) {
      const b = boites(type, zone, charte, options);
      expect(boiteDans(b.marque.boite, zone)).toBe(true);
      expect(b.marque.boite.y).toBe(Math.round(zone.y * 100) / 100);
      for (const t of b.textes) {
        expect(boiteDans(t.boite, zone), `${type} · ${t.nom}`).toBe(true);
        expect(t.taille, `${type} · ${t.nom}`).toBeGreaterThan(0);
        if (t.soumisAuPlancher) expect(t.taille, `${type} · ${t.nom} au plancher`).toBeGreaterThanOrEqual(TAILLE_PLANCHER_DUO * 1920 - 0.01);
      }
      for (const o of b.objets) expect(boiteDans(o.boite, zone), `${type} · ${o.nom}`).toBe(true);
      if (b.fil) expect(boiteDans(b.fil, zone)).toBe(true);
    }
  });

  it("les boîtes de texte d'un même écran ne se chevauchent pas verticalement (hors objets)", () => {
    for (const type of TYPES_ECRAN) {
      const b = boites(type, zone, charte);
      const libres = [b.marque, ...b.textes].filter((t) => !b.objets.some((o) => boiteDans(t.boite, { ...o.boite, x: zone.x, largeur: zone.largeur })));
      const tries = [...libres].sort((p, q) => p.boite.y - q.boite.y);
      for (let i = 1; i < tries.length; i++) expect(tries[i].boite.y, `${type} · ${tries[i].nom}`).toBeGreaterThanOrEqual(tries[i - 1].boite.y + tries[i - 1].boite.hauteur - 0.02);
    }
  });

  it("sur une zone plus large (un seul réseau), les textes gardent la taille de la charte", () => {
    // B1c : textes et objets réduisent ensemble ; avec sa zone de dessin, l'étape tient sans réduire sur LinkedIn.
    const large = zonesEcran(zoneProtegeeCombinee("9:16", ["linkedin"])!, 1080, 1920);
    const b = boites("etape", large.utile, charte, {}, { dessin: large.dessin });
    expect(b.reduction).toEqual({ textes: 1, objets: 1 });
    expect(b.textes.find((t) => t.nom === "titre")!.taille).toBeCloseTo(0.099 * 1920, 6);
    const quatre = zonesEcran(QUATRE, 1080, 1920);
    expect(b.objets[0].boite.hauteur).toBeGreaterThan(boites("etape", quatre.utile, charte, {}, { dessin: quatre.dessin }).objets[0].boite.hauteur);
  });
});

describe("propriétés des écrans", () => {
  it("une propriété par écran, 25 i/s, la marque, la zone, les événements depuis le début de l'écran", () => {
    const p = ecrans();
    expect(p).toHaveLength(12);
    expect(p.map((x) => x.type)).toEqual([...TYPES_ECRAN]);
    for (const [i, x] of p.entries()) {
      expect(x.fps).toBe(25);
      expect(x.marque).toBe("axion-ia.com");
      expect([x.largeur, x.hauteur]).toEqual([1080, 1920]);
      expect(x.zone).toEqual(zoneUtile(QUATRE, 1080, 1920));
      expect(x.evenements).toEqual([{ cible: "ligne", ms: 400 }]);
      expect(imagesEcran(x)).toBe(70);
      expect(x.id).toBe(CONTENUS[i].id);
    }
    const etape = p[4];
    expect(etape.type === "etape" && etape.visuel).toEqual({ capture: CAPTURES.form });
  });

  it("une capture inconnue est refusée avec un message clair", () => {
    expect(() => proprietesEcrans({ ecrans: [CONTENUS[4]], captures: {}, zoneProtegee: QUATRE })).toThrow(/capture « form » est introuvable/);
  });

  it("les textes de chaque boîte", () => {
    const p = ecrans();
    expect(textesEcran(p[0])).toMatchObject({ marque: "axion-ia.com", etiquette: "Recrutement · cas réel", "titre-2": "nos collaborateurs" });
    expect(textesEcran(p[4])).toMatchObject({ etiquette: "Étape 02", titre: "L'*inscription*", "puce-2": "Réservé sans nous" });
  });

  it("les 12 écrans de la référence passent le contrôle dans la zone des 4 réseaux", () => {
    for (const p of ecrans()) expect(controlerProprietes(p), p.type).toEqual([]);
  });

  it("chaque texte posé tient dans sa boîte, au plancher ou au-dessus", () => {
    for (const p of ecrans()) {
      for (const t of disposer(p).textes) {
        expect(t.tient, `${p.type} · ${t.nom}`).toBe(true);
        if (t.soumisAuPlancher) expect(t.tailleRendue).toBeGreaterThanOrEqual(TAILLE_PLANCHER_DUO * 1920 - 0.01);
      }
    }
  });

  it("déterministe", () => {
    expect(JSON.stringify(ecrans())).toBe(JSON.stringify(ecrans()));
    expect(JSON.stringify(ecrans().map(disposer))).toBe(JSON.stringify(ecrans().map(disposer)));
  });
});

describe("controlerProprietes : refus en français", () => {
  const base = () => ecrans();

  it("refuse une marque vide", () => {
    const p = { ...base()[0], marque: "" } as unknown as ProprietesEcran;
    expect(controlerProprietes(p)).toContain("Écran e01 · la marque est absente.");
  });

  it("refuse une durée nulle", () => {
    const p = { ...base()[1], finMs: base()[1].debutMs };
    expect(controlerProprietes(p)).toContain("Écran e02 · durée nulle.");
  });

  it("refuse une capture sans dimensions", () => {
    const e = base()[4];
    const p = { ...e, visuel: { capture: { ...CAPTURES.form, largeur: 0 } } } as ProprietesEcran;
    expect(controlerProprietes(p)).toContain("Écran e05 · capture sans dimensions.");
  });

  it("refuse un titre qui ne tient pas, même au plancher", () => {
    const p = { ...base()[3], lignes: ["Anticonstitutionnellement extraordinaire", "tout"] } as ProprietesEcran;
    expect(controlerProprietes(p).join(" ")).toMatch(/Écran e04 · texte qui ne tient pas dans sa boîte \(titre-1/);
  });

  it("refuse un texte sous le plancher", () => {
    const p = base()[3];
    // Image très basse : la charte demande alors un plancher plus grand que la boîte ne peut porter.
    const ecrase = { ...p, zone: { ...p.zone, hauteur: 120 } } as ProprietesEcran;
    expect(controlerProprietes(ecrase).join(" ")).toMatch(/sous le plancher|hors de la zone utile/);
  });
});

describe("image de rendu", () => {
  it("la brique est copiée dans l'image, juste après `src/briques/motion`", () => {
    const lignes = readFileSync("deploiement/studio-rendu/Dockerfile", "utf8").split("\n");
    const i = lignes.indexOf("COPY --chown=rendu:rendu src/briques/motion /app/src/briques/motion");
    expect(i).toBeGreaterThan(0);
    expect(lignes[i + 1]).toBe("COPY --chown=rendu:rendu src/briques/ecrans-motion /app/src/briques/ecrans-motion");
    // Elle lit la charte : l'habillage est copié lui aussi.
    expect(lignes).toContain("COPY --chown=rendu:rendu src/briques/habillage /app/src/briques/habillage");
  });
});
