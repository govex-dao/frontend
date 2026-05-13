export type SortDirection = "ascending" | "descending";

export interface SortConfig<T extends string> {
    field: T;
    direction: SortDirection;
}

interface SortableHeaderCellProps<T extends string> {
    field?: T;
    label: string;
    sortConfig?: SortConfig<T>;
    onSort?: (field: T) => void;
    align?: "left" | "right" | "center";
    sortable?: boolean;
}

export function SortableHeaderCell<T extends string>({
    field,
    label,
    sortConfig,
    onSort,
    align = "left",
    sortable = true,
}: SortableHeaderCellProps<T>) {
    const isActive = sortable && field && sortConfig?.field === field;
    const alignClass = align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start";

    const handleClick = () => {
        if (sortable && field && onSort) {
            onSort(field);
        }
    };

    return (
        <th
            className={`bg-card-elevated border-b border-border-light px-4 py-3 text-xs tracking-wider ${isActive ? "text-text-primary" : "text-text-tertiary"} transition-colors select-none ${
                sortable ? "cursor-pointer hover:text-text-primary" : ""
            } ${align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"}`}
            onClick={handleClick}
        >
            <div className={`flex items-center gap-1.5 ${alignClass}`}>
                <span>{label}</span>
                {sortable && (
                    <span
                        className={`text-[10px] transition-all ${isActive ? "text-text-primary" : "text-text-muted"}`}
                    >
                        {isActive && sortConfig?.direction === "ascending" ? "↑" : "↓"}
                    </span>
                )}
            </div>
        </th>
    );
}

interface SortableTableHeaderProps<T extends string> {
    columns: Array<{
        field?: T;
        label: string;
        align?: "left" | "right" | "center";
        sortable?: boolean;
    }>;
    sortConfig: SortConfig<T>;
    onSort: (field: T) => void;
}

export function SortableTableHeader<T extends string>({ columns, sortConfig, onSort }: SortableTableHeaderProps<T>) {
    return (
        <thead>
            <tr>
                {columns.map((column, index) => (
                    <SortableHeaderCell
                        key={column.field || index}
                        field={column.field}
                        label={column.label}
                        sortConfig={sortConfig}
                        onSort={onSort}
                        align={column.align}
                        sortable={column.sortable !== false}
                    />
                ))}
            </tr>
        </thead>
    );
}
