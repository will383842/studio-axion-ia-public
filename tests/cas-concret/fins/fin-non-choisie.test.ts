/**
 * FIX-CC-FIN-NON-CHOISIE (17/11, Williams) : le Studio ne dit et n'écrit jamais une phrase que l'utilisateur n'a pas écrite
 * ou choisie. Sans « Avec le mot » coché et branché, plus aucune fin : la vidéo s'arrête sur la question du script ; l'écran
 * « Relire et valider le script » montre tout ce qui sera dit et écrit. Doubles seulement, aucun appel réel.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TABLE_FINS_DIAGNOSTIC } from "@/briques/fins/table-diagnostic";
import { suiteDeFins } from "@/briques/fins";
import { FIN_APRES_DERNIER_MOT_SEC, type ReseauCas } from "@/formats/cas-concret";
import { CATALOGUE, trouverCas } from "@/formats/cas-concret/catalogue";
import { recettePour } from "@/formats/cas-concret/recette";
import { fournisseurVoixSimulation } from "@/fournisseurs/simulation/autres";
import { estimerDepuisCas } from "@/moteurs/montage-cas-concret";
import { corpsVise, dureeDiteMs, dureesDesFins, ficheParGabarit, PLACE_FIN_VIDE_MS, variableEcriture } from "@/moteurs/montage-cas-concret/ecriture";
import { texteDuCorps } from "@/moteurs/montage-cas-concret/fiche";
import { validerFicheEcrans } from "@/moteurs/montage-cas-concret/regles";
import { regrouperFins } from "@/moteurs/montage-cas-concret/etapes";
import { fabriquerCasConcret } from "@/moteurs/montage-cas-concret/fabriquer";
import { FIN_AUCUNE, planDesFins, RAISON_MOT_NON_BRANCHE } from "@/moteurs/montage-cas-concret/fins";
import { CONSIGNE_SANS_FIN, textesDePublication } from "@/moteurs/montage-cas-concret/publication";
import { lignesDesEcrans, rangDeLigne } from "@/moteurs/montage-cas-concret/relecture";
import { apercuDesEcrans } from "@/moteurs/montage-cas-concret/script-valide";
import { phraseDeFin } from "@/services/cas-concret-vue";
import { doubles, type Doubles } from "../fabriquer/doubles";

const CAS = trouverCas("contact-vers-crm")!;
const TOUS: ReseauCas[] = ["facebook", "instagram", "tiktok", "linkedin"];
const FIXE = { videoId: "video-cc", versionId: "v1", habillage: "charte-duo/1", origine: "porte-a" as const };
const demande = (o: { reseaux: ReseauCas[]; avecMot: boolean; motSur?: ReseauCas[] }) => ({ ...o, offre: CAS.offre, ...(CAS.nature ? { nature: CAS.nature } : {}), mot: CAS.mot, ...(CAS.motDit ? { motDit: CAS.motDit } : {}), table: TABLE_FINS_DIAGNOSTIC });
const FRAGMENTS_INTERDITS = /diagnostic|lien|commentaire|quelques minutes/i;

describe("FIX-CC-FIN-NON-CHOISIE · a) sans « Avec le mot » : fin vide", () => {
  it.each([[["facebook"]], [["tiktok"]], [["linkedin"]], [TOUS]] as [ReseauCas[]][])("réseaux %j : chaque fin n'a ni ligne ni écran", (reseaux) => {
    const plan = planDesFins(demande({ reseaux, avecMot: false }));
    expect(plan.sansFin).toEqual([]);
    expect(plan.fins.length).toBeGreaterThan(0);
    for (const f of plan.fins) {
      expect(f.appels).toEqual([]);
      expect(f.ecrans).toEqual([]);
    }
    expect(plan.fins.flatMap((f) => f.reseaux).sort()).toEqual([...reseaux].sort());
    expect(JSON.stringify(plan)).not.toContain("fin-fb-lien-commentaire");
  });

  it("les réseaux sans fin sont regroupés : un seul fichier", () => {
    expect(regrouperFins(planDesFins(demande({ reseaux: TOUS, avecMot: false }))).fins).toHaveLength(1);
  });
});

describe("FIX-CC-FIN-NON-CHOISIE · b) « Avec le mot » coché et branché : la fin au mot reste, mot pour mot", () => {
  const plan = planDesFins(demande({ reseaux: TOUS, avecMot: true, motSur: ["facebook"] }));
  const de = (r: ReseauCas) => plan.fins.find((f) => f.reseaux.includes(r))!;

  it("Facebook garde ses deux lignes et ses deux écrans, identiques à la table", () => {
    expect(de("facebook").appels.map((a) => a.id)).toEqual(["fin-if-mot", "fin-if-envoi-structure"]);
    const direct = suiteDeFins("facebook", ["fin-if-mot", "fin-if-envoi-structure"], { mot: CAS.mot, ...(CAS.motDit ? { motDit: CAS.motDit } : {}) }, TABLE_FINS_DIAGNOSTIC);
    expect(de("facebook").appels).toEqual(direct);
    expect(de("facebook").ecrans.map((e) => e.type)).toEqual(["appel-mot", "promesse"]);
    expect(de("facebook").ecrans.map((e) => e.texteDit).join(" ")).toBe(direct.map((a) => a.dit).join(" "));
  });

  it("TikTok, LinkedIn et Instagram (mot non branché) : fin vide, plus de repli sur le diagnostic", () => {
    for (const r of ["tiktok", "linkedin", "instagram"] as const) {
      expect(de(r).appels, r).toEqual([]);
      expect(de(r).ecrans, r).toEqual([]);
    }
    expect(JSON.stringify(plan)).not.toMatch(/diagnostic-gratuit|lien-profil|lien-commentaire/);
  });

  it("la raison du repli reste dite, pour Instagram", () => {
    expect(plan.reduites).toEqual([{ reseaux: ["instagram"], raison: RAISON_MOT_NON_BRANCHE }]);
  });
});

describe("FIX-CC-FIN-NON-CHOISIE · c) la fabrication d'une fin vide : le corps seul", () => {
  it("aucune voix de fin lue, aucun écran de fin, la dernière image est la question, aucun mot de fin dans les sous-titres", async () => {
    const d = doubles({ casId: "contact-vers-crm", reseaux: ["facebook"], avecMot: false });
    const cr = await fabriquerCasConcret(d.options);
    // Le corps seul est lu : une lecture payée, jamais le diagnostic ni le lien.
    expect(d.lus).toHaveLength(1);
    expect(d.lus[0]).not.toMatch(FRAGMENTS_INTERDITS);
    expect(cr.prises).toHaveLength(1);
    expect(cr.plan.fins).toHaveLength(1);
    expect(cr.plan.fins[0].ecrans).toEqual([]);
    // Aucun écran de fin (f01, f02…) : ni au plan, ni parmi les écrans rendus.
    expect(cr.fins).toHaveLength(1);
    expect(cr.ecrans.rendus.join(" ")).not.toMatch(/\bf0\d/);
    const dernier = cr.fiche.ecrans[cr.fiche.ecrans.length - 1];
    expect(dernier.type).toBe("question");
    // Aucun contrôle bloquant : la voix finit à 2,0 s au moins de la fin du fichier (le « ? » seul n'est pas un mot).
    expect(cr.rapport.lignes.filter((l) => l.bloquant && l.etat === "echoue")).toEqual([]);
    // Un seul assemblage : celui du corps seul (même traitement final de la recette, sans phrase de fin).
    expect(d.assemblages).toHaveLength(1);
    const morceaux = (d.assemblages[0].recette?.parametres.morceaux ?? []) as { source?: number }[];
    expect(morceaux.every((m) => (m.source ?? 0) === 0)).toBe(true);
    // Les sous-titres ne disent que le corps.
    for (const c of d.compositionsSoumises()) {
      const segments = ((c.parametres as { texte: { sousTitres?: { segments: { texte?: string; mots?: { mot?: string }[] }[] } } }).texte.sousTitres?.segments ?? []).map((s) => JSON.stringify(s)).join(" ");
      expect(segments).not.toMatch(FRAGMENTS_INTERDITS);
    }
    expect(cr.sousTitres?.map((s) => JSON.stringify(s)).join(" ") ?? "").not.toMatch(FRAGMENTS_INTERDITS);
  });

  it("4 réseaux sans choix : un seul fichier, un seul assemblage, toujours aucune lecture de fin", async () => {
    const d = doubles({ casId: "contact-vers-crm", avecMot: false });
    const cr = await fabriquerCasConcret(d.options);
    expect(cr.fins).toHaveLength(1);
    expect(cr.fins[0].reseaux.sort()).toEqual([...TOUS].sort());
    expect(d.lus).toHaveLength(1);
    expect(d.assemblages).toHaveLength(1);
  });

  it("la fin au mot choisie garde sa lecture de fin et ses écrans (Facebook), la fin vide n'en a pas (TikTok)", async () => {
    const d = doubles({ casId: "contact-vers-crm", reseaux: ["facebook", "tiktok"], avecMot: true, motSur: ["facebook"] });
    const cr = await fabriquerCasConcret(d.options);
    expect(cr.fins).toHaveLength(2);
    expect(d.lus).toHaveLength(2); // le corps, la fin au mot
    expect(d.lus.some((t) => /diagnostic|lien/i.test(t))).toBe(false);
    expect(d.assemblages).toHaveLength(2);
    const fb = cr.plan.fins.find((f) => f.reseaux.includes("facebook"))!;
    const tt = cr.plan.fins.find((f) => f.reseaux.includes("tiktok"))!;
    expect(fb.ecrans.length).toBeGreaterThan(0);
    expect(tt.ecrans).toEqual([]);
  });

  it("heures de mots estimées (voix sans heures) + fin vide : le son du corps entier, le corps calé, la réserve dite", async () => {
    const d = doubles({ casId: "contact-vers-crm", reseaux: ["facebook"], avecMot: false });
    d.options.outils.voix.voix = () => ({
      ...fournisseurVoixSimulation,
      async lire(demande) {
        return { ...(await fournisseurVoixSimulation.lire(demande)), mots: [] };
      },
    });
    const cr = await fabriquerCasConcret(d.options);
    expect(cr.reservesVoix).toContain("Voix sans heures des mots : sous-titres approximatifs, son gardé entier.");
    // Une seule lecture payée (le corps), un seul assemblage : un seul morceau, le son du corps entier, jamais une fin.
    expect(cr.prises).toHaveLength(1);
    const finals = d.assemblages.filter((a) => a.recette);
    expect(finals).toHaveLength(1);
    expect(finals[0].morceaux).toHaveLength(1);
    expect(finals[0].morceaux[0].deSec).toBe(0);
    expect(finals[0].morceaux[0].aSec).toBeGreaterThan(0);
    // Les écrans du corps sont calés, dans l'ordre, sans trou ni recouvrement, et aucun écran de fin.
    const e = cr.fiche.ecrans;
    expect(cr.plan.fins[0].ecrans).toEqual([]);
    for (let i = 0; i < e.length; i++) {
      expect(e[i].finMs!).toBeGreaterThan(e[i].debutMs!);
      if (i > 0) expect(e[i].debutMs!).toBeGreaterThanOrEqual(e[i - 1].finMs! - 1);
    }
    expect(cr.rapport.lignes.filter((l) => l.bloquant && l.etat === "echoue")).toEqual([]);
  });
});

describe("FIX-CC-FIN-NON-CHOISIE · d) l'estimation ne compte plus la voix d'une fin", () => {
  it("avecMot: false : la voix estimée est celle du corps seul, et jamais celle d'un diagnostic de plus", () => {
    const voixDe = (reseaux: ReseauCas[]) => estimerDepuisCas(CAS, reseaux, false, { voix: { fournisseur: "heygen" } }).lignes.filter((l) => /voix/i.test(l.etape));
    const un = voixDe(["facebook"]);
    const quatre = voixDe(TOUS);
    // Plus de fin par réseau : le prix de la voix ne dépend plus du nombre de réseaux.
    expect(quatre).toEqual(un);
    // Avant (master du 17/11, 4 réseaux) : 2 790 caractères lus, 81 centimes ; une fin de plus par groupe de réseaux.
    expect(quatre[0].quantite).toBeLessThan(2790);
    expect(quatre[0].total.centimes).toBeLessThan(81);
  });

  // T1 (ARGENT) : le prix annoncé ne monte jamais. Référence : `origin/master` du 18/11 (5509bc3), 118 cas × 6 scénarios = 708 prix,
  // fabriquée AVANT les corrections (somme de `lignes[].total.centimes`, voix HeyGen) ; elle remplace l'ancien cas « UN réseau ».
  const REFERENCE = JSON.parse(readFileSync(join(process.cwd(), "tests/cas-concret/prix/prix-avant-fin-non-choisie.json"), "utf8")) as { master: string; prix: Record<string, number> };
  const SCENARIOS: [string, ReseauCas[], boolean, ReseauCas[] | undefined][] = [
    ["facebook", ["facebook"], false, undefined],
    ["linkedin", ["linkedin"], false, undefined],
    ["tiktok", ["tiktok"], false, undefined],
    ["4reseaux", TOUS, false, undefined],
    ["4reseaux-mot-fb", TOUS, true, ["facebook"]],
    ["facebook-mot-fb", ["facebook"], true, ["facebook"]],
  ];
  const prixDe = (cas: (typeof CATALOGUE)[number], reseaux: ReseauCas[], avecMot: boolean, motSur?: ReseauCas[]) =>
    estimerDepuisCas(cas, reseaux, avecMot, { voix: { fournisseur: "heygen" }, ...(motSur ? { motSur } : {}) }).lignes.reduce((n, l) => n + l.total.centimes, 0);

  it("la référence couvre les 708 combinaisons", () => {
    expect(Object.keys(REFERENCE.prix)).toHaveLength(CATALOGUE.length * SCENARIOS.length);
    expect(CATALOGUE).toHaveLength(118);
  });

  it("le prix annoncé ne monte jamais : chaque combinaison est au plus égale à la référence de master", () => {
    const hausses: string[] = [];
    for (const cas of CATALOGUE) for (const [nom, reseaux, avecMot, motSur] of SCENARIOS) {
      const cle = `${cas.id}|${nom}`;
      const avant = REFERENCE.prix[cle];
      const apres = prixDe(cas, reseaux, avecMot, motSur);
      if (apres > avant) hausses.push(`${cle} : ${avant} → ${apres}`);
    }
    expect(hausses).toEqual([]);
  }, 120_000);

  it("la fin au mot seule (Facebook, mot sur Facebook) : exactement le même prix qu'avant, 118 cas", () => {
    for (const cas of CATALOGUE) expect(prixDe(cas, ["facebook"], true, ["facebook"]), cas.id).toBe(REFERENCE.prix[`${cas.id}|facebook-mot-fb`]);
}, 60_000);

  it("contact-vers-crm : 1,84 € → 1,78 € (Facebook), 1,96 → 1,78 (4 réseaux), 1,94 → 1,82 (mixte)", () => {
    expect(REFERENCE.prix["contact-vers-crm|facebook"]).toBe(184);
    expect(prixDe(CAS, ["facebook"], false)).toBeLessThanOrEqual(178);
    expect(REFERENCE.prix["contact-vers-crm|4reseaux"]).toBe(196);
    expect(prixDe(CAS, TOUS, false)).toBeLessThanOrEqual(178);
    expect(REFERENCE.prix["contact-vers-crm|4reseaux-mot-fb"]).toBe(194);
    expect(prixDe(CAS, TOUS, true, ["facebook"])).toBeLessThanOrEqual(182);
  });
});

// T2 : la consigne donnée à Claude et l'estimation visent le même corps (même `dureesDesFins`).
describe("FIX-CC-FIN-NON-CHOISIE · d bis) sans fin : la consigne et l'estimation visent le même corps", () => {
  it.each(["contact-vers-crm", "rendez-vous-classes", "compte-rendu-visio"])("%s : <duree_fins> = la visée de ficheParGabarit, aucune fiche refusée par R21", (id) => {
    const cas = trouverCas(id)!;
    const plan = regrouperFins(planDesFins({ reseaux: TOUS, offre: cas.offre, ...(cas.nature ? { nature: cas.nature } : {}), mot: cas.mot, ...(cas.motDit ? { motDit: cas.motDit } : {}), avecMot: false, table: TABLE_FINS_DIAGNOSTIC }));
    expect(plan.fins.every((f) => f.ecrans.length === 0)).toBe(true);
    const d = dureesDesFins(plan.fins)!;
    expect(d.plusCourteMs).toBe(PLACE_FIN_VIDE_MS);
    const vise = corpsVise(d);
    const consigne = variableEcriture(cas, recettePour(cas), FIXE, plan.fins);
    const m = /corps à viser de (\d+(?:,\d+)?) s à (\d+(?:,\d+)?) s/.exec(consigne);
    expect(m, "la consigne dit le corps à viser").not.toBeNull();
    expect(Math.abs(Number(m![1].replace(",", ".")) - vise.minMs / 1000)).toBeLessThanOrEqual(0.05);
    expect(Math.abs(Number(m![2].replace(",", ".")) - vise.maxMs / 1000)).toBeLessThanOrEqual(0.05);
    const fiche = ficheParGabarit(cas, FIXE, d);
    expect(dureeDiteMs(fiche.ecrans)).toBeGreaterThanOrEqual(vise.minMs);
    expect(dureeDiteMs(fiche.ecrans)).toBeLessThanOrEqual(vise.maxMs);
    const v = validerFicheEcrans(fiche, { cas, texteScript: texteDuCorps(fiche), fins: plan.fins });
    expect(v.ok ? [] : v.problemes.map((p) => p.message)).toEqual([]);
  });
});

describe("FIX-CC-FIN-NON-CHOISIE · c bis) plan mixte : la fin au mot sur Facebook, aucune fin ailleurs", () => {
  const FICHE = ficheParGabarit(CAS, FIXE);
  const avecFiche = (d: Doubles): Doubles => {
    d.options.entrees = { ...d.options.entrees, ficheCle: "studio/dev/fiches/video-cc.json" };
    d.options.lireFiche = async () => structuredClone(FICHE);
    return d;
  };
  const plansDe = (d: Doubles, i: number) => (d.compositionsSoumises()[i].parametres as unknown as { dureeSec: number; image: { plans: { debutSec: number; finSec: number }[] } });

  // T3 : rouge sur cf7229e (« la voix finit à 0,4 s ; il faut 2,0 s »).
  it("T3 · aucune réserve « la voix finit à… » ; le fichier de la fin vide tient sa voix + la tenue ; celui de Facebook est celui de « Facebook seul »", async () => {
    const mixte = avecFiche(doubles({ casId: "contact-vers-crm", reseaux: TOUS, avecMot: true, motSur: ["facebook"] }));
    const cr = await fabriquerCasConcret(mixte.options);
    expect(cr.rapport.lignes.filter((l) => l.bloquant && l.etat === "echoue")).toEqual([]);
    // Le contrôle « la voix finit à X s ; il faut 2,0 s » ne se déclenche pas : aucune ligne du rapport qui le dit n'est en échec ou à vérifier.
    expect(cr.rapport.lignes.filter((l) => l.etat !== "reussi" && /la voix finit à/.test(JSON.stringify(l)))).toEqual([]);
    expect(JSON.stringify(cr.reservesVoix ?? [])).not.toMatch(/la voix finit à/);
    expect(cr.fins).toHaveLength(2);
    const iFb = cr.fins.findIndex((f) => f.reseaux.includes("facebook"));
    const iVide = 1 - iFb;

    // Référence « tout vide » (même fiche) : sa fin dure dernier mot + tenue (calage.ts), sans instant commun.
    const tousVides = avecFiche(doubles({ casId: "contact-vers-crm", reseaux: TOUS, avecMot: false }));
    const crVide = await fabriquerCasConcret(tousVides.options);
    expect(crVide.fins).toHaveLength(1);
    const dureeVide = cr.fins[iVide].dureeSec;
    expect(Math.abs(dureeVide - crVide.fins[0].dureeSec)).toBeLessThanOrEqual(0.04 + 1e-9);
    // Pas coupée à l'instant commun (début des écrans de la fin au mot) : elle va plus loin que le dernier écran du corps du fichier de Facebook.
    expect(dureeVide).toBeGreaterThan(cr.fiche.ecrans[cr.fiche.ecrans.length - 1].finMs! / 1000 + FIN_APRES_DERNIER_MOT_SEC - 0.5);
    // La dernière scène du fichier de la fin vide va jusqu'à la fin de sa voix + tenue.
    const vide = plansDe(mixte, iVide);
    expect(vide.dureeSec).toBeCloseTo(dureeVide, 2);
    expect(vide.image.plans[vide.image.plans.length - 1].finSec).toBeCloseTo(dureeVide, 2);

    // Le fichier de Facebook : mêmes scènes, même durée que « Facebook seul, mot sur Facebook » (même fiche).
    const seul = avecFiche(doubles({ casId: "contact-vers-crm", reseaux: ["facebook"], avecMot: true, motSur: ["facebook"] }));
    const crSeul = await fabriquerCasConcret(seul.options);
    expect(cr.fins[iFb].dureeSec).toBe(crSeul.fins[0].dureeSec);
    expect(plansDe(mixte, iFb).image.plans).toEqual(plansDe(seul, 0).image.plans);
  });

  // T5 : vide → mot, sur la même fiche : seule la fin est payée.
  it("T5 · fin vide puis fin au mot (Facebook seul) : la prise du corps n'est pas relue, la seule lecture est la fin au mot", async () => {
    const d1 = avecFiche(doubles({ casId: "contact-vers-crm", reseaux: ["facebook"], avecMot: false, motSur: [] }));
    const cr1 = await fabriquerCasConcret(d1.options);
    expect(cr1.plan.fins[0].ecrans).toEqual([]);
    expect(cr1.prises.filter((p) => p.prise === "corps")).toHaveLength(1);
    const d2 = avecFiche(doubles({ partage: d1.partage, casId: "contact-vers-crm", reseaux: ["facebook"], avecMot: true, motSur: ["facebook"] }));
    const cr2 = await fabriquerCasConcret(d2.options);
    expect(cr2.plan.fins[0].ecrans.length).toBeGreaterThan(0);
    expect(cr2.prises.filter((p) => p.prise === "corps")).toEqual([]);
    expect(d2.lus).toHaveLength(1);
    expect(d2.lus[0]).toMatch(/Écrivez/);
  });
});

describe("FIX-CC-FIN-NON-CHOISIE · e) l'écran « Relire et valider le script » montre la fin", () => {
  const apercu = apercuDesEcrans(ficheParGabarit(CAS, FIXE).ecrans);

  it("sans choix : une dernière ligne verrouillée, groupe « Fin », texte FIN_AUCUNE", () => {
    expect(FIN_AUCUNE).toBe("Fin : aucune (votre choix). Rien n'est dit ni écrit après la question.");
    const lignes = lignesDesEcrans(apercu, [{ reseaux: "facebook-instagram-tiktok-linkedin", dit: FIN_AUCUNE, ecrits: [] }]);
    const derniere = lignes[lignes.length - 1];
    // 18/11 (FIX-CC-ECRAN-SCRIPT-COMPLET, amendement n°1) : les textes posés par le Studio sont sur des lignes verrouillées `p-eNN` à part ; on compte les lignes hors poses, même attente exacte qu'avant, puis les poses.
    expect(lignes.filter((l) => !l.id.startsWith("p-"))).toHaveLength(apercu.length + 1);
    const poses = lignes.filter((l) => l.id.startsWith("p-"));
    expect(poses).toHaveLength(apercu.filter((e) => (e.poses ?? []).length > 0).length);
    expect(poses.every((l) => l.verrouille === true)).toBe(true);
    expect(derniere).toMatchObject({ id: "f-facebook-instagram-tiktok-linkedin", dit: FIN_AUCUNE, groupe: "Fin", verrouille: true });
    expect(derniere.ecrits).toEqual([]);
    expect(rangDeLigne(derniere.id)).toBeNull();
  });

  it("avec la fin au mot : sa phrase dite et ses textes écrits, mot pour mot", () => {
    const [fin] = planDesFins(demande({ reseaux: ["facebook"], avecMot: true, motSur: ["facebook"] })).fins;
    const ecrits = apercuDesEcrans(fin.ecrans).flatMap((e) => e.affiches);
    const dit = fin.ecrans.map((e) => e.texteDit.trim()).join(" ");
    const derniere = lignesDesEcrans(apercu, [{ reseaux: "facebook", dit, ecrits }]).at(-1)!;
    expect(derniere).toMatchObject({ dit, groupe: "Fin", verrouille: true });
    expect(dit).toBe("Écrivez C.R.M. en commentaire. Je vous envoie la structure complète.");
    expect(derniere.ecrits?.map((x) => x.texte)).toEqual(ecrits);
    expect(ecrits.length).toBeGreaterThan(0);
    expect(derniere.ecrits?.every((x) => x.modifiable === false)).toBe(true);
  });

  it("sans fins passées : les lignes d'avant, inchangées", () => {
    const lignes = lignesDesEcrans(apercu);
    // 18/11 (FIX-CC-ECRAN-SCRIPT-COMPLET, amendement n°1) : les textes posés par le Studio sont sur des lignes verrouillées `p-eNN` à part ; on compte les lignes hors poses, même attente exacte qu'avant, puis les poses.
    expect(lignes.filter((l) => !l.id.startsWith("p-"))).toHaveLength(apercu.length);
    const poses = lignes.filter((l) => l.id.startsWith("p-"));
    expect(poses).toHaveLength(apercu.filter((e) => (e.poses ?? []).length > 0).length);
    expect(poses.every((l) => l.verrouille === true)).toBe(true);
    expect(lignes.every((l) => l.groupe !== "Fin")).toBe(true);
  });

  it("« Vos fichiers » écrit FIN_AUCUNE pour une fin vide", () => {
    expect(phraseDeFin([])).toBe(FIN_AUCUNE);
    expect(phraseDeFin(["rendez-vous", "lien"])).toBe("Fin : diagnostic et lien");
  });
});

describe("FIX-CC-FIN-NON-CHOISIE · f) les textes de publication d'une fin vide", () => {
  const fiche = ficheParGabarit(CAS, FIXE);
  const plan = planDesFins(demande({ reseaux: TOUS, avecMot: false }));
  const textes = textesDePublication(fiche, plan, { facebook: "https://x/fb", instagram: "https://x/ig", tiktok: "https://x/tt", linkedin: "https://x/li" }, { mot: CAS.mot });

  it("un texte par réseau, sans lien ni premier commentaire, sans phrase d'appel", () => {
    expect(textes.map((t) => t.reseau).sort()).toEqual([...TOUS].sort());
    for (const t of textes) {
      expect(t.ouPoserLeLien, t.reseau).toBe("aucun");
      expect(t.premierCommentaire, t.reseau).toBeUndefined();
      expect(t.consigneLien, t.reseau).toBe(CONSIGNE_SANS_FIN);
      expect(t.texte, t.reseau).not.toMatch(FRAGMENTS_INTERDITS);
      expect(t.texte, t.reseau).not.toContain("https://");
      expect(t.texte.length, t.reseau).toBeGreaterThan(0);
    }
  });
});
