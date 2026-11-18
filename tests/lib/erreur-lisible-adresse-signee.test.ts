import { describe, expect, it } from "vitest";
import { phraseLisible } from "@/lib/erreur-lisible";

// Une adresse signée (stockage) ne doit jamais être jugée « lisible » : sinon elle serait affichée telle quelle.
const SIGNEES = [
  "Could not fetch media from b.r2.cloudflarestorage.com/v.mp4?X-Amz-Credential=AKIA/x&X-Amz-Signature=deadbeef",
  "Impossible de lire la vidéo b.r2.example.com/v.mp4%3FX-Amz-Signature%3Dabc",
  "Impossible de lire la vidéo b.r2.example.com/v.mp4%3fX-Amz-Signature%3Dabc%26X-Amz-Expires%3D60",
  "Impossible de lire la vidéo b.r2.example.com/v.mp4?a=1&amp;X-Amz-Signature=abc&amp;X-Amz-Expires=60",
  "Impossible de lire la vidéo b.r2.example.com/v.mp4?X-Amz-Security-Token=FwoGZXIvYXdz",
  "Impossible de lire la vidéo, paramètre X-Amz-Signature=deadbeef refusé",
  "Impossible de lire la vidéo https://b.r2.example.com/v.mp4?X-Amz-Signature=abc",
];

describe("phraseLisible : adresse signée", () => {
  it.each(SIGNEES)("refuse %s", (m) => {
    expect(phraseLisible(m)).toBe(false);
  });
  it("garde une adresse sans signature", () => {
    expect(phraseLisible("Impossible de lire la vidéo b.r2.example.com/v.mp4 pour le moment")).toBe(true);
  });
  it("garde un message sans adresse", () => {
    expect(phraseLisible("La vidéo est trop longue pour ce format")).toBe(true);
  });
});
