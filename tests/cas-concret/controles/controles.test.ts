/**
 * M7 · Contrôles finaux du cas concret : bloquants, indicatifs, phrases sans identifiant interne.
 * Aucune taille en pixels n'est figée ici : les écrans viennent des exemples de la brique.
 */
import { describe, expect, it } from "vitest";
import { TABLE_FINS_DIAGNOSTIC } from "@/briques/fins";
import { zoneSureDe } from "@/briques/controle-image";
import { recrutementApporteurs } from "@/formats/cas-concret/catalogue/recrutement-apporteurs";
import { controlerVideoCasConcret, SEUILS_CAS_CONCRET, type EntreeControleCasConcret, type MesuresFin } from "@/moteurs/montage-cas-concret/controles";
import type { FicheEcrans } from "@/moteurs/montage-cas-concret/fiche";
import { planDesFins } from "@/moteurs/montage-cas-concret/fins";
import { exemplesEcrans, ZONE_QUATRE_RESEAUX } from "../../../studio-rendu/compositions/cas-concret/exemples";
import { ficheVideo1 } from "../regles/outils";

const ZONE = { haut: ZONE_QUATRE_RESEAUX.haut / 100, droite: ZONE_QUATRE_RESEAUX.droite / 100, bas: ZONE_QUATRE_RESEAUX.bas / 100, gauche: ZONE_QUATRE_RESEAUX.gauche / 100 };
const base = { mot: recrutementApporteurs.mot, motDit: recrutementApporteurs.motDit, avecMot: true, motSur: ["facebook" as const, "instagram" as const], table: TABLE_FINS_DIAGNOSTIC };

/** Fiche de la vidéo 1 calée : 3 s par écran, accroche de 2,8 s. */
function ficheCalee(): FicheEcrans {
  const f = ficheVideo1();
  let t = 0;
  return { ...f, ecrans: f.ecrans.map((e, i) => { const d = i === 0 ? 2800 : 3000; const r = { ...e, debutMs: t, finMs: t + d }; t += d; return r; }) as FicheEcrans["ecrans"] };
}

const MESURES_BONNES: MesuresFin = { lufs: -14, creteVraieDbtp: -2, imageNoireTete: 0, dureeSec: 53, largeur: 1080, hauteur: 1920, fps: 25, voixFinSec: 50.9 };

function entree(sur: Partial<EntreeControleCasConcret> = {}): EntreeControleCasConcret {
  const plan = planDesFins({ ...base, reseaux: ["facebook"], offre: "integration", nature: "automatisation" });
  const fin = plan.fins[0];
  const finCalee = { ...plan, fins: [{ ...fin, ecrans: fin.ecrans.map((e, i, tous) => ({ ...e, debutMs: i * 3000, finMs: (i + 1) * 3000 + (i === tous.length - 1 ? 2100 : 0) })) }] };
  return {
    fiche: ficheCalee(),
    proprietes: { corps: exemplesEcrans(), fins: {} },
    mesuresParFin: { [fin.id]: MESURES_BONNES },
    journalCaptures: [],
    planDesFins: finCalee,
    bruitagesPoses: ["clic"],
    zone: ZONE,
    ...sur,
  };
}

const IDENTIFIANT = /\b[ef]\d{2}\b|\bR\d{2}\b|\b[a-z]+-\d+\b|[a-z]+[A-Z][a-z]+|undefined|null/;

describe("M7 · contrôles finaux", () => {
  it("la zone du test est celle des quatre réseaux de la brique", () => {
    expect(zoneSureDe("9:16", ["facebook", "instagram", "tiktok", "linkedin"])).toEqual(ZONE);
  });

  it("une vidéo en règle : verdict ok, aucun bloquant", () => {
    const r = controlerVideoCasConcret(entree());
    expect(r.bloquants.map((l) => l.raison)).toEqual([]);
    expect(r.verdict).toBe("ok");
    expect(r.resume).toMatch(/^Vérifications passées/);
  });

  it("volume à −16 → bloquant", () => {
    const e = entree();
    const id = e.planDesFins.fins[0].id;
    const r = controlerVideoCasConcret({ ...e, mesuresParFin: { [id]: { ...MESURES_BONNES, lufs: -16 } } });
    expect(r.verdict).toBe("bloque");
    expect(r.bloquants.some((l) => l.libelle === "Volume du son")).toBe(true);
  });

  it("un fichier de 1080 × 1350 → bloquant, qui dit la taille attendue", () => {
    const e = entree();
    const id = e.planDesFins.fins[0].id;
    const r = controlerVideoCasConcret({ ...e, mesuresParFin: { [id]: { ...MESURES_BONNES, hauteur: 1350 } } });
    const l = r.bloquants.find((x) => x.libelle === "Taille de l'image");
    expect(l?.raison).toContain("largeur 1080, hauteur 1920, 25 images par seconde");
    expect(l?.raison).toContain("1350");
  });

  it("une cadence de 30 images par seconde → bloquant", () => {
    const e = entree();
    const id = e.planDesFins.fins[0].id;
    const r = controlerVideoCasConcret({ ...e, mesuresParFin: { [id]: { ...MESURES_BONNES, fps: 30 } } });
    expect(r.verdict).toBe("bloque");
  });

  it("la voix finit à moins de 2,0 s de la fin → bloquant ; à 2,0 s pile → passe", () => {
    const e = entree();
    const id = e.planDesFins.fins[0].id;
    const court = controlerVideoCasConcret({ ...e, mesuresParFin: { [id]: { ...MESURES_BONNES, voixFinSec: 51.5 } } });
    expect(court.bloquants.map((l) => l.libelle)).toContain("Fin de la voix");
    const pile = controlerVideoCasConcret({ ...e, mesuresParFin: { [id]: { ...MESURES_BONNES, voixFinSec: 51 } } });
    expect(pile.bloquants).toEqual([]);
  });

  it("mesures absentes d'une fin → non fait, jamais réussi", () => {
    const r = controlerVideoCasConcret(entree({ mesuresParFin: {} }));
    expect(r.nonFaits.some((l) => l.famille === "fichier")).toBe(true);
    expect(r.verdict).toBe("ok");
  });

  it("marque absente → bloquant qui nomme l'écran par son rang", () => {
    const e = entree();
    const corps = e.proprietes.corps.map((p, i) => (i === 2 ? ({ ...p, marque: "" } as unknown as typeof p) : p));
    const r = controlerVideoCasConcret({ ...e, proprietes: { corps } });
    const l = r.bloquants.find((x) => /marque/.test(x.raison));
    expect(l?.raison).toMatch(/Écran n° 3/);
    expect(r.verdict).toBe("bloque");
  });

  it("une accroche qui finit après 3,0 s (après la voix) → indicatif, pas bloquant, verdict ok", () => {
    const f = ficheCalee();
    const ecrans = f.ecrans.map((x, i) => (i === 0 ? { ...x, finMs: 3400 } : i === 1 ? { ...x, debutMs: 3400 } : x)) as FicheEcrans["ecrans"];
    const r = controlerVideoCasConcret(entree({ fiche: { ...f, ecrans } }));
    expect(r.bloquants.map((l) => l.libelle)).not.toContain("Accroche");
    const l = r.indicatifs.find((x) => x.libelle === "Accroche");
    expect(l?.raison).toMatch(/3,4 s/);
    expect(l?.raison).toMatch(/après la voix : signalé, la vidéo est livrée/);
    expect(r.verdict).toBe("ok");
  });

  it("un premier écran qui n'est pas l'accroche reste bloquant", () => {
    const f = ficheCalee();
    const ecrans = f.ecrans.map((x, i) => (i === 0 ? { ...x, type: "corps" } : x)) as unknown as FicheEcrans["ecrans"];
    const r = controlerVideoCasConcret(entree({ fiche: { ...f, ecrans } }));
    expect(r.bloquants.map((l) => l.libelle)).toContain("Accroche");
  });

  it("après la voix, un écran trop long (6,3 s) est un indicatif, pas un bloquant", () => {
    const f = ficheCalee();
    const ecrans = f.ecrans.map((x, i) => (i === 1 ? { ...x, finMs: x.debutMs! + 6300 } : i > 1 ? { ...x, debutMs: x.debutMs! + 3300, finMs: x.finMs! + 3300 } : x)) as FicheEcrans["ecrans"];
    const r = controlerVideoCasConcret(entree({ fiche: { ...f, ecrans } }));
    expect(r.bloquants.filter((l) => l.libelle === "Durée des écrans")).toEqual([]);
    const l = r.indicatifs.find((x) => x.libelle === "Durée des écrans");
    expect(l?.raison).toMatch(/6,30 s/);
    expect(l?.raison).toMatch(/Écran n° 2/);
  });

  it("fiche calée en règle sauf un écran de 5,2 s → verdict ok", () => {
    const f = ficheCalee();
    const ecrans = f.ecrans.map((x, i) => (i === 1 ? { ...x, finMs: x.debutMs! + 5200 } : i > 1 ? { ...x, debutMs: x.debutMs! + 2200, finMs: x.finMs! + 2200 } : x)) as FicheEcrans["ecrans"];
    const r = controlerVideoCasConcret(entree({ fiche: { ...f, ecrans } }));
    expect(r.indicatifs.some((l) => l.libelle === "Durée des écrans")).toBe(true);
    expect(r.verdict).toBe("ok");
  });

  it("une fin dont le dernier écran dure 2,1 s de trop (hors tenue) → indicatif, verdict ok", () => {
    const e = entree();
    const fin = e.planDesFins.fins[0];
    const ecrans = fin.ecrans.map((x, i, tous) => (i === tous.length - 1 ? { ...x, finMs: x.debutMs! + 5200 + 2100 } : x));
    const r = controlerVideoCasConcret({ ...e, planDesFins: { ...e.planDesFins, fins: [{ ...fin, ecrans }] } });
    expect(r.bloquants.filter((l) => l.libelle === "Durée des écrans")).toEqual([]);
    expect(r.indicatifs.some((l) => l.libelle === "Durée des écrans" && /^Fin pour/.test(l.raison))).toBe(true);
    expect(r.verdict).toBe("ok");
  });

  it("un écran calé de 0,8 s reste bloquant", () => {
    const f = ficheCalee();
    const ecrans = f.ecrans.map((x, i) => (i === 1 ? { ...x, finMs: x.debutMs! + 800 } : i > 1 ? { ...x, debutMs: x.debutMs! - 2200, finMs: x.finMs! - 2200 } : x)) as FicheEcrans["ecrans"];
    const r = controlerVideoCasConcret(entree({ fiche: { ...f, ecrans } }));
    expect(r.bloquants.map((l) => l.libelle)).toContain("Durée des écrans");
    expect(r.verdict).toBe("bloque");
  });

  it("capture remplacée → indicatif, verdict ok", () => {
    const r = controlerVideoCasConcret(entree({ journalCaptures: ["Écran réel remplacé par un dessin : la capture a échoué (étape 2)."] }));
    expect(r.indicatifs).toHaveLength(1);
    expect(r.indicatifs[0].famille).toBe("capture");
    expect(r.verdict).toBe("ok");
  });

  it("X1 · le libellé n'est pas répété quand la raison commence par lui", () => {
    const r = controlerVideoCasConcret(entree({ journalCaptures: ["Écran réel remplacé par un dessin : la capture a échoué (étape 2)."] }));
    expect(r.phrases).toContain("À noter · Écran réel remplacé par un dessin : la capture a échoué (étape 2).");
    for (const p of r.phrases) expect(p).not.toMatch(/(\p{L}[\p{L} ]+) : \1/u);
  });

  it("fin réduite, bruitages absents, prise gardée malgré un rejet → trois indicatifs, verdict ok", () => {
    const plan = planDesFins({ ...base, reseaux: ["facebook"], offre: "formation" });
    const e = entree();
    const id = e.planDesFins.fins[0].id;
    const reduit = { ...e.planDesFins, reduites: plan.reduites.length ? plan.reduites : [{ reseaux: ["facebook" as const], raison: "Le mot n'est pas branché sur ce compte : la fin propose le diagnostic." }] };
    const r = controlerVideoCasConcret({ ...e, planDesFins: reduit, bruitagesPoses: [], finsGardeesMalgreRejet: [{ id, phrase: "la voix traîne" }] });
    expect(r.indicatifs.map((l) => l.famille).sort()).toEqual(["bruitage", "fin", "voix"]);
    expect(r.verdict).toBe("ok");
  });

  it("fiche non calée → durées non faites (jamais réussies)", () => {
    const r = controlerVideoCasConcret(entree({ fiche: ficheVideo1() }));
    expect(r.nonFaits.some((l) => l.famille === "duree")).toBe(true);
  });

  it("aucune zone sûre → mise en page non faite, sans erreur", () => {
    const r = controlerVideoCasConcret(entree({ zone: null }));
    expect(r.nonFaits.some((l) => l.famille === "mise-en-page")).toBe(true);
  });

  it("les seuils du format lisent la charte et la brique", () => {
    expect(SEUILS_CAS_CONCRET.tailleTexteMin).toBe(0.03);
    expect(SEUILS_CAS_CONCRET.contrasteTexteMin).toBe(7);
  });

  it("aucune phrase ne contient un identifiant interne ni un sigle", () => {
    const e = entree();
    const id = e.planDesFins.fins[0].id;
    const corps = e.proprietes.corps.map((p, i) => (i === 2 ? ({ ...p, marque: "" } as unknown as typeof p) : p));
    const r = controlerVideoCasConcret({
      ...e,
      proprietes: { corps },
      mesuresParFin: { [id]: { ...MESURES_BONNES, lufs: -16, hauteur: 1350, voixFinSec: 52 } },
      journalCaptures: ["Écran réel remplacé par un dessin : la capture a échoué (étape 2)."],
      bruitagesPoses: [],
      finsGardeesMalgreRejet: [{ id, phrase: "la voix traîne" }],
    });
    expect(r.phrases.length).toBeGreaterThan(4);
    for (const p of r.phrases) expect(p, p).not.toMatch(IDENTIFIANT);
    expect(r.resume).not.toMatch(IDENTIFIANT);
  });
});

describe("14/10 · fin propre lue sur le fichier exporté (indicatif, jamais bloquant)", () => {
  const id = () => entree().planDesFins.fins[0].id;
  it("fin coupée net : « la vidéo s'arrête net », à noter, verdict inchangé", () => {
    const r = controlerVideoCasConcret(entree({ mesuresParFin: { [id()]: { ...MESURES_BONNES, sonDerniere100msDb: -20, mouvementDerniereImage: 9 } } }));
    expect(r.verdict).toBe("ok");
    expect(r.bloquants).toEqual([]);
    const fin = r.indicatifs.find((l) => l.libelle === "Fin propre");
    expect(fin?.raison).toMatch(/la vidéo s'arrête net : le son n'est pas éteint/);
    expect(r.phrases.some((p) => p.startsWith("À noter · Fin propre"))).toBe(true);
    expect(r.phrases.join(" ")).not.toMatch(IDENTIFIANT);
  });
  it("fin propre : ligne réussie ; mesure absente (export d'avant) : aucune ligne", () => {
    const propre = controlerVideoCasConcret(entree({ mesuresParFin: { [id()]: { ...MESURES_BONNES, sonDerniere100msDb: -120, mouvementDerniereImage: 0 } } }));
    expect(propre.lignes.find((l) => l.libelle === "Fin propre")?.etat).toBe("reussi");
    expect(controlerVideoCasConcret(entree()).lignes.some((l) => l.libelle === "Fin propre")).toBe(false);
  });
});
