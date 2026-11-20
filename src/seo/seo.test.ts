import { describe, expect, it } from "vitest";
import { isProductionHost } from "./config";
import { usableSeoDescription, usableSeoTitle } from "./fields";
import { isFileNameAlt, summarize, toText } from "./text";

// Real admin entries found in the catalogue (2026-11-20).
describe("admin SEO titles", () => {
  it("keeps a good title", () => {
    expect(usableSeoTitle("Ziva Mustard Yellow Anarkali Set | Festive Wear | Madalsa Couture", "Ziva")).toBe(
      "Ziva Mustard Yellow Anarkali Set | Festive Wear | Madalsa Couture",
    );
  });
  it("rejects keyword lists, typos, sentences and titles about another product", () => {
    expect(usableSeoTitle("Dark Purple Anarkali Set, Purple Anarkali Suit, Designer Anarkali Suit, Madalsa Couture.", "Mayra – The Purple Anarkali Sharara Set")).toBe("");
    expect(usableSeoTitle("blue lonOcean Blue Maxi Dress with Pearl Straps | Madalsa Coutureg", "Ocean Blue Maxi Dress")).toBe("");
    expect(usableSeoTitle("Shop Rose Aura, a sophisticated rose pink one-shoulder kurta set.", "Serena")).toBe("");
    expect(usableSeoTitle("Rose Aura Kurta Set | Madalsa Couture", "Serena")).toBe("");
  });
  it("rejects a title typed into the description box", () => {
    expect(usableSeoDescription("Pearl Elegant Anarkali Set with Embroidered Dupatta | Madalsa Couture", "Pearl")).toBe("");
    expect(usableSeoDescription("Shop Ziva Mustard Yellow Anarkali Set by Madalsa Couture, featuring flared Anarkali, straight pants and net dupatta.", "Ziva")).not.toBe("");
    // A normal sentence with several commas is not a keyword list; long ones are shortened.
    const red = usableSeoDescription(
      "Shop the Red Hot Short Dress by Madalsa Couture, featuring a chic square neckline, stone work detailing and soft moss crepe fabric. Perfect for Valentine’s dates, parties and evening occasions.",
      "Red hot short dress",
    );
    expect(red.startsWith("Shop the Red Hot Short Dress")).toBe(true);
    expect(red.length).toBeLessThanOrEqual(160);
  });
});

describe("text helpers", () => {
  it("summarises on word boundaries", () => {
    const s = summarize("word ".repeat(80));
    expect(s.length).toBeLessThanOrEqual(160);
    expect(s.endsWith("…")).toBe(true);
  });
  it("strips HTML", () => {
    expect(toText("<h2><strong>1.&nbsp;Introduction</strong></h2><p>Hi &amp; bye</p>")).toBe("1. Introduction\nHi & bye");
  });
  it("spots camera file names used as alt text", () => {
    expect(isFileNameAlt("IMG_5347")).toBe(true);
    expect(isFileNameAlt("CAN07030_copy")).toBe(true);
    expect(isFileNameAlt("Noor emerald green Anarkali, front view")).toBe(false);
  });
});

describe("production host", () => {
  it("only the real domain is indexable", () => {
    expect(isProductionHost("madalsacouture.com")).toBe(true);
    expect(isProductionHost("www.madalsacouture.com")).toBe(true);
    expect(isProductionHost("madalsacouture.vercel.app")).toBe(false);
    expect(isProductionHost("madalsacouture-g12t.onrender.com")).toBe(false);
    expect(isProductionHost("localhost:3000")).toBe(false);
    expect(isProductionHost(null)).toBe(false);
  });
});
