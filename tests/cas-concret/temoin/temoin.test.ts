/**
 * T1 · Fiche témoin de la vidéo 1 : le portage reproduit la vidéo validée par Will (référence : `reference/`).
 * Aucune taille en pixels n'est figée ici : la géométrie est lue de la brique `ecrans-motion` (réglée par ailleurs).
 * X6 : le corps garde le TEXTE et la voix de la référence ; la fin est celle de Facebook aujourd'hui (le diagnostic, puis
 * le lien en commentaire), plus courte : ses mots sont posés à la suite du corps, au débit de la fin de la référence.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { MotCalage } from "@/briques/motion/calage";
import { controlerProprietes, imagesEcran, textesEcran, zonesEcran, type ProprietesEcran, type ZoneProtegeePct } from "@/briques/ecrans-motion";
import { zoneProtegeeCombinee } from "@/reseaux";
import { calerFiche, IMAGE_MS } from "@/moteurs/montage-cas-concret/calage";
import { cleMot, motsLus, texteDuCorps, validerSchemaFiche } from "@/moteurs/montage-cas-concret/fiche";
import { BANDE_SOUS_TITRES_CAS_CONCRET } from "@/formats/cas-concret";
import { REGLES_CAS_CONCRET, verifierRegles } from "@/moteurs/montage-cas-concret/regles";
import { contexteVideo1 } from "../regles/outils";
import { planLien } from "../../../studio-rendu/compositions/cas-concret/plans/Lien";
import { planPromesse } from "../../../studio-rendu/compositions/cas-concret/plans/Promesse";
import { CAPTURE_DE_L_ECRAN, DEROGATIONS_TEMOIN, ecransCales, FILM_FORMULAIRE, ficheTemoin, finTemoin, motsDitsTemoin, proprietesTemoin } from "./fiche-temoin";

const DOSSIER = join(__dirname, "reference");
const lire = <T>(f: string): T => JSON.parse(readFileSync(join(DOSSIER, f), "utf8")) as T;
const REF_MOTS = lire<{ mots: { word: string; start: number; end: number }[] }>("mots.json").mots;
const REF_PLANS = lire<{ tempo: number; duree: number; plans: { id: string; debut: number; fin: number }[] }>("plans.json");
const TEXTE = readFileSync(join(DOSSIER, "texte.txt"), "utf8").trim();
const TEMPO = REF_PLANS.tempo;
const DEUX_IMAGES = 2 * IMAGE_MS;

/** Mots du corps (référence, au tempo final), puis ceux de la fin d'aujourd'hui posés au débit de la fin de la référence. */
const motsDits: MotCalage[] = motsDitsTemoin(REF_MOTS, TEMPO);
const MOTS_CORPS = texteDuCorps(ficheTemoin()).split(/\s+/).length;
const motsFin = motsDits.slice(MOTS_CORPS);

/** Écran de la référence auquel correspond chaque écran de la fiche témoin (le plan « avant » en porte deux). */
const PLAN_DE_L_ECRAN = ["s1", "s2", "s4", "s4", "s6", "s7", "s8", "s9", "s10", "s11", "s12", "s13", "s14", "s16", "s16b", "s17", "s18"];
const PLANS_FIN = ["s19", "s20", "s21"];

function caler() {
  const r = calerFiche(ficheTemoin(), finTemoin(), motsDits, { finApresDernierMotSec: 2.1 });
  if (!r.ok) throw new Error(r.problemes.join("\n"));
  return r;
}

/** Règles refusées par la fiche, regroupées par numéro de règle. */
function refusParRegle(): Record<string, string[]> {
  const contexte = contexteVideo1();
  const res: Record<string, string[]> = {};
  for (const r of REGLES_CAS_CONCRET) {
    const l = verifierRegles(ficheTemoin(), contexte, [r]);
    if (l.length) res[r.id] = l.map((p) => p.message);
  }
  return res;
}

describe("T1 · fiche témoin de la vidéo 1", () => {
  it("la forme est valide (règle 1) et le texte dit est celui de texte.txt, mot pour mot", () => {
    const v = validerSchemaFiche(ficheTemoin());
    expect(v.ok, v.ok ? "" : v.problemes.map((p) => p.message).join("\n")).toBe(true);
    // Le corps : les mots de texte.txt, mot pour mot ; la fin : celle de Facebook aujourd'hui, tirée de la table.
    const cles = (t: string) => t.split(/\s+/).map(cleMot);
    expect(cles(texteDuCorps(ficheTemoin()))).toEqual(cles(TEXTE).slice(0, MOTS_CORPS));
    expect(TEXTE.split(/\s+/)).toHaveLength(167);
    expect(finTemoin().ecrans.map((e) => e.texteDit).join(" ")).toBe("Faites votre diagnostic gratuit en quelques minutes. Le lien est en commentaire.");
  });

  it("les écrans suivent plans.json, avec le plan « avant » coupé en deux", () => {
    const fiche = ficheTemoin();
    expect(fiche.ecrans).toHaveLength(PLAN_DE_L_ECRAN.length);
    expect(PLAN_DE_L_ECRAN.length).toBe(REF_PLANS.plans.length - PLANS_FIN.length + 1);
    expect(fiche.ecrans.filter((e) => e.type === "liste-avant")).toHaveLength(2);
    expect(finTemoin().appels.map((a) => a.id)).toEqual(["fin-if-diagnostic-gratuit", "fin-fb-lien-commentaire"]);
  });

  it("passe la forme et les 23 règles avec le cas recrutement-apporteurs, aux dérogations nommées près (liste écrite ici)", () => {
    expect(DEROGATIONS_TEMOIN).toEqual(Object.keys(ECRANS_DEROGES));
    const refus = refusParRegle();
    const detail = Object.entries(refus).map(([id, m]) => `${id}\n  ${m.join("\n  ")}`).join("\n");
    // Chaque règle refusée l'est aux seuls écrans prévus : une dérogation ne cache pas un autre défaut.
    const ecrans = Object.fromEntries(Object.entries(refus).map(([id, m]) => [id, [...new Set(m.map((x) => /Écran (e\d+)/.exec(x)?.[1] ?? "fiche"))]]));
    expect(ecrans, detail).toEqual(ECRANS_DEROGES);
  });

  it("calée sur mots.json (tempo de plans.json), chaque début d'écran est à 2 images près de plans.json ; la fin, plus courte, raccourcit la vidéo", () => {
    const r = caler();
    const debuts = [...r.fiche.ecrans, ...(r.fin?.ecrans ?? [])].map((e) => e.debutMs!);
    // Le corps et le premier écran de la fin (s19) gardent leurs débuts de référence.
    const attendus = REF_PLANS.plans.filter((p) => !PLANS_FIN.slice(1).includes(p.id)).map((p) => p.debut * 1000);
    // Le plan « avant » est coupé en deux : l'écran ajouté (rang 3) n'a pas de début de référence.
    const sansAjout = debuts.filter((_, i) => i !== 3).slice(0, attendus.length);
    expect(sansAjout).toHaveLength(attendus.length);
    sansAjout.forEach((d, i) => expect(Math.abs(d - attendus[i]), `écran ${i} : ${d} ms au lieu de ${attendus[i]} ms`).toBeLessThanOrEqual(DEUX_IMAGES));
    // Durée : le dernier mot de la fin, puis la tenue de 2,1 s ; plus courte que la référence (51,24 s).
    const attendue = (motsFin[motsFin.length - 1].finSec + 2.1) * 1000;
    expect(Math.abs(r.dureeMs - attendue)).toBeLessThanOrEqual(DEUX_IMAGES);
    expect(r.dureeMs).toBeLessThan(REF_PLANS.duree * 1000 - 5000);
    expect(r.dureeMs).toBeGreaterThan(40_000);
  });

  it("calée, aucun écran du corps ne dure plus de 5 s", () => {
    const r = caler();
    for (const e of r.fiche.ecrans) expect(e.finMs! - e.debutMs!, `écran ${e.id}`).toBeLessThanOrEqual(5000);
  });

  it("la fin est celle de la table : deux écrans, « diagnostic » puis « lien », calés à la suite du corps", () => {
    const r = caler();
    expect(r.fin?.ecrans.map((e) => [e.id, e.type])).toEqual([["f01", "diagnostic"], ["f02", "lien"]]);
    expect(r.fin!.ecrans[0].debutMs).toBe(r.fiche.ecrans[r.fiche.ecrans.length - 1].finMs);
  });

  it("chaque propriété porte la marque et la durée de son écran", () => {
    for (const p of propriete()) {
      expect(p.marque, `écran ${p.id}`).toBe("axion-ia.com");
      expect(p.finMs, `écran ${p.id}`).toBeGreaterThan(p.debutMs);
    }
  });

  it("le contrôle avant rendu ne refuse aucun écran (bande des sous-titres à 8 %, vrais écrans compris)", () => {
    const zone = zoneProtegeeCombinee("9:16", ["facebook", "instagram", "tiktok", "linkedin"]) as ZoneProtegeePct;
    for (const p of propriete()) expect(p.zone, p.id).toEqual(zonesEcran(zone, 1080, 1920, BANDE_SOUS_TITRES_CAS_CONCRET).utile);
    const refus = propriete().flatMap((p) => controlerProprietes(p));
    expect(refus).toEqual([]);
  });

  it("f01 : « Faites votre » puis « DIAGNOSTIC GRATUIT » en accent, et « en quelques minutes » dessous", () => {
    const f01 = propriete().find((p) => p.id === "f01") as Extract<ProprietesEcran, { type: "promesse" }>;
    expect([f01.type, f01.invite, f01.cadeau, f01.ligne]).toEqual(["promesse", "Faites votre", "*diagnostic gratuit*", "en quelques minutes"]);
    const plan = planPromesse(f01, imagesEcran(f01) - 1);
    expect(plan.cadeau.mots.every((m) => m.accent)).toBe(true);
    expect(controlerProprietes(f01)).toEqual([]);
  });

  it("f02 : la bulle « Diagnostic gratuit · lien en commentaire » tient, la signature « Axion-IA » tombe", () => {
    const f02 = propriete().find((p) => p.id === "f02") as Extract<ProprietesEcran, { type: "lien" }>;
    expect([f02.titre, f02.lien, f02.signature, f02.etiquette]).toEqual(["Le lien est en commentaire", "Diagnostic gratuit · lien en commentaire", "Axion-*IA*", undefined]);
    const plan = planLien(f02, imagesEcran(f02) - 1);
    expect(plan.bulle.tient).toBe(true);
    expect(plan.textes.signature).toBe("Axion-IA");
  });

  it("résultat : « +1 H » avant, « 15 MIN » maintenant, tirés des faits du cas ; « 60 » n'est écrit nulle part", () => {
    const r = propriete().find((p) => p.type === "resultat") as Extract<ProprietesEcran, { type: "resultat" }>;
    expect([r.avant, r.maintenant]).toEqual(["+1 H", "15 MIN"]);
    for (const p of propriete()) expect(Object.values(textesEcran(p)).join(" "), `écran ${p.id}`).not.toMatch(/\b60\b/);
  });

  it("M8c · chaque événement tombe sur le mot de la référence (rangs comptés par `motsLus`, un « : » isolé n'est pas un mot)", () => {
    const vus: Record<string, string> = {};
    for (const e of [...ficheTemoin().ecrans, ...finTemoin().ecrans]) {
      const lus = motsLus(e.texteDit);
      for (const ev of e.evenements) vus[`${e.id} ${ev.cible}`] = cleMot(lus[ev.surMot] ?? "");
    }
    expect(vus).toEqual(MOT_DE_L_EVENEMENT);
  });

  it("M8c · « MINUTES. » garde son point (texte dit fini par un point) ; les titres aussi", () => {
    const e02 = propriete().find((p) => p.id === "e02")!;
    expect(textesEcran(e02).unite).toBe("minutes.");
    const e12 = propriete().find((p) => p.id === "e12")!;
    expect(textesEcran(e12)["titre-2"]).toBe("*travail.*");
  });

  it("M8c · la page du rendez-vous montre d'emblée le calendrier (décalage de départ de la fiche, repris par la capture)", () => {
    const e09 = propriete().find((p) => p.id === "e09")!;
    const capture = e09.type === "etape" && "capture" in e09.visuel ? (e09.visuel.capture as { departY?: number }) : {};
    // « Choisissez un jour » commence vers 1 500 px sur les 3 276 de la page.
    expect(capture.departY).toBeCloseTo(1500 / 3276, 2);
  });

  it("M8c · barres : textes tirés des faits par la chaîne (`texteBarre`), aucun texte écrit dans la fiche témoin", () => {
    const r = ficheTemoin().ecrans.find((e) => e.type === "resultat");
    expect(r && r.type === "resultat" && [r.avant.faitId, r.maintenant.faitId]).toEqual(["plus-d-une-heure", "visio-quinze-minutes"]);
    expect(readFileSync(join(__dirname, "fiche-temoin.ts"), "utf8")).not.toMatch(/"\+1 H"|"15 MIN"|` H`|` MIN`/);
  });

  it("les vrais écrans sont ceux des rushes : publicité (e06), formulaire en film (e07), page du rendez-vous (e09)", () => {
    const ps = propriete();
    const vus = ps.filter((p) => (p.type === "etape" || p.type === "objet") && "capture" in p.visuel).map((p) => p.id);
    expect(vus).toEqual(Object.keys(CAPTURE_DE_L_ECRAN));
    for (const f of ["pub.png", "rdv-entier.jpg", ...FILM_FORMULAIRE.images]) expect(existsSync(join(DOSSIER, "rushes", f)), f).toBe(true);
    const e07 = ps.find((p) => p.id === "e07")!;
    expect(e07.type === "etape" && "capture" in e07.visuel && e07.visuel.capture).toMatchObject({ sorte: "video", dureeSec: 1 });
  });
});

/* ------------------------------------------------------------------ */
/* Pièces du test                                                        */
/* ------------------------------------------------------------------ */

/**
 * Mot de la référence (v8-a.html, fonction `rendre`) sur lequel tombe chaque événement. Exceptions voulues, la référence
 * n'ayant pas de mot pour ces moments : les trois pastilles (e02) entrent en cascade à partir de « Oui » ; la puce
 * « Inscrite » (e07) entre 0,15 s après « vingt », soit sur « secondes ».
 */
const MOT_DE_L_EVENEMENT: Record<string, string> = {
  "e01 titre-3": "en",
  "e02 pastille-1": "oui",
  "e02 pastille-2": "quinze",
  "e02 pastille-3": "minutes",
  "e03 tache-1": "trier",
  "e03 tache-2": "repondre",
  "e03 tache-3": "relancer",
  "e03 tache-4": "caler",
  "e04 tache-1": "envoyer",
  "e04 tache-2": "courir",
  "e04 total": "plus",
  "e05 titre-2": "tout",
  "e07 puce-1": "secondes",
  "e09 puce-1": "rendezvous",
  "e10 notification": "rappel",
  "e11 chrono": "quinze",
  "e12 titre-2": "travail",
  "e13 puce-1": "part",
  "e13 signature": "signe",
  "e13 puce-2": "telephone",
  "e15 puce-1": "cent",
  "e15 puce-2": "sans",
  "e16 barre-maintenant": "heures",
  "e17 titre-2": "entreprise",
  "e17 question": "quelle",
  "f01 cadeau": "diagnostic",
  "f02 lien": "lien",
};

/** Écrans refusés par chaque règle dérogée (la fiche entière : « fiche »). */
// V4-3 : les règles acceptent désormais ce que la vidéo validée par Will montre (R03, R07, R08, R12 : voir
// `tests/cas-concret/script-valide/regles-v4.test.ts`) ; seule la phrase de conformité reste dérogée.
const ECRANS_DEROGES: Record<string, string[]> = {
  R17: ["e15"],
};

function propriete() {
  const r = caler();
  const zone = zoneProtegeeCombinee("9:16", ["facebook", "instagram", "tiktok", "linkedin"]);
  if (!zone) throw new Error("Zone protégée commune introuvable.");
  return proprietesTemoin(ecransCales(r.fiche.ecrans, r.fin?.ecrans ?? [], r.evenements), zone as ZoneProtegeePct, (f) => `rushes/${f}`);
}
