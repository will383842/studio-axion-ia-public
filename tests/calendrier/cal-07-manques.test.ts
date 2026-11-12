/** CAL-07 · moteur calculerManques : fonction pure, alertes jamais bloquantes (maquette du calendrier, définitions de départ). */
import { describe, expect, it } from "vitest";
import { REGLAGES_CADENCE_DEFAUT } from "@/domaine/cadence/reglages";
import { calculerManques, type EntreeManque } from "@/domaine/calendrier/manques";

// Mercredi 11 novembre 2026, 09 h à Paris (même jour de repère que la maquette).
const MAINTENANT = "2026-11-11T09:00:00+01:00";
const entree = (o: Partial<EntreeManque> & { instant: string }): EntreeManque => ({
  id: "e" + o.instant, reseau: "instagram", type: "video", statut: "programme", texte: "Un texte", premierCommentaire: "Une question ?", ...o,
});
const codes = (l: ReturnType<typeof calculerManques>) => l.map((m) => `${m.reseau}:${m.jour}:${m.code}`);
/** Semaine entière couverte par une publication Instagram par jour : isole le réseau testé. */
const igToutesLesJours = Array.from({ length: 7 }, (_, i) => entree({ id: "ig" + i, instant: `2026-11-${11 + i}T10:00:00+01:00` }));

describe("CAL-07 · calculerManques", () => {
  it("est pure : mêmes entrées, même sortie, entrées non modifiées", () => {
    const entrees = [entree({ instant: "2026-11-12T10:00:00+01:00", texte: "" })];
    const copie = JSON.stringify(entrees);
    const a = calculerManques(entrees, { maintenant: MAINTENANT });
    const b = calculerManques(entrees, { maintenant: MAINTENANT });
    expect(a).toEqual(b);
    expect(JSON.stringify(entrees)).toBe(copie);
  });

  it("calendrier vide : créneau vide Instagram les 7 jours, LinkedIn et Facebook en semaine seulement, TikTok jamais", () => {
    const l = calculerManques([], { maintenant: MAINTENANT });
    expect(l.filter((m) => m.reseau === "instagram")).toHaveLength(7);
    expect(l.filter((m) => m.reseau === "linkedin").map((m) => m.jour)).toEqual(["2026-11-11", "2026-11-12", "2026-11-13", "2026-11-16", "2026-11-17"]);
    expect(l.filter((m) => m.reseau === "facebook")).toHaveLength(5);
    expect(l.filter((m) => m.reseau === "tiktok")).toHaveLength(0);
    expect(l.every((m) => m.code === "creneau-vide")).toBe(true);
  });

  it("LinkedIn le week-end : aucun créneau attendu samedi ni dimanche", () => {
    const l = calculerManques(igToutesLesJours, { maintenant: MAINTENANT });
    const li = l.filter((m) => m.reseau === "linkedin").map((m) => m.jour);
    expect(li).not.toContain("2026-11-14");
    expect(li).not.toContain("2026-11-15");
    expect(li).toContain("2026-11-16");
  });

  it("LinkedIn le week-end : une publication déposée à la main un samedi n'est pas un manque ni refusée", () => {
    const l = calculerManques([...igToutesLesJours, entree({ reseau: "linkedin", instant: "2026-11-14T08:00:00+01:00", type: "carrousel" })], { maintenant: MAINTENANT });
    expect(l.some((m) => m.reseau === "linkedin" && m.jour === "2026-11-14")).toBe(false);
  });

  it("jour passé exclu : hier n'apparaît jamais, aujourd'hui compte", () => {
    const l = calculerManques([], { maintenant: MAINTENANT });
    expect(l.some((m) => m.jour === "2026-11-10")).toBe(false);
    expect(l.some((m) => m.jour === "2026-11-11")).toBe(true);
  });

  it("la fenêtre est de 7 jours à venir : le 8e jour n'est pas signalé", () => {
    const l = calculerManques([], { maintenant: MAINTENANT });
    expect(l.some((m) => m.jour === "2026-11-17")).toBe(true);
    expect(l.some((m) => m.jour === "2026-11-18")).toBe(false);
  });

  it("le jour se lit à l'heure de Paris : 23 h 30 UTC le 10 est déjà le 11 à Paris", () => {
    const l = calculerManques([], { maintenant: "2026-11-10T23:30:00Z" });
    expect(l.some((m) => m.jour === "2026-11-10")).toBe(false);
    expect(l.some((m) => m.jour === "2026-11-11")).toBe(true);
  });

  it("TikTok sans premier commentaire : ce n'est pas un manque", () => {
    const l = calculerManques([...igToutesLesJours, entree({ reseau: "tiktok", instant: "2026-11-13T19:00:00+01:00", premierCommentaire: undefined })], { maintenant: MAINTENANT });
    expect(l.some((m) => m.reseau === "tiktok")).toBe(false);
  });

  it("TikTok sans texte : c'est un manque (« Il manque le texte »)", () => {
    const l = calculerManques([...igToutesLesJours, entree({ reseau: "tiktok", instant: "2026-11-13T19:00:00+01:00", texte: "  ", statut: "brouillon" })], { maintenant: MAINTENANT });
    const m = l.find((x) => x.reseau === "tiktok");
    expect(m?.code).toBe("texte-manquant");
    expect(m?.message).toContain("texte");
  });

  it("Instagram sans premier commentaire : manque signalé ; avec commentaire, rien", () => {
    const sans = calculerManques([entree({ id: "x", instant: "2026-11-14T09:45:00+01:00", premierCommentaire: undefined }), ...igToutesLesJours.filter((e) => !e.instant.startsWith("2026-11-14"))], { maintenant: MAINTENANT });
    expect(codes(sans).filter((c) => c.startsWith("instagram"))).toEqual(["instagram:2026-11-14:commentaire-manquant"]);
    expect(calculerManques(igToutesLesJours, { maintenant: MAINTENANT }).some((m) => m.code === "commentaire-manquant")).toBe(false);
  });

  it("quota à 0 : aucun créneau attendu sur ce réseau", () => {
    const reglages = structuredClone(REGLAGES_CADENCE_DEFAUT);
    reglages.reseaux.instagram.quotaParJour = 0;
    const l = calculerManques([], { maintenant: MAINTENANT, reglages });
    expect(l.some((m) => m.reseau === "instagram")).toBe(false);
    expect(l.some((m) => m.reseau === "linkedin")).toBe(true);
  });

  it("quota illisible ou négatif : traité comme 0, sans erreur", () => {
    const reglages = structuredClone(REGLAGES_CADENCE_DEFAUT);
    reglages.reseaux.instagram.quotaParJour = -3;
    reglages.reseaux.facebook.quotaParJour = Number.NaN;
    const l = calculerManques([], { maintenant: MAINTENANT, reglages });
    expect(l.some((m) => m.reseau === "instagram" || m.reseau === "facebook")).toBe(false);
  });

  it("écart de 24 h : visuel non validé à moins de 24 h = urgent ; à 24 h pile = simple alerte", () => {
    const moins = calculerManques([entree({ instant: "2026-11-12T08:59:00+01:00", type: "carrousel", visuelValide: false })], { maintenant: MAINTENANT });
    expect(moins.find((m) => m.code === "visuel-non-valide")?.gravite).toBe("urgent");
    const pile = calculerManques([entree({ instant: "2026-11-12T09:00:00+01:00", type: "carrousel", visuelValide: false })], { maintenant: MAINTENANT });
    expect(pile.find((m) => m.code === "visuel-non-valide")?.gravite).toBe("alerte");
  });

  it("visuel validé ou état inconnu : pas de manque de visuel", () => {
    const l = calculerManques([entree({ instant: "2026-11-11T18:00:00+01:00", visuelValide: true }), entree({ id: "y", instant: "2026-11-12T18:00:00+01:00" })], { maintenant: MAINTENANT });
    expect(l.some((m) => m.code === "visuel-non-valide")).toBe(false);
  });

  it("jamais un blocage : toute alerte porte bloquant = false, même urgente", () => {
    const l = calculerManques([entree({ instant: "2026-11-11T20:00:00+01:00", visuelValide: false, texte: "", premierCommentaire: "" })], { maintenant: MAINTENANT });
    expect(l.length).toBeGreaterThan(3);
    expect(l.every((m) => m.bloquant === false)).toBe(true);
  });

  it("le jour du carrousel LinkedIn, le carrousel remplace la vidéo : il remplit le créneau", () => {
    const l = calculerManques([entree({ reseau: "linkedin", type: "carrousel", instant: "2026-11-12T08:00:00+01:00" })], { maintenant: MAINTENANT });
    expect(l.some((m) => m.reseau === "linkedin" && m.jour === "2026-11-12")).toBe(false);
  });

  it("une idée de l'IA ou une entrée archivée ne remplit pas un créneau", () => {
    const l = calculerManques([entree({ reseau: "linkedin", instant: "2026-11-12T08:00:00+01:00", statut: "idee" }), entree({ id: "a", reseau: "linkedin", instant: "2026-11-13T08:00:00+01:00", statut: "archive" })], { maintenant: MAINTENANT });
    expect(codes(l)).toContain("linkedin:2026-11-12:creneau-vide");
    expect(codes(l)).toContain("linkedin:2026-11-13:creneau-vide");
  });

  it("déjà partie ou passée : une entrée publiée ou d'une heure passée n'est pas réclamée (texte, commentaire)", () => {
    const l = calculerManques([entree({ instant: "2026-11-11T07:00:00+01:00", texte: "", premierCommentaire: "" }), entree({ id: "p", instant: "2026-11-11T23:00:00+01:00", statut: "publie", texte: "" })], { maintenant: MAINTENANT });
    expect(l.some((m) => m.code === "texte-manquant" || m.code === "commentaire-manquant")).toBe(false);
  });

  it("entrées illisibles ou vides : ignorées sans erreur ; heure de référence illisible : liste vide", () => {
    expect(() => calculerManques([entree({ instant: "n'importe quoi" }), null as never, {} as never], { maintenant: MAINTENANT })).not.toThrow();
    expect(calculerManques([], { maintenant: "illisible" })).toEqual([]);
    expect(calculerManques(undefined as never, { maintenant: MAINTENANT }).length).toBeGreaterThan(0);
  });

  it("rejeu : la même entrée deux fois ne double pas l'alerte", () => {
    const e = entree({ instant: "2026-11-12T10:00:00+01:00", texte: "" });
    const une = calculerManques([e], { maintenant: MAINTENANT }).filter((m) => m.code === "texte-manquant");
    const deux = calculerManques([e, e], { maintenant: MAINTENANT }).filter((m) => m.code === "texte-manquant");
    expect(deux).toHaveLength(une.length);
  });

  it("jours attendus modifiables : le fondateur peut attendre TikTok le lundi", () => {
    const l = calculerManques([], { maintenant: MAINTENANT, joursAttendus: { tiktok: [1] } });
    expect(l.filter((m) => m.reseau === "tiktok").map((m) => m.jour)).toEqual(["2026-11-16"]);
  });

  it("fenêtre modifiable et bornée : jours = 0 ne donne rien d'absurde, jours = 3 s'arrête au 13", () => {
    expect(calculerManques([], { maintenant: MAINTENANT, jours: 3 }).some((m) => m.jour > "2026-11-13")).toBe(false);
    expect(calculerManques([], { maintenant: MAINTENANT, jours: 0 })).toEqual([]);
  });
});
