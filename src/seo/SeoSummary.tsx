import Link from "next/link";
import type { PageSeo } from "./resolve";

/** JSON-LD for a <script> tag: "<" escaped so text from the database can never close the tag. */
export const jsonLdString = (value: object) => JSON.stringify(value).replace(/</g, "\\u003c");

export function JsonLd({ items }: { items: object[] }) {
  return (
    <>
      {items.map((item, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(item) }} />
      ))}
    </>
  );
}

/**
 * A plain, server-rendered copy of the page's main content (same facts the visible page shows).
 * The website renders in the browser, so without this the HTML that crawlers download is empty.
 * It is hidden and removed as soon as the real page loads, so visitors never see it.
 */
export function SeoSummary({ seo }: { seo: PageSeo }) {
  const s = seo.summary;
  if (!s) return null;
  return (
    <div id="seo-summary" hidden>
      {s.breadcrumbs?.length ? (
        <nav aria-label="Breadcrumb">
          <ol>
            {s.breadcrumbs.map((b) => (
              <li key={b.href}>
                <Link href={b.href} prefetch={false}>{b.label}</Link>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
      <main>
        <h1>{s.h1}</h1>
        {s.facts?.length ? (
          <dl>
            {s.facts.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {s.paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        {s.sections?.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            <ul>
              {section.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
        {s.links?.items.length ? (
          <section>
            <h2>{s.links.heading}</h2>
            <ul>
              {s.links.items.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} prefetch={false}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
      <nav aria-label="Site">
        <Link href="/" prefetch={false}>Home</Link> <Link href="/products" prefetch={false}>All products</Link> <Link href="/about" prefetch={false}>About</Link> <Link href="/contact" prefetch={false}>Contact</Link>{" "}
        <Link href="/terms" prefetch={false}>Terms &amp; Conditions</Link> <Link href="/privacy-policy" prefetch={false}>Privacy Policy</Link> <Link href="/refund-policy" prefetch={false}>Refund Policy</Link>{" "}
        <Link href="/shipping-policy" prefetch={false}>Shipping Policy</Link>
      </nav>
    </div>
  );
}
