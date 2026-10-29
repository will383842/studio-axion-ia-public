/**
 * L1 · Carte de l'image : contrat `carte-image/1`, types et classes recalculés, formules absolues, photos, offre,
 * chapitres déterministes (M5), plafonds par réseau (M6), cohérence signalée sans correction, table d'icônes.
 * Tout est figé : fixtures JSON, aucune date, aucun hasard.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { completerCarte, controlerCarte, schemaCarteImage, textesDeLaCarte, type CarteImage } from "@/domaine/image-video/carte";
import { complexiteDe, dureeScriptAcceptable, type ClasseImage } from "@/domaine/image-video/complexite";
import { formulesAbsoluesDe } from "@/domaine/image-video/formules";
import { ICONE_NEUTRE, iconeDe, iconeOuRepli, NOMS_ICONES_IV, TABLE_ICONES } from "@/domaine/image-video/icones";
import { depasseLimiteDure, verdictPlafond } from "@/domaine/image-video/plafonds";

const DOSSIER = join(process.cwd(), "tests/image-video/fixtures/cartes");
const lire = (nom: string): CarteImage => JSON.parse(readFileSync(join(DOSSIER, `${nom}.json`), "utf8"));
const LETTRES = ["A", "B", "C", "D", "E", "F"] as const;
const cartes = Object.fromEntries(LETTRES.map((l) => [l, lire(l)])) as Record<(typeof LETTRES)[number], CarteImage>;
const faux = lire("faux-16-noeuds");

/** Permutation fixe d'une liste (retournée puis coupée en deux) : même contenu, autre ordre. */
function melange<T>(liste: readonly T[]): T[] {
  const r = [...liste].reverse();
  const m = Math.ceil(r.length / 2);
  return [...r.slice(m), ...r.slice(0, m)];
}

describe("contrat carte-image/1", () => {
  for (const nom of [...LETTRES, "faux-16-noeuds"]) {
    it(`${nom} passe le schéma et les contrôles du code`, () => {
      const carte = nom === "faux-16-noeuds" ? faux : cartes[nom as (typeof LETTRES)[number]];
      expect(schemaCarteImage.safeParse(carte).success).toBe(true);
      expect(controlerCarte(carte).erreurs).toEqual([]);
    });
    it(`${nom} est figée : le code recalcule exactement la même carte`, () => {
      const carte = nom === "faux-16-noeuds" ? faux : cartes[nom as (typeof LETTRES)[number]];
      expect(completerCarte(carte)).toEqual(carte);
    });
  }

  it("refuse une version inconnue et un champ inattendu", () => {
    expect(schemaCarteImage.safeParse({ ...cartes.C, version: "carte-image/2" }).success).toBe(false);
    expect(schemaCarteImage.safeParse({ ...cartes.C, inconnu: 1 }).success).toBe(false);
  });

  it("refuse une carte sans nœud", () => {
    expect(schemaCarteImage.safeParse({ ...cartes.C, noeuds: [] }).success).toBe(false);
  });
});

describe("types et classes recalculés par le code", () => {
  const attendus: Record<(typeof LETTRES)[number], { type: string; classes: ClasseImage[] }> = {
    A: { type: "benefices", classes: ["simple", "moyenne"] },
    B: { type: "benefices", classes: ["simple", "moyenne"] },
    C: { type: "embranchement", classes: ["branches"] },
    D: { type: "entonnoir", classes: ["moyenne"] },
    E: { type: "avant-apres", classes: ["moyenne"] },
    F: { type: "avant-apres", classes: ["moyenne"] },
  };
  for (const l of LETTRES) {
    it(`${l} → ${attendus[l].type}, ${attendus[l].classes.join(" ou ")}`, () => {
      expect(cartes[l].types[0]).toBe(attendus[l].type);
      const c = complexiteDe(cartes[l]);
      expect(attendus[l].classes).toContain(c.classe);
      expect(c.chapitres).toEqual([]);
      expect(c.dureeCibleSec).toBeGreaterThanOrEqual(c.fourchetteSec[0]);
      expect(c.dureeCibleSec).toBeLessThanOrEqual(c.fourchetteSec[1]);
    });
  }

  it("le type ne dépend pas de ce que la lecture a annoncé : il est recalculé", () => {
    expect(completerCarte({ ...cartes.C, types: ["chaine"] }).types[0]).toBe("embranchement");
  });

  it("durée du script : cible ±10 %", () => {
    const c = complexiteDe(cartes.C);
    expect(dureeScriptAcceptable(c, c.dureeCibleSec * 1.09)).toBe(true);
    expect(dureeScriptAcceptable(c, c.dureeCibleSec * 1.12)).toBe(false);
  });
});

describe("offre, automatisation, photos de personnes", () => {
  it("A et B : offre formation, pas d'automatisation", () => {
    for (const l of ["A", "B"] as const) {
      expect(cartes[l].offre).toBe("formation");
      expect(cartes[l].automatisation).toBe(false);
    }
  });
  it("C à F : automatisation (annonce « situation type » obligatoire)", () => {
    for (const l of ["C", "D", "E", "F"] as const) expect(cartes[l].automatisation).toBe(true);
  });
  it("A : la photo est marquée photoPersonnes et signalée à Will", () => {
    const photos = cartes.A.noeuds.filter((n) => n.photoPersonnes);
    expect(photos.map((n) => n.id)).toEqual(["n01"]);
    expect(controlerCarte(cartes.A).alertes.some((a) => a.includes("photo de personnes"))).toBe(true);
  });
  it("l'offre corrigée par Will est gardée", () => {
    expect(completerCarte({ ...cartes.C, offre: "audit" }).offre).toBe("audit");
  });
});

describe("formules absolues : repérées, chacune avec une proposition", () => {
  it("« presque toujours » / « presque jamais » (la version prudente) ne sont plus des formules absolues", () => {
    expect(formulesAbsoluesDe("presque toujours", "x")).toEqual([]);
    expect(formulesAbsoluesDe("Presque   jamais", "x")).toEqual([]);
    expect(formulesAbsoluesDe("Il répond toujours", "x").map((f) => f.proposition)).toEqual(["Il répond presque toujours"]);
    expect(formulesAbsoluesDe("Jamais d'oubli", "x").map((f) => f.proposition)).toEqual(["Presque jamais d'oubli"]);
  });
  const formules = (c: CarteImage) => c.formulesAbsolues.map((f) => f.texte);
  it("F : « Zéro erreur » et « risque erreur : zéro »", () => {
    expect(formules(cartes.F)).toEqual(expect.arrayContaining(["Zéro erreur", "risque erreur : zéro"]));
    expect(cartes.F.formulesAbsolues.find((f) => f.texte === "Zéro erreur")?.proposition).toBe("Une saisie. Trois outils. Presque plus d'erreurs.");
  });
  it("C : « 0 demande perdue »", () => {
    expect(formules(cartes.C)).toContain("0 demande perdue");
  });
  it("A : « dès le premier jour » et « dès le 1er jour »", () => {
    expect(formules(cartes.A)).toEqual(expect.arrayContaining(["dès le premier jour", "dès le 1er jour"]));
  });
  it("D : « 0 question sans réponse »", () => {
    expect(formules(cartes.D)).toContain("0 question sans réponse");
  });
  it("chaque formule a un endroit réel et une proposition différente du texte d'origine", () => {
    for (const l of LETTRES) {
      const textes = textesDeLaCarte(cartes[l]);
      for (const f of cartes[l].formulesAbsolues) {
        const origine = textes.find((t) => t.ou === f.ou)?.texte;
        expect(origine).toContain(f.texte);
        expect(f.proposition.length).toBeGreaterThan(0);
        expect(f.proposition).not.toBe(origine);
      }
    }
  });
  it("le choix de Will (« garder ») survit au recalcul et retire l'alerte", () => {
    const tranche = cartes.F.formulesAbsolues.map((f) => ({ ...f, choixWill: "garder" as const }));
    const carte = completerCarte({ ...cartes.F, formulesAbsolues: tranche });
    expect(carte.formulesAbsolues.every((f) => f.choixWill === "garder")).toBe(true);
    expect(controlerCarte(carte).alertes.some((a) => a.startsWith("Formule"))).toBe(false);
  });
  it("aucune formule inventée sur B", () => {
    expect(cartes.B.formulesAbsolues).toEqual([]);
  });
});

describe("cohérence : signalée, jamais corrigée", () => {
  it("F signale « 19 × 20 = 6 h 20 ≠ 6 h » sans toucher au texte de l'image", () => {
    expect(cartes.F.coherence).toContainEqual({ calcul: "19 × 20 = 6 h 20 ≠ 6 h", ok: false });
    expect(cartes.F.bandeau).toContain("Sur 20 cmd/jour = 6h récupérées");
    expect(controlerCarte(cartes.F).ok).toBe(true);
    expect(controlerCarte(cartes.F).alertes).toContain("Calcul à vérifier sur l'image : 19 × 20 = 6 h 20 ≠ 6 h.");
  });
  it("F valide 8 + 6 + 5 = 19", () => {
    expect(cartes.F.coherence).toContainEqual({ calcul: "8 + 6 + 5 = 19", ok: true });
  });
  it("D valide 16 + 4 = 20", () => {
    expect(cartes.D.coherence).toContainEqual({ calcul: "16 + 4 = 20", ok: true });
  });
  it("C valide 80 % + 20 % = 100 %", () => {
    expect(cartes.C.coherence).toContainEqual({ calcul: "80 % + 20 % = 100 %", ok: true });
  });
  it("une somme fausse est signalée", () => {
    const noeuds = cartes.D.noeuds.map((n) => (n.id === "n04" ? { ...n, quantite: 5 } : n));
    expect(completerCarte({ ...cartes.D, noeuds }).coherence).toContainEqual({ calcul: "16 + 5 ≠ 20", ok: false });
  });
});

describe("contrôles du graphe", () => {
  it("une flèche vers un bloc inexistant est bloquante", () => {
    const carte = { ...cartes.C, liens: [...cartes.C.liens, { id: "l99", de: "n01", vers: "n99", couleur: "noir" as const, style: "plein" as const }] };
    expect(controlerCarte(carte).ok).toBe(false);
  });
  it("un bloc isolé est bloquant hors bénéfices", () => {
    const carte = completerCarte({ ...cartes.D, noeuds: [...cartes.D.noeuds, { id: "n09", libelle: "Bloc perdu", role: "etape", couleur: "noir", acteur: "auto", ordre: 9 }] });
    expect(controlerCarte(carte).erreurs).toContain("Le bloc n09 n'est relié à rien.");
  });
  it("un inventaire de chiffres qui ne correspond plus aux textes est bloquant", () => {
    expect(controlerCarte({ ...cartes.C, chiffres: cartes.C.chiffres.slice(1) }).ok).toBe(false);
  });
  it("un chiffre lu par une seule lecture passe en alerte", () => {
    const chiffres = cartes.C.chiffres.map((c, i) => (i === 0 ? { ...c, lu: "une-seule" as const } : c));
    expect(controlerCarte({ ...cartes.C, chiffres }).alertes.some((a) => a.includes("23h14"))).toBe(true);
  });
  it("un avant / après sans groupe « après » est bloquant", () => {
    const carte = { ...cartes.F, groupes: cartes.F.groupes.filter((g) => g.sorte !== "apres") };
    expect(controlerCarte(carte).ok).toBe(false);
  });
});

describe("faux schéma figé à 16 nœuds et 3 branches (M5)", () => {
  it("très complexe, 3 chapitres, au moins un non essentiel", () => {
    const c = complexiteDe(faux);
    expect(c.noeuds).toBe(16);
    expect(c.branches).toBe(3);
    expect(c.classe).toBe("tres-complexe");
    expect(c.chapitres).toHaveLength(3);
    expect(c.chapitres.some((h) => !h.essentiel)).toBe(true);
    expect(c.chapitres[0].essentiel).toBe(true);
    expect(c.fourchetteSec).toEqual([60, 78]);
  });
  it("toujours les mêmes chapitres, lancé 20 fois", () => {
    const premier = complexiteDe(faux);
    for (let i = 0; i < 20; i++) expect(complexiteDe(faux)).toEqual(premier);
  });
  it("les mêmes chapitres quel que soit l'ordre des listes reçues (égalités départagées par id)", () => {
    const premier = complexiteDe(faux);
    const autreOrdre = { ...faux, noeuds: melange(faux.noeuds), liens: melange(faux.liens), groupes: melange(faux.groupes), chiffres: melange(faux.chiffres) };
    expect(complexiteDe(autreOrdre)).toEqual(premier);
  });
  it("chaque nœud est dans exactement un chapitre", () => {
    const ids = complexiteDe(faux).chapitres.flatMap((h) => h.noeuds).sort();
    expect(ids).toEqual(faux.noeuds.map((n) => n.id).sort());
  });
  it("la branche majoritaire est dans le chapitre essentiel", () => {
    const majoritaire = faux.groupes.find((g) => g.majoritaire)!;
    const essentiel = complexiteDe(faux).chapitres.find((h) => h.essentiel)!;
    for (const n of majoritaire.noeuds) expect(essentiel.noeuds).toContain(n);
  });
});

describe("plafonds de durée par réseau (§ 3)", () => {
  it("58 s TikTok → livrée", () => {
    expect(verdictPlafond("tiktok", 58).verdict).toBe("livree");
  });
  it("66 s TikTok → livrée avec la mention « un peu longue »", () => {
    const v = verdictPlafond("tiktok", 66);
    expect(v.verdict).toBe("mention");
    expect(v.cas).toBe(2);
  });
  it("74 s TikTok → version courte demandée", () => {
    expect(verdictPlafond("tiktok", 74).verdict).toBe("version-courte");
  });
  it("74 s TikTok sans version courte possible → non livrée, avec la phrase", () => {
    const v = verdictPlafond("tiktok", 74, null);
    expect(v.verdict).toBe("non-livree");
    if (v.verdict === "non-livree") expect(v.phrase).toBe("Trop longue pour TikTok (74 s) : raccourcissez le script ou retirez ce réseau");
  });
  it("version courte de 57 s → livrée ; de 72 s → non livrée", () => {
    expect(verdictPlafond("tiktok", 74, 57)).toEqual({ cas: 1, verdict: "livree", dureeSec: 57 });
    expect(verdictPlafond("tiktok", 74, 72).verdict).toBe("non-livree");
  });
  it("91 s Facebook → jamais livrée telle quelle (limite dure 90 s)", () => {
    expect(["version-courte", "non-livree"]).toContain(verdictPlafond("facebook", 91).verdict);
    expect(verdictPlafond("facebook", 91, null).verdict).toBe("non-livree");
    expect(depasseLimiteDure("facebook", 91)).toBe(true);
  });
  it("74 s Instagram → livrée (plafond 90 s)", () => {
    expect(verdictPlafond("instagram", 74).verdict).toBe("livree");
  });
});

describe("table d'icônes", () => {
  it("chaque nom de la table existe dans la bibliothèque « interface claire »", () => {
    const source = readFileSync(join(process.cwd(), "studio-rendu/compositions/interface-claire/elements.tsx"), "utf8");
    const bloc = source.slice(source.indexOf("const TRACES"), source.indexOf("export const NOMS_ICONES"));
    const noms = [...bloc.matchAll(/^ {2}"?([a-z-]+)"?:/gm)].map((m) => m[1]);
    for (const n of NOMS_ICONES_IV) expect(noms).toContain(n);
    for (const n of Object.values(TABLE_ICONES)) expect(NOMS_ICONES_IV).toContain(n);
  });
  it("un mot inconnu est refusé, jamais remplacé par un rond", () => {
    expect(iconeDe("licorne")).toBeNull();
    expect(iconeDe("constructor")).toBeNull();
  });
  it("repli automatique : mots-clés proches puis icône neutre, toujours une icône connue de la table", () => {
    expect(iconeOuRepli("licorne", "Rappel la veille")).toBe("cloche");
    expect(iconeOuRepli("reponse-patient", "Réponse du patient ?")).toBe("message");
    expect(iconeOuRepli("presence", "Patient présent au rendez-vous")).toBe("calendrier");
    expect(iconeOuRepli("licorne", "Patient confirmé")).toBe("coche");
    expect(iconeOuRepli("licorne", "Un mot sans rapport")).toBe(ICONE_NEUTRE);
    expect(iconeOuRepli("licorne")).toBe(ICONE_NEUTRE);
    expect(iconeOuRepli("Enveloppe", "Rappel")).toBe("mail");
    for (const nom of NOMS_ICONES_IV) expect(iconeDe(nom), nom).toBe(nom);
    expect(iconeDe(iconeOuRepli("licorne", "Envoi du devis"))).not.toBeNull();
    expect(iconeOuRepli("licorne", "Envoi du devis")).toBe("envoyer");
    // Mots-clés ancrés (limites de mot, négation) : pas de coche/euro/cible trouvés au milieu d'un autre mot.
    for (const l of ["Dossier invalide", "Presentation du projet", "Resultat indetermine", "Écoute active", "Début de journée", "Neurologue"]) {
      const icone = iconeOuRepli("licorne", l);
      expect(["coche", "euro"], l).not.toContain(icone);
      expect(icone, l).not.toBe(l === "Début de journée" ? "cible" : "coche");
    }
    expect(iconeOuRepli("licorne", "Dossier invalide")).toBe(ICONE_NEUTRE);
    expect(iconeOuRepli("licorne", "Écoute active")).toBe(ICONE_NEUTRE);
    expect(iconeOuRepli("licorne", "Début de journée")).toBe(ICONE_NEUTRE);
    for (const mot of ["licorne", "rappel", "patient", "rendez-vous", "reponse", "presence", "confirmation", "x"]) expect(iconeDe(iconeOuRepli(mot)), mot).not.toBeNull();
  });
  it("la remarque « Icône inconnue » ne sort plus : Réponse du patient ?, Rappel la veille, Patient présent au rendez-vous", () => {
    const libelles = ["Réponse du patient ?", "Rappel la veille", "Patient présent au rendez-vous"];
    const noeuds = cartes.A.noeuds.map((n, i) => (i < libelles.length ? { ...n, libelle: libelles[i]!, icone: "pictogramme-inconnu" } : n));
    const brute = { ...cartes.A, noeuds };
    expect(controlerCarte(brute).alertes.some((a) => a.includes("Icône inconnue"))).toBe(false);
    const carte = completerCarte(brute);
    expect(controlerCarte(carte).alertes.some((a) => a.includes("Icône inconnue"))).toBe(false);
    expect(carte.noeuds.slice(0, 3).map((n) => iconeDe(n.icone!))).toEqual(["message", "cloche", "calendrier"]);
    expect(completerCarte(carte)).toEqual(carte);
  });
  it("accents, majuscules et pluriel sont tolérés", () => {
    expect(iconeDe("Enveloppes")).toBe("mail");
    expect(iconeDe("Équipe")).toBe("utilisateurs");
  });
  it("toutes les icônes des 6 cartes sont connues", () => {
    for (const l of LETTRES) for (const n of cartes[l].noeuds) if (n.icone) expect(iconeDe(n.icone), n.icone).not.toBeNull();
  });
});

describe("relecture de L1 : accord de « presque aucun(e) … sans … »", () => {
  const proposition = (t: string) => formulesAbsoluesDe(t, "titre")[0]?.proposition;
  it("nom féminin : « 0 question sans réponse » → « presque aucune question sans réponse »", () => {
    expect(proposition("0 question sans réponse")).toBe("presque aucune question sans réponse");
    expect(proposition("0 demande sans suite")).toBe("presque aucune demande sans suite");
    expect(proposition("0 réclamation sans réponse")).toBe("presque aucune réclamation sans réponse");
  });
  it("nom masculin : « 0 message sans réponse » → « presque aucun message sans réponse »", () => {
    expect(proposition("0 message sans réponse")).toBe("presque aucun message sans réponse");
    expect(proposition("Zéro appel sans rappel")).toBe("Presque aucun appel sans rappel");
    expect(proposition("0 dossier sans suivi")).toBe("presque aucun dossier sans suivi");
  });
  it("nom au pluriel : « presque plus de … », sans accord à deviner", () => {
    expect(proposition("0 clients sans réponse")).toBe("presque plus de clients sans réponse");
  });
  it("D garde sa proposition féminine", () => {
    expect(cartes.D.formulesAbsolues.find((f) => f.texte === "0 question sans réponse")?.proposition).toContain("presque aucune question sans réponse");
  });
});

describe("relecture de L1 : contrôle d'entonnoir indépendant de l'ordre des listes", () => {
  // D + un bloc de tri placé EN TÊTE, d'où partent deux chemins NON chiffrés : le vrai filtre (n02) reste valable.
  const leurre: CarteImage = {
    ...cartes.D,
    noeuds: [
      { id: "n05", libelle: "Tri manuel", role: "etape", couleur: "neutre", acteur: "humain", ordre: 5 },
      { id: "n06", libelle: "Archive", role: "sortie", couleur: "neutre", acteur: "humain", ordre: 6 },
      { id: "n07", libelle: "Corbeille", role: "sortie", couleur: "neutre", acteur: "humain", ordre: 7 },
      ...cartes.D.noeuds,
    ],
    liens: [
      { id: "l04", de: "n04", vers: "n05", couleur: "noir", style: "plein" },
      { id: "l05", de: "n05", vers: "n06", couleur: "noir", style: "plein" },
      { id: "l06", de: "n05", vers: "n07", couleur: "noir", style: "plein" },
      ...cartes.D.liens,
    ],
  };
  const erreurEntonnoir = (c: CarteImage) => controlerCarte(c).erreurs.filter((e) => e.startsWith("Un entonnoir"));
  it("le leurre placé en tête ne fait pas refuser l'entonnoir", () => {
    expect(erreurEntonnoir(leurre)).toEqual([]);
  });
  it("même verdict quel que soit l'ordre des nœuds et des flèches", () => {
    const melangee = { ...leurre, noeuds: melange(leurre.noeuds), liens: melange(leurre.liens) };
    const retournee = { ...leurre, noeuds: [...leurre.noeuds].reverse(), liens: [...leurre.liens].reverse() };
    expect(erreurEntonnoir(melangee)).toEqual([]);
    expect(erreurEntonnoir(retournee)).toEqual([]);
  });
  it("sans aucune sortie chiffrée, l'entonnoir reste refusé dans tous les ordres", () => {
    const sansChiffre = { ...leurre, chiffres: leurre.chiffres.filter((c) => c.dansNoeud !== "n03" && c.dansNoeud !== "n04") };
    expect(erreurEntonnoir(sansChiffre)).toHaveLength(1);
    expect(erreurEntonnoir({ ...sansChiffre, noeuds: [...sansChiffre.noeuds].reverse() })).toHaveLength(1);
  });
});
