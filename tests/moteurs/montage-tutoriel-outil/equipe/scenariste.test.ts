import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { CarteZones, ZoneCarte } from "@/moteurs/montage-tutoriel-outil/equipe/analyste";
import { DUREE_CIBLE_SEC, type CahierVideo } from "@/moteurs/montage-tutoriel-outil/equipe/chef-de-projet";
import type { FicheValeur } from "@/moteurs/montage-tutoriel-outil/equipe/strategie-valeur";
import {
  CONSIGNE_SCENARISTE,
  FONCTION_SANS_BENEFICE,
  JARGON,
  MOTS_ENTREPRISE,
  MOTS_OUTIL,
  entreeScenariste,
  figerScriptChoisi,
  lirePropositionScripts,
  modeScenariste,
  roleScenariste,
  verifierVersion,
  type EntreeScenariste,
  type PhraseScript,
  type PropositionScripts,
  type VersionScript,
} from "@/moteurs/montage-tutoriel-outil/equipe/scenariste";
import { MOTS_PAR_SECONDE } from "@/moteurs/montage-tutoriel-outil/script";

const cahier = (scriptsFournis: string[] = []): CahierVideo => ({
  version: "cahier-tutoriel.v1",
  entree: "A",
  cas: 1,
  gabarits: ["G-Decision"],
  roles: ["analyste", "stratege", "scenariste", "realisateur", "controleur"],
  manques: [],
  scriptsFournis,
  fin: "aucune",
  ratios: ["4:5"],
  dureeCibleSec: [40, 55],
  raisons: [],
});

const zone = (id: string, etat: ZoneCarte["etat"], chiffres: string[] = []): ZoneCarte => ({
  id,
  nom: id,
  aller: id,
  cible: `[data-zone="${id}"]`,
  etat,
  gestes: ["clic"],
  prouve: "Une zone de démonstration.",
  chiffres,
});

const carte: CarteZones = {
  version: "carte-zones.v1",
  maquette: "demo",
  manques: [],
  zones: [zone("alertes", "maintenant", ["12 commandes"]), zone("commandes", "maintenant"), zone("resume", "avant")],
};

const fiche: FicheValeur = {
  version: "fiche-valeur.v1",
  persona: { metier: "responsable d'atelier", journee: "Entre deux commandes, il cherche ce qui manque.", perte: "Du temps et du calme." },
  avant: ["Des tableurs dispersés."],
  moments: [
    { id: "m1", zoneId: "alertes", geste: "clic", evite: "Vous ne cherchez plus ce qui manque." },
    { id: "m2", zoneId: "commandes", geste: "clic", permet: "Vous voyez tout de suite les commandes en retard." },
  ],
  gainEntreprise: { devient: "plus-sereine", pourquoi: "L'entreprise garde une vue claire de son activité." },
  emotion: "soulagement",
};

const entree = (extra: Partial<EntreeScenariste> = {}): EntreeScenariste => ({ cahier: cahier(), carte, fiche, dureeFinSec: 0, ...extra });

/** Phrase de remplissage au vouvoiement, sans chiffre ni mot interdit. */
const REMPLIR = "Vous gardez la vue sur ce qui compte vraiment pour votre journée.";
const phrases = (): PhraseScript[] => [
  { texte: "Chaque jour, vous perdez du temps à chercher.", temps: "situation", apport: "Le spectateur se reconnaît." },
  { texte: "Vous ne cherchez plus ce qui manque.", temps: "changement", apport: "Il voit ce qui change.", zoneId: "alertes", momentId: "m1" },
  { texte: "Vous voyez tout de suite les commandes en retard.", temps: "changement", apport: "Il voit ce qui change.", zoneId: "commandes", momentId: "m2" },
  { texte: "Votre atelier tourne, sans courir après l'information.", temps: "gain", apport: "Il voit ce que l'entreprise devient." },
];
/** Allonge un script de remplissage jusqu'à `secondes` (hors fin). */
const allonger = (base: PhraseScript[], secondes: number): PhraseScript[] => {
  const out = [...base];
  const mots = (): number => out.map((p) => p.texte).join(" ").split(/\s+/).length;
  while (mots() / MOTS_PAR_SECONDE < secondes) {
    out.splice(1, 0, { texte: REMPLIR, temps: "situation", apport: "Prolonge la situation reconnue." });
  }
  return out;
};
const version = (id: "A" | "B", p: PhraseScript[], source: "ecrit" | "fourni" = "ecrit"): VersionScript => ({ id, source, phrases: p, empreinte: "x" });
const milieu = (DUREE_CIBLE_SEC[0] + DUREE_CIBLE_SEC[1]) / 2;
const bonne = (): PhraseScript[] => allonger(phrases(), milieu);

const iChg = (p: PhraseScript[]): number => p.findIndex((x) => x.temps === "changement");
const bloquants = (p: PhraseScript[], e = entree()): string => verifierVersion(version("A", p), e).bloquants.join(" | ");

describe("modeScenariste", () => {
  it("2 scripts fournis → annoter ; 1 → annoter + écrire ; 0 → écrire", () => {
    expect(modeScenariste(cahier(["a b", "c d e"]))).toEqual({ A: "annoter", B: "annoter" });
    expect(modeScenariste(cahier(["a b"]))).toEqual({ A: "annoter", B: "ecrire" });
    expect(modeScenariste(cahier())).toEqual({ A: "ecrire", B: "ecrire" });
  });
  it("ajusterDemande: true → ajuster ; la chaîne « true » n'ajuste pas", () => {
    expect(modeScenariste(cahier(["a b", "c d e"]), true)).toEqual({ A: "ajuster", B: "ajuster" });
    expect(modeScenariste(cahier(["a b", "c d e"]), "true")).toEqual({ A: "annoter", B: "annoter" });
    expect(modeScenariste(cahier(), true)).toEqual({ A: "ecrire", B: "ecrire" });
  });
});

describe("simuler", () => {
  for (const dureeFinSec of [0, 3]) {
    it(`2 versions qui passent la garde, A plus courte que B (fin ${dureeFinSec} s)`, () => {
      const e = entree({ dureeFinSec });
      const sortie = roleScenariste.simuler(entreeScenariste(e));
      const r = lirePropositionScripts(sortie, e);
      expect(r.ok, r.ok ? "" : r.erreurs.join(" | ")).toBe(true);
      if (!r.ok) return;
      const [a, b] = r.proposition.versions;
      const duree = (v: VersionScript): number => v.phrases.map((p) => p.texte).join(" ").split(/\s+/).length / MOTS_PAR_SECONDE + dureeFinSec;
      expect(duree(a)).toBeLessThan(duree(b));
      for (const d of [duree(a), duree(b)]) {
        expect(d).toBeGreaterThanOrEqual(DUREE_CIBLE_SEC[0]);
        expect(d).toBeLessThanOrEqual(DUREE_CIBLE_SEC[1]);
      }
    });
  }
  it("est déterministe", () => {
    const e = entree();
    expect(roleScenariste.simuler(entreeScenariste(e))).toEqual(roleScenariste.simuler(entreeScenariste(e)));
  });
});

describe("mode annoter : le texte fourni ne bouge pas", () => {
  const fourniA = "Chaque jour, vous perdez du temps à chercher. Vous ne cherchez plus ce qui manque.";
  const e = (): EntreeScenariste => entree({ cahier: cahier([fourniA]) });
  const annote = (texte: string): VersionScript =>
    version(
      "A",
      texte.split(/(?<=\.)\s+/).map((t, i) => ({ texte: t, temps: i === 0 ? "situation" : "changement", apport: "Apporte un gain clair.", zoneId: i === 0 ? undefined : "alertes" })),
      "fourni",
    );
  it("le texte recopié passe l'intégrité (les écarts de trame restent des remarques)", () => {
    const r = verifierVersion(annote(fourniA), e());
    expect(r.bloquants).toEqual([]);
    expect(r.remarques.length).toBeGreaterThan(0);
  });
  it("une virgule changée → refus « le texte fourni a été modifié »", () => {
    const r = verifierVersion(annote(fourniA.replace("Chaque jour, vous", "Chaque jour vous")), e());
    expect(r.bloquants.join(" ")).toMatch(/le texte fourni a été modifié/i);
  });
  it("source « fourni » sans script fourni, ou version écrite alors qu'un script est fourni → refus", () => {
    expect(verifierVersion(annote(fourniA), entree()).bloquants.join(" ")).toMatch(/sans script fourni/);
    expect(verifierVersion(version("A", bonne()), e()).bloquants.join(" ")).toMatch(/annoter/);
  });
});

describe("version écrite : règles de trame bloquantes", () => {
  it("la version de référence passe", () => {
    expect(bloquants(bonne())).toBe("");
  });
  it("ordre gain → changement → refus", () => {
    const p = bonne();
    const g = p.pop()!;
    p.splice(1, 0, g);
    expect(bloquants(p)).toMatch(/ordre des temps/);
  });
  it("4 moments → refus", () => {
    const p = bonne();
    p.splice(3, 0, { texte: "Vous gardez la main sur vos commandes.", temps: "changement", apport: "Il garde la main.", zoneId: "alertes", momentId: "m4" as "m3" });
    const f4 = { ...fiche, moments: [...fiche.moments, { id: "m3" as const, zoneId: "alertes", geste: "zoom" as const, evite: "Vous ne cherchez plus." }, { id: "m4" as "m3", zoneId: "alertes", geste: "survol" as const, evite: "Vous ne cherchez plus." }] };
    expect(bloquants(p, entree({ fiche: f4 }))).toMatch(/moments/);
  });
  it("moment de la fiche non couvert → refus", () => {
    expect(bloquants(bonne().filter((p) => p.momentId !== "m2"))).toMatch(/« m2 »/);
  });
  it("phrase « L'outil permet de suivre les stocks. » → refus (fonction sans bénéfice)", () => {
    const p = bonne();
    p[iChg(p)] = { ...p[iChg(p)]!, texte: "L'outil permet de suivre les stocks." };
    expect(bloquants(p)).toMatch(/fonction sans bénéfice/);
  });
  it("phrase « changement » sans « vous » → refus", () => {
    const p = bonne();
    p[iChg(p)] = { ...p[iChg(p)]!, texte: "Les stocks se suivent d'un coup d'œil." };
    expect(bloquants(p)).toMatch(/« vous »/);
  });
  it("changement sans zoneId, zone inconnue ou zone « avant » → refus", () => {
    for (const zoneId of [undefined, "inconnue", "resume"]) {
      const p = bonne();
      p[iChg(p)] = { ...p[iChg(p)]!, zoneId };
      expect(bloquants(p)).toMatch(/zone/);
    }
  });
  it("apport vide ou trop court → refus", () => {
    for (const apport of ["", "Un gain."]) {
      const p = bonne();
      p[iChg(p)] = { ...p[iChg(p)]!, apport };
      expect(bloquants(p)).toMatch(/apporte/);
    }
  });
  it("dernière phrase sur l'outil → refus ; sur l'entreprise → ok", () => {
    const p = bonne();
    p[p.length - 1] = { ...p[p.length - 1]!, texte: "Le tableau de bord fait le reste." };
    expect(bloquants(p)).toMatch(/dernière phrase/i);
    const q = bonne();
    q[q.length - 1] = { ...q[q.length - 1]!, texte: "Votre atelier tourne, sans courir après l'information." };
    expect(bloquants(q)).toBe("");
  });
  it("dernière phrase qui n'est pas un « gain » → refus", () => {
    const p = bonne();
    p[p.length - 1] = { ...p[p.length - 1]!, temps: "changement", zoneId: "alertes", momentId: "m1" };
    expect(bloquants(p)).toMatch(/« gain »/);
  });
  it("1re phrase de 15 mots sans mot commun avec la persona → refus ; avec un mot commun → ok", () => {
    const longue = "Bonjour à toutes et à tous, voici une présentation rapide des quelques écrans qui vont suivre aujourd'hui.";
    const p = bonne();
    p[0] = { ...p[0]!, texte: longue.replace("à toutes et à tous", "à celles et ceux") };
    expect(bloquants(p)).toMatch(/3 secondes/);
    const q = bonne();
    q[0] = { ...q[0]!, texte: "Entre deux commandes, vous cherchez ce qui manque, encore et encore, sans jamais avoir la vue." };
    expect(bloquants(q)).toBe("");
  });
  it("durée : trop courte ou trop longue → refus (bornes lues dans DUREE_CIBLE_SEC)", () => {
    expect(bloquants(allonger(phrases(), DUREE_CIBLE_SEC[0] - 10))).toMatch(/Durée/);
    expect(bloquants(allonger(phrases(), DUREE_CIBLE_SEC[1] + 5))).toMatch(/Durée/);
    expect(bloquants(bonne(), entree({ dureeFinSec: DUREE_CIBLE_SEC[1] }))).toMatch(/Durée/);
  });
});

describe("version fournie : trame en remarques, marque en refus", () => {
  const e = (): EntreeScenariste => {
    const p = bonne();
    return entree({ cahier: cahier([p.map((x) => x.texte).join(" ")]) });
  };
  const fourni = (p: PhraseScript[]): { bloquants: string[]; remarques: string[] } => verifierVersion(version("A", p, "fourni"), entree({ cahier: cahier([p.map((x) => x.texte).join(" ")]) }));

  it("les mêmes règles de trame deviennent des remarques", () => {
    const p = bonne();
    p[iChg(p)] = { ...p[iChg(p)]!, texte: "L'outil permet de suivre les stocks." };
    const r = fourni(p);
    expect(r.bloquants).toEqual([]);
    expect(r.remarques.join(" ")).toMatch(/fonction sans bénéfice/);
    void e;
  });
  const marque = (texte: string, motif: RegExp, attendu = true): void => {
    const p = bonne();
    p[iChg(p)] = { ...p[iChg(p)]!, texte };
    const r = fourni(p);
    if (attendu) expect(r.bloquants.join(" ")).toMatch(motif);
    else expect(r.bloquants).toEqual([]);
  };
  it("« 3 000 € » → refus", () => marque("Vous gagnez 3 000 € par mois.", /argent/));
  it("« garanti » → refus", () => marque("Vous êtes garanti de ne rien oublier.", /garanti/));
  it("« tu » → refus", () => marque("Tu ne cherches plus ce qui manque.", /tutoiement/));
  it("« Douleur : … » → refus", () => marque("Douleur : vous cherchez ce qui manque.", /étiquette/));
  it("« Prendre rendez-vous » → refus", () => marque("Vous pouvez prendre rendez-vous dès maintenant.", /fin/));
  it("jargon → refus", () => marque("Vous suivez vos KPI sans effort.", /jargon/));
  it("« 12 commandes » absent de la carte → refus, présent → ok", () => {
    marque("Vous voyez 13 commandes en retard.", /nombre/);
    marque("Vous voyez 12 commandes en retard.", /nombre/, false);
  });
});

describe("lirePropositionScripts", () => {
  it("accepte A puis B et calcule l'empreinte", () => {
    const e = entree();
    const brut = { version: "scripts-tutoriel.v1", versions: [{ id: "A", source: "ecrit", phrases: bonne() }, { id: "B", source: "ecrit", phrases: allonger(phrases(), milieu + 4) }] };
    const r = lirePropositionScripts(brut, e);
    expect(r.ok, r.ok ? "" : r.erreurs.join(" | ")).toBe(true);
    if (r.ok) expect(r.proposition.versions[0].empreinte).toMatch(/^[0-9a-f]{16}$/);
  });
  it("A plus longue que B → refus", () => {
    const brut = { version: "scripts-tutoriel.v1", versions: [{ id: "A", source: "ecrit", phrases: allonger(phrases(), milieu + 4) }, { id: "B", source: "ecrit", phrases: bonne() }] };
    const r = lirePropositionScripts(brut, entree());
    expect(r.ok).toBe(false);
  });
  it("null, chaîne, mauvais nombre de versions, champ inconnu → refus sans exception", () => {
    for (const brut of [null, "texte", 3, {}, { version: "scripts-tutoriel.v1", versions: [] }, { version: "scripts-tutoriel.v1", versions: [{ id: "A", source: "ecrit", phrases: bonne() }] }]) {
      const r = lirePropositionScripts(brut, entree());
      expect(r.ok).toBe(false);
    }
    const r = lirePropositionScripts({ version: "scripts-tutoriel.v1", versions: [], extra: 1 }, entree());
    expect(r.ok).toBe(false);
  });
});

describe("figerScriptChoisi", () => {
  const proposition = (): PropositionScripts => {
    const r = lirePropositionScripts(roleScenariste.simuler(entreeScenariste(entree())), entree());
    if (!r.ok) throw new Error(r.erreurs.join(" | "));
    return r.proposition;
  };
  it("choisir B → texte de B, empreinte stable", () => {
    const p = proposition();
    const a = figerScriptChoisi(p, { version: "B" });
    const b = figerScriptChoisi(p, { version: "B" });
    expect(a.source).toBe("choisi");
    expect(a.texte).toBe(p.versions[1].phrases.map((x) => x.texte).join(" "));
    expect(a.empreinte).toBe(b.empreinte);
    expect(a.empreinte).toBe(p.versions[1].empreinte);
  });
  it("une correction reste au caractère près, source « corrige », phrases inconnues « à revoir »", () => {
    const p = proposition();
    const connue = p.versions[0].phrases[0]!.texte;
    const corrige = `${connue}  Une phrase  que Williams a  écrite lui-même !`;
    const c = figerScriptChoisi(p, { corrige });
    expect(c.texte).toBe(corrige);
    expect(c.source).toBe("corrige");
    expect(c.phrases[0]).toMatchObject({ texte: connue, aRevoir: false, temps: "situation" });
    expect(c.phrases[1]).toMatchObject({ aRevoir: true });
  });
  it("le module n'importe aucun appel Claude", () => {
    const source = readFileSync("src/moteurs/montage-tutoriel-outil/equipe/scenariste.ts", "utf8");
    const imports = source.split("\n").filter((l) => /^import /.test(l)).join("\n");
    expect(imports).not.toMatch(/AppelClaude|executerRole|appelerAvecRotation|fournisseurs\/claude\/client|plan-scenes\/generateur/);
  });
});

describe("roleScenariste", () => {
  it("modèle, effort, consigne", () => {
    expect(roleScenariste.id).toBe("tutoriel-scenariste");
    expect(roleScenariste.modele).toBe("claude-opus-5-5");
    expect(roleScenariste.effort).toBe("medium");
    expect(roleScenariste.maxTokens).toBe(4000);
    expect(CONSIGNE_SCENARISTE).toContain("ne changez pas un caractère");
    expect(CONSIGNE_SCENARISTE).toContain("aucune fin");
  });
  it("listes exportées", () => {
    expect(FONCTION_SANS_BENEFICE).toContain("l'outil permet");
    expect(MOTS_ENTREPRISE).toContain("atelier");
    expect(MOTS_OUTIL).toContain("le tableau de bord");
    expect(JARGON).toContain("KPI");
  });
  it("le fichier n'écrit aucune borne de durée en dur", () => {
    const source = readFileSync("src/moteurs/montage-tutoriel-outil/equipe/scenariste.ts", "utf8");
    expect(source).not.toMatch(/DUREE_MIN_SEC|DUREE_MAX_SEC|\b40\b|\b55\b/);
  });
});
