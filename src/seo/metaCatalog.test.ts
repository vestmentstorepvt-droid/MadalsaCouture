import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/seo/data", () => ({ getProduct: vi.fn(), listProducts: vi.fn() }));

const { catalogXml, toCatalogItem, xml } = await import("./metaCatalog");
const meta = (await import("@/server/services/metaConversionsService")).default;

const product = {
  _id: "665f1c2a9b1e8a0012345678",
  title: "Ziva Anarkali Set",
  slug: "ziva-anarkali-set",
  description: "<p>Mustard &amp; gold anarkali</p>",
  basePrice: 3999,
  mrp: 4999,
  primaryImage: "https://res.cloudinary.com/x/ziva-1.jpg",
  images: [{ url: "https://res.cloudinary.com/x/ziva-1.jpg" }, { url: "https://res.cloudinary.com/x/ziva-2.jpg" }],
  variants: [{ price: 3999 }, { price: 4299 }],
  inStock: true,
  status: "published",
  gender: "Unisex",
  category: { name: "Anarkali" },
};

describe("Meta catalog feed", () => {
  it("uses the product's database id, the same id the pixel sends", () => {
    expect(toCatalogItem(product)?.id).toBe(product._id);
  });

  it("puts MRP as the price and the lowest size price as the sale price", () => {
    const item = toCatalogItem(product)!;
    expect(item.price).toBe(4999);
    expect(item.salePrice).toBe(3999);
    expect(item.additionalImageLinks).toEqual(["https://res.cloudinary.com/x/ziva-2.jpg"]);
  });

  it("has no sale price when there is no discount, and marks stock", () => {
    const item = toCatalogItem({ ...product, mrp: 3999, inStock: false })!;
    expect(item.price).toBe(3999);
    expect(item.salePrice).toBeNull();
    expect(item.availability).toBe("out of stock");
  });

  it("leaves gender out while it is the default 'Unisex'", () => {
    expect(toCatalogItem(product)?.gender).toBeNull();
    expect(toCatalogItem({ ...product, gender: "Women" })?.gender).toBe("female");
  });

  it("skips products that can't be advertised (no image or no price)", () => {
    expect(toCatalogItem({ ...product, primaryImage: null, images: [] })).toBeNull();
    expect(toCatalogItem({ ...product, basePrice: 0, variants: [] })).toBeNull();
  });

  it("writes valid, escaped XML", () => {
    const out = catalogXml([toCatalogItem({ ...product, title: 'Rose & "Aura" Set' })!]);
    expect(out).toContain("<g:title>Rose &amp; &quot;Aura&quot; Set</g:title>");
    expect(xml("a<b>c")).toBe("a&lt;b&gt;c");
    expect(out).toContain("<g:price>4999.00 INR</g:price>");
    expect(out).toContain("<g:sale_price>3999.00 INR</g:sale_price>");
    expect(xml("a\u0001b")).toBe("ab");
  });
});

describe("Meta Conversions API user data", () => {
  it("sends phone numbers with India's country code", () => {
    expect(meta._normalizePhone("+91 98765-43210")).toBe("919876543210");
    expect(meta._normalizePhone("9876543210")).toBe("919876543210");
    expect(meta._normalizePhone("12345")).toBeUndefined();
  });

  it("uses the trusted IP, forwarded pixel cookies, and hashed address fields", () => {
    const req = {
      ip: "203.0.113.7",
      headers: { "x-forwarded-for": "6.6.6.6", "user-agent": "UA", "x-meta-fbp": "fb.1.1700000000000.123456", "x-meta-fbc": "not-a-cookie" },
    };
    const data = meta._buildUserData(req, { city: "Bhopal", zip: "462 001", country: "IN", externalId: "u1" });
    expect(data.client_ip_address).toBe("203.0.113.7");
    expect(data.fbp).toBe("fb.1.1700000000000.123456");
    expect(data.fbc).toBeUndefined();
    expect(data.ct).toBe(meta._hashData("bhopal"));
    expect(data.zp).toBe(meta._hashData("462001"));
    expect(data.country).toBe(meta._hashData("in"));
    expect(data.external_id).toBe(meta._hashData("u1"));
  });

  it("uses the shopper details saved at checkout when there is no browser request (webhook)", () => {
    const data = meta._buildUserData(null, { ip: "198.51.100.2", userAgent: "Phone", fbc: "fb.1.1700000000000.AbC-123" });
    expect(data.client_ip_address).toBe("198.51.100.2");
    expect(data.client_user_agent).toBe("Phone");
    expect(data.fbc).toBe("fb.1.1700000000000.AbC-123");
  });
});
