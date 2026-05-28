import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectInput } from "@/components/ui/select-input";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";

export function ContentTabs() {
  const links = [
    ["/admin/content", "Overview"],
    ["/admin/content/pages", "Pages"],
    ["/admin/content/help", "Help articles"],
    ["/admin/content/faqs", "FAQs"],
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {links.map(([href, label]) => (
        <Button key={href} asChild variant="secondary"><Link href={href}>{label}</Link></Button>
      ))}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={status === "published" ? "success" : status === "archived" ? "neutral" : "warning"}>{status}</Badge>;
}

export function CmsPageForm({ action, page }: { action: (formData: FormData) => void | Promise<void>; page?: Record<string, unknown> }) {
  return (
    <Card>
      <form action={action} className="grid gap-4 md:grid-cols-2">
        {page?.id ? <input type="hidden" name="id" value={String(page.id)} /> : null}
        <TextInput label="Title" name="title" defaultValue={String(page?.title ?? "")} required />
        <TextInput label="Slug" name="slug" defaultValue={String(page?.slug ?? "")} required />
        <SelectInput label="Status" name="status" defaultValue={String(page?.status ?? "draft")} options={statusOptions} />
        <SelectInput label="Audience" name="audience" defaultValue={String(page?.audience ?? "all_users")} options={audienceOptions} />
        <TextInput label="Country" name="countryCode" defaultValue={String(page?.countryCode ?? "")} maxLength={2} />
        <TextInput label="Sort order" name="sortOrder" type="number" defaultValue={String(page?.sortOrder ?? 100)} />
        <TextInput label="Meta title" name="metaTitle" defaultValue={String(page?.metaTitle ?? "")} />
        <TextInput label="Meta description" name="metaDescription" defaultValue={String(page?.metaDescription ?? "")} />
        <div className="md:col-span-2"><TextArea label="Excerpt" name="excerpt" defaultValue={String(page?.excerpt ?? "")} /></div>
        <div className="md:col-span-2"><TextArea label="Markdown content" name="contentMarkdown" defaultValue={String(page?.contentMarkdown ?? "")} rows={14} required /></div>
        <div className="md:col-span-2"><Button type="submit">Save page</Button></div>
      </form>
    </Card>
  );
}

export function HelpArticleForm({ action, article }: { action: (formData: FormData) => void | Promise<void>; article?: Record<string, unknown> }) {
  return (
    <Card>
      <form action={action} className="grid gap-4 md:grid-cols-2">
        {article?.id ? <input type="hidden" name="id" value={String(article.id)} /> : null}
        <TextInput label="Title" name="title" defaultValue={String(article?.title ?? "")} required />
        <TextInput label="Slug" name="slug" defaultValue={String(article?.slug ?? "")} required />
        <TextInput label="Category" name="category" defaultValue={String(article?.category ?? "")} placeholder="households" required />
        <SelectInput label="Article type" name="articleType" defaultValue={String(article?.articleType ?? "help_article")} options={articleTypeOptions} />
        <SelectInput label="Status" name="status" defaultValue={String(article?.status ?? "draft")} options={statusOptions} />
        <SelectInput label="Audience" name="audience" defaultValue={String(article?.audience ?? "all_users")} options={audienceOptions} />
        <TextInput label="Country" name="countryCode" defaultValue={String(article?.countryCode ?? "")} maxLength={2} />
        <TextInput label="Sort order" name="sortOrder" type="number" defaultValue={String(article?.sortOrder ?? 100)} />
        <div className="md:col-span-2"><TextArea label="Excerpt" name="excerpt" defaultValue={String(article?.excerpt ?? "")} /></div>
        <div className="md:col-span-2"><TextArea label="Markdown content" name="contentMarkdown" defaultValue={String(article?.contentMarkdown ?? "")} rows={14} required /></div>
        <div className="md:col-span-2"><Button type="submit">Save article</Button></div>
      </form>
    </Card>
  );
}

export function FaqItemForm({ action, faq }: { action: (formData: FormData) => void | Promise<void>; faq?: Record<string, unknown> }) {
  return (
    <Card>
      <form action={action} className="grid gap-4 md:grid-cols-2">
        {faq?.id ? <input type="hidden" name="id" value={String(faq.id)} /> : null}
        <TextInput label="Question" name="question" defaultValue={String(faq?.question ?? "")} required />
        <TextInput label="Category" name="category" defaultValue={String(faq?.category ?? "")} />
        <SelectInput label="Status" name="status" defaultValue={String(faq?.status ?? "draft")} options={statusOptions} />
        <SelectInput label="Audience" name="audience" defaultValue={String(faq?.audience ?? "all_users")} options={audienceOptions} />
        <TextInput label="Country" name="countryCode" defaultValue={String(faq?.countryCode ?? "")} maxLength={2} />
        <TextInput label="Sort order" name="sortOrder" type="number" defaultValue={String(faq?.sortOrder ?? 100)} />
        <div className="md:col-span-2"><TextArea label="Answer markdown" name="answerMarkdown" defaultValue={String(faq?.answerMarkdown ?? "")} rows={10} required /></div>
        <div className="md:col-span-2"><Button type="submit">Save FAQ</Button></div>
      </form>
    </Card>
  );
}

const statusOptions = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

const audienceOptions = [
  { value: "all_users", label: "All users" },
  { value: "households", label: "Households" },
  { value: "chefs", label: "Chefs" },
  { value: "home_catering", label: "Home catering" },
  { value: "restaurants", label: "Restaurants" },
  { value: "sellers", label: "Sellers" },
  { value: "admins", label: "Admins" },
];

const articleTypeOptions = [
  { value: "help_article", label: "Help article" },
  { value: "onboarding_guide", label: "Onboarding guide" },
  { value: "seller_guide", label: "Seller guide" },
  { value: "food_safety_guide", label: "Food safety guide" },
  { value: "support_documentation", label: "Support documentation" },
];
