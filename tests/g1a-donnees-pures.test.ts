/**
 * G1a : DONNÉES PURES du générateur (plan v5 B.2.4, B.2.5, B.4.0, B.5.1, B.5.4).
 * Registre des codes, codes et noms de fichiers, unicité (code, version) sur toutes les combinaisons (codes de format à
 * 2 ET 3 lettres), familles et héritage, dérivations, péremption, règles datées et tournures semées.
 */
import { describe, expect, it } from "vitest";
import { listerFormats, obtenirFormat } from "@/formats";
import { RECETTES_FAMILLES, resoudreRecette } from "@/formats/familles";
import { codeDuFormat, entreeDuCode, inscrireCodeFormat, listerCodes, MOTIF_CODE_FORMAT, proposerCode } from "@/formats/registre-codes";
import type { FamilleFormat } from "@/formats/types";
import { CODES_RESEAU, RESEAUX_DECLINAISON } from "@/reseaux/codes";
import { ECRITURE_RESEAUX, regleIdsEcriture } from "@/reseaux/ecriture";
import { REGLES_DATEES_SEMEES } from "@/donnees/generateur/regles-datees";
import { DRAPEAUX_TOURNURES, TOURNURES_CALIBREES } from "@/donnees/generateur/tournures-calibrees";
import {
  analyserCode,
  appliquerPrononciations,
  assemblerBlocs,
  codeVariante,
  detailConcret,
  empreinteCorps,
  etapeEditorialeDe,
  etatReseau,
  etatSujet,
  grilleSujet,
  nomFichier,
  proposerPilier,
  proposerTypeMatiere,
  repartirBlocs,
  statutEditorialDerive,
  utilisationsMatiere,
  versionsCourantes,
} from "@/domaine/derivations-generateur";
import { historiqueSerie, partAnecdote } from "@/domaine/variete";
import { expireBientot, PEREMPTION_MATIERE, PEREMPTION_PAR_TYPE, peremptionParDefaut } from "@/domaine/preuves";
import type { Adresse, BlocScript, ModeDiction, Prononciation, Publication, ScriptMaitre, TypeMatiere, VarianteReseau, Video } from "@/domaine/types";

const LE = "2026-10-02T10:00:00.000Z";

describe("registre des codes de format", () => {
  it("semé avec AV, PO, EP, UG, SE, MO, WC, SAR, BUR, TE, TST ; codes uniques, bien formés", () => {
    const codes = listerCodes().map((e) => e.code);
    expect(codes).toEqual(expect.arrayContaining(["AV", "PO", "EP", "UG", "SE", "MO", "WC", "SAR", "BUR", "TE", "TST"]));
    expect(new Set(codes).size).toBe(codes.length);
    expect(new Set(listerCodes().map((e) => e.formatId)).size).toBe(codes.length);
    for (const c of codes) expect(c).toMatch(MOTIF_CODE_FORMAT);
  });

  it("chaque format du studio a un code ; renommer un format ne change pas son code", () => {
    for (const f of listerFormats({ inclureMasques: true })) expect(codeDuFormat(f.id), f.id).toMatch(MOTIF_CODE_FORMAT);
    const avocat = obtenirFormat("avocat");
    const renomme = { ...avocat, nom: "Avocat (nouveau nom)", nomCourt: "Autre nom" };
    expect(codeDuFormat(renomme.id)).toBe("AV");
  });

  it("ajout seul : un code pris (même archivé) ou mal formé est refusé ; proposerCode ne propose que des codes libres", () => {
    expect(() => inscrireCodeFormat({ code: "AV", formatId: "autre-chose" })).toThrow(/réservé/);
    expect(() => inscrireCodeFormat({ code: "A1", formatId: "x" })).toThrow(/mal formé/);
    expect(() => inscrireCodeFormat({ code: "ZZZ", formatId: "avocat" })).toThrow(/déjà un code/);
    const propositions = proposerCode("Avis client filmé");
    expect(propositions.length).toBe(3);
    for (const p of propositions) {
      expect(p).toMatch(MOTIF_CODE_FORMAT);
      expect(entreeDuCode(p)).toBeUndefined();
    }
    expect(proposerCode("Témoignage")).not.toContain("TE");
  });
});

describe("codes de version et noms de fichiers (B.2.4, B.6.10)", () => {
  it("exemples du plan", () => {
    expect(codeVariante({ numero: 42, codeFormat: "AV", reseau: "tiktok" })).toBe("0042-AV-TT");
    expect(codeVariante({ numero: 42, codeFormat: "AV", reseau: "tiktok", mode: "teleprompteur" })).toBe("0042-AV-TT-L");
    expect(codeVariante({ numero: 42, codeFormat: "AV", reseau: "linkedin", adresse: "tu" })).toBe("0042-AV-LI-T");
    expect(codeVariante({ numero: 42, codeFormat: "AV", reseau: "tiktok", mode: "teleprompteur", adresse: "tu" })).toBe("0042-AV-TT-L-T");
    expect(codeVariante({ numero: 43, codeFormat: "SAR", reseau: "youtube-shorts" })).toBe("0043-SAR-YS");
    expect(codeVariante({ numero: 7, codeFormat: "MO", reseau: "instagram", mode: "voix-off" })).toBe("0007-MO-IG-V");
    expect(analyserCode("0042-AV-TT-L-T")).toEqual({ numero: 42, codeFormat: "AV", reseau: "tiktok", mode: "teleprompteur", adresse: "tu" });
    expect(analyserCode("0042-av-tt")).toMatchObject({ numero: 42, reseau: "tiktok", mode: "avatar", adresse: "vous" });
    expect(analyserCode("42-AV")).toBeNull();
  });

  it("unicité de (code, version) sur TOUTES les combinaisons, codes de format à 2 et 3 lettres", () => {
    const vus = new Set<string>();
    const modes: ModeDiction[] = ["avatar", "teleprompteur", "trame", "voix-off"];
    const adresses: Adresse[] = ["vous", "tu"];
    let n = 0;
    for (const numero of [1, 42, 999, 9000])
      for (const codeFormat of ["AV", "TE", "SAR", "TST", "BUR"])
        for (const reseau of RESEAUX_DECLINAISON)
          for (const mode of modes)
            for (const adresse of adresses)
              for (const version of [1, 2, 3]) {
                const code = codeVariante({ numero, codeFormat, reseau, mode, adresse });
                const cle = `${code}#${version}`;
                expect(vus.has(cle), cle).toBe(false);
                vus.add(cle);
                expect(analyserCode(code)).toEqual({ numero, codeFormat, reseau, mode, adresse });
                n++;
              }
    expect(n).toBe(4 * 5 * 5 * 4 * 2 * 3);
  });

  it("nom de fichier : code, titre court, ratio, -A2, -vN ; caractères sûrs", () => {
    expect(nomFichier({ code: "0042-AV-TT-L", titre: "Données : ChatGPT lit-il vos factures ?", ratio: "9:16", version: 2, extension: "mp4" })).toBe("0042-AV-TT-L-donnees-chatgpt-lit-il-9x16-v2.mp4");
    expect(nomFichier({ code: "0042-AV-TT", titre: "Le PV", ratio: "4:5", essaiAccroche: 2, extension: ".mp4" })).toBe("0042-AV-TT-le-pv-4x5-A2.mp4");
    expect(nomFichier({ code: "0042-AV-TT", titre: "Le PV", extension: "srt" })).toBe("0042-AV-TT-le-pv.srt");
    for (const r of RESEAUX_DECLINAISON) expect(nomFichier({ code: codeVariante({ numero: 1, codeFormat: "TST", reseau: r }), titre: "Été / « spécial » #1", ratio: "1:1", extension: "mp4" })).toMatch(/^[A-Za-z0-9-]+\.mp4$/);
  });

  it("codes réseau : un par réseau, YouTube long à part ; 5 réseaux de déclinaison", () => {
    expect(Object.values(CODES_RESEAU)).toEqual(["TT", "IG", "FB", "LI", "YS", "YT"]);
    expect(RESEAUX_DECLINAISON).toEqual(["tiktok", "instagram", "youtube-shorts", "linkedin", "facebook"]);
  });
});

describe("familles et héritage (B.4.0)", () => {
  it("toutes les familles ont une recette, dont « témoignage »", () => {
    const familles: FamilleFormat[] = ["face-camera", "conversation", "ugc", "temoignage", "ecran-partage", "motion", "autre"];
    for (const f of familles) expect(RECETTES_FAMILLES[f].famille).toBe(f);
    expect(RECETTES_FAMILLES.temoignage.modesDiction).toEqual(["trame"]);
  });

  it("le format hérite de sa famille ; ses tableaux REMPLACENT ceux de la famille (jamais additionnés)", () => {
    const avocat = obtenirFormat("avocat");
    const herite = resoudreRecette(avocat);
    expect(herite.famille).toBe("face-camera");
    expect(herite.modesDiction).toEqual(["avatar", "teleprompteur", "trame"]);
    expect(herite.debitParMode.avatar).toBe(avocat.recetteScript.motsParSeconde);
    expect(herite.debitParMode.teleprompteur).toBe(2.9);
    const diff = resoudreRecette({ ...avocat, recetteScript: { ...avocat.recetteScript, modesDiction: ["trame"], annotations: ["emphase"] } });
    expect(diff.modesDiction).toEqual(["trame"]);
    expect(diff.modeParDefaut).toBe("trame");
    expect(diff.annotations).toEqual(["emphase"]);
    // Une valeur non déclarée (undefined) ne remplace rien.
    expect(resoudreRecette({ ...avocat, recetteScript: { ...avocat.recetteScript, modesDiction: undefined } }).modesDiction).toEqual(["avatar", "teleprompteur", "trame"]);
    // Héritage explicite d'une autre famille.
    expect(resoudreRecette({ ...avocat, recetteScript: { ...avocat.recetteScript, herite: "motion" } }).modesDiction).toEqual(["voix-off"]);
  });

  it("déclinaison : celle du format, sinon celle de la famille", () => {
    const avocat = obtenirFormat("avocat");
    expect(resoudreRecette(avocat).declinaison).toBe("ouverture-fin");
    expect(resoudreRecette({ ...avocat, declinaison: "aucune" }).declinaison).toBe("aucune");
  });
});

describe("règles par réseau et règles datées (B.5.1, B.5.4)", () => {
  it("chaque valeur d'écriture cite une règle datée semée ; ids semés uniques", () => {
    const ids = REGLES_DATEES_SEMEES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of regleIdsEcriture()) expect(ids, id).toContain(id);
    expect(Object.keys(ECRITURE_RESEAUX).sort()).toEqual([...RESEAUX_DECLINAISON].sort());
    for (const id of ["hyp-familles-reseau", "hyp-zones-reseau", "hyp-ordre-publication"]) expect(REGLES_DATEES_SEMEES.find((r) => r.id === id)?.niveau).toBe("hypothese");
    // v5 : Facebook sans plafond de durée (à vérifier), règles réécrites présentes.
    expect(ECRITURE_RESEAUX.facebook.dureeMaxSec).toEqual({ valeur: null, regleId: "fb-tout-reels-2025" });
    expect(REGLES_DATEES_SEMEES.find((r) => r.id === "fb-rediffusion-2025")?.texte).toMatch(/plusieurs de ses Pages/);
  });

  it("tournures calibrées (lot GR) : 68 bloquantes, 19 en grappe, aucune présente chez l'avocat de référence ; toutes compilent", () => {
    expect(TOURNURES_CALIBREES.filter((t) => t.niveau === "bloquant")).toHaveLength(68);
    expect(TOURNURES_CALIBREES.filter((t) => t.niveau === "grappe")).toHaveLength(19);
    for (const t of TOURNURES_CALIBREES) {
      expect(t.humains.avocatref).toBe(0);
      expect(() => new RegExp(t.regex, DRAPEAUX_TOURNURES)).not.toThrow();
    }
    const trouve = (id: string, texte: string) => new RegExp(TOURNURES_CALIBREES.find((t) => t.motif === id)!.regex, DRAPEAUX_TOURNURES).test(texte);
    expect(trouve("rassurez-vous", "Rassurez-vous, ce n'est pas grave.")).toBe(true);
    expect(trouve("et-si-je-vous-disais", "Et si je vous disais que…")).toBe(true);
    // Limite de mot sensible aux accents (traduction de la syntaxe Python) : « créveritable » ne déclenche rien.
    expect(trouve("crucial", "C'est crucial.")).toBe(true);
    expect(trouve("crucial", "Écrucialement")).toBe(false);
  });
});

/* ---------------- Dérivations ---------------- */

function bloc(id: string, blocRecette: string, textes: (string | [string, string])[]): BlocScript {
  return { id, blocRecette, segments: textes.map((t, i) => (Array.isArray(t) ? { id: `${id}-${i}`, texte: t[0], facultatif: t[1] as VarianteReseau["reseau"] } : { id: `${id}-${i}`, texte: t })) };
}

function variante(p: Partial<VarianteReseau> & Pick<VarianteReseau, "id" | "code" | "reseau">): VarianteReseau {
  return {
    scriptMaitreId: "suj-1",
    scriptId: "script-1",
    formatId: "avocat",
    version: 1,
    versionRecette: 4,
    ouverture: [bloc(`${p.id}-o`, "accroche", [`Accroche ${p.reseau}`])],
    fin: [bloc(`${p.id}-f`, "appel", [`Appel ${p.reseau}`])],
    accrocheId: "a",
    appel: { type: "sauvegarde", texte: "x", selonObjectif: false },
    boucle: false,
    segmentFacultatifRetenu: false,
    dureeEstimeeSec: 30,
    ratios: ["9:16"],
    encadre: { texte: "x" },
    publication: { texte: "", motsDiese: [], premiereLigne: "", sources: [], rappels: {}, etiquetteIAPlateforme: false, justifications: [] },
    empreinteCorps: "e",
    empreinteTexte: "t",
    note: { globale: 0, criteres: {} },
    controles: { passe: true, violations: [], versionControles: 0 },
    etat: "a-relire",
    creeLe: LE,
    modifieLe: LE,
    ...p,
  };
}

describe("assemblage, répartition, prononciations", () => {
  const corps = [bloc("c1", "coeur", ["Le milieu.", ["Pour LinkedIn seulement.", "linkedin"]]), bloc("c2", "preuve", ["La preuve."])];

  it("assemblerBlocs : ouverture + corps + fin ; le segment facultatif n'est dit que sur SON réseau, s'il y est retenu", () => {
    const tt = variante({ id: "v-tt", code: "0001-AV-TT", reseau: "tiktok" });
    const li = variante({ id: "v-li", code: "0001-AV-LI", reseau: "linkedin", segmentFacultatifRetenu: true });
    const txt = (b: BlocScript[]) => b.flatMap((x) => x.segments.map((s) => s.texte));
    expect(txt(assemblerBlocs({ blocs: corps }, tt))).toEqual(["Accroche tiktok", "Le milieu.", "La preuve.", "Appel tiktok"]);
    expect(txt(assemblerBlocs({ blocs: corps }, li))).toEqual(["Accroche linkedin", "Le milieu.", "Pour LinkedIn seulement.", "La preuve.", "Appel linkedin"]);
    expect(txt(assemblerBlocs({ blocs: corps }, { ...li, segmentFacultatifRetenu: false }))).not.toContain("Pour LinkedIn seulement.");
  });

  it("repartirBlocs suit les parties déclarées ; l'empreinte du corps change avec son texte", () => {
    const tout = [bloc("o", "accroche", ["A"]), ...corps, bloc("f", "appel", ["Z"]), bloc("g", "boucle", ["B"])];
    const r = repartirBlocs(tout, { ouverture: ["accroche", "promesse"], fin: ["appel", "boucle"] });
    expect(r.ouverture.map((b) => b.id)).toEqual(["o"]);
    expect(r.corps.map((b) => b.id)).toEqual(["c1", "c2"]);
    expect(r.fin.map((b) => b.id)).toEqual(["f", "g"]);
    expect(empreinteCorps(corps)).toBe(empreinteCorps(structuredClone(corps)));
    expect(empreinteCorps(corps)).not.toBe(empreinteCorps([bloc("c1", "coeur", ["Le milieu changé."])]));
  });

  it("appliquerPrononciations : délègue à prononciationsActives ; le texte affiché ne change pas", () => {
    const dico: Prononciation[] = [{ id: "p1", mot: "PV", prononciation: "pé-vé", creeLe: LE, modifieLe: LE } as Prononciation];
    const [s] = appliquerPrononciations([{ id: "s", texte: "Un PV arrive." }], dico);
    expect(s.texte).toBe("Un PV arrive.");
    expect(s.texteDit).toContain("pé-vé");
  });
});

describe("états : source de vérité (B.2.5)", () => {
  const v = variante({ id: "v1", code: "0001-AV-TT", reseau: "tiktok", etat: "validee" });
  const video: Pick<Video, "id" | "statut"> = { id: "vid", statut: "prete" };
  const pub = (statut: Publication["statut"], via: Publication["via"] = "buffer"): Pick<Publication, "videoId" | "varianteId" | "reseau" | "statut" | "via"> => ({ videoId: "vid", varianteId: "v1", reseau: "tiktok", statut, via });

  it("etatReseau : écriture, puis vidéo, puis publications ; une simulation ne compte jamais", () => {
    expect(etatReseau(null, null)).toBe("absent");
    expect(etatReseau({ ...v, etat: "a-reverifier" }, video)).toBe("a-reverifier");
    expect(etatReseau(v, null)).toBe("validee");
    expect(etatReseau(v, video)).toBe("en-video");
    expect(etatReseau(v, { id: "vid", statut: "echec" })).toBe("probleme");
    expect(etatReseau(v, video, [pub("programmee", "simulation")])).toBe("en-video");
    expect(etatReseau(v, video, [pub("programmee")])).toBe("programmee");
    expect(etatReseau(v, video, [pub("programmee"), pub("publiee", "manuel")])).toBe("publiee");
    expect(etatReseau({ ...v, archiveLe: LE }, video)).toBe("absent");
    expect(etapeEditorialeDe("a-completer")).toBe("a_relire");
    expect(etapeEditorialeDe("en-video")).toBe("validee");
  });

  it("versions courantes, statut éditorial dérivé, état du sujet = la version la moins avancée", () => {
    const v1 = variante({ id: "a1", code: "0001-AV-TT", reseau: "tiktok", etat: "validee" });
    const v2 = variante({ id: "a2", code: "0001-AV-TT", reseau: "tiktok", version: 2, parentId: "a1", etat: "a-relire" });
    const w = variante({ id: "b1", code: "0001-AV-LI", reseau: "linkedin", etat: "validee" });
    expect(versionsCourantes([v1, v2, w]).map((x) => x.id).sort()).toEqual(["a2", "b1"]);
    expect(statutEditorialDerive("script-1", [v1, v2, w])).toBe("brouillon");
    expect(statutEditorialDerive("script-1", [v1, w])).toBe("valide");
    expect(statutEditorialDerive("script-x", [v1, w])).toBe("brouillon");
    const maitre = { id: "suj-1" } as ScriptMaitre;
    expect(etatSujet(maitre, [v1, v2, w])).toBe("a-relire");
    expect(etatSujet({ ...maitre, etat: "en-ecriture" }, [v1, w])).toBe("en-ecriture");
    expect(etatSujet(maitre, [])).toBe("brouillon");
  });
});

describe("grille d'un sujet : 2 formats + 1 « je lis » (B.6.2)", () => {
  it("une ligne par (format, mode, adresse), 5 cases ; cases absentes là où rien n'est écrit", () => {
    const maitre = { id: "suj-1" } as ScriptMaitre;
    const scripts = [
      { id: "s-av", formatId: "avocat", mode: "avatar" as const, adresse: "vous" as const, scriptMaitreId: "suj-1", creeLe: "2026-10-02T10:00:00Z" },
      { id: "s-po", formatId: "podcast", mode: "teleprompteur" as const, adresse: "vous" as const, scriptMaitreId: "suj-1", creeLe: "2026-10-02T11:00:00Z" },
      { id: "s-av-l", formatId: "avocat", mode: "teleprompteur" as const, adresse: "vous" as const, scriptMaitreId: "suj-1", creeLe: "2026-10-02T12:00:00Z" },
    ];
    const vs = [
      ...RESEAUX_DECLINAISON.map((r) => variante({ id: `av-${r}`, code: codeVariante({ numero: 1, codeFormat: "AV", reseau: r }), reseau: r, scriptId: "s-av" })),
      ...(["linkedin", "youtube-shorts"] as const).map((r) => variante({ id: `po-${r}`, code: codeVariante({ numero: 1, codeFormat: "PO", reseau: r, mode: "teleprompteur" }), reseau: r, scriptId: "s-po", formatId: "podcast", etat: "validee" })),
      variante({ id: "avl-tt", code: "0001-AV-TT-L", reseau: "tiktok", scriptId: "s-av-l" }),
    ];
    const g = grilleSujet(maitre, scripts, vs);
    expect(g.map((l) => `${l.formatId}/${l.mode}`)).toEqual(["avocat/avatar", "avocat/teleprompteur", "podcast/teleprompteur"]);
    expect(Object.values(g[0].cases).map((c) => c.etat)).toEqual(["a-relire", "a-relire", "a-relire", "a-relire", "a-relire"]);
    expect(g[1].cases.tiktok).toMatchObject({ etat: "a-relire", code: "0001-AV-TT-L" });
    expect(g[1].cases.instagram.etat).toBe("absent");
    expect(g[2].cases.linkedin.etat).toBe("validee");
    expect(g[2].cases.tiktok.etat).toBe("absent");
  });
});

describe("matières : utilisations calculées, heuristiques, péremption", () => {
  it("utilisationsMatiere : seules les versions VALIDÉES consomment ; réseaux et numéro listés", () => {
    const maitre = { id: "suj-1", numero: 42, ancrages: [{ matiereId: "m1", type: "anecdote-will" as TypeMatiere, role: "principal" as const, faible: false }] } as ScriptMaitre;
    const vs = [variante({ id: "x1", code: "0042-AV-TT", reseau: "tiktok", etat: "validee" }), variante({ id: "x2", code: "0042-AV-LI", reseau: "linkedin", etat: "validee" }), variante({ id: "x3", code: "0042-AV-IG", reseau: "instagram" })];
    const u = utilisationsMatiere("m1", { maitres: [maitre], scripts: [], variantes: vs });
    expect(u.nombre).toBe(1);
    expect(u.sujets[0]).toMatchObject({ numero: 42, reseaux: ["tiktok", "linkedin"] });
    expect(utilisationsMatiere("m1", { maitres: [maitre], scripts: [], variantes: [vs[2]] }).nombre).toBe(0);
    expect(utilisationsMatiere("m1", { maitres: [{ ...maitre, archiveLe: LE }], scripts: [], variantes: vs }).nombre).toBe(0);
  });

  it("proposerTypeMatiere : les exemples de B.2.9", () => {
    const cas: [string, TypeMatiere][] = [
      ["La première fois que j'ai vu ses tableaux, j'ai compté 47 onglets.", "anecdote-will"],
      ["Un tableau Excel partagé n'est pas un outil de pilotage.", "avis-will"],
      ["« Je ne savais même pas ce que je ne voyais pas. »", "parole-dirigeant"],
      ["Est-ce que ChatGPT peut lire nos factures ?", "question-recue"],
      ["Dans presque toutes les PME que j'accompagne, le même fichier circule en 5 versions.", "observation"],
      ["Beaucoup pensent qu'il faut un informaticien pour automatiser.", "idee-recue"],
      ["Sauf si vos tableaux changent de forme chaque mois.", "limite"],
      ["Selon une étude de l'Insee publiée en mars, 40 % des PME…", "etude"],
      ["Une nouvelle loi entre en vigueur le 1er janvier.", "actualite"],
      ["Mon client a gagné 35 h par semaine.", "cas-client"],
    ];
    for (const [t, type] of cas) expect(proposerTypeMatiere(t), t).toBe(type);
  });

  it("detailConcret : chiffre, objet, métier ou lieu ; sinon ancrage « faible »", () => {
    expect(detailConcret("J'ai compté 47 onglets.")).toBe("47 onglets");
    expect(detailConcret("Le DAF ne voyait rien.")).toBe("daf");
    expect(detailConcret("C'était chez Martin, à Villeexemple.")).not.toBeNull();
    expect(detailConcret("Les choses se passent souvent mal.")).toBeNull();
  });

  it("proposerPilier par mots-clés", () => {
    const piliers = [{ id: "auto", motsCles: ["excel", "facture"] }, { id: "form", motsCles: ["formation"] }];
    expect(proposerPilier("Vos factures Excel en double", piliers)).toBe("auto");
    expect(proposerPilier("Rien à voir", piliers)).toBeUndefined();
  });

  it("PEREMPTION_PAR_TYPE et PEREMPTION_MATIERE", () => {
    expect(PEREMPTION_PAR_TYPE).toEqual({ etude: 18, "chiffre-interne": 12, "cas-client": 24, "regle-loi": 12 });
    expect(PEREMPTION_MATIERE["anecdote-will"]).toBeNull();
    expect(peremptionParDefaut({ preuve: "etude" }, "2026-01-31T00:00:00.000Z")).toBe("2027-07-31T00:00:00.000Z");
    expect(peremptionParDefaut({ matiere: "actualite" }, "2026-10-02T00:00:00.000Z")).toBe("2026-11-01T00:00:00.000Z");
    expect(peremptionParDefaut({ matiere: "parole-dirigeant" }, "2026-02-28T00:00:00.000Z")).toBe("2029-02-28T00:00:00.000Z");
    expect(peremptionParDefaut({ matiere: "cas-client", preuveReliee: { type: "cas-client" } }, "2026-10-02T00:00:00.000Z")).toBe("2028-10-02T00:00:00.000Z");
    expect(peremptionParDefaut({ matiere: "limite" }, LE)).toBeNull();
    expect(expireBientot("actualite", "2026-10-08T00:00:00.000Z", "2026-10-02T00:00:00.000Z")).toBe(true);
    expect(expireBientot("actualite", "2026-10-20T00:00:00.000Z", "2026-10-02T00:00:00.000Z")).toBe(false);
  });
});

describe("historique de série (B.0 n° 40)", () => {
  const maitre = (id: string, extra: Partial<ScriptMaitre> = {}): ScriptMaitre =>
    ({ id, version: 1, brief: { reseaux: ["tiktok"] } as ScriptMaitre["brief"], ancrages: [{ matiereId: `m-${id}`, type: "anecdote-will", role: "principal", faible: false }], marqueId: "m", contexteAxionVersion: 0, creeLe: LE, modifieLe: LE, ...extra }) as ScriptMaitre;

  it("validées et réservées comptent ; l'archivé et l'échec libèrent ; ordre par date", () => {
    const vs = [
      variante({ id: "a", code: "0001-AV-TT", reseau: "tiktok", scriptMaitreId: "s1", etat: "validee", avisWill: { resultat: "valide", le: "2026-10-01T00:00:00Z" } }),
      variante({ id: "b", code: "0002-AV-TT", reseau: "tiktok", scriptMaitreId: "s2", etat: "a-relire" }),
      variante({ id: "c", code: "0004-AV-TT", reseau: "tiktok", scriptMaitreId: "s4", etat: "validee", avisWill: { resultat: "valide", le: "2026-09-01T00:00:00Z" } }),
    ];
    const choix = { structure: "AV.S1", ancrages: [{ matiereId: "m-s3", type: "observation" as TypeMatiere, role: "principal" as const, faible: false }], pointDeVue: "vous" as const, emotion: "surprise" as const, poidsFamilles: {}, relachements: [], modeRotation: "demarrage" as const };
    const entrees = { maitres: [maitre("s1"), maitre("s2"), maitre("s3", { etat: "en-ecriture", choix, creeLe: "2026-10-02T09:00:00Z" }), maitre("s4")], variantes: vs };
    const h = historiqueSerie(entrees, "tiktok", 10);
    expect(h.map((e) => e.scriptMaitreId)).toEqual(["s4", "s1", "s3"]);
    expect(h[2]).toMatchObject({ reserve: true, origineDate: "lancement", typesAncrage: ["observation"] });
    expect(partAnecdote(h)).toBeCloseTo(2 / 3);
    const libere = historiqueSerie({ ...entrees, maitres: [maitre("s1"), maitre("s3", { etat: "en-ecriture", choix, archiveLe: LE }), maitre("s4", { etat: "echec" })] }, "tiktok", 10);
    expect(libere.map((e) => e.scriptMaitreId)).toEqual(["s1"]);
    expect(historiqueSerie(entrees, "tiktok", 1).map((e) => e.scriptMaitreId)).toEqual(["s3"]);
    expect(historiqueSerie(entrees, "linkedin", 10)).toEqual([]);
  });
});
