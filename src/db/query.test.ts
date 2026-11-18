import { describe, expect, it } from "vitest";
import { runPipeline } from "./aggregate";
import { applyProjection, matches, sortDocs } from "./query";
import { applyUpdate } from "./update";

const product = {
  _id: "6a81ff9493d59a4e574bcfc7",
  title: "Ziva",
  status: "published",
  basePrice: 4400,
  tagIds: ["t1", "t2"],
  flags: { isFeatured: true },
  images: [{ url: "a.jpg", role: "primary" }, { url: "b.jpg", role: "gallery" }],
  createdAt: "2026-11-10T10:00:00.000Z",
  isDeleted: false,
};

describe("matches (MongoDB filter semantics)", () => {
  it("handles equality, arrays and nested paths", () => {
    expect(matches(product, { status: "published", isDeleted: false })).toBe(true);
    expect(matches(product, { tagIds: "t2" })).toBe(true); // value inside an array
    expect(matches(product, { "flags.isFeatured": true })).toBe(true);
    expect(matches(product, { "images.role": "primary" })).toBe(true); // through array of objects
    expect(matches(product, { missing: null })).toBe(true);
  });

  it("handles operators", () => {
    expect(matches(product, { basePrice: { $gte: 4000, $lt: 5000 } })).toBe(true);
    expect(matches(product, { basePrice: { $gt: "1" } })).toBe(false); // no cross-type comparison
    expect(matches(product, { tagIds: { $in: ["x", "t1"] } })).toBe(true);
    expect(matches(product, { tagIds: { $nin: ["t1"] } })).toBe(false);
    expect(matches(product, { title: { $regex: "^zi", $options: "i" } })).toBe(true);
    expect(matches(product, { title: /iva$/ })).toBe(true);
    expect(matches(product, { $or: [{ status: "draft" }, { basePrice: 4400 }] })).toBe(true);
    expect(matches(product, { createdAt: { $lte: new Date("2026-11-11") } })).toBe(true); // Date vs ISO string
    expect(matches(product, { $expr: { $gt: ["$basePrice", 4000] } })).toBe(true);
    expect(matches(product, { images: { $elemMatch: { role: "gallery", url: "b.jpg" } } })).toBe(true);
  });
});

describe("applyUpdate (MongoDB update operators)", () => {
  it("sets, increments, pushes and pulls", () => {
    const next = applyUpdate(product, {
      $set: { title: "Ziva II", "flags.isNew": true },
      $inc: { basePrice: -400 },
      $push: { tagIds: "t3" },
      $pull: { images: { role: "gallery" } },
    });
    expect(next.title).toBe("Ziva II");
    expect(next.flags).toEqual({ isFeatured: true, isNew: true });
    expect(next.basePrice).toBe(4000);
    expect(next.tagIds).toEqual(["t1", "t2", "t3"]);
    expect(next.images).toHaveLength(1);
    expect(product.basePrice).toBe(4400); // original untouched
  });

  it("treats a plain object as $set (Mongoose behaviour)", () => {
    expect(applyUpdate(product, { status: "archived" }).status).toBe("archived");
  });
});

describe("sorting and projection", () => {
  it("sorts like MongoDB (missing values first ascending)", () => {
    const docs = [{ n: 2 }, { n: null }, { n: 1 }, {}];
    expect(sortDocs(docs, { n: 1 }).map((d: any) => d.n ?? null)).toEqual([null, null, 1, 2]);
    expect(sortDocs(docs, "-n").map((d: any) => d.n ?? null)).toEqual([2, 1, null, null]);
  });

  it("hides select:false fields unless forced", () => {
    const user = { _id: "u", email: "a@b.c", password: "hash" };
    expect(applyProjection(user, undefined, ["password"])).toEqual({ _id: "u", email: "a@b.c" });
    expect(applyProjection(user, "+password", ["password"])).toEqual(user);
    expect(applyProjection(user, "email")).toEqual({ _id: "u", email: "a@b.c" });
  });
});

describe("aggregation pipeline", () => {
  it("groups, sums and formats dates", async () => {
    const orders = [
      { status: "Paid", total: 100, createdAt: "2026-11-01T05:00:00.000Z" },
      { status: "Paid", total: 50, createdAt: "2026-11-01T09:00:00.000Z" },
      { status: "Cancelled", total: 70, createdAt: "2026-11-02T09:00:00.000Z" },
    ];
    const out = await runPipeline(
      orders,
      [
        { $match: { status: { $in: ["Paid"] } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, revenue: { $sum: "$total" }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ],
      async () => [],
    );
    expect(out).toEqual([{ _id: "2026-11-01", revenue: 150, count: 2 }]);
  });
});
