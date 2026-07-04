import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Helmet } from "react-helmet-async";
import { Calendar, Tag } from "lucide-react";
import { BLOG_TAGS, filterByTag, formatBlogDate, getBlogTagLabel } from "@/data/blogPosts";
import type { BlogTag } from "@/data/blogPosts";

const VALID_TAGS = new Set<string>(BLOG_TAGS.map((t) => t.value));

function TagButton({ label, isActive, onClick }: { label: string; isActive: boolean; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border-light bg-card/40 text-text-muted hover:bg-white/5 hover:text-text-primary"
            }`}
        >
            {label}
        </button>
    );
}

export function Blog() {
    const [searchParams, setSearchParams] = useSearchParams();
    const tagParam = searchParams.get("tag");
    const initialTag = tagParam && VALID_TAGS.has(tagParam) ? (tagParam as BlogTag) : null;
    const [activeTag, setActiveTag] = useState<BlogTag | null>(initialTag);
    const filtered = filterByTag(activeTag);

    useEffect(() => {
        const nextTag = searchParams.get("tag");
        setActiveTag(nextTag && VALID_TAGS.has(nextTag) ? (nextTag as BlogTag) : null);
    }, [searchParams]);

    return (
        <div className="route-container gap-6 py-6 sm:py-8">
            <Helmet>
                <title>Blog | Govex</title>
            </Helmet>

            <div className="mx-auto w-full max-w-5xl">
                <div className="mb-6 border-b border-border-light pb-5">
                    <h1 className="text-3xl font-semibold">Blog</h1>
                    <p className="mt-2 max-w-2xl text-sm text-text-muted">Updates, ideas, and deep dives from Govex.</p>
                </div>

                <div className="mb-6 flex flex-wrap items-center gap-2">
                    <Tag className="w-4 h-4 text-text-muted" />
                    <TagButton
                        label="All"
                        isActive={activeTag === null}
                        onClick={() => {
                            setActiveTag(null);
                            setSearchParams({});
                        }}
                    />
                    {BLOG_TAGS.map((tag) => (
                        <TagButton
                            key={tag.value}
                            label={tag.label}
                            isActive={activeTag === tag.value}
                            onClick={() => {
                                const next = activeTag === tag.value ? null : tag.value;
                                setActiveTag(next);
                                setSearchParams(next ? { tag: next } : {});
                            }}
                        />
                    ))}
                </div>

                {filtered.length === 0 ? (
                    <div className="rounded-lg border border-border-light bg-card/30 py-16 text-center text-text-muted">
                        <p className="text-lg">No posts yet.</p>
                        <p className="text-sm mt-1">Check back soon.</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {filtered.map((post) => (
                            <Link
                                key={post.slug}
                                to={`/blog/${post.slug}`}
                                className="group rounded-lg border border-border-light bg-card/30 p-4 transition-colors hover:border-primary/25 hover:bg-card/50 sm:p-5"
                            >
                                <div
                                    className={
                                        post.image
                                            ? "grid gap-4 sm:grid-cols-[184px_minmax(0,1fr)] sm:items-stretch"
                                            : ""
                                    }
                                >
                                    {post.image && (
                                        <div className="overflow-hidden rounded-md border border-border-subtle bg-black/20">
                                            <img
                                                src={post.image.src}
                                                alt={post.image.alt}
                                                className="aspect-[16/10] h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                                                loading="lazy"
                                            />
                                        </div>
                                    )}

                                    <div className="min-w-0">
                                        <div className="mb-3 flex flex-wrap items-center gap-2">
                                            {post.tags.map((tag) => (
                                                <span
                                                    key={tag}
                                                    className="rounded-md border border-border-subtle bg-white/5 px-2 py-0.5 text-xs text-text-muted"
                                                >
                                                    {getBlogTagLabel(tag)}
                                                </span>
                                            ))}
                                            <span className="flex items-center gap-1 text-xs text-text-disabled sm:ml-auto">
                                                <Calendar className="w-3 h-3" />
                                                {formatBlogDate(post.date, {
                                                    month: "short",
                                                    day: "numeric",
                                                    year: "numeric",
                                                })}
                                            </span>
                                        </div>
                                        <h2 className="text-lg font-semibold transition-colors group-hover:text-primary sm:text-xl">
                                            {post.title}
                                        </h2>
                                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-text-muted">
                                            {post.description}
                                        </p>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
