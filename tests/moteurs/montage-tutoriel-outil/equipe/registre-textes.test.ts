import { describe, expect, it } from "vitest";
import {
  ajouterAuVerdict,
  choisirProposition,
  etablirRegistre,
  figerRegistre,
  lignesPourValidation,
  verifierRendu,
  type RegistreTextes,
} from "@/moteurs/montage-tutoriel-outil/equipe/registre-textes";

const PHRASES = [
  "Votre journée commence par un tri.",
  "Ici, tout arrive déjà classé.",
  "Vous ouvrez, vous relisez, vous validez.",
  "Le reste se fait sans vous.",
  "Vous gardez la main, à chaque étape.",
  "Votre entreprise gagne du temps.",
];
const base = {
  script: { phrases: PHRASES },
  fin: "aucune" as const,
  parcours: { etapes: [{ id: "e1" }] },
  textesMaquette: [] as { etapeId: string; textes: string[]; creee: boolean }[],
};
const fige = (r: RegistreTextes): RegistreTextes => {
  const f = figerRegistre(r, "2026-11-18T10:00:00Z");
  if (!f.ok) throw new Error(f.erreur);
  return f.registre;
};
const voix = PHRASES.join(" ");
const rendu = (o: Partial<Parameters<typeof verifierRendu>[1]> = {}) => ({ voix, sousTitres: [], ecran: [], ...o });

describe("registre : voix et fin", () => {
  it("6 phrases, fin aucune : 6 entrées voix, aucune fin, rendu identique réussi", () => {
    const r = fige(etablirRegistre(base));
    expect(r.entrees.filter((x) => x.ou === "voix")).toHaveLength(6);
    expect(r.entrees.filter((x) => x.ou === "fin")).toHaveLength(0);
    expect(verifierRendu(r, rendu()).ok).toBe(true);
  });
  it("texte dit après la fin « aucune » : échec", () => {
    const r = fige(etablirRegistre(base));
    const res = verifierRendu(r, rendu({ voix: `${voix} Prendre rendez-vous.` }));
    expect(res.ok).toBe(false);
    expect(res.message).toContain("texte dit après la fin");
  });
  it("fin choisie avec texte : entrée fin ; rendu sans la fin : échec", () => {
    const r = fige(etablirRegistre({ ...base, fin: "prendre-rendez-vous", texteFin: "Prendre rendez-vous." }));
    expect(r.entrees.filter((x) => x.ou === "fin")).toHaveLength(1);
    expect(verifierRendu(r, rendu()).ok).toBe(false);
    expect(verifierRendu(r, rendu({ voix: `${voix} Prendre rendez-vous.` })).ok).toBe(true);
  });
  it("fin choisie sans texte : échec nommé, aucune entrée inventée", () => {
    const r = fige(etablirRegistre({ ...base, fin: "prendre-rendez-vous" }));
    expect(r.entrees.some((x) => x.ou === "fin")).toBe(false);
    const res = verifierRendu(r, rendu());
    expect(res.ok).toBe(false);
    expect(res.message).toContain("fin choisie");
  });
});

describe("registre : mot pour mot", () => {
  const r = fige(etablirRegistre(base));
  it("une virgule changée : échec, texte recopié", () => {
    const res = verifierRendu(r, rendu({ voix: voix.replace("Ici, tout", "Ici tout") }));
    expect(res.ok).toBe(false);
    expect(res.details.join(" ")).toContain("Ici tout arrive");
  });
  it("espace insécable : réussi", () => {
    expect(verifierRendu(r, rendu({ voix: voix.replace("Votre journée", "Votre journée") })).ok).toBe(true);
  });
  it("apostrophe typographique : réussie", () => {
    const r2 = fige(etablirRegistre({ ...base, script: { phrases: ["L'outil trie."] } }));
    expect(verifierRendu(r2, rendu({ voix: "L’outil trie." })).ok).toBe(true);
  });
  it("casse non normalisée : « votre » échoue", () => {
    expect(verifierRendu(r, rendu({ voix: voix.replace("Votre journée", "votre journée") })).ok).toBe(false);
  });
  it("accent non normalisé", () => {
    expect(verifierRendu(r, rendu({ voix: voix.replace("journée", "journee") })).ok).toBe(false);
  });
});

describe("registre : sous-titres", () => {
  const r = fige(etablirRegistre(base));
  it("3 morceaux contigus : réussi", () => {
    expect(verifierRendu(r, rendu({ sousTitres: ["Votre journée commence", "par un tri. Ici,", "tout arrive déjà classé."] })).ok).toBe(true);
  });
  it("un morceau qui saute un mot : échec", () => {
    const res = verifierRendu(r, rendu({ sousTitres: ["Votre commence par"] }));
    expect(res.ok).toBe(false);
    expect(res.details).toContain("Votre commence par");
  });
});

describe("registre : propositions, figeage", () => {
  const avecProp = () =>
    etablirRegistre({ ...base, propositions: [{ id: "prop-1", texte: "Vue d'ensemble", etapeId: "e1" }] });
  it("proposition non choisie à l'écran : échec ; cochée puis figée : réussi", () => {
    const ecran = [{ texte: "Vue d'ensemble", ou: "ecran-studio" as const }];
    expect(verifierRendu(fige(avecProp()), rendu({ ecran })).message).toContain("texte proposé non choisi");
    const c = choisirProposition(avecProp(), "prop-1", true);
    if (!c.ok) throw new Error(c.erreur);
    expect(verifierRendu(fige(c.registre), rendu({ ecran })).ok).toBe(true);
  });
  it("registre non figé : échec", () => {
    const res = verifierRendu(etablirRegistre(base), rendu());
    expect(res.ok).toBe(false);
    expect(res.message).toContain("pas encore validé");
  });
  it("figer deux fois les mêmes entrées : même empreinte", () => {
    const a = fige(etablirRegistre(base));
    const b = fige(etablirRegistre(base));
    expect(a.fige?.empreinte).toBe(b.fige?.empreinte);
  });
  it("modifier après figeage : { ok: false }", () => {
    const f = fige(avecProp());
    expect(choisirProposition(f, "prop-1", true)).toEqual({ ok: false, erreur: "registre figé : revalider" });
    expect(figerRegistre(f, "x")).toEqual({ ok: false, erreur: "registre figé : revalider" });
  });
  it("changer le script change l'empreinte (nouveau registre, nouvelle validation)", () => {
    const a = fige(etablirRegistre(base));
    const b = fige(etablirRegistre({ ...base, script: { phrases: [...PHRASES.slice(0, 5), "Autre phrase."] } }));
    expect(a.fige?.empreinte).not.toBe(b.fige?.empreinte);
  });
});

describe("registre : maquette", () => {
  const tm = [{ etapeId: "e1", textes: ["Entreprise exemple · 12 commandes"], creee: false }];
  it("texte de maquette au registre et rendu : réussi", () => {
    const r = fige(etablirRegistre({ ...base, textesMaquette: tm }));
    expect(r.entrees.find((x) => x.ou === "maquette")?.origine).toBe("maquette-dossier");
    expect(verifierRendu(r, rendu({ ecran: [{ texte: "Entreprise exemple · 12 commandes", ou: "maquette" }] })).ok).toBe(true);
  });
  it("texte de maquette absent du registre : échec", () => {
    const r = fige(etablirRegistre(base));
    const res = verifierRendu(r, rendu({ ecran: [{ texte: "Entreprise exemple · 12 commandes", ou: "maquette" }] }));
    expect(res.ok).toBe(false);
    expect(res.details).toContain("Entreprise exemple · 12 commandes");
  });
  it("maquette créée : origine maquette-creee ; conversation : conversation-dossier", () => {
    const r = etablirRegistre({
      ...base,
      textesMaquette: [{ etapeId: "e1", textes: ["Espace démo · métier"], creee: true }],
      conversation: [{ auteur: "client", texte: "Bonjour" }],
    });
    expect(r.entrees.find((x) => x.ou === "maquette")?.origine).toBe("maquette-creee");
    expect(r.entrees.find((x) => x.ou === "conversation")?.origine).toBe("conversation-dossier");
  });
});

describe("registre : verdict et validation", () => {
  it("verdict ok + échec registre : bloque", () => {
    const echec = verifierRendu(etablirRegistre(base), rendu());
    const v = ajouterAuVerdict({ verdict: "ok", resultats: [] }, echec);
    expect(v.verdict).toBe("bloque");
    expect(v.resultats.map((x) => x.id)).toContain("TUT-REGISTRE");
  });
  it("verdict ok + registre réussi : reste ok", () => {
    const ok = verifierRendu(fige(etablirRegistre(base)), rendu());
    expect(ajouterAuVerdict({ verdict: "ok", resultats: [] }, ok).verdict).toBe("ok");
  });
  it("lignesPourValidation : ordre voix → écran → fin, texte de 300 caractères entier", () => {
    const long = "a".repeat(300);
    const r = etablirRegistre({
      ...base,
      script: { phrases: ["Une.", long] },
      fin: "prendre-rendez-vous",
      texteFin: "Prendre rendez-vous.",
      textesMaquette: [{ etapeId: "e1", textes: ["Entreprise exemple"], creee: false }],
    });
    const l = lignesPourValidation(r);
    expect(l.map((x) => x.ou)).toEqual(["voix", "voix", "maquette", "fin"]);
    expect(l[1].texte).toHaveLength(300);
  });
});
