/**
 * FINITIONS DES CARTES — constat visuel sur la vidéo réelle (prod 10/10, montage v3 de IMG_7747, écran partagé 9:16).
 * Aucun appel réel : fixtures lues sur disque, planification complète (coupes, recalage de la reprise, mots montés,
 * cartes, habillage) comme la chaîne la fait.
 *  1. PANNEAU VIDE : le panneau s'ouvrait 0,8 à 2,9 s avant le premier contenu (icône + mot, liste « Chez Axion-IA »,
 *     chiffre) — il s'ouvre maintenant au premier contenu, ou un titre / sur-titre est visible dès l'ouverture.
 *  2. DÉBORDEMENT : le 4e point de « Chez Axion-IA » sortait du panneau — mise en page adaptative (boîtes calculées).
 *  3. SOUS-TITRES : posés sur la jonction, ils masquaient la carte — moitié basse, sous la bouche ; un titre affiché
 *     (appel à l'action) n'est plus répété en sous-titre.
 *  4. LISTE « Un / Deux / Trois » ABSENTE en prod — détection mot par mot, indépendante de la ponctuation et du
 *     découpage en phrases ; toujours posée.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { appliquerRecalages, calculerCoupes, motsDuMontage } from "@/briques/coupes";
import { horodaterMotsPrononces } from "@/briques/calage/report";
import { masquerTextesAffiches } from "@/briques/composition";
import { dispositionQuiTient, ligneSousTitresEcranPartage, ouvrirAuPremierContenu, planifierCartesAuto, premierContenuSec, sourceYMoitieBasse, textesAffichesDesCartes, type CarteAuto } from "@/briques/habillage-facecam";
import { miseEnPage } from "@/briques/motion";
import { disposerListe, zoneListe, AGRANDISSEMENT_ACTIF } from "@/briques/motion/disposition-liste";
import type { CarteMotionTous } from "@/briques/motion/types-etendus";
import { habillageFacecam } from "@/moteurs/montage-facecam/habillage";
import type { MotHorodate } from "@/domaine/types";

const reel = JSON.parse(readFileSync("tests/fixtures/img7747-v2-montage-reel.json", "utf-8")) as { mots: MotHorodate[] };
const DUREE_PRISE = 130.732;
/** Texte validé reconstitué (même texte que `facecam-reprise-cartes.test.ts`). */
const SCRIPT = readFileSync("tests/facecam-reprise-cartes.test.ts", "utf-8").match(/const SCRIPT =\s*\n\s*"([^"]+)"/)![1];
const QUESTIONS = "Un, où part votre temps ? Deux, qu'est-ce qui peut changer en premier ? Trois, de quoi avez-vous besoin pour avancer ?";

/** Planification complète comme la chaîne : coupes (reprise retirée), recalage, mots montés, texte validé horodaté. */
function montage(texte = SCRIPT): { mots: MotHorodate[]; duree: number } {
  const plan = calculerCoupes({ mots: reel.mots, dureeSec: DUREE_PRISE, texteValide: texte });
  const montes = motsDuMontage(appliquerRecalages(reel.mots, plan.recalages), plan.gardes);
  const texteMonte = plan.phrases.filter((p) => p.debutSec !== undefined).map((p) => p.texte).join(" ");
  return { mots: horodaterMotsPrononces(texteMonte.split(/\s+/).filter(Boolean), montes), duree: plan.dureeSortieSec };
}

const donnees = (c: { carte: CarteMotionTous }) => c.carte.donnees as unknown as Record<string, unknown>;
const elementsDe = (c: { carte: CarteMotionTous }) => ((donnees(c).elements as { texte: string; aSec?: number }[]) ?? []).map((e) => e.texte);
const numerotee = (cartes: CarteAuto[]) => cartes.find((x) => donnees(x).numerotee === true);
const debutMot = (mots: MotHorodate[], mot: string, apres = 0) => mots.find((m) => m.mot.replace(/[,.?:]/g, "") === mot && m.debutSec >= apres)!.debutSec;

const { mots, duree } = montage();
const cartes = planifierCartesAuto(mots, duree);
const h = habillageFacecam({ pisteMonteeCle: "p.mov", dureeSec: duree, mots, prefixeCartes: "c", visage: { yeuxPct: 33, bouchePct: 45 } });

describe("1. Panneau jamais vide", () => {
  const aUnTitre = (c: { carte: CarteMotionTous }) => !!(donnees(c).titre || donnees(c).surTitre);

  it("chaque carte planifiée : premier contenu ≤ 0,4 s après l'ouverture, ou titre / sur-titre visible dès l'ouverture", () => {
    expect(cartes.length).toBeGreaterThanOrEqual(8);
    for (const c of cartes) {
      const t = premierContenuSec(c.carte);
      if (t > 0.4 + 1e-6) {
        expect(aUnTitre(c), `${c.carte.modele} à ${c.debutSec} s : rien avant ${t} s`).toBe(true);
        expect(t).toBeLessThanOrEqual(1.2);
      }
    }
  });

  it("icône + mot « Une fuite » (prod : 1,64 s d'attente) et liste « Chez Axion-IA » (prod : 0,8 s) s'ouvrent au contenu", () => {
    const fuite = cartes.find((c) => c.carte.modele === "icone-mot")!;
    expect(donnees(fuite).mot).toBe("Une fuite");
    expect(premierContenuSec(fuite.carte)).toBeLessThan(0.8);
    expect(fuite.debutSec + premierContenuSec(fuite.carte)).toBeCloseTo(debutMot(mots, "une", 3), 1); // le mot reste au mot dit
    const chez = cartes.find((c) => donnees(c).titre === "Chez Axion-IA")!;
    expect(premierContenuSec(chez.carte)).toBeLessThanOrEqual(0.4 + 1e-6);
    expect(chez.debutSec + premierContenuSec(chez.carte)).toBeCloseTo(debutMot(mots, "forme"), 1);
  });

  it("après le calage du rendu (habillage), aucune carte n'attend plus de 0,4 s sans titre ni sur-titre", () => {
    expect(h.cartes).toHaveLength(cartes.length);
    for (const r of h.cartes) {
      const p = r.parametres.proprietes as unknown as { modele: string; donnees: Record<string, unknown> };
      const carte = { modele: p.modele, donnees: p.donnees } as unknown as CarteMotionTous;
      if (premierContenuSec(carte) > 0.4 + 1e-6) expect(aUnTitre({ carte })).toBe(true);
    }
  });

  it("ouvrirAuPremierContenu : décale l'ouverture et les apparitions, garde 3 s, reste dans la vidéo", () => {
    const c = { debutSec: 10, finSec: 13, carte: { modele: "liste", donnees: { elements: [{ texte: "Alpha", aSec: 1.5 }, { texte: "Beta", aSec: 2.5 }] } } as CarteMotionTous };
    const o = ouvrirAuPremierContenu(c, 60);
    expect(o.debutSec).toBeCloseTo(11.1, 3);
    expect(o.finSec).toBeCloseTo(14.1, 3);
    expect(elementsDe(o)).toEqual(["Alpha", "Beta"]);
    expect((donnees(o).elements as { aSec: number }[]).map((e) => e.aSec)).toEqual([0.4, 1.4]);
    // En fin de vidéo : jamais au-delà de la fin.
    expect(ouvrirAuPremierContenu(c, 13.5).finSec).toBeLessThanOrEqual(13.45 + 1e-6);
    // Contenu immédiat : rien ne bouge.
    const d = { ...c, carte: { modele: "liste", donnees: { elements: [{ texte: "Alpha", aSec: 0.2 }, { texte: "Beta", aSec: 1 }] } } as CarteMotionTous };
    expect(ouvrirAuPremierContenu(d, 60)).toBe(d);
  });
});

describe("2. Débordement : tous les points tiennent dans la zone sûre", () => {
  const MOITIE = miseEnPage("9:16", "moitie-haute", 6);
  const PLEIN = miseEnPage("9:16", "plein-ecran", 6);
  const dedans = (d: ReturnType<typeof disposerListe>, mp: typeof MOITIE) => {
    const z = zoneListe(mp);
    for (const b of d.boites) {
      const marge = (b.hauteur * AGRANDISSEMENT_ACTIF) / 2;
      expect(b.x).toBeGreaterThanOrEqual(-0.5);
      expect(b.y - marge).toBeGreaterThanOrEqual(-0.5);
      expect(b.x + b.largeur * (1 + AGRANDISSEMENT_ACTIF)).toBeLessThanOrEqual(z.largeur + 0.5);
      expect(b.y + b.hauteur + marge).toBeLessThanOrEqual(z.hauteur + 0.5);
      // Zone sûre dans l'image : le bas du dernier point au-dessus du bas du panneau.
      expect(z.y + b.y + b.hauteur).toBeLessThanOrEqual(mp.hauteur);
    }
    if (d.boiteTitre) expect(d.boiteTitre.y).toBeGreaterThanOrEqual(-0.5);
    // Points jamais l'un sur l'autre.
    for (let i = 0; i < d.boites.length; i++)
      for (let j = i + 1; j < d.boites.length; j++) {
        const a = d.boites[i];
        const b = d.boites[j];
        expect(a.x + a.largeur <= b.x + 0.5 || b.x + b.largeur <= a.x + 0.5 || a.y + a.hauteur <= b.y + 0.5 || b.y + b.hauteur <= a.y + 0.5).toBe(true);
      }
    expect(d.tailleTexte).toBeGreaterThanOrEqual(Math.ceil(0.03 * 1920)); // jamais sous 3 % de la hauteur
  };

  it("« Chez Axion-IA » (4 points) : tout tient en moitié haute, « Automatise » compris (avant : coupé par le bas)", () => {
    const d = disposerListe({ titre: "Chez Axion-IA", textes: ["Forme les équipes", "Accompagne en one-to-one", "Audite", "Automatise"], mp: MOITIE });
    expect(d.tient).toBe(true);
    dedans(d, MOITIE);
    // Ancienne mise en page (taille fixe, bloc centré) : le 4e point débordait.
    const ancien = { ...d, tailleTexte: 69 };
    expect(ancien.tailleTexte).toBeGreaterThan(d.tailleTexte);
  });

  it("les 4 listes réelles de la vidéo tiennent en moitié haute (aucun repli plein écran)", () => {
    for (const c of cartes.filter((x) => x.carte.modele === "liste")) {
      const d = disposerListe({ titre: donnees(c).titre as string | undefined, textes: elementsDe(c), mp: MOITIE });
      expect(d.tient, elementsDe(c).join(" · ")).toBe(true);
      dedans(d, MOITIE);
    }
    expect(h.entree.cartesPleinEcran).toBeUndefined();
  });

  const LONGS = ["Les chiffres qui arrivent beaucoup trop tard", "Accompagnement one-to-one des dirigeants", "Automatisation de tout ce qui coûte du temps", "Qu'est-ce qui peut changer en premier ?", "Formation des équipes à l'intelligence", "Audit complet de vos processus internes"];
  const COURTS = ["Formation", "Audit", "Automatisation", "Accompagnement", "Relances", "Devis"];
  for (let n = 2; n <= 6; n++)
    for (const [nom, textes] of [
      ["longs", LONGS.slice(0, n)],
      ["courts", COURTS.slice(0, n)],
      ["mêlés", LONGS.slice(0, n).map((t, i) => (i % 2 ? COURTS[i] : t))],
    ] as const)
      for (const titre of [undefined, "Trois questions pour avancer vite"]) {
        it(`${n} points ${nom}${titre ? " + titre" : ""} : aucun point hors du cadre (moitié haute, sinon plein écran)`, () => {
          const carte = { modele: "liste", donnees: { ...(titre ? { titre } : {}), elements: textes.map((texte) => ({ texte })) } } as CarteMotionTous;
          const disposition = dispositionQuiTient(carte, "moitie-haute");
          const mp = disposition === "moitie-haute" ? MOITIE : PLEIN;
          const d = disposerListe({ titre, textes: [...textes], mp });
          expect(d.tient).toBe(true);
          dedans(d, mp);
          // Points courts : ils restent en écran partagé (le visage visible) ; avec un titre de 2 lignes, jusqu'à 4.
          if (nom === "courts" && (!titre || n <= 4)) expect(disposition).toBe("moitie-haute");
        });
      }

  it("deux colonnes quand une seule ne suffit pas et que chaque mot tient dans sa colonne", () => {
    const d = disposerListe({ titre: "Six offres", textes: ["Devis rapides", "Relances auto", "Factures vite", "Tableaux clairs", "Agenda simple", "Rapports hebdo"], mp: MOITIE });
    expect(d.tient).toBe(true);
    expect(d.colonnes).toBe(2);
    dedans(d, MOITIE);
  });

  it("habillage : une liste trop longue pour la moitié haute part en plein écran (jamais coupée)", () => {
    const longue = habillageFacecam({ pisteMonteeCle: "p.mov", dureeSec: 30, mots, prefixeCartes: "c", cartes: [{ id: "l", debutSec: 5, finSec: 12, disposition: "moitie-haute", carte: { modele: "liste", donnees: { titre: "Trois questions pour avancer vite", elements: LONGS.map((texte) => ({ texte })) } } }] });
    // Vérif V1 et #15 : les cartes automatiques s'ajoutent ailleurs (moitié haute) ; la liste longue, elle, est en plein écran.
    expect((longue.entree.ecransPartages ?? []).map((x) => x.carteCle)).not.toContain("c/l.mp4");
    expect(longue.entree.cartesPleinEcran?.map((x) => x.carteCle)).toEqual(["c/l.mp4"]);
  });
});

describe("3. Sous-titres : hors de la carte, jamais répétés", () => {
  it("pendant chaque écran partagé, la ligne est dans la moitié basse, sous la bouche, au-dessus du bas de l'image", () => {
    const passages = h.entree.ecransPartages ?? [];
    expect(passages.length).toBe(cartes.length);
    const yeux = 0.33 * 1920;
    const bouche = 0.45 * 1920 - sourceYMoitieBasse({ yeuxY: yeux }, 1920, 960) + 960;
    for (const p of passages) {
      const centre = (p.ligne!.centrePct / 100) * 1920;
      expect(centre - 42).toBeGreaterThan(960 + 20); // hors de la carte, avec de l'air sous la jonction
      expect(centre - 42).toBeGreaterThan(bouche); // jamais sur la bouche
      expect(centre + 42).toBeLessThan(1920 - 0.05 * 1920);
    }
  });

  it("ligneSousTitresEcranPartage : suit la bouche, bornée à la moitié basse", () => {
    const a = ligneSousTitresEcranPartage({ yeuxPct: 30, bouchePct: 40 }, 960, 1920);
    const b = ligneSousTitresEcranPartage({ yeuxPct: 30, bouchePct: 44 }, 960, 1920);
    expect(b).toBeGreaterThan(a);
    expect(a).toBeGreaterThan(52);
    expect(ligneSousTitresEcranPartage({ yeuxPct: 30, bouchePct: 70 }, 960, 1920)).toBeLessThanOrEqual(92);
    expect(ligneSousTitresEcranPartage(undefined, 960, 1920)).toBeGreaterThan(55);
  });

  it("appel à l'action affiché : les groupes qui répètent « Réservez votre appel diagnostic gratuit » ne sont pas dessinés", () => {
    const cta = h.entree.textesAffiches ?? [];
    expect(cta).toHaveLength(1);
    expect(cta[0].texte).toContain("Réservez votre appel diagnostic gratuit");
    const visibles = masquerTextesAffiches(h.segments, cta);
    const pendant = (s: { debutSec: number; finSec: number }) => s.debutSec < cta[0].finSec && cta[0].debutSec < s.finSec;
    const repetes = h.segments.filter((s) => pendant(s) && /r[ée]servez|appel|diagnostic|gratuit/i.test(s.mots.map((m) => m.mot).join(" ")));
    expect(repetes.length).toBeGreaterThan(0);
    for (const s of repetes) expect(visibles).not.toContain(s);
    // Les autres groupes restent (aucun sous-titre perdu hors de la carte), et les données ne changent pas.
    expect(visibles.filter((s) => !pendant(s))).toEqual(h.segments.filter((s) => !pendant(s)));
    expect(h.entree.segments).toBe(h.segments);
  });

  it("masquerTextesAffiches : un groupe qui dit autre chose reste ; hors de la carte, rien n'est masqué", () => {
    const seg = (debutSec: number, texte: string) => ({ debutSec, finSec: debutSec + 1, mots: texte.split(" ").map((mot) => ({ mot })) });
    const textes = [{ debutSec: 10, finSec: 14, texte: "Réservez votre appel diagnostic gratuit" }];
    const s = [seg(10, "réservez votre appel"), seg(11, "si vous sentez"), seg(12, "diagnostic gratuit."), seg(20, "réservez votre appel")];
    expect(masquerTextesAffiches(s, textes).map((x) => x.debutSec)).toEqual([11, 20]);
    expect(textesAffichesDesCartes([{ debutSec: 0, finSec: 5, disposition: "moitie-haute", carte: { modele: "liste", donnees: { elements: [{ texte: "Devis" }] } } }])).toEqual([]);
  });
});

describe("4. Liste « Un / Deux / Trois » : toujours sa carte", () => {
  const attendus = ["Où part votre temps ?", "Qu'est-ce qui peut changer en premier ?", "De quoi avez-vous besoin ?"];

  it("planification complète (reprise retirée, mots recalés) : liste numérotée posée et dans l'habillage", () => {
    const c = numerotee(cartes)!;
    expect(elementsDe(c)).toEqual(attendus);
    expect(h.cartes.some((r) => (r.parametres.proprietes as unknown as { donnees: { numerotee?: boolean } }).donnees.numerotee)).toBe(true);
  });

  // Variantes du texte validé : la prod avait le texte réel (non fourni), écrit autrement que la reconstitution.
  const variantes: [string, string][] = [
    ["« Un : … »", QUESTIONS.replace("Un,", "Un :").replace("Deux,", "Deux :").replace("Trois,", "Trois :")],
    ["« Un. … »", QUESTIONS.replace("Un,", "Un.").replace("Deux,", "Deux.").replace("Trois,", "Trois.")],
    ["« 1. … »", QUESTIONS.replace("Un,", "1.").replace("Deux,", "2.").replace("Trois,", "3.")],
    ["« Premièrement, … »", QUESTIONS.replace("Un,", "Premièrement,").replace("Deux,", "Deuxièmement,").replace("Trois,", "Troisièmement,")],
    ["sans ponctuation après le numéro", QUESTIONS.replace("Un,", "Un").replace("Deux,", "Deux").replace("Trois,", "Trois")],
    ["une seule phrase, « et trois »", "Un, où part votre temps, deux, qu'est-ce qui peut changer en premier, et trois, de quoi avez-vous besoin pour avancer ?"],
  ];
  for (const [nom, questions] of variantes)
    it(`texte validé écrit ${nom} : la liste numérotée sort`, () => {
      const m = montage(SCRIPT.replace(QUESTIONS, questions));
      const c = numerotee(planifierCartesAuto(m.mots, m.duree));
      expect(c, nom).toBeDefined();
      expect(elementsDe(c!)).toHaveLength(3);
      expect(elementsDe(c!)[0]).toMatch(/^Où part votre temps/);
      expect(elementsDe(c!)[2]).toMatch(/^De quoi avez-vous besoin/);
    });

  /** Blanc de `blanc` s après le mot `apres` (calage de l'aligneur : pause réelle après le numéro). */
  const avecBlanc = (apres: string, blanc: number) => {
    const k = mots.findIndex((x) => x.mot === apres);
    return { mots: mots.map((x, i) => (i > k ? { ...x, debutSec: +(x.debutSec + blanc).toFixed(3), finSec: +(x.finSec + blanc).toFixed(3) } : x)), duree: duree + blanc };
  };
  for (const apres of ["Un,", "Deux,", "Trois,"])
    it(`blanc de 1,5 s après « ${apres} » (aligneur) : la liste numérotée sort, ses points au mot dit`, () => {
      const m = avecBlanc(apres, 1.5);
      const c = numerotee(planifierCartesAuto(m.mots, m.duree))!;
      expect(c).toBeDefined();
      expect(elementsDe(c)).toEqual(attendus);
      const el = donnees(c).elements as { aSec: number }[];
      expect(c.debutSec + el[0].aSec).toBeCloseTo(m.mots.find((x) => x.mot === "Un,")!.debutSec, 2);
      expect(c.debutSec + el[2].aSec).toBeCloseTo(m.mots.find((x) => x.mot === "Trois,")!.debutSec, 2);
    });

  it("transcription seule (« 1. », « 2. », « 3. » de Whisper, sans texte validé) : la liste sort", () => {
    const plan = calculerCoupes({ mots: reel.mots, dureeSec: DUREE_PRISE });
    const c = numerotee(planifierCartesAuto(motsDuMontage(appliquerRecalages(reel.mots, plan.recalages), plan.gardes), plan.dureeSortieSec))!;
    expect(elementsDe(c)).toHaveLength(3);
  });

  it("créneau disputé (densité serrée, carte 45 min juste avant) : la liste numérotée passe, la carte d'avant est raccourcie", () => {
    const serre = planifierCartesAuto(mots, duree, { ecartMinSec: 2.5 });
    const c = numerotee(serre)!;
    expect(elementsDe(c)).toEqual(attendus);
    for (let k = 1; k < serre.length; k++) expect(serre[k].debutSec).toBeGreaterThanOrEqual(serre[k - 1].finSec - 1e-6);
  });

  it("jamais de fausse liste : « Un premier diagnostic… », « une entreprise, deux entreprises »", () => {
    const t = (texte: string) => texte.split(" ").map((mot, i) => ({ mot, debutSec: 3 + i * 0.4, finSec: 3 + i * 0.4 + 0.3 }));
    expect(numerotee(planifierCartesAuto(t("Un premier diagnostic gratuit de 45 minutes en visio avec notre équipe. Ensuite on vous rappelle vite."), 20))).toBeUndefined();
    expect(numerotee(planifierCartesAuto(t("Pour une entreprise, deux entreprises ou dix, la méthode reste la même pour tout le monde."), 20))).toBeUndefined();
  });
});
