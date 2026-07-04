import { Link, useParams } from "react-router";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, Calendar } from "lucide-react";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { formatBlogDate, getBlogPost, getBlogTagLabel } from "@/data/blogPosts";

export function BlogPost() {
    const { slug } = useParams<{ slug: string }>();
    const post = slug ? getBlogPost(slug) : undefined;

    if (!post) {
        return (
            <div className="route-container py-16 text-center">
                <Helmet>
                    <title>Post Not Found | Govex</title>
                </Helmet>
                <h1 className="text-2xl font-bold mb-4">Post not found</h1>
                <Link to="/blog" className="text-primary hover:text-primary-light transition-colors">
                    Back to blog
                </Link>
            </div>
        );
    }

    return (
        <div className="route-container gap-6 py-6 sm:py-8">
            <Helmet>
                <title>{post.title} | Govex Blog</title>
                <meta name="description" content={post.description} />
            </Helmet>

            <article className="mx-auto w-full max-w-3xl">
                <Link
                    to="/blog"
                    className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-primary"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to blog
                </Link>

                <div className="rounded-lg border border-border-light bg-card/30">
                    <header className="border-b border-border-light p-5 sm:p-6">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                            {post.tags.map((tag) => (
                                <Link
                                    key={tag}
                                    to={`/blog?tag=${tag}`}
                                    className="rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs text-primary transition-colors hover:bg-primary/15"
                                >
                                    {getBlogTagLabel(tag)}
                                </Link>
                            ))}
                            <span className="ml-auto flex items-center gap-1 text-xs text-text-disabled">
                                <Calendar className="w-3 h-3" />
                                {formatBlogDate(post.date, {
                                    month: "long",
                                    day: "numeric",
                                    year: "numeric",
                                })}
                            </span>
                        </div>
                        <h1 className="text-2xl font-semibold leading-tight sm:text-3xl md:text-4xl">{post.title}</h1>
                        <p className="mt-3 text-base text-text-muted sm:text-lg">{post.description}</p>
                    </header>

                    {post.image && (
                        <div className="border-b border-border-light p-3 sm:p-4">
                            <img
                                src={post.image.src}
                                alt={post.image.alt}
                                className="aspect-[16/9] w-full rounded-md border border-border-subtle object-cover"
                            />
                        </div>
                    )}

                    <div className="p-5 sm:p-6">
                        <MarkdownRenderer content={post.content} variant="article" />
                    </div>
                </div>
            </article>
        </div>
    );
}
