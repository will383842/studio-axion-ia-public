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
  "Impossible de lire la vidéo b.example.com/hook?id=x&sig=abc",
  "Impossible de lire la vidéo b.example.com/hook?id=x%26SIG%3Dabc",
  "Impossible de lire la vidéo b.blob.example.com/v.mp4?sv=2022-11-02&se=2026-01-01&sig=abc%2Fdef",
  "Impossible de lire la vidéo b.example.com/v.mp4?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Expires=60",
  "Impossible de lire la vidéo b.example.com/v.mp4%3FX-Goog-Signature%3Dabc",
  "Impossible de lire la vidéo, signature : deadbeef refusée",
  "Impossible de lire la vidéo, signature= deadbeef refusée",
];

describe("phraseLisible : adresse signée", () => {
  it.each(SIGNEES)("refuse %s", (m) => {
    expect(phraseLisible(m)).toBe(false);
  });
  it("garde une adresse sans signature", () => {
    expect(phraseLisible("Impossible de lire la vidéo b.r2.example.com/v.mp4 pour le moment")).toBe(true);
  });
  it.each([
    "Merci de relire la signature du contrat avant l'envoi",
    "Le signal de la vidéo est trop faible pour ce format",
    "La signature du client est manquante sur la vidéo",
    "Le signataire doit valider la vidéo avant la diffusion",
  ])("garde la phrase normale : %s", (m) => {
    expect(phraseLisible(m)).toBe(true);
  });
  it("garde un message sans adresse", () => {
    expect(phraseLisible("La vidéo est trop longue pour ce format")).toBe(true);
  });
});
