import { mots as motsDe } from "./normaliser";
import type { InstantRegard } from "./types";

interface PartieEntree {
  id: string;
  debutSec: number;
  finSec: number;
  texteAttendu: boolean;
}
interface MotHorodate {
  mot: string;
  debutSec: number;
  finSec: number;
}

const arrondir = (x: number) => Math.round(x * 1000) / 1000;

/** Instants à regarder : début (0,5 s), une fois le texte de chaque partie apparu, et la fin. Fonction pure. */
export function choisirInstants(e: { parties: PartieEntree[]; dureeSec: number; mots?: MotHorodate[] }, max = 24): InstantRegard[] {
  const duree = Math.max(0, e.dureeSec);
  const dits = (t: number) => (e.mots ?? []).filter((m) => m.debutSec <= t + 1 && m.finSec >= t - 1).flatMap((m) => motsDe(m.mot));
  const brut = (sorte: InstantRegard["sorte"], t: number, partie: PartieEntree | null) => ({
    sorte,
    instantSec: arrondir(Math.min(Math.max(0, t), duree)),
    partieId: partie?.id ?? null,
    texteAttendu: partie?.texteAttendu ?? false,
  });
  const debut = brut("debut", 0.5, null);
  const fin = brut("fin", duree - 0.3, null);
  let parties = e.parties.map((p) => {
    const t = Math.max(p.debutSec, Math.min(p.debutSec + 0.7 * (p.finSec - p.debutSec), p.finSec - 0.3));
    return brut("partie", Math.min(t, p.finSec), p);
  });
  const places = Math.max(0, max - 2);
  if (parties.length > places) {
    const tries = [...parties].sort((a, b) => a.instantSec - b.instantSec);
    parties = Array.from({ length: places }, (_, i) => tries[Math.floor((i * tries.length) / places)]!);
  }
  return [debut, ...parties, fin]
    .map((x, i) => ({ x, i }))
    .sort((a, b) => a.x.instantSec - b.x.instantSec || a.i - b.i)
    .map(({ x }, i) => ({
      nom: `i${String(i + 1).padStart(2, "0")}`,
      instantSec: x.instantSec,
      partieId: x.partieId,
      sorte: x.sorte,
      legende: x.sorte === "debut" ? "début de la vidéo" : x.sorte === "fin" ? "fin de la vidéo" : `partie ${x.partieId}`,
      texteAttendu: x.texteAttendu,
      motsDits: dits(x.instantSec),
    }));
}
