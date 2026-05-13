export interface TimeRemaining {
    days: number;
    hours: number;
    minutes: number;
    totalMs: number;
}

export function getTimeRemaining(targetDate: Date, fromDate?: Date): TimeRemaining {
    fromDate = fromDate || new Date();
    const totalMs = targetDate.getTime() - fromDate.getTime();
    const days = Math.floor(totalMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor(totalMs / (1000 * 60 * 60));
    const minutes = Math.floor(totalMs / (1000 * 60));

    return {
        days,
        hours,
        minutes,
        totalMs,
    };
}

export function getTotalTimeRemaining(targetDate: Date, fromDate?: Date): TimeRemaining {
    fromDate = fromDate || new Date();
    const totalMs = targetDate.getTime() - fromDate.getTime();
    const days = Math.floor(totalMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((totalMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));

    return {
        days,
        hours,
        minutes,
        totalMs,
    };
}

export function formatTimeRemaining(timeRemaining: TimeRemaining): string {
    const { days, hours, minutes } = timeRemaining;

    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    return "<1m";
}

export function formatTimeUntil(timeRemaining: TimeRemaining): string {
    if (timeRemaining.totalMs <= 0) return "<1m";

    const { days, hours, minutes } = timeRemaining;

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours % 24 > 0) parts.push(`${hours % 24}h`);
    if (parts.length === 0 || (parts.length === 1 && days === 0)) {
        parts.push(`${minutes % 60}m`);
    }

    return parts.join(" ");
}

export function formatDateTime(date: Date) {
    const dateStr = date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
    const timeStr = date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });
    return `${dateStr}, ${timeStr}`;
}
