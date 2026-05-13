export const getDaysRemaining = (endDate: Date) => {
    const now = new Date();
    const diff = endDate.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
};

export const getTimeRemainingLabel = (endDate: Date) => {
    const now = new Date();
    const diff = endDate.getTime() - now.getTime();
    if (diff <= 0) return "Ended";

    const totalMinutes = Math.floor(diff / (1000 * 60));
    const totalHours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days >= 2) return `${days} days left`;
    if (days === 1) {
        const remainingHours = totalHours - 24;
        return remainingHours > 0 ? `1 day ${remainingHours}h left` : "1 day left";
    }
    if (totalHours >= 1) {
        const remainingMinutes = totalMinutes - totalHours * 60;
        return remainingMinutes > 0 ? `${totalHours}h ${remainingMinutes}m left` : `${totalHours}h left`;
    }
    return `${totalMinutes}m left`;
};
