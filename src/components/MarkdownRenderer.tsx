import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

interface Props {
    content: string;
    className?: string;
}

export function MarkdownRenderer(props: Props) {
    const { content, className = "" } = props;

    // Validate that content is a string
    if (typeof content !== "string") {
        return (
            <div className="px-6 py-4 text-red-400">
                <p>Unable to display content. Invalid format.</p>
            </div>
        );
    }

    return (
        <div
            className={`prose prose-sm max-w-none
      prose-invert
      prose-headings:font-bold prose-headings:text-gray-100
      prose-h1:text-4xl prose-h1:my-4
      prose-h2:text-3xl prose-h2:my-4
      prose-h3:text-2xl prose-h3:my-3
      prose-h4:text-xl prose-h4:my-2
      prose-h5:text-lg prose-h5:my-2
      prose-h6:text-base prose-h6:my-2
      prose-p:my-2 prose-p:text-gray-300
      prose-ul:my-2 prose-ul:list-disc prose-ul:pl-6 prose-ul:text-gray-300
      prose-ol:my-2 prose-ol:list-decimal prose-ol:pl-6 prose-ol:text-gray-300
      prose-li:my-1
      prose-blockquote:border-l-4 prose-blockquote:border-gray-600 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-gray-400
      prose-code:bg-gray-800 prose-code:text-gray-300 prose-code:px-1 prose-code:py-0.5 prose-code:rounded
      prose-pre:bg-gray-900 prose-pre:p-4 prose-pre:rounded prose-pre:overflow-x-auto
      prose-table:border-collapse prose-table:w-full
      prose-th:border prose-th:border-gray-700 prose-th:px-4 prose-th:py-2 prose-th:bg-gray-800 prose-th:text-gray-200
      prose-td:border prose-td:border-gray-700 prose-td:px-4 prose-td:py-2 prose-td:text-gray-300
      prose-img:max-w-full prose-img:h-auto
      prose-a:text-blue-400 prose-a:underline hover:prose-a:text-blue-300
      prose-strong:text-gray-100
      prose-em:text-gray-200 ${className}`}
        >
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeSanitize]}
                components={{
                    h1: ({ children, ...props }) => (
                        <h1 {...props} className=" text-xl font-bold mb-3">
                            {children}
                        </h1>
                    ),
                    h2: ({ children, ...props }) => (
                        <h2 {...props} className=" text-lg font-bold mt-2 mb-1">
                            {children}
                        </h2>
                    ),
                    h3: ({ children, ...props }) => (
                        <h3 {...props} className=" text-base font-semibold mt-1">
                            {children}
                        </h3>
                    ),
                    code(props) {
                        const { className, children, ...rest } = props;
                        const match = /language-(\w+)/.exec(className || "");
                        const inline = !match;

                        if (!inline) {
                            return (
                                <pre className="bg-gray-900 p-4 rounded overflow-x-auto">
                                    <code className={`text-gray-300 ${className || ""}`} {...rest}>
                                        {String(children).replace(/\n$/, "")}
                                    </code>
                                </pre>
                            );
                        }

                        return (
                            <code className={className} {...rest}>
                                {children}
                            </code>
                        );
                    },
                    p: ({ children, ...props }) => {
                        return (
                            <p {...props} className="text-text-secondary text-xs">
                                {children}
                            </p>
                        );
                    },
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}
