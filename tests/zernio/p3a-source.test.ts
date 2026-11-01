/** P3-A · source d'une publication : exactement une vidéo ou un visuel, lue par `sourceDe`. */
import { describe, expect, it } from "vitest";
import { sourceDe, videoIdDe } from "@/domaine/types";

describe("P3-A · sourceDe", () => {
  it("rend la famille « video » quand seul videoId est posé", () => {
    expect(sourceDe({ videoId: "v1" })).toEqual({ famille: "video", videoId: "v1" });
    expect(videoIdDe({ videoId: "v1" })).toBe("v1");
  });
  it("rend la famille « visuel » quand seul visuelId est posé", () => {
    expect(sourceDe({ visuelId: "x1" })).toEqual({ famille: "visuel", visuelId: "x1" });
    expect(videoIdDe({ visuelId: "x1" })).toBeUndefined();
  });
  it("refuse les deux à la fois", () => {
    expect(() => sourceDe({ videoId: "v1", visuelId: "x1" })).toThrow();
  });
  it("refuse l'absence de source", () => {
    expect(() => sourceDe({})).toThrow();
  });
});
