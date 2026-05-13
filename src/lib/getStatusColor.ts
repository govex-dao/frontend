export const getStatusColor = (status: string) => {
    switch (status) {
        case "passed":
            return "bg-green-500/10 text-green-400 border-green-500/20";
        case "failed":
            return "bg-red-500/10 text-red-400 border-red-500/20";
        case "active":
            return "bg-primary/10 text-primary-light border-primary/20";
        default:
            return "bg-white/5 text-text-muted border-white/10";
    }
};
