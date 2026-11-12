/** GV-VG-03 : contrôle de la première seconde (pur, puis service avec dépôts simulés). Aucun appel réel. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SegmentSousTitres } from "../src/domaine/types";
import { controlerPremiereSeconde, PREFIXE } from "../src/domaine/premiere-seconde";

const seg = (debutSec: number, nbMots: number): SegmentSousTitres => ({
  id: `s${debutSec}`,
  debutSec,
  finSec: debutSec + 0.5,
  mots: Array.from({ length: nbMots }, (_, i) => ({ mot: `m${i}`, debutSec: debutSec + i * 0.1, finSec: debutSec + i * 0.1 + 0.1 })),
});

describe("contrôle pur", () => {
  it("premier segment à 0,8 s sans encadré : P1", () => {
    const a = controlerPremiereSeconde({ segments: [seg(0.8, 4)] });
    const p1 = a.find((x) => x.gravite === "attention");
    expect(p1?.code).toBe("defaut-visuel");
    expect(p1?.message).toBe("Première seconde : rien n'est écrit avant 0,8 s. Sur LinkedIn la vidéo démarre sans son ; l'accroche doit se lire dès la première image.");
  });
  it("encadré 0 à 3 s : pas de P1", () => {
    expect(controlerPremiereSeconde({ segments: [seg(0.8, 4)], encadre: { de: 0, a: 3 } }).filter((x) => x.gravite === "attention")).toEqual([]);
  });
  it("2 mots dans la 1re seconde : P2 (info)", () => {
    const a = controlerPremiereSeconde({ segments: [seg(0.2, 2)] });
    expect(a).toHaveLength(1);
    expect(a[0].gravite).toBe("info");
    expect(a[0].message.startsWith(PREFIXE)).toBe(true);
  });
  it("4 mots : rien", () => {
    expect(controlerPremiereSeconde({ segments: [seg(0.2, 4)] })).toEqual([]);
  });
  it("encadré aux mots connus : ils s'ajoutent ; inconnus : P2 ne se prononce pas", () => {
    expect(controlerPremiereSeconde({ segments: [seg(0.2, 2)], encadre: { de: 0, a: 3, mots: 2 } })).toEqual([]);
    expect(controlerPremiereSeconde({ segments: [seg(0.2, 2)], encadre: { de: 0, a: 3 } })).toEqual([]);
  });
  it("segments vides : rien", () => {
    expect(controlerPremiereSeconde({ segments: [] })).toEqual([]);
  });
});

// --- Service, dépôts simulés ---
const etat = vi.hoisted(() => ({ video: null as Record<string, unknown> | null, segments: [] as unknown[], erreur: false }));
vi.mock("server-only", () => ({}));
vi.mock("../src/services/_commun", () => ({
  depots: () => {
    if (etat.erreur) throw new Error("panne");
    return {
      videos: {
        obtenir: async () => etat.video,
        modifier: async (_id: string, patch: Record<string, unknown>) => {
          etat.video = { ...etat.video, ...patch };
        },
      },
      sousTitres: { lister: async () => [{ id: "st", versionId: "v1", version: 1, creeLe: "2026-01-01", segments: etat.segments }] },
    };
  },
}));

const AUTRE = { code: "duree", gravite: "info", message: "Durée proche de la limite." };
beforeEach(() => {
  etat.erreur = false;
  etat.segments = [seg(0.8, 4)];
  etat.video = { id: "vid", formatId: "facecam", versionChoisieId: "v1", noteQualite: { globale: 77, alertes: [AUTRE] } };
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("service", () => {
  it("ajoute l'alerte, garde les autres dans l'ordre, ne touche pas `globale`, et ne se double pas", async () => {
    const { controlerPremiereSecondeVideo } = await import("../src/services/premiere-seconde");
    await controlerPremiereSecondeVideo("vid");
    await controlerPremiereSecondeVideo("vid");
    const note = (etat.video as { noteQualite: { globale: number; alertes: { message: string }[] } }).noteQualite;
    expect(note.globale).toBe(77);
    expect(note.alertes[0]).toEqual(AUTRE);
    expect(note.alertes.filter((a) => a.message.startsWith(PREFIXE))).toHaveLength(1);
  });
  it("retire l'ancienne alerte quand le problème a disparu", async () => {
    const { controlerPremiereSecondeVideo } = await import("../src/services/premiere-seconde");
    await controlerPremiereSecondeVideo("vid");
    etat.segments = [seg(0.1, 4)];
    await controlerPremiereSecondeVideo("vid");
    expect((etat.video as { noteQualite: { alertes: unknown[] } }).noteQualite.alertes).toEqual([AUTRE]);
  });
  it("avocat (encadré 0 à 3 s) : rien ; démo : rien ; panne : avalée", async () => {
    const { controlerPremiereSecondeVideo } = await import("../src/services/premiere-seconde");
    etat.video = { ...etat.video, formatId: "avocat" };
    await controlerPremiereSecondeVideo("vid");
    expect((etat.video as { noteQualite: { alertes: unknown[] } }).noteQualite.alertes).toEqual([AUTRE]);
    etat.video = { ...etat.video, formatId: "facecam", estDemo: true };
    await controlerPremiereSecondeVideo("vid");
    expect((etat.video as { noteQualite: { alertes: unknown[] } }).noteQualite.alertes).toEqual([AUTRE]);
    etat.erreur = true;
    await expect(controlerPremiereSecondeVideo("vid")).resolves.toBeUndefined();
  });
});
