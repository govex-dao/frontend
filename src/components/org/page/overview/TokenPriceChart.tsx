export function TokenPriceChart() {
    return (
        <div className="h-full w-full flex items-center justify-center p-6 md:p-8">
            <div className="max-w-md space-y-3 text-center">
                <p className="text-sm font-semibold uppercase tracking-wide text-text-primary">
                    Token Price History Unavailable
                </p>
                <p className="text-sm text-text-secondary leading-relaxed">
                    The current token price shown on this page comes from the live spot pool. Historical proposal TWAP
                    data is not the same thing, so it is no longer shown here as token price history.
                </p>
                <p className="text-xs text-text-tertiary">
                    Proposal TWAP history is still available on individual proposal market pages.
                </p>
            </div>
        </div>
    );
}
