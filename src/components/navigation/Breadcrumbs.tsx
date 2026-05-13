import { Link } from "react-router";
import { ChevronRight } from "lucide-react";

export interface BreadcrumbItem {
    label: string;
    href?: string;
}

interface BreadcrumbsProps {
    items: BreadcrumbItem[];
}

export function Breadcrumbs(props: BreadcrumbsProps) {
    const { items } = props;

    return (
        <nav className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
            {items.map((item, index) => {
                const isLast = index === items.length - 1;

                return (
                    <div key={index} className="flex items-center gap-1.5 sm:gap-2">
                        {item.href && !isLast ? (
                            <Link to={item.href} className="text-text-muted hover:text-text-primary transition-colors">
                                {item.label}
                            </Link>
                        ) : (
                            <span className={isLast ? "text-text-primary font-medium" : "text-text-muted"}>
                                {item.label}
                            </span>
                        )}
                        {!isLast && <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 text-text-muted shrink-0" />}
                    </div>
                );
            })}
        </nav>
    );
}
