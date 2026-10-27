/**
 * L14 : plan des fins à 5 réseaux, LinkedIn muet, liens suivis, textes de publication, plafonds par réseau.
 * Déterministe : aucune date, aucun hasard, aucun appel réseau.
 */
import { describe, expect, it } from "vitest";
import { appelDeLaBanque } from "@/briques/fins";
import { RESEAUX_IV } from "@/domaine/image-video/plafonds";
import { CODE_FORMAT_IV, codeVersionIV, liensSuivisIV, planDesFinsIV, refusQuestion } from "@/moteurs/montage-image-video/fins";
import { textesDePublicationIV, titreShorts, interditsDans } from "@/moteurs/montage-image-video/publication";
import { etapeDeSecoursIV } from "@/moteurs/montage-image-video/secours";
import { dureeTotaleIV, verdictReseau, verdictsParReseau, versionsPourDuree } from "@/moteurs/montage-image-video/reseaux";

const QUESTION = "Et chez vous, combien de messages attendent jusqu'au lendemain ?";
const base = { reseaux: RESEAUX_IV, offre: "integration" as const, questionCommentaire: QUESTION };
const plan = planDesFinsIV(base);
const finDe = (r: string) => plan.fins.find((f) => f.reseaux.includes(r as never))!;
const dits = (r: string) => finDe(r).appels.map((a) => a.dit);

describe("planDesFinsIV · 4 réseaux", () => {
  it("couvre les 4 réseaux sans refus ni réduction", () => {
    expect(plan.sansFin).toEqual([]);
    expect(plan.reduites).toEqual([]);
    expect(plan.fins.flatMap((f) => f.reseaux).sort()).toEqual([...RESEAUX_IV].sort());
  });

  it("YouTube Shorts a une fin complète : diagnostic + lien dans le profil", () => {
    const f = finDe("youtube-shorts");
    expect(f.appels.map((a) => a.id)).toEqual(["fin-ty-diagnostic-gratuit", "fin-ty-lien-profil"]);
    expect(f.appels.map((a) => a.type)).toEqual(["rendez-vous", "lien"]);
    expect(dits("youtube-shorts")).toEqual(["Faites votre diagnostic gratuit en quelques minutes.", "Le lien est dans mon profil."]);
  });

  it("TikTok n'est plus proposé pour Image → vidéo (décision de Will du 19/10/2026) : jamais planifié, même demandé", () => {
    expect((RESEAUX_IV as readonly string[]).includes("tiktok")).toBe(false);
    const p = planDesFinsIV({ ...base, reseaux: ["tiktok", "youtube-shorts"] as never });
    expect(p.fins.flatMap((f) => f.reseaux)).toEqual(["youtube-shorts"]);
  });

  it("LinkedIn : rien dit, rien affiché, aucune question dans la vidéo", () => {
    const f = finDe("linkedin");
    expect(f.muet).toBe(true);
    expect(f.appels).toEqual([]);
    expect(f.question).toBeUndefined();
    expect(f.reseaux).toEqual(["linkedin"]);
  });

  it("question de commentaire sur Instagram, Facebook, Shorts : la phrase de l'image", () => {
    for (const r of ["instagram", "facebook", "youtube-shorts"]) {
      expect(finDe(r).question).toMatchObject({ dit: QUESTION, origine: "image" });
    }
  });

  it("Instagram et Facebook se séparent (lien différent) ; les liens viennent de la banque", () => {
    expect(finDe("instagram").appels.at(-1)!.id).toBe("fin-ig-lien-profil");
    expect(finDe("facebook").appels.at(-1)!.id).toBe("fin-fb-lien-commentaire");
    expect(finDe("facebook")).not.toBe(finDe("instagram"));
  });

  it("sans question d'image : la question de la banque", () => {
    const p = planDesFinsIV({ ...base, questionCommentaire: undefined });
    expect(p.fins.find((f) => f.reseaux.includes("youtube-shorts"))!.question).toMatchObject({ origine: "banque", ligne: "fin-ty-question-tache" });
  });

  it("réglage « fin-seule » : plus aucune question", () => {
    const p = planDesFinsIV({ ...base, appelCommentaire: "fin-seule" });
    expect(p.fins.every((f) => f.question === undefined)).toBe(true);
  });

  it("un sous-ensemble de réseaux ne produit que ces réseaux, dans l'ordre fixe", () => {
    const p = planDesFinsIV({ ...base, reseaux: ["facebook", "youtube-shorts"] });
    expect(p.fins.flatMap((f) => f.reseaux)).toEqual(["youtube-shorts", "facebook"]);
  });

  it("est déterministe", () => {
    expect(planDesFinsIV(base)).toEqual(planDesFinsIV(base));
  });
});

describe("fin « diagnostic » tant que rien n'est branché : aucune promesse d'envoi", () => {
  const promesse = /envoie|écrivez|commentez|abonnez/i;
  it("par défaut, aucun réseau ne promet un envoi", () => {
    for (const f of plan.fins) for (const a of f.appels) expect(a.dit).not.toMatch(promesse);
  });
  it("le mot demandé mais non branché reste en diagnostic, avec sa raison", () => {
    const p = planDesFinsIV({ ...base, mot: "IA", cadeauReel: true });
    expect(p.fins.flatMap((f) => f.appels).every((a) => a.type !== "commentaire" && a.type !== "cadeau")).toBe(true);
    expect(p.reduites.flatMap((r) => r.reseaux).sort()).toEqual(["facebook", "instagram"]);
  });
  it("mot branché mais cadeau pas réel : diagnostic", () => {
    const p = planDesFinsIV({ ...base, mot: "IA", motSur: ["instagram", "facebook"] });
    expect(p.fins.flatMap((f) => f.appels).some((a) => a.type === "commentaire")).toBe(false);
    expect(p.reduites.flatMap((r) => r.reseaux).sort()).toEqual(["facebook", "instagram"]);
  });
  it("coaching : jamais de fin au mot, même branché", () => {
    const p = planDesFinsIV({ ...base, offre: "coaching", mot: "IA", motSur: ["instagram"], cadeauReel: true });
    expect(p.fins.flatMap((f) => f.appels).some((a) => a.type === "commentaire")).toBe(false);
  });
  it("mot + cadeau réel + branché : fin au mot sur Instagram et Facebook seulement, jamais Shorts / LinkedIn", () => {
    const p = planDesFinsIV({ ...base, mot: "IA", motSur: ["instagram", "facebook", "youtube-shorts", "linkedin"], cadeauReel: true });
    const ig = p.fins.find((f) => f.reseaux.includes("instagram"))!;
    expect(ig.appels.map((a) => a.id)).toEqual(["fin-ig-mot-abonnement"]);
    expect(p.fins.find((f) => f.reseaux.includes("facebook"))!.appels.map((a) => a.id)).toEqual(["fin-if-mot", "fin-if-envoi-structure"]);
    expect(p.fins.find((f) => f.reseaux.includes("youtube-shorts"))!.appels.every((a) => a.type !== "commentaire")).toBe(true);
    expect(p.fins.find((f) => f.reseaux.includes("linkedin"))!.appels).toEqual([]);
  });
});

describe("question de commentaire", () => {
  it("accepte une question propre", () => expect(refusQuestion(QUESTION)).toBeNull());
  it("refuse > 12 mots, un lien, un mot à commenter, le vide", () => {
    expect(refusQuestion("Et chez vous combien de messages restent sans réponse jusqu'au lendemain matin tôt ?")).toMatch(/12 mots/);
    expect(refusQuestion("Et chez vous ? axion-ia.com")).toMatch(/lien/);
    expect(refusQuestion("Commentez IA pour la recevoir")).toMatch(/mot/);
    expect(refusQuestion("   ")).toMatch(/vide/);
  });
  it("le plan lève une erreur claire si la question est refusée", () => {
    expect(() => planDesFinsIV({ ...base, questionCommentaire: "Écrivez IA en commentaire" })).toThrow(/mot en commentaire/);
  });
});

describe("code de version et liens suivis", () => {
  it("« 0042-IV-YS »", () => {
    expect(CODE_FORMAT_IV).toBe("IV");
    expect(codeVersionIV(42, "youtube-shorts")).toBe("0042-IV-YS");
    expect(codeVersionIV(1, "linkedin")).toBe("0001-IV-LI");
    expect(codeVersionIV(7, "facebook")).toBe("0007-IV-FB");
  });
  it("refuse un numéro invalide", () => {
    for (const n of [0, -1, 1.5, 10000]) expect(() => codeVersionIV(n, "youtube-shorts")).toThrow();
  });
  it("un lien distinct par réseau, avec utm_campaign = code de version et utm_content = activité", () => {
    const liens = liensSuivisIV(RESEAUX_IV, 42);
    expect(new Set(Object.values(liens)).size).toBe(4);
    for (const r of RESEAUX_IV) {
      const u = new URL(liens[r]);
      expect(u.searchParams.get("utm_source")).toBe(r);
      expect(u.searchParams.get("utm_campaign")).toBe(codeVersionIV(42, r));
      expect(u.searchParams.get("utm_content")).toBe("clients");
    }
  });
  it("sans numéro de version : une erreur claire, jamais des liens absents en silence", () => {
    expect(() => liensSuivisIV(RESEAUX_IV, undefined)).toThrow(/numéro de la version est introuvable/);
  });
});

describe("textes de publication", () => {
  const contenu = { accroche: "Vos clients écrivent à 23 h 14 et personne ne répond.", resultat: "Réponse en 4 secondes, 24 h/24.", questionCommentaire: QUESTION };
  const liens = liensSuivisIV(RESEAUX_IV, 42);
  const pub = textesDePublicationIV(contenu, plan, liens);
  const de = (r: string) => pub.textes.find((t) => t.reseau === r)!;

  it("5 textes, aucun manquement", () => {
    expect(pub.textes.map((t) => t.reseau)).toEqual(["youtube-shorts", "linkedin", "instagram", "facebook"]);
    expect(pub.manquements).toEqual([]);
  });

  it("LinkedIn : question + phrase du lien dans le post, lien en premier commentaire, jamais « commentez »", () => {
    const t = de("linkedin");
    expect(t.texte).toContain(QUESTION);
    expect(t.texte).toContain(appelDeLaBanque("fin-li-rdv-texte")!.legende);
    expect(t.texte).not.toMatch(/commentez/i);
    expect(t.ouPoserLeLien).toBe("premier-commentaire");
    expect(t.premierCommentaire).toContain(liens.linkedin);
  });

  it("Instagram / Shorts : lien dans le profil ; Facebook : en premier commentaire", () => {
    for (const r of ["instagram", "youtube-shorts"]) expect(de(r).ouPoserLeLien).toBe("profil");
    expect(de("facebook").ouPoserLeLien).toBe("premier-commentaire");
    expect(de("facebook").premierCommentaire).toContain(liens.facebook);
  });

  it("19/10 · fin de secours d'Instagram et de Shorts : publication normale du réseau (lien dans le profil, jamais en premier commentaire) ; Facebook en secours : premier commentaire", () => {
    let p = plan;
    for (const r of ["instagram", "youtube-shorts", "facebook"] as const) {
      const f = finDe(r);
      p = { ...p, fins: p.fins.map((x) => (x.id === f.id ? etapeDeSecoursIV(p, f.id)!.fin : x)) };
    }
    const sec = textesDePublicationIV(contenu, p, liens);
    const t = (r: string) => sec.textes.find((x) => x.reseau === r)!;
    for (const r of ["instagram", "youtube-shorts"]) {
      expect(t(r).ouPoserLeLien, r).toBe("profil");
      expect(t(r).premierCommentaire, r).toBeUndefined();
      expect(t(r).consigneLien, r).not.toMatch(/commentaire/);
      expect(t(r).texte, r).toContain("Vous trouverez le lien juste en haut de mon profil.");
    }
    expect(t("facebook").ouPoserLeLien).toBe("premier-commentaire");
    expect(t("facebook").premierCommentaire).toContain(liens.facebook);
    expect(sec.manquements).toEqual([]);
  });

  it("la question de l'image figure dans le texte des 5 réseaux", () => {
    for (const t of pub.textes) expect(t.texte).toContain(QUESTION);
  });

  it("Shorts a un titre de 60 caractères au plus", () => {
    expect(de("youtube-shorts").titre!.length).toBeLessThanOrEqual(60);
    expect(titreShorts("a ".repeat(80)).length).toBeLessThanOrEqual(60);
    expect(titreShorts("Court")).toBe("Court");
  });

  it("« Villeexemple » dans un post est refusé, comme « machine » (mot entier)", () => {
    const p = textesDePublicationIV({ ...contenu, accroche: "Depuis Villeexemple, une machine répond." }, plan, liens);
    const mots = p.manquements.map((m) => m.detail);
    expect(mots.some((d) => d.includes("Villeexemple"))).toBe(true);
    expect(mots.some((d) => d.includes("machine"))).toBe(true);
    expect(p.manquements.every((m) => m.champ === "texte")).toBe(true);
    expect(interditsDans("machinerie", ["machine"])).toEqual([]);
  });

  it("un interdit passé par l'appelant est contrôlé aussi sur le premier commentaire", () => {
    const p = textesDePublicationIV(contenu, plan, { ...liens, linkedin: "https://axion-ia.com/fr/diagnostic?x=secret" }, ["secret"]);
    expect(p.manquements.some((m) => m.champ === "premier-commentaire" && m.reseau === "linkedin")).toBe(true);
  });

  it("un appel à commenter dans le post LinkedIn est refusé", () => {
    const p = textesDePublicationIV({ ...contenu, questionCommentaire: undefined, resultat: "Commentez IA pour la recevoir." }, plan, liens);
    expect(p.manquements.some((m) => m.reseau === "linkedin" && /commenter/.test(m.detail))).toBe(true);
  });

  it("sans LinkedIn dans le plan : pas de texte LinkedIn", () => {
    const p = planDesFinsIV({ ...base, reseaux: ["youtube-shorts"] });
    expect(textesDePublicationIV(contenu, p, liens).textes.map((t) => t.reseau)).toEqual(["youtube-shorts"]);
  });
});

describe("plafonds de durée par réseau", () => {
  it("(plafonds gardés pour lire les anciennes vidéos) 58 s TikTok → livrée ; 66 s → mention ; 74 s → version courte demandée", () => {
    expect(verdictReseau("tiktok", 58)).toMatchObject({ verdict: "livree", version: "longue", bloquant: false });
    expect(verdictReseau("tiktok", 66)).toMatchObject({ verdict: "mention", version: "longue", bloquant: false });
    expect(verdictReseau("tiktok", 74)).toMatchObject({ verdict: "version-courte", version: "courte", bloquant: false });
  });

  it("91 s Facebook → jamais livrée telle quelle", () => {
    const v = verdictReseau("facebook", 91);
    expect(v.verdict).toBe("version-courte");
    expect(v.version).toBe("courte");
    expect(verdictReseau("facebook", 91, null)).toMatchObject({ verdict: "non-livree", version: "aucune", bloquant: true });
  });

  it("74 s → Shorts, LinkedIn en courte ; Instagram et Facebook en longue", () => {
    expect(versionsPourDuree(74)).toEqual({ "youtube-shorts": "courte", linkedin: "courte", instagram: "longue", facebook: "longue" });
  });

  it("une version courte mesurée est jugée à son tour", () => {
    expect(verdictReseau("tiktok", 74, 59)).toMatchObject({ verdict: "livree", version: "courte", dureeSec: 59 });
    expect(verdictReseau("tiktok", 74, 66)).toMatchObject({ verdict: "mention", version: "courte" });
    expect(verdictReseau("tiktok", 74, 70)).toMatchObject({ verdict: "non-livree", version: "aucune" });
    expect(verdictReseau("tiktok", 74, null).phrase).toBe("Trop longue pour TikTok (74 s) : raccourcissez le script ou retirez ce réseau");
  });

  it("jamais une version longue au-delà de la limite dure de Facebook", () => {
    for (let d = 40; d <= 140; d++) {
      const v = verdictReseau("facebook", d);
      if (v.version === "longue") expect(v.dureeSec).toBeLessThanOrEqual(90);
    }
  });

  it("durée totale : LinkedIn ne compte ni question ni fin", () => {
    const d = { corpsSec: 55, questionSec: 3, finSec: 4 };
    expect(dureeTotaleIV("linkedin", d)).toBe(55);
    expect(dureeTotaleIV("tiktok", d)).toBe(62);
  });

  it("verdicts dans l'ordre fixe des réseaux", () => {
    const v = verdictsParReseau({ facebook: 91, "youtube-shorts": 58 });
    expect(v.map((x) => x.reseau)).toEqual(["youtube-shorts", "facebook"]);
  });
});
