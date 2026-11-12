import { describe, expect, it, vi } from "vitest";
import type { MessageStock } from "@/domaine/stock-messages";
import { ecarterSujetsProches, rangerSignature, signatureDeMessage, signaturesDuStock, type SignatureStock } from "@/services/stock-signatures";

const msg = (id: string, texte: string, etat?: MessageStock["etat"]): MessageStock => ({ id, texte, etat, creeLe: "2026-11-01T10:00:00.000Z" });
const planifie = (id: string, texte: string) => msg(id, texte, "planifie");

describe("RC-34 signatures du stock", () => {
  it("écarte un sujet de l'usine proche d'un message planifié", () => {
    const stock = signaturesDuStock([planifie("m1", "Comment relancer un client qui ne répond plus")]);
    const r = ecarterSujetsProches([{ id: "s1", sujet: "Relancer un client qui ne répond plus" }, { id: "s2", sujet: "Fiscalité des auto-entrepreneurs" }], stock);
    expect(r.ecartes.map((s) => s.id)).toEqual(["s1"]);
    expect(r.gardes.map((s) => s.id)).toEqual(["s2"]);
    expect(r.ecartes[0].proche).toBe("m1");
  });

  it("garde l'écart au-delà de 60 messages, sans aucune mémoire centrale", () => {
    const messages = Array.from({ length: 100 }, (_, i) => planifie(`m${i}`, `Sujet numéro${i} unique${i}`));
    messages[0] = planifie("m0", "Relancer un client silencieux");
    const stock = signaturesDuStock(messages);
    expect(stock).toHaveLength(100);
    const r = ecarterSujetsProches([{ id: "s1", sujet: "Relancer un client silencieux" }], stock);
    expect(r.ecartes).toHaveLength(1);
  });

  it("ne stocke que des empreintes hachées", () => {
    const sig = signatureDeMessage(planifie("m1", "Relancer un client silencieux"));
    const brut = JSON.stringify(sig).toLowerCase();
    for (const mot of ["relancer", "relanc", "client", "silenci", "silencieux"]) expect(brut).not.toContain(mot);
    expect(Object.keys(sig).sort()).toEqual(["axes", "id"]);
    expect(sig.axes.every((a) => /^[0-9a-f]{64}$/.test(a))).toBe(true);
  });

  it("hache aussi la signature de l'usine", () => {
    const sig = signatureDeMessage(planifie("m1", "Relancer un client silencieux"), "sig-usine-ABC");
    expect(JSON.stringify(sig)).not.toContain("sig-usine-ABC");
    expect(sig.signature).toMatch(/^[0-9a-f]{64}$/);
    const r = ecarterSujetsProches([{ id: "s1", sujet: "tout autre thème", signatureUsine: "sig-usine-ABC" }], [sig], 0.1);
    expect(r.ecartes).toHaveLength(1);
  });

  it("n'envoie rien : aucun appel réseau", () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    const stock = signaturesDuStock([planifie("m1", "Relancer un client silencieux")]);
    ecarterSujetsProches([{ id: "s1", sujet: "Relancer un client silencieux" }], stock);
    vi.unstubAllGlobals();
    expect(f).not.toHaveBeenCalled();
  });

  it("ne retient que les messages planifiés ou publiés, archivés compris", () => {
    const stock = signaturesDuStock([
      msg("a", "Relancer un client"),
      planifie("b", "Facturer un acompte"),
      msg("c", "Rédiger un devis", "publie"),
      { ...planifie("d", "Choisir un statut"), archiveLe: "2026-11-05T08:00:00.000Z" },
    ]);
    expect(stock.map((s) => s.id).sort()).toEqual(["b", "c", "d"]);
  });

  it("cas limites : vide, illisible, sans mot plein", () => {
    expect(ecarterSujetsProches([], [])).toEqual({ gardes: [], ecartes: [] });
    const stock = signaturesDuStock([planifie("m1", "Relancer un client")]);
    const r = ecarterSujetsProches([{ id: "s1", sujet: "" }, { id: "s2", sujet: "le la de" }, { id: "s3", sujet: undefined as unknown as string }], stock);
    expect(r.gardes.map((s) => s.id)).toEqual(["s1", "s2", "s3"]);
    expect(signaturesDuStock([planifie("x", ""), null as unknown as MessageStock, { id: "y" } as MessageStock])).toEqual([]);
    expect(ecarterSujetsProches([{ id: "s", sujet: "Relancer" }], [{ id: "z", axes: [] }, null as unknown as SignatureStock]).ecartes).toEqual([]);
  });

  it("seuil exact : score égal au seuil écarté, juste en dessous gardé", () => {
    const stock = signaturesDuStock([planifie("m1", "Relancer client")]);
    const s = [{ id: "s1", sujet: "Relancer client facture" }]; // 2 communs / 3 = 0,666…
    expect(ecarterSujetsProches(s, stock, 2 / 3).ecartes).toHaveLength(1);
    expect(ecarterSujetsProches(s, stock, 0.67).ecartes).toHaveLength(0);
  });

  it("rejeu : ranger deux fois le même message ne double rien, rien n'est supprimé", () => {
    const a = signatureDeMessage(planifie("m1", "Relancer un client"));
    const b = signatureDeMessage(planifie("m2", "Facturer un acompte"));
    const liste = rangerSignature(rangerSignature(rangerSignature([], a), b), a);
    expect(liste.map((s) => s.id)).toEqual(["m1", "m2"]);
    const avant = JSON.stringify(liste);
    rangerSignature(liste, signatureDeMessage(planifie("m3", "Autre chose ici")));
    expect(JSON.stringify(liste)).toBe(avant);
  });

  it("n'altère pas les entrées", () => {
    const sujets = [{ id: "s1", sujet: "Relancer un client" }];
    const copie = JSON.stringify(sujets);
    ecarterSujetsProches(sujets, signaturesDuStock([planifie("m1", "Relancer un client")]));
    expect(JSON.stringify(sujets)).toBe(copie);
  });
});
