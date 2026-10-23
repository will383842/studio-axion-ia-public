/**
 * FACE CAMÉRA ANIMÉE — DIVERSITÉ DES ANIMATIONS (retour de Will sur la vidéo 5, 15/10 : « c'est presque toujours les
 * mêmes choses qui reviennent en animations… le visage est caché trop tôt au début »). Règles R1 à R7 du directeur
 * artistique, contrôlées dans `regles.ts` (`controlerDiversite`) : un cas rouge par règle, sur le plan de référence de 22 s
 * (seuils ramenés à la durée) et sur des suites d'apparitions de 90 s. Plus : la vraie vidéo 5 (si présente sur ce poste),
 * le catalogue des 15 familles, l'historique `historique-motion.json`. AUCUN appel réseau, aucun rendu.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FAMILLES_MOTION, type MotionPlan, type PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";
import { apparitionsDuPlan, CATALOGUE_FAMILLES, DIVERSITE, FAMILLES, familleDeSon, plafondFamille, ramene } from "@/moteurs/montage-facecam-animee/realisateur/familles";
import { ajouterAHistoriqueMotion, enregistrerHistoriqueMotion, historiqueMotionVide, lireHistoriqueMotion } from "@/moteurs/montage-facecam-animee/realisateur/historique-motion";
import { controlerDiversite, estRendable, historiqueDuPlan, verifierPlan, type HistoriqueVideo } from "@/moteurs/montage-facecam-animee/realisateur/regles";
import { bruitagesDuPlan, SONS_DISPONIBLES } from "@/moteurs/montage-facecam-animee/realisateur/sons";
import { MOTS, planValide } from "./plan-reference";

const copie = (p: PlanFacecamAnimee) => JSON.parse(JSON.stringify(p)) as PlanFacecamAnimee;
const div = (p: PlanFacecamAnimee, historique?: HistoriqueVideo[]) => controlerDiversite(p, { historique }).erreurs;
const avec = (m: (p: PlanFacecamAnimee) => void, historique?: HistoriqueVideo[]) => {
  const p = copie(planValide());
  m(p);
  return div(p, historique);
};
const contient = (liste: string[], morceau: string) => expect(liste.some((e) => e.includes(morceau)), `attendu « ${morceau} » dans :\n${liste.join("\n")}`).toBe(true);
const aucun = (liste: string[], code: string) => expect(liste.filter((e) => e.startsWith(code)), liste.join("\n")).toEqual([]);

/**
 * Plan de 90 s fait d'une SUITE de motions (sans cartes ni fenêtres, pour isoler une règle) : `suite` donne les familles
 * dans l'ordre, une toutes les `pas` secondes, chacune de `duree` secondes. Contenu minimal valide par famille.
 */
function contenuMinimal(f: MotionPlan["famille"], a: number): Record<string, unknown> {
  switch (f) {
    case "mot-geant": return { mots: [{ texte: "Fuite", a }] };
    case "ecran-partage": return { gauche: { titre: "Avant", a }, droite: { titre: "Après", a: a + 0.3 } };
    case "telephone": return { appli: "mail", lignes: [{ texte: "Relance", a }] };
    case "carte-france": return { points: [{ a }, { a: a + 0.3 }] };
    case "pile-notifications": return { notifications: [{ titre: "Devis", icone: "document", a }, { titre: "Relance", icone: "mail", a: a + 0.3 }] };
    case "chiffre-eclate": return { valeur: 45, a };
    case "trait-dessine": return { forme: "souligne", traits: [{ mot: "devis", a }] };
    case "volet": return { titre: "La solution", a };
    case "ruban": return { mots: [{ texte: "Audit", a }, { texte: "Formation", a: a + 0.2 }, { texte: "Conseil", a: a + 0.4 }] };
    case "horloge": return { mode: "horloge", a };
    case "jauge": return { forme: "cadran", legende: "Charge", niveaux: [{ niveau: 0.8, a }] };
    case "bulles": return { questions: [{ texte: "Par où commencer ?", a }] };
  }
}
function planSuite(suite: readonly MotionPlan["famille"][], pas = 2, duree = 1.6, depart = 1, total = 91): PlanFacecamAnimee {
  return {
    ...copie(planValide()),
    duree: total,
    groupes: [],
    cartes: [],
    fenetres: [],
    calques: [],
    motions: suite.map((famille, k) => ({ debut: depart + k * pas, fin: depart + k * pas + duree, famille, illustre: "x", contenu: contenuMinimal(famille, depart + k * pas + 0.1) })),
    fin: { ...planValide().fin, debut: total - 2 },
    sons: [],
  };
}
/** Une rotation des 12 motions qui tient R3 (jamais deux fois de suite, couples qui ne reviennent pas trop tôt). */
const ROTATION_90 = Array.from({ length: 44 }, (_, k) => FAMILLES_MOTION[(k * 5) % 12]);

describe("diversité · le catalogue des 15 familles", () => {
  it("15 familles : fenêtre, étiquette, carte et les 12 motions ; chacune a son bruitage propre, et ses sons existent", () => {
    expect(FAMILLES).toHaveLength(15);
    expect(FAMILLES.slice(0, 3)).toEqual(["fenetre", "etiquette", "carte"]);
    expect(FAMILLES.slice(3)).toEqual([...FAMILLES_MOTION]);
    const sons = FAMILLES.flatMap((f) => CATALOGUE_FAMILLES[f].sons);
    expect(new Set(sons).size).toBe(sons.length);
    for (const s of sons) expect((SONS_DISPONIBLES as readonly string[]).includes(s), s).toBe(true);
    expect(sons.some((s) => s.startsWith("whoosh"))).toBe(false);
    // Couvrent le visage : mot géant, écran partagé, volet (plein écran) ; les autres motions le laissent entier.
    expect(FAMILLES.filter((f) => CATALOGUE_FAMILLES[f].visage === "couvert")).toEqual(["mot-geant", "ecran-partage", "volet"]);
    expect(FAMILLES.filter((f) => CATALOGUE_FAMILLES[f].ouverture)).toEqual(["etiquette", "chiffre-eclate", "trait-dessine", "horloge", "bulles"]);
  });

  it("plafonds pour 90 s (R4b) et ramenés à la durée hors de 80 à 95 s", () => {
    expect(FAMILLES.map((f) => [f, ramene(CATALOGUE_FAMILLES[f].plafond90, 90)])).toEqual([
      ["fenetre", 6], ["etiquette", 5], ["carte", 5], ["mot-geant", 3], ["ecran-partage", 2], ["telephone", 3], ["carte-france", 3], ["pile-notifications", 3], ["chiffre-eclate", 3], ["trait-dessine", 3], ["volet", 2], ["ruban", 3], ["horloge", 3], ["jauge", 3], ["bulles", 3],
    ]);
    expect(ramene(6, 93)).toBe(6);
    expect(ramene(6, 45)).toBe(3);
    expect(ramene(2, 22)).toBe(1);
    // R7d : plafond atteint dans la vidéo précédente → un de moins.
    expect(plafondFamille("fenetre", 90, { comptesFamilles: { fenetre: 6 }, duree: 90 })).toBe(5);
    expect(plafondFamille("fenetre", 90, { comptesFamilles: { fenetre: 5 }, duree: 90 })).toBe(6);
  });

  it("apparitions : une par objet, rangée dans sa famille, triées ; visage couvert / poussé / à sa place", () => {
    const ap = apparitionsDuPlan(planValide());
    expect(ap.map((a) => a.famille)).toEqual(["trait-dessine", "horloge", "etiquette", "chiffre-eclate", "fenetre", "telephone", "carte", "pile-notifications", "mot-geant", "ruban", "jauge", "bulles"]);
    expect(ap.filter((a) => a.couvre).map((a) => a.famille)).toEqual(["mot-geant"]);
    expect(ap.filter((a) => a.pousse).map((a) => a.famille)).toEqual(["etiquette", "fenetre", "carte"]);
  });
});

describe("diversité · R1 ouverture sur le visage entier", () => {
  it("(a) rien d'autre que les sous-titres avant 0,8 s", () => {
    contient(avec((p) => (p.motions![0].debut = 0.5)), "R1a — motion 1 (trait-dessine) à 0,50 s : rien d'autre que les sous-titres de 0 à 0,8 s");
    aucun(div(planValide()), "R1");
  });
  it("(b) de 0 à 4 s : ni fenêtre, ni carte, rien qui couvre ; seulement étiquette, trait, chiffre, horloge, bulles", () => {
    contient(avec((p) => Object.assign(p.fenetres[0], { debut: 3.2, fin: 4.6 })), "R1b — fenêtre 1 à 3,20 s : de 0 à 4 s, le visage reste ENTIER");
    contient(avec((p) => Object.assign(p.motions![3], { debut: 2.4, famille: "telephone" })), "R1b — motion 4 (telephone)");
  });
  it("(c) premier objet sur le visage à 5 s au plus tôt ; (d) première carte à 8 s ; (e) premier plein écran à 10 s", () => {
    contient(avec((p) => Object.assign(p.fenetres[0], { debut: 4.5, cadrage: "sur-le-visage" })), "R1c — fenêtre 1 à 4,50 s couvre le visage");
    contient(avec((p) => (p.cartes[0].debut = 7.5)), "R1d — carte 1 (liste) à 7,50 s : la première carte entre à 8 s au plus tôt");
    contient(avec((p) => Object.assign(p.motions![3], { debut: 7.5, fin: 8.4, famille: "mot-geant", contenu: { mots: [{ texte: "Livraison", a: 7.5 }] } })), "R1e — motion 4 (mot-geant) à 7,50 s : le premier objet plein écran");
  });
  it("un échec sur R1 empêche le rendu", () => {
    const r = verifierPlan((() => { const p = copie(planValide()); p.motions![0].debut = 0.5; return p; })(), MOTS);
    expect(r.rendable).toBe(false);
    expect(estRendable(["R2a — visage couvert 31 %"])).toBe(true);
    expect(estRendable(["R3a — fenêtre 1 puis fenêtre 2"])).toBe(false);
  });
});

describe("diversité · R2 temps de visage", () => {
  it("(a) visage couvert 30 % au plus, à sa place 45 % au moins", () => {
    const couvrant = planSuite(Array.from({ length: 40 }, (_, k) => (k % 2 ? "trait-dessine" : (["mot-geant", "volet", "ecran-partage"] as const)[k % 3])), 2.2, 2, 11);
    contient(div(couvrant), "R2a — visage couvert");
    const p = copie(planValide());
    p.calques = [{ type: "etiquette", debut: 0.8, fin: 19.5, texte: "Bureau" }];
    contient(div(p), "R2a — visage à sa place (ni couvert ni poussé");
  });
  it("(b) 50 % au plus sur toute fenêtre de 10 s ; (c) 1 s de visage entier entre deux objets qui le couvrent", () => {
    const p = copie(planValide());
    Object.assign(p.motions![6], { famille: "volet", fin: 15.4, contenu: { titre: "Écran", a: 14.5 } });
    Object.assign(p.motions![5], { fin: 14.0 });
    p.motions![5].contenu = { mots: [{ texte: "Semaine", a: 13.5 }] };
    contient(div(p), "R2c — motion 6 (mot-geant) puis motion 7 (volet) à 14,40 s : 0,40 s de visage entier");
    contient(div(p), "R3d — motion 6 (mot-geant) puis motion 7 (volet) à 14,40 s couvrent tous deux le visage");
  });
});

describe("diversité · R3 enchaînements", () => {
  it("(a) jamais la même famille deux fois de suite (fenêtre-fenêtre, étiquette-étiquette compris)", () => {
    contient(avec((p) => p.calques.push({ type: "compteur", debut: 5.0, fin: 5.9, de: 0, a: 45, suffixe: " min" }) && p.motions!.splice(2, 1)), "R3a — calque 1 (etiquette) puis calque 2 (compteur) à 5,00 s : même famille « etiquette » deux fois de suite");
    aucun(div(planValide()), "R3");
  });
  it("(b) une famille 2 fois au plus sur 5 apparitions consécutives ; (c) un couple ne revient pas dans les 6 suivantes", () => {
    contient(div(planSuite(["horloge", "jauge", "horloge", "bulles", "horloge", "ruban", "telephone"])), "R3b — « horloge » revient 3 fois sur les 5 apparitions de 1,00 s à 9,00 s");
    contient(div(planSuite(["horloge", "jauge", "bulles", "horloge", "jauge", "ruban"])), "R3c — l'enchaînement « horloge → jauge » à 3,00 s revient à 9,00 s");
  });
  it("(d) deux objets qui couvrent le visage sont séparés par une famille qui le laisse entier", () => {
    contient(div(planSuite(["horloge", "jauge", "bulles", "ruban", "telephone", "mot-geant", "volet", "jauge"], 2.2, 1, 1, 40)), "R3d — motion 6 (mot-geant) puis motion 7 (volet)");
  });
});

describe("diversité · R4 plafonds", () => {
  it("(a) une famille fait 20 % des apparitions au plus (un échec empêche le rendu)", () => {
    const suite = Array.from({ length: 30 }, (_, k) => (k % 2 ? "horloge" : (["jauge", "bulles", "ruban", "telephone"] as const)[(k / 2) % 4]));
    const r = div(planSuite(suite));
    contient(r, "R4a — « horloge » fait 15 apparitions sur 30 (50,0 %)");
    expect(estRendable(r)).toBe(false);
  });
  it("(b) plafonds pour 90 s, un mot géant par tranche de 30 s ; R7d : plafond atteint la fois d'avant = un de moins", () => {
    const r = div(planSuite(ROTATION_90));
    // La rotation de 44 apparitions passe 4 fois par 8 des 12 motions.
    contient(r, "R4b — « jauge » : 4 apparitions ; 3 au plus pour cette vidéo");
    contient(r, "R4b — « ecran-partage » : 4 apparitions ; 2 au plus pour cette vidéo");
    contient(r, "R4b — 2 mots géants entre 0 et 30 s");
    const hier: HistoriqueVideo = { types: [], entrees: [], familles: ["bulles"], comptesFamilles: { bulles: 3 }, duree: 90 };
    const p = planSuite(["bulles", "horloge", "bulles", "jauge", "ruban", "bulles"], 10, 1.5, 1, 90);
    contient(div(p, [hier]), "R4b — « bulles » : 3 apparitions ; 2 au plus pour cette vidéo (plafond atteint dans la vidéo précédente : un de moins)");
  });
  it("(c) chaque contenu de carte une fois par vidéo ; une même place ou une même entrée 2 fois de suite au plus", () => {
    contient(div(planSuite(["horloge", "carte-france", "chiffre-eclate", "jauge"])), "R4c — même place à l'écran (« gauche ») 3 fois de suite (jusqu'à motion 3 (chiffre-eclate) à 5,00 s)");
    contient(div(planSuite(["jauge", "telephone", "bulles", "horloge"])), "R4c — même entrée « monte » 3 fois de suite");
  });
  it("(d) fenêtres : la moitié au plus sur le visage et la moitié au plus avec une étiquette", () => {
    contient(avec((p) => (p.fenetres[0].cadrage = "sur-le-visage")), "R4d — 1 fenêtres sur 1 posées « sur-le-visage »");
  });
});

describe("diversité · R5 variété", () => {
  it("(a) 7 familles au moins par fenêtre de 60 s, (b) 4 par fenêtre de 20 s, (c) 10 familles dont 6 motions sur la vidéo", () => {
    const pauvre = planSuite(Array.from({ length: 44 }, (_, k) => (["horloge", "jauge", "bulles", "ruban"] as const)[k % 4]));
    const r = div(pauvre);
    contient(r, "R5a — 4 familles différentes entre 0,00 s et 60,00 s");
    contient(r, "il en faut 7 au moins sur toute fenêtre de 60 s");
    contient(r, "R5c — 4 familles sur 15 dans la vidéo");
    contient(r, "R5c — 4 familles « motion » (les 12 nouvelles) ; il en faut 6 au moins");
    expect(estRendable(r)).toBe(false);
    contient(div(planSuite(Array.from({ length: 44 }, (_, k) => (["horloge", "jauge", "bulles"] as const)[k % 3]))), "R5b — 3 familles différentes entre 0,00 s et 20,00 s");
    aucun(div(planSuite(ROTATION_90)), "R5");
  });
  it("(d) une apparition toutes les 1 à 2,5 s, jamais plus de 3 s sans nouvel objet, jamais deux débuts à moins de 0,4 s", () => {
    contient(div(planSuite(ROTATION_90.slice(0, 30), 3.05)), "R5d — 3,05 s sans nouvel objet entre");
    contient(div(planSuite(ROTATION_90.slice(0, 30), 3.05)), "R5d — un événement visuel toutes les 3,");
    contient(avec((p) => (p.motions![1].debut = 1.0)), "R5d — motion 1 (trait-dessine) et motion 2 (horloge) à 1,00 s commencent à 0,20 s d'écart");
  });
});

describe("diversité · R6 bruitages", () => {
  it("le même bruitage 30 % au plus ; whoosh réservés à ce qui traverse le cadre ; chaque famille son son", () => {
    const p = copie(planValide());
    const sons = bruitagesDuPlan(p);
    const parFamille = new Map<string, number>();
    for (const [, s] of sons) parFamille.set(familleDeSon(s), (parFamille.get(familleDeSon(s)) ?? 0) + 1);
    for (const [s, n] of parFamille) expect(n / sons.length, s).toBeLessThanOrEqual(DIVERSITE.partSonMax);
    aucun(div(p), "R6");
    // L'ancienne bande-son (tous les pops en « drop ») : refusée.
    p.sons = sons.map(([t, s, v]) => [t, s.startsWith("whoosh") || s.startsWith("confirmation") ? s : "drop_002", v]);
    contient(div(p), "R6 — le bruitage « drop » fait");
    // Un whoosh posé sur une étiquette (qui apparaît sur place) : refusé.
    const q = copie(planValide());
    q.sons = [...bruitagesDuPlan(q), [4.0, "whoosh-in", 0.2]];
    contient(div(q), "R6 — whoosh à 4,00 s : les whoosh sont réservés aux objets qui entrent ou sortent du cadre");
    // Le son d'une famille absente à cet instant : refusé.
    const s = copie(planValide());
    s.sons = [...bruitagesDuPlan(s), [6.5, "tick_004", 0.05]];
    contient(div(s), "R6 — le son « tick_004 » (1 fois, dès 6,50 s) appartient à la famille « horloge »");
  });
});

describe("diversité · R7 historique (historique-motion.json)", () => {
  const hier = historiqueDuPlan(planValide(), "Hier");
  it("(a) première famille différente des 3 vidéos précédentes ; (b) enchaînements des 20 premières secondes ; (c) familles absentes ; (e) famille la plus utilisée", () => {
    const r = div(planValide(), [hier]);
    contient(r, "R7a — la vidéo commence par « trait-dessine » comme la vidéo « Hier »");
    contient(r, "R7b — les 20 premières secondes reprennent 100 % des enchaînements");
    contient(r, "R7c — 0 famille absente de la vidéo précédente");
    // Une vidéo d'avant qui ouvrait sur l'horloge et n'avait que 3 familles : rien à redire à celle-ci.
    aucun(div(planValide(), [{ types: [], entrees: [], familles: ["horloge", "jauge", "ruban"], debutsFamilles: [1, 3, 5], comptesFamilles: { horloge: 1, jauge: 1, ruban: 1 }, duree: 22 }]), "R7");
    // R7e : seule en tête comme la fois d'avant (à égalité avec une autre, elle ne l'est plus).
    const p = copie(planValide());
    p.motions!.push({ debut: 19.65, fin: 19.95, famille: "trait-dessine", illustre: "devis", contenu: { forme: "souligne", traits: [{ mot: "devis.", a: 19.5 }] } });
    contient(div(p, [{ types: [], entrees: [], comptesFamilles: { "trait-dessine": 3, horloge: 1 }, duree: 22 }]), "R7e — « trait-dessine » est la famille la plus utilisée, comme dans la vidéo précédente");
  });

  it("historique-motion.json : suite des familles, débuts, comptes par famille et par type ; 5 vidéos gardées ; fichier absent = vide", () => {
    expect(hier).toMatchObject({ titre: "Hier", familles: ["trait-dessine", "horloge", "etiquette", "chiffre-eclate", "fenetre", "telephone", "carte", "pile-notifications", "mot-geant", "ruban", "jauge", "bulles"], debutsFamilles: [0.8, 2.3, 4, 4.95, 6, 7.5, 8.95, 11.7, 13.5, 14.4, 16.5, 18], duree: 22 });
    expect(hier.comptesFamilles).toMatchObject({ fenetre: 1, etiquette: 1, carte: 1, horloge: 1 });
    let h = historiqueMotionVide();
    for (let k = 0; k < 7; k++) h = ajouterAHistoriqueMotion(h, planValide(), `Vidéo ${k}`);
    expect(h.videos.map((v) => v.titre)).toEqual(["Vidéo 6", "Vidéo 5", "Vidéo 4", "Vidéo 3", "Vidéo 2"]);
    const dossier = mkdtempSync(join(tmpdir(), "historique-motion-"));
    try {
      const chemin = join(dossier, "historique-motion.json");
      expect(lireHistoriqueMotion(chemin).videos).toEqual([]);
      enregistrerHistoriqueMotion(chemin, planValide(), "Première");
      const lu = lireHistoriqueMotion(chemin);
      expect(lu.version).toBe("historique-motion/1");
      expect(lu.videos[0]).toMatchObject({ titre: "Première", familles: hier.familles });
      expect(JSON.parse(readFileSync(chemin, "utf8")).videos).toHaveLength(1);
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
  });
});

describe("diversité · la vraie vidéo 5 (si son plan est présent sur ce poste)", () => {
  const chemin = "<dossier utilisateur>/AppData/Local/Temp/claude/<projet-local>-Documents-Projets-Axion-IA/55133bef-9581-493b-a484-fae7fb25910a/scratchpad/realisateur-essai-5/plan-rendu.json";
  it.skipIf(!existsSync(chemin))("tous les défauts relevés par Will et le directeur artistique sont refusés, et le plan n'est pas rendu", () => {
    const plan = JSON.parse(readFileSync(chemin, "utf8")) as PlanFacecamAnimee;
    const d = controlerDiversite(plan);
    contient(d.erreurs, "R1b — fenêtre 1 à 0,36 s");
    contient(d.erreurs, "R1c — fenêtre 1 à 0,36 s couvre le visage");
    contient(d.erreurs, "R3a — ");
    contient(d.erreurs, "R4a — « fenetre » fait 15 apparitions sur 41 (36,6 %)");
    contient(d.erreurs, "R4c — contenu de carte « frise » utilisé 4 fois");
    contient(d.erreurs, "R5a — 3 familles différentes");
    contient(d.erreurs, "R6 — le bruitage « drop » fait 52,9 % des sons");
    expect(d.mesures).toMatchObject({ apparitions: 41, nombreFamilles: 3, memeFamilleDeSuite: 16, premiereCouvertureVisageSec: 0.36, partFamilleMax: 0.366 });
    expect(estRendable(d.erreurs)).toBe(false);
  });
});
