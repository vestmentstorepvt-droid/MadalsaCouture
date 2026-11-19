import { Router } from "@/server/http/router";
import { sendSuccess } from "@/server/http/response";
import type { Next, Req, Res } from "@/server/http/types";
import CommentModel from "@/server/models/commentModel";
import ProductModel from "@/server/models/productModel";

// New (redesign): GET /api/v1/reviews/featured?limit=6
// Recent 4–5 star reviews with text, across all products, for the home page
// "Reviews & testimonials" section. Read-only; existing review APIs are unchanged.

const Comment = CommentModel as any;
const Product = ProductModel as any;

const router = new Router();

router.get("/featured", async (req: Req, res: Res, next: Next) => {
  try {
    const limit = Math.min(24, Math.max(1, parseInt(String(req.query.limit ?? "6"), 10) || 6));
    const comments = await Comment.find({ isDeleted: false, rating: { $gte: 4 } })
      .sort({ createdAt: -1 })
      .limit(limit * 3)
      .lean();

    const withText = comments.filter((c: any) => typeof c.body === "string" && c.body.trim().length >= 12).slice(0, limit);
    const productIds = [...new Set(withText.map((c: any) => String(c.productId)))];
    const products = productIds.length
      ? await Product.find({ _id: { $in: productIds }, isDeleted: false }).select("title slug images").lean()
      : [];
    const byId = new Map(products.map((p: any) => [String(p._id), p]));

    const reviews = withText.map((c: any) => {
      const p: any = byId.get(String(c.productId));
      const image = p?.images?.find((i: any) => i.role === "primary")?.url ?? p?.images?.[0]?.url ?? null;
      const name = String(c.authorName || "").trim();
      return {
        _id: c._id,
        rating: c.rating,
        body: c.body.trim(),
        // First name + initial only, for privacy.
        author: name ? name.split(/\s+/).map((part, i) => (i === 0 ? part : `${part[0]}.`)).slice(0, 2).join(" ") : "Verified customer",
        createdAt: c.createdAt,
        product: p ? { title: p.title, slug: p.slug, image } : null,
      };
    });

    return sendSuccess(res, { reviews });
  } catch (err) {
    return next(err);
  }
});

export default router;
