import type { ReactNode } from "react";

interface TableProps {
    children: ReactNode;
}

export function Table({ children }: TableProps) {
    return (
        <div className="overflow-hidden border border-border rounded-lg">
            <div className="overflow-x-auto">
                <table className="w-full">{children}</table>
            </div>
        </div>
    );
}

interface TableHeadProps {
    children: ReactNode;
}

export function TableHead({ children }: TableHeadProps) {
    return <thead className="bg-card">{children}</thead>;
}

interface TableBodyProps {
    children: ReactNode;
}

export function TableBody({ children }: TableBodyProps) {
    return <tbody>{children}</tbody>;
}

interface TableRowProps {
    children: ReactNode;
    hover?: boolean;
}

export function TableRow({ children, hover = false }: TableRowProps) {
    return (
        <tr className={`border-b border-border/30 last:border-0 ${hover ? "hover:bg-card/50 transition-colors" : ""}`}>
            {children}
        </tr>
    );
}

interface TableHeaderCellProps {
    children: ReactNode;
    align?: "left" | "right" | "center";
}

export function TableHeaderCell({ children, align = "left" }: TableHeaderCellProps) {
    const alignClass = {
        left: "text-left",
        right: "text-right",
        center: "text-center",
    }[align];

    return (
        <th
            className={`${alignClass} py-3 px-4 text-xs font-medium text-text-light/70 tracking-wider whitespace-nowrap`}
        >
            {children}
        </th>
    );
}

interface TableCellProps {
    children: ReactNode;
    align?: "left" | "right" | "center";
    className?: string;
    colSpan?: number;
}

export function TableCell({ children, align = "left", className = "", colSpan }: TableCellProps) {
    const alignClass = {
        left: "text-left",
        right: "text-right",
        center: "text-center",
    }[align];

    return (
        <td colSpan={colSpan} className={`py-3 px-4 text-sm ${alignClass} ${className}`}>
            {children}
        </td>
    );
}
