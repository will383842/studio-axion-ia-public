/**
 * Fins du 26/10/2026 (validées par Will) : ACCROCHE + APPEL + PHRASE DU LIEN, dits à la suite, identiques sur tous les
 * réseaux d'une vidéo ; seule la phrase du lien change. Banque, choix par numéro de version (pur, sans répétition
 * d'accroche), regroupement des réseaux, LinkedIn non muet, liens suivis et plafonds de durée avec une fin de 8 à 9 s.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { idElementBruitage, SONS_BANQUE } from "@/donnees/bruitages";
import { pisteSimulee } from "@/moteurs/montage-image-video/calage";
import { FICHES_SIMULEES } from "@/moteurs/montage-image-video/ecriture.simulation";
import { FINS_INTERDITES, mettreEnSceneIV } from "@/moteurs/montage-image-video/mise-en-scene";
import { ecransIrrendables, scenesDeLaLigne } from "@/services/image-video-rendu";
import { BANQUE_APPELS, appelDeLaBanque, nombreMots } from "@/briques/fins";
import { motsDeLaPlusLonguePhrase } from "@/briques/fins";
import { RESEAUX_IV, PLAFONDS_IV, type ReseauIV } from "@/domaine/image-video/plafonds";
import {
  ACCROCHES_APPEL_IV,
  ACCROCHES_TOUR_IV,
  APPELS_ACCOMPAGNEMENT_IV,
  APPELS_DIAGNOSTIC_IV,
  INVITATIONS_TOUR_IV,
  LIEN_FIN_IV,
  PAGE_TOUR_DE_FRANCE_IA,
  choixDeFinIV,
  finDuReseauIV,
  finsTourActivesIV,
  liensSuivisIV,
  planDesFinsIV,
  sorteDuPlanIV,
  type PlanDesFinsIV,
} from "@/moteurs/montage-image-video/fins";
import { FINS_DE_SECOURS_IV, etapeDeSecoursIV, peutRelireIV } from "@/moteurs/montage-image-video/secours";
import { MOTS_INTERDITS_FORMAT } from "@/moteurs/montage-image-video/emprunts";
import { textesDePublicationIV } from "@/moteurs/montage-image-video/publication";
import { verdictReseau } from "@/moteurs/montage-image-video/reseaux";
import { texteDeFinIV } from "@/moteurs/montage-image-video/texte-fin";

const LIGNES_IV = BANQUE_APPELS.filter((a) => a.code.startsWith("fin-iv-"));
const TOUS_RESEAUX: readonly ReseauIV[] = ["tiktok", ...RESEAUX_IV];
const contenu = { accroche: "Vos clients écrivent à 23 h 14 et personne ne répond.", resultat: "Une réponse en quatre secondes." };

describe("banque : les phrases validées", () => {
  it("trente-quatre lignes neuves, toutes validées, pour la vidéo, au public « clients »", () => {
    expect(LIGNES_IV).toHaveLength(34);
    for (const a of LIGNES_IV) {
      expect(a.etat, a.code).toBe("valide");
      expect(a.typeContenu, a.code).toBe("video");
      expect(a.public, a.code).toBe("public.clients");
    }
  });

  it("les treize accroches, mot pour mot (accents et apostrophes français)", () => {
    expect(ACCROCHES_APPEL_IV.map((c) => appelDeLaBanque(c)!.dit)).toEqual([
      "Vous savez qu'il faut automatiser, mais pas par où commencer ?",
      "Automatiser, oui. Mais quoi en premier ?",
      "Vous ne savez pas quoi automatiser chez vous ? C'est normal.",
      "Quelles tâches de votre entreprise pourraient tourner toutes seules ?",
      "Beaucoup d'entreprises ne savent pas quoi automatiser. Et vous ?",
      "Par où commencer avec l'IA dans votre entreprise ?",
      "Et si votre entreprise gagnait en productivité et en rentabilité ?",
      "Et si votre équipe passait moins de temps sur le répétitif ?",
      "Et si vos journées se libéraient pour l'essentiel ?",
      "Vous voulez savoir ce que l'IA ferait chez vous ?",
      "Et si l'IA s'occupait de ce qui vous fait perdre du temps ?",
      "Et chez vous, quelle tâche revient tous les jours ?",
      "Combien de temps perdez-vous chaque semaine sur ça ?",
    ]);
  });

  it("les appels diagnostic (quatre) et accompagnement (trois)", () => {
    expect(APPELS_DIAGNOSTIC_IV.map((c) => appelDeLaBanque(c)!.dit)).toEqual([
      "Réservez un appel : on identifie ensemble ce qu'on peut automatiser chez vous.",
      "Réservez un appel : un diagnostic de ce qu'on peut automatiser chez vous.",
      "Réservez un appel gratuit : on regarde ensemble par où commencer.",
      "Réservez un appel : on fait le point sur ce que l'IA peut faire chez vous.",
    ]);
    expect(APPELS_ACCOMPAGNEMENT_IV.map((c) => appelDeLaBanque(c)!.dit)).toEqual([
      "Réservez un appel : on vous accompagne, de l'idée à la mise en place.",
      "Réservez un appel : on choisit avec vous ce qui vaut la peine d'être automatisé.",
      "Réservez un appel : on vous accompagne pour automatiser ce qui compte.",
    ]);
  });

  it("les fins Tour de France IA : six accroches, cinq invitations", () => {
    expect(ACCROCHES_TOUR_IV.map((c) => appelDeLaBanque(c)!.dit)).toEqual([
      "Axion-IA fait son tour de France.",
      "L'IA fait le tour de France.",
      "Et si Axion-IA venait chez vous ?",
      "Une étape près de chez vous ? Axion-IA fait son tour de France.",
      "Axion-IA va à la rencontre des entreprises de toute la France.",
      "Des entreprises de toute la France se lancent dans l'IA, ensemble.",
    ]);
    expect(INVITATIONS_TOUR_IV.map((c) => appelDeLaBanque(c)!.dit)).toEqual([
      "Découvrez le concept.",
      "Découvrez le concept du Tour de France IA.",
      "Découvrez comment participer.",
      "Envie d'en faire partie ? Découvrez le concept.",
      "Découvrez le Tour et participez à une étape.",
    ]);
  });

  it("la phrase du lien de chaque réseau", () => {
    const dit = (r: ReseauIV) => appelDeLaBanque(LIEN_FIN_IV[r])!.dit;
    expect(dit("instagram")).toBe("Le lien est dans mon profil.");
    expect(dit("tiktok")).toBe("Le lien est dans mon profil.");
    expect(dit("youtube-shorts")).toBe("Le lien est sur ma chaîne.");
    expect(dit("facebook")).toBe("Le lien est en premier commentaire.");
    expect(dit("linkedin")).toBe("Le lien est en premier commentaire.");
    // Facebook et LinkedIn : la même ligne (même phrase exacte, un seul fichier de fin).
    expect(LIEN_FIN_IV.facebook).toBe(LIEN_FIN_IV.linkedin);
    expect(LIEN_FIN_IV.instagram).toBe(LIEN_FIN_IV.tiktok);
  });

  it("règles : 12 mots au plus par phrase, 8 à l'écran, aucun chiffre, aucun mot interdit, aucune promesse de résultat", () => {
    const interdits = [...MOTS_INTERDITS_FORMAT, "machine", "Grenoble", "certifié", "certifie", "Aucun gain garanti"];
    for (const a of LIGNES_IV) {
      expect(motsDeLaPlusLonguePhrase(a.dit), a.code).toBeLessThanOrEqual(12);
      expect(nombreMots(a.ecran), a.code).toBeLessThanOrEqual(8);
      expect(a.dit + a.ecran, a.code).not.toMatch(/\d/);
      for (const m of interdits) expect(`${a.dit} ${a.ecran}`.toLowerCase(), `${a.code} · ${m}`).not.toContain(m.toLowerCase());
      expect(a.dit + a.ecran, a.code).not.toMatch(/garanti|\{MOT\}|commentez|écrivez/i);
    }
  });
});

describe("choix de la fin par numéro de version (pur)", () => {
  const de = (n: number, tourActif = false) => choixDeFinIV(n, { tourActif });

  it("est déterministe", () => {
    for (const n of [1, 2, 3, 4, 57, 9999]) expect(de(n)).toEqual(de(n));
    expect(() => choixDeFinIV(0)).toThrow();
    expect(() => choixDeFinIV(1.5)).toThrow();
  });

  it("jamais la même accroche sur deux numéros consécutifs (Tour activé ou non)", () => {
    for (const tour of [false, true]) {
      for (let n = 1; n < 2000; n++) expect(de(n, tour).accroche, `n=${n} tour=${tour}`).not.toBe(de(n + 1, tour).accroche);
    }
  });

  it("Tour désactivé (page inconnue) : aucune fin Tour ; deux sur trois diagnostic, un sur trois accompagnement", () => {
    expect(PAGE_TOUR_DE_FRANCE_IA).toBeNull();
    expect(finsTourActivesIV()).toBe(false);
    const sortes = Array.from({ length: 1200 }, (_, i) => choixDeFinIV(i + 1).sorte);
    expect(sortes.filter((s) => s === "tour")).toHaveLength(0);
    expect(sortes.filter((s) => s === "diagnostic")).toHaveLength(800);
    expect(sortes.filter((s) => s === "accompagnement")).toHaveLength(400);
  });

  it("Tour activé : un quart Tour, un tiers accompagnement, le reste (cinq douzièmes) diagnostic", () => {
    const sortes = Array.from({ length: 1200 }, (_, i) => de(i + 1, true).sorte);
    expect(sortes.filter((s) => s === "tour")).toHaveLength(300);
    expect(sortes.filter((s) => s === "diagnostic")).toHaveLength(500);
    expect(sortes.filter((s) => s === "accompagnement")).toHaveLength(400);
  });

  it("chaque sorte tire ses propres lignes, et toutes les lignes tournent", () => {
    const vues = new Set<string>();
    for (let n = 1; n <= 600; n++) {
      const c = de(n, true);
      vues.add(c.accroche);
      vues.add(c.appel);
      if (c.sorte === "tour") {
        expect(ACCROCHES_TOUR_IV).toContain(c.accroche);
        expect(INVITATIONS_TOUR_IV).toContain(c.appel);
      } else {
        expect(ACCROCHES_APPEL_IV).toContain(c.accroche);
        expect((c.sorte === "diagnostic" ? APPELS_DIAGNOSTIC_IV : APPELS_ACCOMPAGNEMENT_IV)).toContain(c.appel);
      }
    }
    for (const c of [...ACCROCHES_APPEL_IV, ...APPELS_DIAGNOSTIC_IV, ...APPELS_ACCOMPAGNEMENT_IV, ...ACCROCHES_TOUR_IV, ...INVITATIONS_TOUR_IV]) expect(vues.has(c), c).toBe(true);
  });
});

describe("plan des fins du 26/10/2026", () => {
  const base = { reseaux: RESEAUX_IV, offre: "integration" as const };
  const plan = planDesFinsIV({ ...base, numeroVersion: 6 });
  const finDe = (r: ReseauIV) => plan.fins.find((f) => f.reseaux.includes(r))!;

  it("même accroche et même appel sur tous les réseaux ; seule la phrase du lien change", () => {
    const c = choixDeFinIV(6);
    for (const r of RESEAUX_IV) expect(finDe(r).appels.slice(0, 2).map((a) => a.id), r).toEqual([c.accroche, c.appel]);
    expect(finDe("instagram").appels[2].dit).toBe("Le lien est dans mon profil.");
    expect(finDe("youtube-shorts").appels[2].dit).toBe("Le lien est sur ma chaîne.");
    expect(finDe("facebook").appels[2].dit).toBe("Le lien est en premier commentaire.");
    expect(finDe("linkedin").appels[2].dit).toBe("Le lien est en premier commentaire.");
  });

  it("la question de commentaire n'est plus posée par défaut", () => {
    expect(plan.fins.every((f) => f.question === undefined)).toBe(true);
    expect(plan.sansFin).toEqual([]);
    expect(plan.reduites).toEqual([]);
  });

  it("regroupe les réseaux dont la suite est identique : Facebook + LinkedIn un fichier, Shorts seul, Instagram seul", () => {
    expect(plan.fins.map((f) => f.reseaux)).toEqual([["youtube-shorts"], ["linkedin", "facebook"], ["instagram"]]);
    expect(new Set(plan.fins.map((f) => f.id)).size).toBe(3);
  });

  it("Instagram + TikTok partageraient un fichier : mêmes lignes, mêmes phrases dites et écrites", () => {
    const c = choixDeFinIV(6);
    const sans = (r: ReseauIV) => finDuReseauIV(r, c).map(({ id, dit, ecran, type }) => ({ id, dit, ecran, type }));
    expect(sans("tiktok")).toEqual(sans("instagram"));
    // …et jamais celles de Shorts ni de Facebook (phrase du lien différente).
    expect(sans("youtube-shorts")).not.toEqual(sans("instagram"));
    expect(sans("facebook")).not.toEqual(sans("instagram"));
    expect(sans("facebook")).toEqual(sans("linkedin"));
  });

  it("LinkedIn dit et affiche la fin comme les autres (jamais muet)", () => {
    const f = finDe("linkedin");
    expect(f.muet).toBe(false);
    expect(f.appels.map((a) => a.ecran).every(Boolean)).toBe(true);
    expect(texteDeFinIV(f)).toBe(texteDeFinIV(finDe("facebook")));
    expect(texteDeFinIV(f)).toMatch(/Le lien est en premier commentaire\.$/);
  });

  it("le réglage question-puis-fin existe toujours : la question passe avant la fin, LinkedIn compris", () => {
    const q = "Et chez vous, combien de messages attendent jusqu'au lendemain ?";
    const p = planDesFinsIV({ ...base, numeroVersion: 6, appelCommentaire: "question-puis-fin", questionCommentaire: q });
    for (const f of p.fins) expect(f.question?.dit).toBe(q);
    expect(p.fins.map((f) => f.reseaux)).toEqual([["youtube-shorts"], ["linkedin", "facebook"], ["instagram"]]);
  });

  it("sans numéro de version : la fin de la version un (jamais une erreur, le lien suivi, lui, l'exige)", () => {
    expect(planDesFinsIV(base).fins[0].appels[0].id).toBe(choixDeFinIV(1).accroche);
  });

  it("la fin au mot reste inchangée quand tout est branché (Facebook et Instagram), LinkedIn garde la fin habituelle", () => {
    const p = planDesFinsIV({ ...base, numeroVersion: 6, mot: "IA", motSur: ["instagram", "facebook"], cadeauReel: true });
    expect(p.fins.find((f) => f.reseaux.includes("instagram"))!.appels.map((a) => a.id)).toEqual(["fin-ig-mot-abonnement"]);
    expect(p.fins.find((f) => f.reseaux.includes("linkedin"))!.reseaux).toEqual(["linkedin"]);
    expect(p.fins.find((f) => f.reseaux.includes("linkedin"))!.appels).toHaveLength(3);
  });

  it("sorteDuPlanIV lit la sorte de la fin", () => {
    expect(sorteDuPlanIV(planDesFinsIV({ ...base, numeroVersion: 1 }))).toBe("diagnostic");
    expect(sorteDuPlanIV(planDesFinsIV({ ...base, numeroVersion: 2 }))).toBe("accompagnement");
  });
});

describe("liens suivis : la fin Tour pointe vers la page du Tour, jamais le diagnostic", () => {
  it("les fins d'appel gardent la page du diagnostic, un lien par réseau avec son utm_source", () => {
    const liens = liensSuivisIV(RESEAUX_IV, 6);
    for (const r of RESEAUX_IV) {
      const u = new URL(liens[r]);
      expect(u.pathname).toBe("/fr/diagnostic");
      expect(u.searchParams.get("utm_source")).toBe(r);
      expect(u.searchParams.get("utm_campaign")).toMatch(/^0006-IV-/);
    }
  });

  it("la page du Tour n'est pas connue : aucun lien Tour n'est inventé (erreur claire), les fins Tour restent désactivées", () => {
    expect(() => liensSuivisIV(RESEAUX_IV, 4, "clients", "tour")).toThrow(/page du Tour de France IA n'est pas connue/);
  });
});

describe("publication", () => {
  const liens = liensSuivisIV(RESEAUX_IV, 6);
  const plan = planDesFinsIV({ reseaux: RESEAUX_IV, offre: "integration", numeroVersion: 6 });

  it("LinkedIn : le post reprend l'appel et la phrase du lien, le lien est en premier commentaire, jamais « commentez »", () => {
    const pub = textesDePublicationIV(contenu, plan, liens);
    expect(pub.manquements).toEqual([]);
    const li = pub.textes.find((t) => t.reseau === "linkedin")!;
    expect(li.texte).toContain(`${appelDeLaBanque(choixDeFinIV(6).appel)!.dit} Le lien est en premier commentaire.`);
    expect(li.texte).not.toMatch(/commentez/i);
    expect(li.ouPoserLeLien).toBe("premier-commentaire");
    expect(li.premierCommentaire).toContain(liens.linkedin);
  });

  it("le plan d'une vidéo faite avant (LinkedIn muet) garde son ancien texte, qui ne change pas", () => {
    const fins: PlanDesFinsIV["fins"] = [
      ...plan.fins.filter((f) => !f.reseaux.includes("linkedin")),
      { ...plan.fins.find((f) => f.reseaux.includes("facebook"))!, id: "fin-facebook", reseaux: ["facebook"] },
      { id: "fin-linkedin", reseaux: ["linkedin"], muet: true, appels: [] },
    ];
    const ancien: PlanDesFinsIV = { ...plan, fins };
    const li = textesDePublicationIV({ ...contenu, questionCommentaire: "Et chez vous, quelle tâche revient tous les jours ?" }, ancien, liens).textes.find((t) => t.reseau === "linkedin")!;
    expect(li.texte).toContain("Et chez vous, quelle tâche revient tous les jours ?");
    expect(li.texte).toContain(appelDeLaBanque("fin-li-rdv-texte")!.legende);
    expect(li.premierCommentaire).toContain(liens.linkedin);
  });

  it("la fin Tour a son premier commentaire (jamais « Votre diagnostic gratuit »)", () => {
    const c = choixDeFinIV(4, { tourActif: true });
    expect(c.sorte).toBe("tour");
    const fins = [
      { id: "fin-linkedin-facebook", reseaux: ["linkedin", "facebook"] as ReseauIV[], muet: false, appels: finDuReseauIV("facebook", c) },
      { id: "fin-instagram", reseaux: ["instagram"] as ReseauIV[], muet: false, appels: finDuReseauIV("instagram", c) },
    ];
    const lienTour = { linkedin: "https://exemple.test/tour?a=1", facebook: "https://exemple.test/tour?a=2", instagram: "https://exemple.test/tour?a=3" };
    const pub = textesDePublicationIV(contenu, { fins, reduites: [], sansFin: [] }, lienTour);
    expect(sorteDuPlanIV({ fins })).toBe("tour");
    expect(pub.textes.find((t) => t.reseau === "linkedin")!.premierCommentaire).toBe("Le Tour de France IA : https://exemple.test/tour?a=1");
    expect(pub.textes.find((t) => t.reseau === "facebook")!.premierCommentaire).toBe("Le Tour de France IA : https://exemple.test/tour?a=2");
    expect(pub.textes.find((t) => t.reseau === "instagram")!.premierCommentaire).toBeUndefined();
  });
});

describe("plafonds de durée avec la fin (accroche + appel + lien)", () => {
  /** Débit prudent (mots par seconde) pour borner la fin dite : plus lent que le débit simulé (`DEBIT_MOTS_PAR_SEC`). */
  const MOTS_PAR_SEC_PRUDENT = 2.7;
  /** Borne réaliste d'une fin (accroche + appel + lien) à ce débit : la plus longue combinaison de la banque fait ~13 s. */
  const BORNE_FIN_SEC = 13;
  const dureeFin = (codes: readonly string[]) => codes.reduce((n, c) => n + nombreMots(appelDeLaBanque(c)!.dit), 0) / MOTS_PAR_SEC_PRUDENT;
  const combinaisons = (): { codes: string[]; sec: number }[] => {
    const jeux: [readonly string[], readonly string[]][] = [
      [ACCROCHES_APPEL_IV, APPELS_DIAGNOSTIC_IV],
      [ACCROCHES_APPEL_IV, APPELS_ACCOMPAGNEMENT_IV],
      [ACCROCHES_TOUR_IV, INVITATIONS_TOUR_IV],
    ];
    const liens = [...new Set(Object.values(LIEN_FIN_IV))];
    return jeux.flatMap(([accroches, appels]) => accroches.flatMap((a) => appels.flatMap((p) => liens.map((l) => ({ codes: [a, p, l], sec: dureeFin([a, p, l]) })))));
  };

  it("chaque combinaison accroche + appel + lien dure au plus la borne (somme des mots / 2,7 mots par seconde), et la borne est atteinte de près", () => {
    const toutes = combinaisons();
    expect(toutes).toHaveLength(121 * 3);
    const trop = toutes.filter((c) => c.sec > BORNE_FIN_SEC + 1e-6).map((c) => `${c.codes.join(" + ")} : ${c.sec.toFixed(1)} s`);
    expect(trop).toEqual([]);
    expect(BORNE_FIN_SEC).toBeLessThanOrEqual(13);
    expect(Math.max(...toutes.map((c) => c.sec))).toBeGreaterThan(BORNE_FIN_SEC - 1);
  });

  it("chaque réseau reste livré quand le corps laisse à la fin la plus longue la place sous le plafond conseillé", () => {
    const fin = Math.max(...combinaisons().map((c) => c.sec));
    for (const r of TOUS_RESEAUX) {
      const p = PLAFONDS_IV[r].conseilleSec;
      if (p <= fin) continue;
      expect(verdictReseau(r, p - fin).verdict, `${r} ${fin.toFixed(1)}`).toBe("livree");
    }
  });

  it("un corps trop long avec la fin suit le chemin de la version courte existant, sans bloquer", () => {
    for (const r of TOUS_RESEAUX) {
      const p = PLAFONDS_IV[r].conseilleSec;
      const v = verdictReseau(r, p * 1.4 + 9);
      expect(v.verdict, r).toBe("version-courte");
      expect(v.version, r).toBe("courte");
      expect(v.bloquant, r).toBe(false);
      // La version courte mesurée (fin comprise) sous le plafond : livrée.
      expect(verdictReseau(r, p * 1.4 + 9, p - 1).bloquant, r).toBe(false);
    }
  });

  it("Facebook ne livre jamais une version longue au-delà de sa limite dure (90 s) fin comprise", () => {
    expect(verdictReseau("facebook", 82 + 9).version).not.toBe("longue");
  });
});

describe("chaque écran de fin tient dans la mise en page v4", () => {
  // Un texte d'écran trop long ne tient pas dans la boîte du titre (9:16) : le rendu le refuse (`IV_RENDU`) après la voix payée.
  const carte = JSON.parse(readFileSync(join(process.cwd(), "tests/image-video/fixtures/cartes/C.json"), "utf8"));
  const valides = SONS_BANQUE.map((x) => ({ elementId: idElementBruitage(x), declencheur: x.declencheur, variante: x.variante, dureeSec: x.dureeSec }));
  it("les trente-quatre phrases, une à une, en 9:16 et en 4:5", () => {
    const fiche = FICHES_SIMULEES["essai-c"];
    const refus: string[] = [];
    for (const a of LIGNES_IV) {
      for (const format of ["9:16", "4:5"] as const) {
        const fin = { id: "fin-essai", reseaux: ["youtube-shorts" as const], muet: false, appels: [{ id: a.code, groupe: "tiktok-youtube" as const, type: a.type, dit: a.dit, ecran: a.ecran }] };
        const ligne = mettreEnSceneIV({ carte, fiche, voix: pisteSimulee(fiche, fin), fin, reseaux: fin.reseaux, bruitagesValides: valides, format }).ligne;
        const p = ecransIrrendables(scenesDeLaLigne(ligne, { env: "essai", videoId: "v-essai" }));
        if (p.length) refus.push(`${format} ${a.code} « ${a.ecran} » : ${p.join(" ")}`);
      }
    }
    expect(refus).toEqual([]);
  }, 120_000);
});

describe("mise en scène de la fin : toutes les combinaisons passent les contrôles de scène", () => {
  const carte = JSON.parse(readFileSync(join(process.cwd(), "tests/image-video/fixtures/cartes/C.json"), "utf8"));
  const valides = SONS_BANQUE.map((x) => ({ elementId: idElementBruitage(x), declencheur: x.declencheur, variante: x.variante, dureeSec: x.dureeSec }));
  const dernierMot = (t: string) => (t.replace(/\*/g, "").trim().split(/\s+/).pop() ?? "").replace(/[.,!?:;…]+$/u, "");

  it("versions un à cinquante-deux (Tour compris), trois réseaux, deux formats : rythme conforme, aucune ligne arrêtée sur un mot de liaison", () => {
    const fiche = FICHES_SIMULEES["essai-c"];
    const defauts: string[] = [];
    for (let n = 1; n <= 52; n++) {
      const choix = choixDeFinIV(n, { tourActif: true });
      for (const reseau of ["youtube-shorts", "instagram", "facebook"] as const) {
        const fin = { id: "fin-essai", reseaux: [reseau], muet: false, appels: finDuReseauIV(reseau, choix) };
        for (const format of ["9:16", "4:5"] as const) {
          const r = mettreEnSceneIV({ carte, fiche, voix: pisteSimulee(fiche, fin), fin, reseaux: fin.reseaux, bruitagesValides: valides, format });
          if (!r.ok) defauts.push(`n=${n} ${reseau} ${format} : ${r.phrases.join(" / ")}`);
          for (const b of r.ligne.blocs) {
            if (b.sorte !== "ecran" || !("lignes" in b.ecran) || !b.ecran.id.startsWith("f")) continue;
            for (const t of b.ecran.lignes) if (FINS_INTERDITES.test(dernierMot(t))) defauts.push(`n=${n} ${reseau} ${format} ${b.ecran.id} : « ${t} » finit sur un mot de liaison`);
          }
        }
      }
    }
    expect(defauts).toEqual([]);
  }, 180_000);
});

describe("fins de secours des fins du 26/10/2026 (refus Q16 de la voix)", () => {
  const plan = planDesFinsIV({ reseaux: RESEAUX_IV, offre: "integration", numeroVersion: 1 });
  const finDe = (r: ReseauIV) => plan.fins.find((f) => f.reseaux.includes(r))!;
  const lien = (f: PlanDesFinsIV["fins"][number]) => f.appels.at(-1)!;
  const poser = (p: PlanDesFinsIV, id: string, fin: PlanDesFinsIV["fins"][number]): PlanDesFinsIV => ({ ...p, fins: p.fins.map((f) => (f.id === id ? fin : f)) });

  it("les groupes de réseaux qui disent la même fin partagent LE MÊME objet de chaîne", () => {
    expect(FINS_DE_SECOURS_IV.facebook).toBe(FINS_DE_SECOURS_IV.linkedin);
    expect(FINS_DE_SECOURS_IV.instagram).toBe(FINS_DE_SECOURS_IV.tiktok);
    expect(FINS_DE_SECOURS_IV["youtube-shorts"]).not.toBe(FINS_DE_SECOURS_IV.instagram);
  });

  it("Facebook + LinkedIn : secours 1 puis 2 (écran neutre, jamais « profil » ni « Diagnostic gratuit »), aucun repli Instagram", () => {
    const f = finDe("facebook");
    expect(f.reseaux).toEqual(expect.arrayContaining(["facebook", "linkedin"]));
    const e1 = etapeDeSecoursIV(plan, f.id)!;
    expect(e1).toMatchObject({ lecture: true, phrase: "Le lien est dans le premier commentaire." });
    expect(lien(e1.fin)).toMatchObject({ id: "fin-iv-lien-commentaire-secours", ecran: "Le lien est en premier commentaire" });
    const e2 = etapeDeSecoursIV(poser(plan, f.id, e1.fin), f.id)!;
    expect(e2).toMatchObject({ lecture: true, phrase: "Le lien est juste sous la vidéo." });
    expect(e2.fin.appels.map((a) => a.id)).not.toContain("fin-iv-lien-commentaire-secours");
    for (const e of [e1, e2]) for (const a of e.fin.appels) expect(`${a.dit} ${a.ecran}`, a.id).not.toMatch(/profil|diagnostic gratuit/i);
    // Chaîne épuisée : pas de repli (il ferait dire « dans mon profil » à Facebook et LinkedIn).
    const p2 = poser(plan, f.id, e2.fin);
    expect(etapeDeSecoursIV(p2, f.id)).toBeNull();
    expect(peutRelireIV(p2, f.id)).toBe(true);
  });

  it("Instagram (TikTok partage sa chaîne) : « Le lien est dans mon profil » ; Shorts : « sur ma chaîne » ; une seule étape, sans repli", () => {
    const ig = finDe("instagram");
    expect(etapeDeSecoursIV(plan, ig.id)).toMatchObject({ lecture: true, phrase: "Vous trouverez le lien juste en haut de mon profil." });
    expect(lien(etapeDeSecoursIV(plan, ig.id)!.fin)).toMatchObject({ ecran: "Le lien est dans mon profil" });
    const ys = finDe("youtube-shorts");
    const e = etapeDeSecoursIV(plan, ys.id)!;
    expect(lien(e.fin)).toMatchObject({ id: "fin-iv-lien-chaine-secours", ecran: "Le lien est sur ma chaîne" });
    for (const f of [ig, ys]) {
      const p1 = poser(plan, f.id, etapeDeSecoursIV(plan, f.id)!.fin);
      expect(etapeDeSecoursIV(p1, f.id)).toBeNull();
      expect(peutRelireIV(p1, f.id)).toBe(true);
    }
  });

  it("l'accompagnement ne dit jamais « Diagnostic gratuit » dans sa fin de secours", () => {
    const acc = planDesFinsIV({ reseaux: ["instagram", "facebook"], offre: "integration", numeroVersion: 2 });
    expect(sorteDuPlanIV(acc)).toBe("accompagnement");
    for (const f of acc.fins) for (const a of etapeDeSecoursIV(acc, f.id)!.fin.appels) expect(a.ecran, a.id).not.toMatch(/diagnostic gratuit/i);
  });
});
