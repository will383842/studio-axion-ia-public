/**
 * Brique `ecrans-motion` (B1c) : zone de texte et zone de dessin, bande des sous-titres réglable, réduction uniforme,
 * cibles d'ampleur de la vidéo de référence dans la zone commune aux quatre réseaux.
 */
import { describe, expect, it } from "vitest";
import {
  BANDE_SOUS_TITRES,
  boiteDans,
  controlerProprietes,
  disposer,
  largeurTexte,
  proprietesEcrans,
  REDUCTION_MIN,
  REDUCTION_OBJET_MIN,
  sansBalises,
  TYPES_ECRAN,
  ZONE_DESSIN,
  zonesEcran,
  zoneUtile,
  type EcranCale,
  type ProprietesEcran,
  type ZoneProtegeePct,
} from "../../../src/briques/ecrans-motion";
import { TAILLES_DUO } from "../../../src/briques/habillage/charte-duo";
import { zoneProtegeeCombinee } from "../../../src/reseaux";

const RESEAUX = ["facebook", "instagram", "tiktok", "linkedin"] as const;
const QUATRE = zoneProtegeeCombinee("9:16", [...RESEAUX])!;
/** Bande demandée par le format « Cas concret MD » : une ligne courte, 8 % de la hauteur. */
const BANDE = 0.08;

/** Un écran de chaque type avec les textes de la vidéo de référence ; l'écran `objet` montre un vrai écran. */
const CONTENUS = [
  { type: "accroche", etiquette: "Recrutement · cas réel", lignes: ["On recrute", "nos collaborateurs", "*en…*"] },
  { type: "chiffre", nombre: 15, unite: "minutes.", pastilles: ["0 CV à trier", "0 relance", "0 papier"], compteur: false },
  { type: "liste-avant", etiquette: "Avant", titre: "C'était *ça.*", taches: ["Trier les candidatures", "Répondre à chacun", "Relancer", "Caler un rendez-vous"], total: { valeur: "+1 H", ligne: "pour chaque personne" } },
  { type: "titre", lignes: ["Alors on a", "tout *automatisé.*"] },
  { type: "etape", numero: 2, nombreEtapes: 6, titre: "L'*inscription*", ligne: "Toute seule. En vingt secondes.", visuel: { capture: { cle: "form" } }, puces: ["Inscrite", "Réservé sans nous"] },
  { type: "objet", titre: "Le *rendez-vous*", ligne: "Elle le choisit elle-même.", visuel: { capture: { cle: "form" } } },
  { type: "preuve", etiquette: "Et les données ?", titre: "Conforme *RGPD.*", puces: ["100 % automatique", "0 intervention manuelle"] },
  { type: "resultat", etiquette: "Résultat", titre: "Des heures *gagnées.*", avant: "+1 H", maintenant: "15 MIN", ligne: "à chaque recrutement" },
  { type: "question", lignes: ["Et dans votre", "*entreprise ?*"], question: "Quelle tâche pourrait tourner toute seule ?" },
  { type: "appel-mot", etiquette: "Pour la recevoir", invite: "Écrivez", mot: "DIAGNOSTIC", suite: "en *commentaire.*" },
  { type: "promesse", invite: "On vous envoie", cadeau: "*toute la structure*", ligne: "de cette automatisation, à mettre en place chez vous" },
  { type: "lien", etiquette: "Ou", titre: "Réservez votre *diagnostic gratuit*", lien: "Lien en premier commentaire", signature: "Axion-*IA*" },
  { type: "chiffre", nombre: 0, unite: "minutes", pastilles: [], compteur: true },
].map((c, i) => ({ id: `e${String(i + 1).padStart(2, "0")}`, fond: "sombre", debutMs: 0, finMs: 3000, evenements: [], ...c }) as EcranCale);
const CAPTURES = { form: { src: "captures/form.png", cle: "form", sorte: "image" as const, largeur: 1080, hauteur: 1920 } };

const ecrans = (zone: ZoneProtegeePct, bande = BANDE) => proprietesEcrans({ ecrans: CONTENUS, captures: CAPTURES, zoneProtegee: zone, bandeSousTitres: bande });
const ZONES: [string, ZoneProtegeePct][] = [...RESEAUX.map((r) => [r, zoneProtegeeCombinee("9:16", [r])!] as [string, ZoneProtegeePct]), ["union des quatre", QUATRE]];

describe("zones", () => {
  it("la bande des sous-titres reste de 14 % par défaut", () => {
    expect(BANDE_SOUS_TITRES).toBe(0.14);
    expect(zoneUtile(QUATRE, 1080, 1920).hauteur).toBeCloseTo(1920 * (1 - 0.44 - 0.14), 6);
    const sansBande = proprietesEcrans({ ecrans: CONTENUS.slice(0, 1), captures: {}, zoneProtegee: QUATRE });
    expect(sansBande[0].zone).toEqual(zoneUtile(QUATRE, 1080, 1920));
  });

  it("zone de texte = zone sûre ; bande de 8 % à son bas ; zone de dessin à 4 % des côtés et 86 % de la hauteur", () => {
    const z = zonesEcran(QUATRE, 1080, 1920, BANDE);
    expect(z.texte).toEqual(zoneUtile(QUATRE, 1080, 1920, 0));
    expect(z.texte.y + z.texte.hauteur).toBeCloseTo(1920 * 0.7, 6);
    expect(z.sousTitres.hauteur).toBeCloseTo(1920 * BANDE, 6);
    expect(z.sousTitres.y + z.sousTitres.hauteur).toBeCloseTo(z.texte.y + z.texte.hauteur, 6);
    expect(z.utile.y + z.utile.hauteur).toBeCloseTo(z.sousTitres.y, 6);
    expect(ZONE_DESSIN).toEqual({ cotes: 0.04, bas: 0.86 });
    expect(z.dessin.x).toBeCloseTo(1080 * 0.04, 6);
    expect(z.dessin.x + z.dessin.largeur).toBeCloseTo(1080 * 0.96, 6);
    expect(z.dessin.y).toBe(z.texte.y);
    expect(z.dessin.y + z.dessin.hauteur).toBeCloseTo(1920 * 0.86, 6);
    // Jamais plus étroite que la zone de texte.
    const large = zonesEcran({ haut: 0, droite: 0, bas: 0, gauche: 0 }, 1080, 1920, BANDE);
    expect(boiteDans(large.texte, large.dessin)).toBe(true);
  });
});

describe.each(ZONES)("zone %s, bande de 8 %%", (_, zone) => {
  const sure = zonesEcran(zone, 1080, 1920, BANDE);
  const props = ecrans(zone);

  it.each(props.map((p) => [p.id, p.type, p] as const))("%s (%s) : tout texte porteur de sens dans la zone de texte, au-dessus des sous-titres", (_id, _type, p) => {
    const { textes, boites } = disposer(p);
    expect(p.zone).toEqual(sure.utile);
    expect(p.dessin).toEqual(sure.dessin);
    for (const t of textes) {
      expect(boiteDans(t.boite, sure.utile), `${p.type} · ${t.nom}`).toBe(true);
      expect(boiteDans(t.boite, sure.texte), `${p.type} · ${t.nom}`).toBe(true);
      expect(t.tient, `${p.type} · ${t.nom} : « ${sansBalises(t.texte)} »`).toBe(true);
    }
    for (const o of boites.objets) expect(boiteDans(o.boite, o.porteTexte ? sure.utile : sure.dessin), `${p.type} · ${o.nom}`).toBe(true);
    if (boites.fil) expect(boiteDans(boites.fil, sure.dessin)).toBe(true);
    expect(controlerProprietes(p), p.type).toEqual([]);
  });

  it("réduction uniforme : textes au plus jusqu'à 0,6, objets jamais sous 85 % du rapport des textes", () => {
    for (const p of props) {
      const { reduction } = disposer(p).boites;
      expect(reduction.textes, p.type).toBeGreaterThanOrEqual(REDUCTION_MIN);
      expect(reduction.textes, p.type).toBeLessThanOrEqual(1);
      expect(reduction.objets, p.type).toBeGreaterThanOrEqual(REDUCTION_OBJET_MIN * reduction.textes - 1e-9);
      expect(reduction.objets, p.type).toBeLessThanOrEqual(reduction.textes + 1e-9);
    }
  });
});

describe("cibles d'ampleur (zone commune aux quatre réseaux, 1080 × 1920)", () => {
  const props = ecrans(QUATRE);
  const de = <T extends ProprietesEcran["type"]>(type: T) => props.find((p) => p.type === type)!;

  it("le téléphone de l'écran `objet` (vrai écran) fait au moins 700 px de haut", () => {
    const visuel = disposer(de("objet")).boites.objets.find((o) => o.nom === "visuel")!.boite;
    // Le téléphone (470 × 920 dans la référence) est cadré dans la boîte, élargie au besoin à la zone de dessin.
    const hauteurTelephone = Math.min(visuel.hauteur, (Math.max(visuel.largeur, de("objet").zone.largeur) * 920) / 470);
    expect(hauteurTelephone).toBeGreaterThanOrEqual(700);
  });

  it("le nombre de l'écran `chiffre` occupe au moins 60 % de la largeur de la zone de texte", () => {
    const p = de("chiffre");
    const nombre = disposer(p).textes.find((t) => t.nom === "nombre")!;
    const z = zonesEcran(QUATRE, 1080, 1920, BANDE);
    expect(largeurTexte("15", "anton", nombre.tailleRendue)).toBeGreaterThanOrEqual(0.6 * z.texte.largeur);
  });

  it("la première ligne de l'accroche garde au moins 0,7 fois sa taille de référence", () => {
    const titre = disposer(de("accroche")).textes.find((t) => t.nom === "titre-1")!;
    expect(titre.tailleRendue).toBeGreaterThanOrEqual(0.7 * TAILLES_DUO.affiche * 1920);
  });

  it("les objets sans texte des écrans `etape` et `objet` débordent sous la zone de texte ; aucun objet qui porte un texte", () => {
    const debordent = props.flatMap((p) => disposer(p).boites.objets.filter((o) => o.boite.y + o.boite.hauteur > p.zone.y + p.zone.hauteur + 0.01).map((o) => ({ type: p.type, nom: o.nom, porte: o.porteTexte })));
    expect(debordent).toEqual([
      { type: "etape", nom: "visuel", porte: false },
      { type: "objet", nom: "visuel", porte: false },
    ]);
  });
});

describe("contrôle avant rendu", () => {
  it("sans zone de dessin, les objets restent dans la zone utile ; un texte hors de la zone utile est refusé", () => {
    const p = ecrans(QUATRE).find((x) => x.type === "objet")!;
    const sansDessin = { ...p };
    delete sansDessin.dessin;
    expect(controlerProprietes(sansDessin)).toEqual([]);
    for (const o of disposer(sansDessin).boites.objets) expect(boiteDans(o.boite, p.zone)).toBe(true);
    const r = ecrans(QUATRE).find((x) => x.type === "resultat")!;
    expect(controlerProprietes({ ...r, zone: { ...r.zone, hauteur: r.zone.hauteur * 0.5 } }).join(" ")).toMatch(/hors de la zone utile/);
  });

  it("les écrans essayés couvrent les 12 types", () => {
    expect(new Set(ecrans(QUATRE).map((p) => p.type))).toEqual(new Set(TYPES_ECRAN));
  });
});
