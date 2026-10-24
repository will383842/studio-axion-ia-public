"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { CaseACocher } from "@/components/ui/CaseACocher";
import { envoyerFichier } from "@/lib/envoi-multipart";
import { PHRASES_ECRAN_FOURNI, type ZoneMasquee } from "@/moteurs/montage-cas-concret/captures";
import { poserEcranFourniAction, retirerEcranFourniAction } from "./actions";

/** Type d'entité des envois d'écran fourni (même valeur que `TYPE_ENVOI_ECRAN` du service, qui est côté serveur). */
const TYPE_ENVOI = "entree";
const MIMES = ["image/png", "image/jpeg"];

export interface EtapeAEcran {
  numero: number;
  titre: string;
  /** Vrai : une image est déjà gardée pour cette étape. */
  fournie: boolean;
}

/** Un rectangle tiré du doigt ou de la souris sur l'image, en fractions de l'image. */
const rectangle = (a: { x: number; y: number }, b: { x: number; y: number }): ZoneMasquee => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  largeur: Math.abs(a.x - b.x),
  hauteur: Math.abs(a.y - b.y),
});

/** L'image avec ses rectangles posés en noir, en PNG : seule cette version quitte le navigateur. */
async function aplatir(src: string, zones: readonly ZoneMasquee[]): Promise<Blob> {
  const img = new Image();
  img.src = src;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const g = c.getContext("2d");
  if (!g) throw new Error("canvas");
  g.drawImage(img, 0, 0);
  g.fillStyle = "#000";
  for (const z of zones) g.fillRect(z.x * c.width, z.y * c.height, z.largeur * c.width, z.hauteur * c.height);
  return await new Promise<Blob>((ok, ko) => c.toBlob((b) => (b ? ok(b) : ko(new Error("png"))), "image/png"));
}

export function EcranFourni({ casId, etapes }: { casId: string; etapes: EtapeAEcran[] }) {
  const routeur = useRouter();
  const [etape, setEtape] = useState(etapes[0]?.numero ?? 1);
  const [source, setSource] = useState<string | null>(null);
  const [zones, setZones] = useState<ZoneMasquee[]>([]);
  const [tracee, setTracee] = useState<ZoneMasquee | null>(null);
  const [attestation, setAttestation] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [fait, setFait] = useState(false);
  const [attente, demarrer] = useTransition();
  const depart = useRef<{ x: number; y: number } | null>(null);
  const cadre = useRef<HTMLDivElement>(null);

  useEffect(() => () => void (source && URL.revokeObjectURL(source)), [source]);

  const point = (e: React.PointerEvent): { x: number; y: number } => {
    const r = cadre.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };

  function choisir(fichier: File | undefined) {
    setMessage(null);
    setFait(false);
    setZones([]);
    if (!fichier) return;
    if (!MIMES.includes(fichier.type)) {
      setMessage(PHRASES_ECRAN_FOURNI.imageInvalide);
      return;
    }
    setSource(URL.createObjectURL(fichier));
  }

  function garder() {
    if (!source) return;
    if (!attestation) {
      setMessage(PHRASES_ECRAN_FOURNI.sansAttestation);
      return;
    }
    demarrer(async () => {
      try {
        const png = await aplatir(source, zones);
        const envoye = await envoyerFichier(new File([png], `ecran-etape-${etape}.png`, { type: "image/png" }), { typeEntite: TYPE_ENVOI, entiteId: casId });
        const r = await poserEcranFourniAction({ casId, etapeCas: etape, fichierId: envoye.fichierId, masques: zones, attestation });
        if (r.ok) {
          setMessage(null);
          setFait(true);
          routeur.refresh();
        } else setMessage(r.message);
      } catch {
        setMessage("L'image n'a pas pu être gardée. Choisissez-la à nouveau.");
      }
    });
  }

  if (etapes.length === 0) return <p className="text-[15px] text-texte-doux">Ce cas n&apos;a pas d&apos;étape à écran réel : rien à fournir.</p>;
  return (
    <div className="space-y-4">
      <label className="block space-y-1">
        <span className="text-sm font-semibold text-texte-doux">Étape concernée</span>
        <select value={etape} onChange={(e) => setEtape(Number(e.target.value))} className="min-h-12 w-full rounded-carte border border-trait bg-surface-1 px-3 text-[15px] text-texte">
          {etapes.map((e) => (
            <option key={e.numero} value={e.numero}>
              {e.numero}. {e.titre}
              {e.fournie ? " (image gardée)" : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-semibold text-texte-doux">Votre image (PNG ou JPEG)</span>
        <input type="file" accept="image/png,image/jpeg" aria-label="Votre image" className="block w-full text-[15px]" onChange={(e) => choisir(e.target.files?.[0])} />
      </label>

      {source && (
        <div className="space-y-2">
          <p className="text-sm text-texte-doux">Tracez un rectangle sur chaque zone à masquer (nom, adresse, e-mail, visage).</p>
          <div
            ref={cadre}
            data-testid="cadre-masques"
            className="relative mx-auto max-w-sm touch-none select-none overflow-hidden rounded-carte border border-trait"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              depart.current = point(e);
              setTracee(null);
            }}
            onPointerMove={(e) => {
              if (depart.current) setTracee(rectangle(depart.current, point(e)));
            }}
            onPointerUp={(e) => {
              if (depart.current) {
                const z = rectangle(depart.current, point(e));
                if (z.largeur > 0.01 && z.hauteur > 0.01) setZones((l) => [...l, z]);
              }
              depart.current = null;
              setTracee(null);
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={source} alt="Votre image, avant masquage" className="pointer-events-none block w-full" draggable={false} />
            {[...zones, ...(tracee ? [tracee] : [])].map((z, i) => (
              <div key={i} data-testid="zone-masquee" className="pointer-events-none absolute bg-fond" style={{ left: `${z.x * 100}%`, top: `${z.y * 100}%`, width: `${z.largeur * 100}%`, height: `${z.hauteur * 100}%` }} />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Bouton variante="secondaire" onClick={() => setZones((l) => l.slice(0, -1))} disabled={zones.length === 0}>
              Retirer la dernière zone
            </Bouton>
            <span className="text-sm text-texte-doux">{zones.length === 0 ? "Aucune zone masquée" : `${zones.length} zone${zones.length > 1 ? "s" : ""} masquée${zones.length > 1 ? "s" : ""}`}</span>
          </div>
          <CaseACocher libelle="Je confirme qu'aucune donnée personnelle n'est visible" detail="Aucun visage, aucun nom de client, aucune adresse." coche={attestation} onChange={(v) => { setAttestation(v); setMessage(null); }} />
          <Bouton chargement={attente} onClick={garder}>
            Utiliser cette image
          </Bouton>
        </div>
      )}
      {fait && <p role="status" className="text-sm text-texte-doux">Image gardée pour l&apos;étape {etape}. La vidéo la montrera à la place de la capture du site.</p>}
      {message && <p role="alert" className="text-sm text-brique">{message}</p>}

      {etapes.some((e) => e.fournie) && (
        <div className="space-y-2 border-t border-trait pt-3">
          {etapes
            .filter((e) => e.fournie)
            .map((e) => (
              <div key={e.numero} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[15px] text-texte">Étape {e.numero} : image gardée</span>
                <Bouton
                  variante="secondaire"
                  onClick={() =>
                    demarrer(async () => {
                      await retirerEcranFourniAction(casId, e.numero);
                      routeur.refresh();
                    })
                  }
                >
                  Retirer l&apos;image
                </Bouton>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
