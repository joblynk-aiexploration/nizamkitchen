import Link from "next/link";
import { publicPageMetadata } from "@/lib/seo/public-page-metadata";

export const generateMetadata = () => publicPageMetadata("/about");

const values = [
  {
    title: "Authenticity first",
    body: "Every recipe in NizamKitchen is rooted in genuine Hyderabadi culinary tradition — not shortcuts or substitutions.",
  },
  {
    title: "Built for real households",
    body: "We design every feature around how families actually plan, cook, shop, and order. No kitchen is perfectly organised — we meet you where you are.",
  },
  {
    title: "Community at the centre",
    body: "Home chefs, restaurant partners, and households all belong to one kitchen ecosystem. When the platform grows, everyone benefits.",
  },
  {
    title: "Privacy by default",
    body: "Your household data is yours. We isolate every organisation's data at the architectural level — not just in policy.",
  },
  {
    title: "No fake trust signals",
    body: "Restaurant fallback avoids invented ratings, chef profiles require manual verification, and grocery lists are estimates users should check.",
  },
];

export default function AboutPage() {
  return (
    <div className="px-5 py-16 sm:px-8">
      <div className="mx-auto max-w-4xl">
        {/* Origin */}
        <div className="mb-16 border-b border-[var(--color-border)] pb-16">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)]">Our story</p>
          <h1 className="mt-4 font-serif text-4xl text-[var(--color-ink)] sm:text-5xl">
            From one city&apos;s cuisine to a kitchen platform for everyone.
          </h1>
          <div className="mt-8 space-y-5 text-[var(--color-muted)]">
            <p>
              NizamKitchen was born from a simple conviction: Hyderabad&apos;s culinary heritage is one of the world&apos;s
              greatest, and modern households deserve tools that celebrate it — not replace it with generic meal kits
              and algorithm-driven suggestion engines.
            </p>
            <p>
              Hyderabadi cooking is complex, layered, and deeply personal. Biryani is not just rice and meat —
              it carries story, occasion, and memory. Haleem takes hours because it should. Bagara baingan
              requires care because that is how it is meant to be. We built NizamKitchen to honour that.
            </p>
            <p>
              Today, NizamKitchen is a platform for households to plan, cook, hire, and order — with an
              ecosystem of home chefs and restaurant partners who share our passion for authentic food.
            </p>
          </div>
        </div>

        {/* Values */}
        <div>
          <h2 className="font-serif text-3xl text-[var(--color-ink)]">What we believe</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {values.map((v) => (
              <div key={v.title} className="rounded-3xl border border-[var(--color-border)] p-6">
                <h3 className="font-semibold text-[var(--color-ink)]">{v.title}</h3>
                <p className="mt-2 text-sm text-[var(--color-muted)]">{v.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-16 text-center">
          <h2 className="font-serif text-2xl text-[var(--color-ink)]">Join the NizamKitchen community</h2>
          <p className="mt-3 text-[var(--color-muted)]">
            Whether you cook, host, or order — there is a place for you in our kitchen.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/register"
              className="rounded-2xl bg-[var(--button-primary-bg)] px-8 py-3 text-sm font-semibold text-[var(--button-primary-text)] shadow-sm transition hover:bg-[var(--button-primary-hover-bg)]"
            >
              Sign up
            </Link>
            <Link
              href="/contact"
              className="rounded-2xl border border-[var(--color-border)] px-8 py-3 text-sm font-semibold text-[var(--color-ink)] hover:bg-slate-50"
            >
              Get in touch
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
