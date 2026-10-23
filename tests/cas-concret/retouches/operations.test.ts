/**
 * P2-02 · retouches par opérations (liste fermée), pièce PURE : chaque opération rend une nouvelle fiche revalidée par
 * les 22 règles ; l'aperçu dit ce qui est relu (corps, fins) et quels écrans sont refaits. Aucun appel.
 */
import { describe, expect, it } from "vitest";
import { TABLE_FINS_DIAGNOSTIC } from "@/briques/fins";
import { trouverCas } from "@/formats/cas-concret/catalogue";
import { dureesDesFins, ficheParGabarit } from "@/moteurs/montage-cas-concret/ecriture";
import { regrouperFins } from "@/moteurs/montage-cas-concret/etapes";
import { texteDuCorps, type EcranCorps, type FicheEcrans } from "@/moteurs/montage-cas-concret/fiche";
import { planDesFins } from "@/moteurs/montage-cas-concret/fins";
import { validerFicheEcrans } from "@/moteurs/montage-cas-concret/regles";
import {
  apercuRetoucheCasConcret,
  CATALOGUE_RETOUCHES_CAS_CONCRET,
  lireOperationRetoucheCasConcret,
  TYPES_OPERATION_RETOUCHE_CAS_CONCRET,
  type ContexteRetoucheCasConcret,
} from "@/moteurs/montage-cas-concret/retouches";

const cas = trouverCas("recrutement-apporteurs")!;
const reseaux = ["facebook", "instagram", "tiktok", "linkedin"] as const;
// P2R : le mot n'est dit que là où il est branché ; ces essais le branchent sur Facebook et Instagram (comme X7).
const motSur = ["facebook", "instagram"] as const;
const contexte: ContexteRetoucheCasConcret = { cas, reseaux: [...reseaux], motSur: [...motSur], mot: cas.mot, ...(cas.motDit ? { motDit: cas.motDit } : {}), avecMot: true, table: TABLE_FINS_DIAGNOSTIC };
const plan = regrouperFins(planDesFins({ reseaux: [...reseaux], offre: cas.offre, ...(cas.nature ? { nature: cas.nature } : {}), mot: cas.mot, ...(cas.motDit ? { motDit: cas.motDit } : {}), avecMot: true, motSur: [...motSur], table: TABLE_FINS_DIAGNOSTIC }));
const base: FicheEcrans = ficheParGabarit(cas, { videoId: "video-cc", versionId: "v1", habillage: "charte-duo/1", origine: "porte-a" }, dureesDesFins(plan.fins));
const fiche = base;
const ecran = (f: FicheEcrans, id: string) => f.ecrans.find((e) => e.id === id)!;
const etapes = (f: FicheEcrans) => f.ecrans.filter((e): e is Extract<EcranCorps, { type: "etape" }> => e.type === "etape");

describe("P2-02 · la fiche de départ", () => {
  it("est valide (22 règles) : toute retouche part d'une fiche saine", () => {
    expect(validerFicheEcrans(fiche, { cas, texteScript: texteDuCorps(fiche), fins: plan.fins }).ok).toBe(true);
    expect(ecran(fiche, "e06").texteDit).toBe("La personne voit notre annonce.");
  });
});

describe("P2-02 · liste fermée", () => {
  it("six opérations, chacune avec son libellé", () => {
    expect(TYPES_OPERATION_RETOUCHE_CAS_CONCRET).toEqual(["changer-phrase", "changer-chiffre", "retirer-etape", "deplacer-etape", "changer-mot", "sans-le-mot"]);
    for (const t of TYPES_OPERATION_RETOUCHE_CAS_CONCRET) expect(CATALOGUE_RETOUCHES_CAS_CONCRET[t].libelle.length).toBeGreaterThan(3);
  });

  it("opération inconnue ou mal formée : refusée, la fiche ne change pas", () => {
    expect(lireOperationRetoucheCasConcret({ type: "changer-musique" })).toBeNull();
    expect(lireOperationRetoucheCasConcret({ type: "changer-phrase", ecranId: "f01", avant: "a", apres: "b" })).toBeNull();
    const a = apercuRetoucheCasConcret(fiche, [{ type: "changer-musique", musique: "jazz" }], contexte);
    expect(a.ok).toBe(false);
    expect(a.refus).toEqual(["Cette retouche ne fait pas partie de la liste proposée."]);
    expect(a.fiche.ecrans).toEqual(fiche.ecrans);
    expect(a.textesARelire).toEqual([]);
    expect(apercuRetoucheCasConcret(fiche, [], contexte).refus).toEqual(["Aucune retouche n'est demandée."]);
  });

  it("une opération qui ne change rien est refusée", () => {
    const a = apercuRetoucheCasConcret(fiche, [{ type: "changer-mot", mot: "IA", motDit: "I.A." }], contexte);
    expect(a.ok).toBe(false);
    expect(a.refus).toEqual(["Cette retouche ne change rien à la vidéo."]);
  });
});

describe("P2-02 · changer une phrase", () => {
  it("relit le corps seul ; à nombre de mots égal, rien n'est décalé : aucun écran refait (le texte dit n'est pas dessiné)", () => {
    const a = apercuRetoucheCasConcret(fiche, [{ type: "changer-phrase", ecranId: "e06", avant: "notre annonce", apres: "notre offre" }], contexte);
    expect(a.refus).toEqual([]);
    expect(ecran(a.fiche, "e06").texteDit).toBe("La personne voit notre offre.");
    expect(a.corpsRelu).toBe(true);
    expect(a.finsRelues).toEqual([]);
    expect(a.textesARelire).toEqual([texteDuCorps(a.fiche)]);
    expect(a.caracteresARelire).toBe(texteDuCorps(a.fiche).length);
    expect(a.ecransRefaits).toEqual([]);
  });

  it("une phrase plus longue : l'écran et ceux qu'elle décale, jamais ceux d'avant", () => {
    const a = apercuRetoucheCasConcret(fiche, [{ type: "changer-phrase", ecranId: "e06", avant: "notre annonce", apres: "notre petite annonce" }], contexte);
    expect(a.refus).toEqual([]);
    const corps = a.ecransRefaits.filter((id) => /^e\d\d$/.test(id));
    expect(corps).toEqual(a.fiche.ecrans.slice(5).map((e) => e.id));
    expect(a.ecransRefaits.some((id) => id.startsWith("fin-"))).toBe(true);
    expect(a.finsRelues).toEqual([]);
  });

  it("les apparitions suivent leur mot", () => {
    // e03 : « Avant : trier les candidatures, répondre à chacun, relancer, caler un rendez-vous, » ; apparitions sur 1, 4, 7, 8.
    const a = apercuRetoucheCasConcret(fiche, [{ type: "changer-phrase", ecranId: "e03", avant: "trier les candidatures,", apres: "trier toutes les candidatures reçues," }], contexte);
    expect(a.refus).toEqual([]);
    expect(ecran(a.fiche, "e03").evenements.map((e) => e.surMot)).toEqual([1, 6, 9, 10]);
  });

  it("une phrase introuvable, ou coupée au milieu d'un mot, est refusée", () => {
    expect(apercuRetoucheCasConcret(fiche, [{ type: "changer-phrase", ecranId: "e06", avant: "notre affiche", apres: "notre offre" }], contexte).refus[0]).toContain("n'est pas dite telle quelle sur l'écran e06");
    expect(apercuRetoucheCasConcret(fiche, [{ type: "changer-phrase", ecranId: "e06", avant: "nonce", apres: "offre" }], contexte).ok).toBe(false);
    expect(apercuRetoucheCasConcret(fiche, [{ type: "changer-phrase", ecranId: "e40", avant: "a", apres: "b" }], contexte).refus).toEqual(["L'écran e40 n'existe pas dans cette vidéo."]);
  });

  it("une opération qui enfreint une règle est refusée : nombre sans fait, mot interdit, tutoiement", () => {
    const nombre = apercuRetoucheCasConcret(fiche, [{ type: "changer-phrase", ecranId: "e06", avant: "notre annonce", apres: "nos 37 annonces" }], contexte);
    expect(nombre.ok).toBe(false);
    expect(nombre.refus.join(" ")).toContain("« 37 » ne vient d'aucun fait du cas");
    const interdit = apercuRetoucheCasConcret(fiche, [{ type: "changer-phrase", ecranId: "e06", avant: "notre annonce", apres: "notre machine" }], contexte);
    expect(interdit.ok).toBe(false);
    expect(interdit.refus.join(" ")).toContain("Cette retouche n'est pas possible.");
    expect(interdit.fiche.ecrans).toEqual(fiche.ecrans);
    expect(interdit.textesARelire).toEqual([]);
    expect(ecran(fiche, "e15").texteDit).toContain("votre entreprise");
    expect(apercuRetoucheCasConcret(fiche, [{ type: "changer-phrase", ecranId: "e15", avant: "votre entreprise", apres: "ton entreprise" }], contexte).ok).toBe(false);
  });
});

describe("P2-02 · changer un chiffre", () => {
  // Départ : un écran chiffre tiré d'un fait à deux valeurs (« 15 à 20 minutes »).
  const depart: FicheEcrans = structuredClone(fiche);
  const i = depart.ecrans.findIndex((e) => e.id === "e02");
  depart.ecrans[i] = { ...(depart.ecrans[i] as Extract<EcranCorps, { type: "chiffre" }>), faitId: "delai-invitation", valeur: 15, texteDit: "L'invitation part 15 minutes après." };

  it("parmi les valeurs du fait : l'écran et le texte dit changent ensemble", () => {
    const a = apercuRetoucheCasConcret(depart, [{ type: "changer-chiffre", ecranId: "e02", valeur: 20 }], contexte);
    expect(a.refus).toEqual([]);
    const e = ecran(a.fiche, "e02") as Extract<EcranCorps, { type: "chiffre" }>;
    expect(e.valeur).toBe(20);
    expect(e.texteDit).toBe("L'invitation part 20 minutes après.");
    expect(a.corpsRelu).toBe(true);
    expect(a.ecransRefaits).toEqual(["e02"]);
  });

  it("une valeur hors du fait est refusée, avec les valeurs permises", () => {
    const a = apercuRetoucheCasConcret(fiche, [{ type: "changer-chiffre", ecranId: "e02", valeur: 20 }], contexte);
    expect(a.ok).toBe(false);
    expect(a.refus[0]).toBe("« 20 » n'est pas une valeur du fait « L'échange en visio dure 15 minutes. » : choisissez parmi « 15 ».");
    expect(apercuRetoucheCasConcret(fiche, [{ type: "changer-chiffre", ecranId: "e06", valeur: 20 }], contexte).refus).toEqual(["L'écran e06 ne montre aucun chiffre."]);
  });
});

describe("P2-02 · étapes", () => {
  // Le gabarit de master place l'écran « objet » de la part humaine entre deux étapes, sous son propre titre ; seul un
  // écran « objet » du même titre prolonge une étape. Ici, on en pose un après l'étape 1 (« Ce geste vous évite… », comme
  // le fait l'écriture au remplissage 3) pour essayer le bloc « étape + objets qui la prolongent ».
  const premiere = ecran(base, "e06") as Extract<EcranCorps, { type: "etape" }>;
  const modele = ecran(base, "e11") as Extract<EcranCorps, { type: "objet" }>;
  const evite = cas.avant.taches[0];
  const ditEvite = `Ce geste vous évite ${evite.charAt(0).toLowerCase()}${evite.slice(1).replace(/[.!?]+$/, "")}.`;
  const objetDeLEtape: EcranCorps = { ...modele, texteDit: ditEvite, titre: premiere.titre, ligne: evite.split(" ").slice(0, 8).join(" "), visuel: { sorte: "objet", objet: modele.visuel.objet } };
  const avecObjet: EcranCorps[] = [...base.ecrans.slice(0, 6), objetDeLEtape, ...base.ecrans.slice(6)].map((e, i) => ({ ...e, id: `e${String(i + 1).padStart(2, "0")}` }) as EcranCorps);
  const fiche: FicheEcrans = { ...base, ecrans: avecObjet as FicheEcrans["ecrans"] };

  it("la fiche de départ : six étapes ; l'étape 1 est suivie de son écran « objet »", () => {
    expect(fiche.ecrans.filter((e) => e.type === "etape").map((e) => e.id)).toEqual(["e06", "e08", "e09", "e10", "e11", "e13"]);
    expect([ecran(fiche, "e07").type, (ecran(fiche, "e07") as { titre: string }).titre]).toEqual(["objet", (ecran(fiche, "e06") as { titre: string }).titre]);
  });

  it("retirer une étape : écrans et étapes renumérotés, corps relu", () => {
    const a = apercuRetoucheCasConcret(fiche, [{ type: "retirer-etape", ecranId: "e09" }], contexte);
    expect(a.refus).toEqual([]);
    expect(a.fiche.ecrans).toHaveLength(fiche.ecrans.length - 1);
    expect(a.fiche.ecrans.map((e) => e.id)).toEqual(a.fiche.ecrans.map((_, k) => `e${String(k + 1).padStart(2, "0")}`));
    expect(etapes(a.fiche).map((e) => [e.numero, e.total])).toEqual([1, 2, 3, 4, 5].map((n) => [n, 5]));
    expect(texteDuCorps(a.fiche)).not.toContain("Elle reçoit ses e-mails toute seule.");
    expect(a.corpsRelu).toBe(true);
    expect(a.ecransRefaits).not.toContain("e01");
    // Chaque place garde son fond.
    expect(a.fiche.ecrans.map((e) => e.fond)).toEqual(fiche.ecrans.slice(0, -1).map((e) => e.fond));
  });

  it("P2R : retirer une étape retire aussi ses écrans « objet »", () => {
    const a = apercuRetoucheCasConcret(fiche, [{ type: "retirer-etape", ecranId: "e06" }], contexte);
    expect(a.refus).toEqual([]);
    expect(a.fiche.ecrans).toHaveLength(fiche.ecrans.length - 2);
    expect(texteDuCorps(a.fiche)).not.toContain(ecran(fiche, "e06").texteDit);
    expect(texteDuCorps(a.fiche)).not.toContain(ecran(fiche, "e07").texteDit);
    expect(etapes(a.fiche).map((e) => [e.numero, e.total])).toEqual([1, 2, 3, 4, 5].map((n) => [n, 5]));
  });

  it("pas moins de 3 étapes ; un écran qui n'est pas une étape ne se retire pas", () => {
    const quatre = apercuRetoucheCasConcret(fiche, [{ type: "retirer-etape", ecranId: "e06" }, { type: "retirer-etape", ecranId: "e07" }, { type: "retirer-etape", ecranId: "e07" }, { type: "retirer-etape", ecranId: "e07" }], contexte);
    expect(quatre.ok).toBe(false);
    expect(quatre.refus).toEqual(["Une vidéo garde au moins 3 étapes : celle-ci ne peut pas être retirée."]);
    expect(apercuRetoucheCasConcret(fiche, [{ type: "retirer-etape", ecranId: "e05" }], contexte).refus).toEqual(["L'écran e05 n'est pas une étape."]);
  });

  // Portage : master impose l'ordre des étapes du cas (règle « ordre du fonctionnement ») ; échanger deux étapes est donc
  // refusé, avec la phrase de la règle, et la fiche ne change pas. (Ancienne attente de #167 : l'échange réussissait.)
  it("déplacer une étape : refusé par la règle d'ordre de master, rien ne change", () => {
    const a = apercuRetoucheCasConcret(fiche, [{ type: "deplacer-etape", ecranId: "e09", vers: "avant" }], contexte);
    expect(a.ok).toBe(false);
    expect(a.refus.join(" ")).toContain("ordre du fonctionnement");
    expect(a.fiche.ecrans).toEqual(fiche.ecrans);
    expect(a.textesARelire).toEqual([]);
    expect(apercuRetoucheCasConcret(fiche, [{ type: "deplacer-etape", ecranId: "e06", vers: "avant" }], contexte).refus).toEqual(["C'est déjà la première étape."]);
  });
});

describe("P2-02 · le mot", () => {
  it("changer le mot ne relit que les fins qui le disent, sans toucher au corps", () => {
    const a = apercuRetoucheCasConcret(fiche, [{ type: "changer-mot", mot: "AUTO" }], contexte);
    expect(a.refus).toEqual([]);
    expect(a.reglages).toEqual({ mot: "AUTO", motDit: "AUTO", avecMot: true });
    expect(a.corpsRelu).toBe(false);
    const disent = plan.fins.filter((f) => f.ecrans.some((e) => e.type === "appel-mot")).map((f) => f.id);
    expect(disent.length).toBeGreaterThan(0);
    expect(a.finsRelues).toEqual(disent);
    expect(a.textesARelire.every((t) => t.includes("AUTO"))).toBe(true);
    expect(a.ecransRefaits.length).toBeGreaterThan(0);
    expect(a.ecransRefaits.every((id) => disent.some((f) => id.startsWith(`${f}-`)))).toBe(true);
    expect(a.fiche.ecrans).toEqual(fiche.ecrans);
  });

  it("P2R : un mot branché nulle part n'est jamais dit : le changer ne change rien", () => {
    const nulle = { ...contexte, motSur: [] };
    expect(apercuRetoucheCasConcret(fiche, [{ type: "changer-mot", mot: "AUTO" }], nulle).refus).toEqual(["Cette retouche ne change rien à la vidéo."]);
    expect(apercuRetoucheCasConcret(fiche, [{ type: "sans-le-mot" }], nulle).refus).toEqual(["Cette retouche ne change rien à la vidéo."]);
  });

  it("un mot mal formé ou interdit est refusé", () => {
    expect(apercuRetoucheCasConcret(fiche, [{ type: "changer-mot", mot: "deux mots" }], contexte).refus).toEqual(["Le mot doit faire 2 à 24 lettres ou chiffres, sans espace."]);
    expect(apercuRetoucheCasConcret(fiche, [{ type: "changer-mot", mot: "machine" }], contexte).ok).toBe(false);
  });

  it("sans le mot : seules les fins changées sont relues (un texte déjà lu ailleurs est repris)", () => {
    const a = apercuRetoucheCasConcret(fiche, [{ type: "sans-le-mot" }], contexte);
    expect(a.refus).toEqual([]);
    expect(a.reglages.avecMot).toBe(false);
    expect(a.corpsRelu).toBe(false);
    expect(a.plan.fins.flatMap((f) => f.ecrans).some((e) => e.type === "appel-mot")).toBe(false);
    const dejaLus = new Set(plan.fins.map((f) => f.ecrans.map((e) => e.texteDit.trim()).join(" ")));
    for (const t of a.textesARelire) expect(dejaLus.has(t)).toBe(false);
    expect(apercuRetoucheCasConcret(fiche, [{ type: "sans-le-mot" }], { ...contexte, avecMot: false }).refus).toEqual(["Cette retouche ne change rien à la vidéo."]);
  });

  it("aucune prise gardée : tout est relu", () => {
    const a = apercuRetoucheCasConcret(fiche, [{ type: "changer-mot", mot: "AUTO" }], { ...contexte, voixGardee: null });
    expect(a.corpsRelu).toBe(true);
    expect(a.finsRelues).toEqual(a.plan.fins.map((f) => f.id));
  });
});

describe("P2-02 · fiche calée de la version d'avant", () => {
  it("les heures du calage sont retirées : le calage les repose", () => {
    const calee: FicheEcrans = { ...fiche, ecrans: fiche.ecrans.map((e, k) => ({ ...e, debutMs: k * 3000, finMs: k * 3000 + 2900 })) as FicheEcrans["ecrans"] };
    const a = apercuRetoucheCasConcret(calee, [{ type: "changer-phrase", ecranId: "e06", avant: "notre annonce", apres: "notre offre" }], contexte);
    expect(a.refus).toEqual([]);
    expect(a.fiche.ecrans.every((e) => e.debutMs === undefined && e.finMs === undefined)).toBe(true);
  });
});
