import type { Metadata } from "next";
import { AideChat } from "@/components/retouche-chat/AideChat";
import { GabaritCreation } from "@/components/creation/GabaritCreation";

export const metadata: Metadata = { title: "Aide du chat de retouche" };

/** Page d'aide courte du chat de retouche (lot R4). */
export default function PageAideChat() {
  return (
    <GabaritCreation entete={{ titre: "Aide du chat", sousTitre: "Ce que vous pouvez demander, en mots simples." }}>
      <AideChat />
    </GabaritCreation>
  );
}
