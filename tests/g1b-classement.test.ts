/**
 * G1b : CLASSEMENT (fonctions pures). Critères de fin (plan v5 B.10, ligne G1b) : un sujet retrouvé par la rangée, le
 * bouton Format et la recherche « 42 » ; bouton Format lisible avec 30 formats fictifs ; zip aux bons noms, tous ratios ;
 * ordre J à J+4 modifiable ; feuille Buffer d'une version TikTok : un seul réseau proposé.
 */
import { describe, expect, it } from "vitest";
import {
  adresseFiltres,
  analyserRequeteCode,
  champsACollerALaMain,
  CHAMPS_BUFFER,
  deplacerDansOrdre,
  detecterSujetSensible,
  filtrerSujets,
  groupesFormats,
  lireFiltres,
  ordreValide,
  planifierPublications,
  reseauxProposesBuffer,
  sujetDansVue,
  type FormatClassable,
  type SujetClassable,
} from "@/domaine/classement-generateur";
import { nomFichier } from "@/domaine/derivations-generateur";
import type { EtatReseau } from "@/domaine/derivations-generateur";
import type { Adresse, ModeDiction, ReseauDeclinaison } from "@/domaine/types";
import { crc32, creerZip, lireZip } from "@/lib/zip";

const CINQ: ReseauDeclinaison[] = ["tiktok", "instagram", "youtube-shorts", "linkedin", "facebook"];

function ligne(formatId: string, code: string, numero: number, etats: Partial<Record<ReseauDeclinaison, EtatReseau>>, mode: ModeDiction = "avatar", adresse: Adresse = "vous") {
  const sfx = { avatar: "", teleprompteur: "-L", trame: "-I", "voix-off": "-V" }[mode] + (adresse === "tu" ? "-T" : "");
  const cr = { tiktok: "TT", instagram: "IG", "youtube-shorts": "YS", linkedin: "LI", facebook: "FB" } as const;
  return {
    formatId,
    mode,
    adresse,
    cases: Object.fromEntries(CINQ.map((r) => [r, etats[r] ? { etat: etats[r]!, code: `${String(numero).padStart(4, "0")}-${code}-${cr[r]}${sfx}` } : { etat: "absent" as const }])) as SujetClassable["grille"][number]["cases"],
  };
}

function sujet(numero: number | undefined, idee: string, grille: SujetClassable["grille"], extra: Partial<SujetClassable["maitre"]> = {}): SujetClassable & { id: string } {
  return { id: `s-${numero ?? idee}`, maitre: { numero, brief: { idee }, ...extra }, etat: "a-relire", grille };
}

const S42 = sujet(42, "ChatGPT peut-il lire vos factures ?", [
  ligne("avocat", "AV", 42, { tiktok: "a-relire", instagram: "a-relire", "youtube-shorts": "validee", linkedin: "probleme", facebook: "a-relire" }),
  ligne("avocat", "AV", 42, { tiktok: "a-relire" }, "teleprompteur"),
]);
const S41 = sujet(41, "Le même fichier en 5 versions", [ligne("podcast-a-deux", "SAR", 41, { linkedin: "publiee", instagram: "en-video" })]);
const S40 = sujet(40, "35 h par semaine, puis 0", [ligne("avocat", "AV", 40, { facebook: "validee" }, "avatar", "tu")]);
const BROUILLON = sujet(undefined, "Faut-il un DPO ?", [], { manque: { type: "ANCRAGE_MANQUANT" } });
const TOUS = [BROUILLON, S42, S41, S40];
const CODES = { avocat: "AV", "podcast-a-deux": "SAR" };

describe("un sujet retrouvé par la rangée de logos, le bouton Format et la recherche « 42 »", () => {
  it("rangée de logos : TikTok garde les sujets qui ont une version TikTok écrite", () => {
    expect(filtrerSujets(TOUS, { reseau: "tiktok" }).map((s) => s.maitre.numero)).toEqual([42]);
    expect(filtrerSujets(TOUS, { reseau: "linkedin" }).map((s) => s.maitre.numero)).toEqual([42, 41]);
    expect(filtrerSujets(TOUS, { reseau: "facebook" }).map((s) => s.maitre.numero)).toEqual([42, 40]);
  });

  it("bouton Format : un format retient les sujets qui ont une ligne de ce format", () => {
    expect(filtrerSujets(TOUS, { format: "podcast-a-deux" }).map((s) => s.maitre.numero)).toEqual([41]);
    expect(filtrerSujets(TOUS, { format: "avocat", reseau: "tiktok" }).map((s) => s.maitre.numero)).toEqual([42]);
  });

  it("recherche : « 42 », « 0042 », « n° 42 », le code complet, un début de code, un code de format, un mot", () => {
    for (const q of ["42", "0042", "n° 42", "0042-AV-TT", "0042-av-tt-l", "0042-AV"]) expect(filtrerSujets(TOUS, { q }, CODES).map((s) => s.maitre.numero), q).toEqual([42]);
    expect(filtrerSujets(TOUS, { q: "0042-AV-LI-T" }, CODES)).toEqual([]);
    expect(filtrerSujets(TOUS, { q: "SAR" }, CODES).map((s) => s.maitre.numero)).toEqual([41]);
    expect(filtrerSujets(TOUS, { q: "factures" }, CODES).map((s) => s.maitre.numero)).toEqual([42]);
    expect(filtrerSujets(TOUS, { q: "fâctures" }, CODES).map((s) => s.maitre.numero)).toEqual([42]);
  });

  it("analyse d'une requête : un mot de 2-3 lettres n'est un code que s'il est connu", () => {
    expect(analyserRequeteCode("42")).toEqual({ numero: 42 });
    expect(analyserRequeteCode("0042-AV-TT-L")).toEqual({ numero: 42, prefixeCode: "0042-AV-TT-L" });
    expect(analyserRequeteCode("sar", ["SAR"])).toEqual({ codeFormat: "SAR" });
    expect(analyserRequeteCode("pme", ["SAR"])).toBeNull();
  });

  it("autres critères : qui parle, vous/tu, vues rapides, ET entre critères", () => {
    expect(filtrerSujets(TOUS, { qui: "teleprompteur" }).map((s) => s.maitre.numero)).toEqual([42]);
    expect(filtrerSujets(TOUS, { adresse: "tu" }).map((s) => s.maitre.numero)).toEqual([40]);
    expect(filtrerSujets(TOUS, { etat: "il-manque-une-matiere" }).map((s) => s.maitre.brief.idee)).toEqual(["Faut-il un DPO ?"]);
    expect(filtrerSujets(TOUS, { etat: "pret-a-fabriquer" }).map((s) => s.maitre.numero)).toEqual([42, 40]);
    expect(filtrerSujets(TOUS, { etat: "a-programmer" }).map((s) => s.maitre.numero)).toEqual([41]);
    expect(sujetDansVue(S42, "a-relire")).toBe(true);
    expect(filtrerSujets(TOUS, { etat: "pret-a-fabriquer", reseau: "facebook", adresse: "tu" }).map((s) => s.maitre.numero)).toEqual([40]);
  });

  it("état dans l'adresse : une valeur par critère, valeurs inconnues ignorées, aller-retour stable", () => {
    const f = lireFiltres({ reseau: "tiktok", format: "avocat", etat: "a-relire", qui: "inconnu", adresse: ["tu", "vous"], q: " 42 " });
    expect(f).toEqual({ reseau: "tiktok", format: "avocat", etat: "a-relire", adresse: "tu", q: "42" });
    expect(adresseFiltres("/ecrire", f)).toBe("/ecrire?reseau=tiktok&format=avocat&etat=a-relire&adresse=tu&q=42");
    expect(lireFiltres(new URLSearchParams("reseau=youtube&etat=pas-un-etat"))).toEqual({});
  });
});

describe("bouton Format lisible avec 30 formats fictifs", () => {
  const familles = ["face-camera", "conversation", "ecran-partage", "motion", "ugc", "temoignage"];
  const formats: FormatClassable[] = Array.from({ length: 30 }, (_, i) => ({ id: `f${i}`, nom: `Format fictif ${String(i).padStart(2, "0")}`, code: `F${String.fromCharCode(65 + (i % 26))}${i >= 26 ? "Z" : ""}`, famille: familles[i % familles.length] }));
  const nombres = Object.fromEntries(formats.map((f, i) => [f.id, i % 3 === 0 ? 0 : i]));

  it("favoris en premier (les 3 plus utilisés), puis rangés par type de vidéo ; formats sans sujet masqués avec un compteur", () => {
    const { groupes, masques } = groupesFormats(formats, nombres, { ordreFamilles: familles });
    expect(groupes[0].cle).toBe("favoris");
    expect(groupes[0].formats.map((f) => f.id)).toEqual(["f29", "f28", "f26"]);
    expect(groupes.slice(1).map((g) => g.cle)).toEqual(familles.filter((fam) => groupes.some((g) => g.cle === fam)));
    expect(masques).toBe(10);
    const affiches = groupes.flatMap((g) => g.formats);
    expect(affiches).toHaveLength(20);
    expect(new Set(affiches.map((f) => f.id)).size).toBe(20);
    // Aucun groupe ne déborde : au plus 6 formats par type de vidéo, 2 colonnes à 390 px.
    for (const g of groupes) expect(g.formats.length).toBeLessThanOrEqual(6);
  });

  it("« tout afficher » montre les 30 ; la recherche trouve par nom ou par code, même sans sujet", () => {
    expect(groupesFormats(formats, nombres, { toutAfficher: true }).groupes.flatMap((g) => g.formats)).toHaveLength(30);
    const r = groupesFormats(formats, nombres, { recherche: "fictif 03" });
    expect(r.groupes.flatMap((g) => g.formats.map((f) => f.id))).toEqual(["f3"]);
    expect(r.masques).toBe(0);
    expect(groupesFormats(formats, nombres, { recherche: "fd" }).groupes.flatMap((g) => g.formats.map((f) => f.id)).sort()).toEqual(["f29", "f3"]);
    expect(groupesFormats(formats, nombres, { recherche: "FDZ" }).groupes.flatMap((g) => g.formats.map((f) => f.id))).toEqual(["f29"]);
  });

  it("favoris choisis par Will : ils priment sur le calcul ; renommer un format ne change pas son code", () => {
    const g = groupesFormats(formats, nombres, { favoris: ["f0", "f1"] });
    expect(g.groupes[0].formats.map((f) => f.id).sort()).toEqual(["f0", "f1"]);
    const renomme = formats.map((f) => (f.id === "f4" ? { ...f, nom: "Tout autre nom" } : f));
    const avant = groupesFormats(formats, nombres, { recherche: formats[4].code }).groupes.flatMap((x) => x.formats.map((f) => f.id));
    const apres = groupesFormats(renomme, nombres, { recherche: formats[4].code }).groupes.flatMap((x) => x.formats.map((f) => f.id));
    expect(apres).toEqual(avant);
  });
});

describe("ordre et heure de publication (J à J+4, modifiable)", () => {
  it("ordre par défaut : TikTok J, Reels J+1, Shorts J+2, LinkedIn J+3, Facebook J+4 (lundi 05/10/2026)", () => {
    const c = planifierPublications("2026-10-05", CINQ);
    expect(c.map((x) => [x.reseau, x.jour])).toEqual([
      ["tiktok", "2026-10-05"],
      ["instagram", "2026-10-06"],
      ["youtube-shorts", "2026-10-07"],
      ["linkedin", "2026-10-08"],
      ["facebook", "2026-10-09"],
    ]);
    expect(c.every((x) => !x.heure)).toBe(true);
  });

  it("LinkedIn tombé un week-end passe au lundi ; l'heure réglée par réseau est reprise, jamais inventée", () => {
    const c = planifierPublications("2026-10-01", CINQ, undefined, { tiktok: "18:30", linkedin: "8h" });
    const li = c.find((x) => x.reseau === "linkedin")!;
    expect(li).toMatchObject({ jour: "2026-10-05", decaleWeekEnd: true, rang: 3 });
    expect(c.find((x) => x.reseau === "tiktok")!.heure).toBe("18:30");
    expect(li.heure).toBeUndefined();
  });

  it("modifiable d'un toucher : monter LinkedIn le place à J+2 ; l'ordre reste complet et sans doublon", () => {
    const o = deplacerDansOrdre(ordreValide(), "linkedin", -1);
    expect(o).toEqual(["tiktok", "instagram", "linkedin", "youtube-shorts", "facebook"]);
    expect(planifierPublications("2026-10-05", CINQ, o).find((x) => x.reseau === "linkedin")!.jour).toBe("2026-10-07");
    expect(deplacerDansOrdre(o, "tiktok", -1)).toEqual(o);
    expect(ordreValide(["facebook", "facebook", "youtube", "tiktok"])).toEqual(["facebook", "tiktok", "instagram", "youtube-shorts", "linkedin"]);
  });

  it("seuls les réseaux du sujet sont planifiés, serrés sans trou", () => {
    expect(planifierPublications("2026-10-05", ["linkedin", "tiktok"]).map((x) => [x.reseau, x.rang])).toEqual([
      ["tiktok", 0],
      ["linkedin", 1],
    ]);
  });
});

describe("feuille Buffer et champs transmis", () => {
  const tous = ["linkedin", "instagram", "facebook", "tiktok", "youtube", "youtube-shorts"];
  it("version TikTok : un seul réseau proposé ; « autre réseau » confirmé rouvre le choix ; sans version : libre", () => {
    expect(reseauxProposesBuffer(tous, "tiktok")).toEqual(["tiktok"]);
    expect(reseauxProposesBuffer(tous, "tiktok", true)).toEqual(tous);
    expect(reseauxProposesBuffer(tous)).toEqual(tous);
  });

  it("ce que Buffer ne transmet pas devient « à coller » : mots-clés TikTok toujours, commentaire épinglé partout", () => {
    expect(CHAMPS_BUFFER.verifieLe).toBe("2026-10-02");
    expect(champsACollerALaMain("tiktok", { motsClesDeclares: ["factures"] })).toEqual(["motsCles"]);
    expect(champsACollerALaMain("youtube-shorts", { titres: ["a", "b"], sources: ["https://x"] })).toEqual(["premierCommentaire"]);
    expect(champsACollerALaMain("instagram", { sources: ["https://x"], commentaireEpingle: "Épinglé" })).toEqual(["commentaireEpingle"]);
  });
});

describe("noms de fichiers et archive zip", () => {
  it("un fichier par ratio, -A2 pour la 2e accroche, -vN pour une version, sous-titres même racine", () => {
    const base = { code: "0042-AV-TT-L", titre: "Données : ChatGPT, vraiment ?", version: 2 };
    expect(nomFichier({ ...base, ratio: "9:16", extension: "mp4" })).toBe("0042-AV-TT-L-donnees-chatgpt-vraiment-9x16-v2.mp4");
    expect(nomFichier({ ...base, ratio: "1:1", extension: "mp4", essaiAccroche: 2 })).toBe("0042-AV-TT-L-donnees-chatgpt-vraiment-1x1-A2-v2.mp4");
    expect(nomFichier({ ...base, extension: "srt" })).toBe("0042-AV-TT-L-donnees-chatgpt-vraiment-v2.srt");
  });

  it("archive « stockée » : CRC exact, noms UTF-8, contenu relu à l'identique, doublons renommés", () => {
    expect(crc32(new TextEncoder().encode("123456789")).toString(16)).toBe("cbf43926");
    const fichiers = [
      { nom: "0042-AV-TT-donnees-9x16.mp4", donnees: new Uint8Array([1, 2, 3]) },
      { nom: "0042-AV-TT-donnees-1x1.mp4", donnees: new Uint8Array(1000).fill(7) },
      { nom: "0042-AV-TT-données.srt", donnees: new TextEncoder().encode("1\n00:00:00,000 --> 00:00:01,000\nÉté\n") },
      { nom: "0042-AV-TT-donnees-1x1.mp4", donnees: new Uint8Array([9]) },
    ];
    const zip = creerZip(fichiers);
    const relu = lireZip(zip);
    expect(relu.map((f) => f.nom)).toEqual(["0042-AV-TT-donnees-9x16.mp4", "0042-AV-TT-donnees-1x1.mp4", "0042-AV-TT-données.srt", "0042-AV-TT-donnees-1x1 (2).mp4"]);
    expect([...relu[1].donnees]).toEqual([...fichiers[1].donnees]);
    // Fin d'archive : signature et nombre d'entrées.
    const v = new DataView(zip.buffer);
    expect(v.getUint32(zip.length - 22, true)).toBe(0x06054b50);
    expect(v.getUint16(zip.length - 12, true)).toBe(4);
  });
});

describe("sujet sensible proposé par le code", () => {
  it("repère un sujet juridique ou sensible, jamais un sujet ordinaire", () => {
    expect(detecterSujetSensible("Faut-il un DPO dans une PME de 20 personnes ?")).toBe("juridique");
    expect(detecterSujetSensible("Vos fichiers clients dans ChatGPT")).toBe("donnees");
    expect(detecterSujetSensible("Licenciement par SMS")).toBe("rh");
    expect(detecterSujetSensible("ChatGPT peut-il lire vos factures ?")).toBeUndefined();
  });
});
