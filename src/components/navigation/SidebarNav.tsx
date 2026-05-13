import { type ReactNode } from "react";
import { Search } from "lucide-react";
import { Input } from "../inputs/Input";

export interface SidebarNavItem {
    id: string;
    label: string;
    icon?: ReactNode;
}

interface Props {
    items: SidebarNavItem[];
    activeItem: string;
    onItemClick: (id: string) => void;
    searchable?: boolean;
    searchQuery?: string;
    onSearchChange?: (query: string) => void;
    searchPlaceholder?: string;
    emptyMessage?: string;
    className?: string;
}

export function SidebarNav(props: Props) {
    const {
        items,
        activeItem,
        onItemClick,
        searchable = false,
        searchQuery = "",
        onSearchChange,
        searchPlaceholder = "Search",
        emptyMessage = "No results found",
        className = "",
    } = props;

    return (
        <div className={`min-w-48 w-full bg-card-elevated p-4 space-y-1 overflow-y-auto h-full shrink-0 ${className}`}>
            {searchable && (
                <Input
                    value={searchQuery}
                    onChange={(value) => onSearchChange?.(value)}
                    placeholder={searchPlaceholder}
                    className="w-full mb-4"
                    leftIcon={<Search className="w-4 h-4 text-text-muted/40" />}
                />
            )}

            {items.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-text-muted">
                    {emptyMessage}
                    {searchQuery && ` for "${searchQuery}"`}
                </div>
            ) : (
                items.map((item) => {
                    const activeClasses = "bg-card-more-elevated text-text-primary";
                    const inactiveClasses =
                        "text-text-tertiary hover:bg-card-more-elevated/50 hover:text-text-secondary";

                    return (
                        <button
                            key={item.id}
                            onClick={() => onItemClick(item.id)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors text-left ${
                                activeItem === item.id ? activeClasses : inactiveClasses
                            }`}
                        >
                            {item.icon}
                            <span className="text-sm font-medium">{item.label}</span>
                        </button>
                    );
                })
            )}
        </div>
    );
}
