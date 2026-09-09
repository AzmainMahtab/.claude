# Content Collections, RSS and Structured Data

Anything repeated with the same shape is a collection: blog posts, portfolio projects, packages, team members, testimonials. Typed at build time, so a missing field fails `astro build` instead of shipping a broken card.

---

## Schema

`src/content.config.ts` (Astro 5 — note this is at `src/`, not `src/content/`):

```ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
  schema: ({ image }) =>
    z.object({
      title: z.string().max(70),
      description: z.string().min(80).max(160),
      publishedAt: z.coerce.date(),
      updatedAt: z.coerce.date().optional(),
      category: z.enum(['planning', 'design', 'floral', 'stories']),
      cover: image(),
      coverAlt: z.string(),
      author: z.string().default('Eventrra'),
      draft: z.boolean().default(false),
    }),
});

const projects = defineCollection({
  loader: glob({ base: './src/content/projects', pattern: '**/*.md' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      client: z.string().optional(),
      category: z.enum(['weddings', 'corporate', 'social', 'floral']),
      guests: z.number().optional(),
      venue: z.string(),
      year: z.number(),
      cover: image(),
      coverAlt: z.string(),
      gallery: z.array(z.object({ src: image(), alt: z.string() })).default([]),
      featured: z.boolean().default(false),
    }),
});

export const collections = { blog, projects };
```

The constraints earn their keep:

- `description` bounded at 80–160 characters because that is the meta description, and the SEO audit has an opinion about it.
- `title` capped at 70 so the `<title>` is not truncated in results.
- `coverAlt` **required alongside every image**. Making alt text a schema field is the cheapest way to guarantee the accessibility score — a post without it does not build.
- `image()` returns an optimizable `ImageMetadata`, not a string path, so `<Image>` can do AVIF and dimensions.

---

## Reading

```astro
---
import { getCollection, render } from 'astro:content';

const posts = (await getCollection('blog', ({ data }) => !data.draft))
  .sort((a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime());

const featured = posts[0];
const rest = posts.slice(1);
const categories = [...new Set(posts.map((p) => p.data.category))];
---
```

Filter drafts in the `getCollection` predicate, not in the template — a drafted post should not reach the DOM at all.

In Astro 5, rendering is a top-level import: `const { Content, headings } = await render(entry);` — not `entry.render()`.

---

## Dynamic routes

`src/pages/journal/[...slug].astro`:

```astro
---
import { getCollection, render } from 'astro:content';
import Base from '../../layouts/Base.astro';
import { Image } from 'astro:assets';

export async function getStaticPaths() {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  return posts.map((post) => ({ params: { slug: post.id }, props: { post } }));
}

const { post } = Astro.props;
const { Content } = await render(post);

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BlogPosting',
  headline: post.data.title,
  description: post.data.description,
  datePublished: post.data.publishedAt.toISOString(),
  dateModified: (post.data.updatedAt ?? post.data.publishedAt).toISOString(),
  author: { '@type': 'Organization', name: post.data.author },
  image: new URL(post.data.cover.src, Astro.site).href,
  mainEntityOfPage: new URL(Astro.url.pathname, Astro.site).href,
};
---
<Base title={post.data.title} description={post.data.description} jsonLd={jsonLd}>
  <article class="mx-auto max-w-3xl px-[--spacing-gutter] py-[--spacing-section]">
    <h1 class="text-[length:--text-h2] font-[--font-display] text-balance">{post.data.title}</h1>
    <time datetime={post.data.publishedAt.toISOString()} class="mt-4 block text-sm text-[--color-ink-muted]">
      {post.data.publishedAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
    </time>
    <Image src={post.data.cover} alt={post.data.coverAlt} widths={[640, 960, 1280]}
           sizes="(min-width: 768px) 48rem, 100vw" loading="eager" fetchpriority="high"
           class="mt-8 aspect-[16/9] w-full rounded-sm object-cover" />
    <div class="prose-custom mt-10"><Content /></div>
  </article>
</Base>
```

The cover image on a post page is the LCP element — it gets `eager` + `fetchpriority="high"`, and it is the only one on the page that does.

---

## Long-form typography

Do not install `@tailwindcss/typography` for a handful of elements — it ships rules for tags the site will never use. Style the prose block against the tokens:

```css
@layer components {
  .prose-custom {
    font-size: var(--text-body);
    line-height: 1.7;
    color: var(--color-ink-muted);
  }
  .prose-custom > * + * { margin-block-start: 1.25em; }
  .prose-custom h2 {
    margin-block-start: 2em;
    font-family: var(--font-display);
    font-size: 1.75rem;
    line-height: 1.2;
    color: var(--color-ink);
  }
  .prose-custom a {
    color: var(--color-ink);
    text-decoration-line: underline;
    text-underline-offset: 3px;
    text-decoration-color: var(--color-accent);
  }
  .prose-custom img { border-radius: 0.125rem; }
  .prose-custom blockquote {
    border-inline-start: 2px solid var(--color-accent);
    padding-inline-start: 1.25rem;
    font-style: italic;
    color: var(--color-ink);
  }
}
```

Check the link colour and the muted body colour against the surface in the contrast table before shipping. Muted prose text on a tinted background is the single most common accessibility failure on a blog.

---

## RSS

`src/pages/rss.xml.ts`:

```ts
import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  return rss({
    title: 'Eventrra Journal',
    description: 'Notes on planning, design and production.',
    site: context.site!,
    items: posts
      .sort((a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime())
      .map((post) => ({
        title: post.data.title,
        description: post.data.description,
        pubDate: post.data.publishedAt,
        link: `/journal/${post.id}/`,
      })),
  });
}
```

Link it from `Base.astro`'s head so feed readers and crawlers find it.

---

## Category filtering without JavaScript

Prefer real routes over a client-side filter. `/journal/category/weddings/` is crawlable, linkable, indexable, and free:

```astro
---
export async function getStaticPaths() {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  const categories = [...new Set(posts.map((p) => p.data.category))];
  return categories.map((category) => ({
    params: { category },
    props: { posts: posts.filter((p) => p.data.category === category), category },
  }));
}
---
```

The design's category tabs then become `<a>` links with `aria-current="page"` on the active one. This is strictly better than a JS filter: more indexed pages, zero bytes, shareable URLs. Only use a client-side filter when the design genuinely needs instant multi-facet filtering — and say so when you choose it.

---

## Pagination

`paginate()` on a `getStaticPaths` route gives `/journal/`, `/journal/2/` with `page.url.prev` / `page.url.next`. Use it instead of a "load more" button — a load-more button hides content from crawlers and needs JavaScript to reveal it. If the design shows a "Load more" control, implement it as the paginated next-page link styled to match, and note the substitution in the handoff.
