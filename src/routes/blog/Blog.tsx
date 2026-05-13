import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Helmet } from "react-helmet-async";
import { Calendar, Tag } from "lucide-react";
import { BLOG_TAGS, filterByTag } from "@/data/blogPosts";
import type { BlogTag } from "@/data/blogPosts";

const VALID_TAGS = new Set<string>(BLOG_TAGS.map((t) => t.value));

function TagButton({
    label,
    isActive,
    onClick,
}: {
    label: string;
    isActive: boolean;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                    ? "bg-primary text-white"
                    : "bg-white/5 text-text-muted hover:bg-white/10 hover:text-text-primary"
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
        <div className="route-container gap-8 py-8 sm:py-12">
            <Helmet>
                <title>Blog | Govex</title>
            </Helmet>

            <div className="max-w-4xl mx-auto w-full">
                <div className="mb-8">
                    <h1 className="text-3xl sm:text-4xl font-bold">Blog</h1>
                    <p className="text-text-muted mt-2">Updates, ideas, and deep dives from Govex.</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-8">
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
                    <div className="text-center py-16 text-text-muted">
                        <p className="text-lg">No posts yet.</p>
                        <p className="text-sm mt-1">Check back soon.</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {filtered.map((post) => (
                            <Link
                                key={post.slug}
                                to={`/blog/${post.slug}`}
                                className="group bg-card rounded-xl p-5 sm:p-6 border border-white/5 hover:border-primary/20 transition-all"
                            >
                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                    {post.tags.map((tag) => (
                                        <span
                                            key={tag}
                                            className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-text-muted"
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                    <span className="text-xs text-text-disabled flex items-center gap-1 ml-auto">
                                        <Calendar className="w-3 h-3" />
                                        {new Date(post.date).toLocaleDateString("en-US", {
                                            month: "short",
                                            day: "numeric",
                                            year: "numeric",
                                        })}
                                    </span>
                                </div>
                                <h2 className="text-lg sm:text-xl font-semibold group-hover:text-primary transition-colors">
                                    {post.title}
                                </h2>
                                <p className="text-text-muted text-sm mt-1 line-clamp-2">{post.description}</p>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
