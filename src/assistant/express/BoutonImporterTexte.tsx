"use client";

/**
 * « Importer un fichier » (B6), partagé par tous les écrans où l'on part de son propre texte : .txt et .md lus dans le
 * navigateur, .docx et .pdf lus par le serveur (/api/import : session exigée, bornes de taille et de caractères de texte-colle.ts).
 * Le texte lu est rendu tel quel à `onTexte` : jamais raccourci ici.
 */
import { useRef, useState } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { notifier } from "@/components/ui/Toast";
import { decoderTexteFichier, MESSAGE_TEXTE_TROP_LONG, TEXTE_MAX_CARACTERES, texteDuMarkdown, verifierFichierImport } from "./texte-colle";

export function BoutonImporterTexte({ onTexte }: { onTexte: (texte: string) => void }) {
  const [importe, setImporte] = useState(false);
  const fichier = useRef<HTMLInputElement>(null);

  async function importer(f: File) {
    const v = verifierFichierImport({ nom: f.name, taille: f.size });
    if (!v.ok) return notifier.erreur(v.message);
    setImporte(true);
    let lu: string;
    if (v.lecture === "navigateur") {
      // VERIF-E2E-1 (B) : UTF-8, sinon Windows-1252 (jamais de « � » à la place des accents).
      const brut = decoderTexteFichier(new Uint8Array(await f.arrayBuffer()));
      lu = v.extension === ".md" ? texteDuMarkdown(brut) : brut;
      // Relecture paquet 4 (sécurité D1) : même borne que le serveur, refus clair avant d'afficher le texte.
      if (lu.trim().length > TEXTE_MAX_CARACTERES) {
        setImporte(false);
        return notifier.erreur(MESSAGE_TEXTE_TROP_LONG);
      }
    } else {
      // Relecture paquet 4 (sécurité P1) : /api/import exige la session avant de lire le fichier.
      const r = await lireFichierSurLeServeur(f);
      if (!r.ok) {
        setImporte(false);
        return notifier.erreur(r.message);
      }
      lu = r.texte;
    }
    setImporte(false);
    onTexte(lu);
  }

  return (
    <>
      <input
        ref={fichier}
        type="file"
        accept=".txt,.md,.docx,.pdf"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void importer(f);
        }}
      />
      <Bouton variante="fantome" icone="document" pleineLargeur chargement={importe} onClick={() => fichier.current?.click()}>
        Importer un fichier
      </Bouton>
    </>
  );
}

/** Envoie le fichier à /api/import (le serveur lit le texte d'un .docx ou d'un .pdf). */
async function lireFichierSurLeServeur(f: File): Promise<{ ok: true; texte: string } | { ok: false; message: string }> {
  try {
    const r = await fetch("/api/import", { method: "POST", headers: { "x-nom-fichier": encodeURIComponent(f.name) }, body: f });
    const corps = (await r.json().catch(() => ({}))) as { texte?: string; erreur?: string };
    if (r.ok && typeof corps.texte === "string") return { ok: true, texte: corps.texte };
    return { ok: false, message: corps.erreur ?? "Ce fichier n'a pas pu être lu. Ouvrez-le, copiez le texte et collez-le." };
  } catch {
    return { ok: false, message: "Le studio ne répond pas. Réessayez dans un instant." };
  }
}
