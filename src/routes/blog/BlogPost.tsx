import { Link, useParams } from "react-router";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, Calendar } from "lucide-react";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { getBlogPost } from "@/data/blogPosts";

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
        <div className="route-container gap-8 py-8 sm:py-12">
            <Helmet>
                <title>{post.title} | Govex Blog</title>
                <meta name="description" content={post.description} />
            </Helmet>

            <article className="max-w-3xl mx-auto w-full">
                <Link
                    to="/blog"
                    className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-primary transition-colors mb-6"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to blog
                </Link>

                <header className="mb-8">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                        {post.tags.map((tag) => (
                            <Link
                                key={tag}
                                to={`/blog?tag=${tag}`}
                                className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                            >
                                {tag}
                            </Link>
                        ))}
                        <span className="text-xs text-text-disabled flex items-center gap-1 ml-auto">
                            <Calendar className="w-3 h-3" />
                            {new Date(post.date).toLocaleDateString("en-US", {
                                month: "long",
                                day: "numeric",
                                year: "numeric",
                            })}
                        </span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold leading-tight">{post.title}</h1>
                    <p className="text-text-muted mt-3 text-base sm:text-lg">{post.description}</p>
                </header>

                <div className="border-t border-white/5 pt-8">
                    <MarkdownRenderer content={post.content} />
                </div>
            </article>
        </div>
    );
}
