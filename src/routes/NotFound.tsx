import { Link } from "react-router";
import { Helmet } from "react-helmet-async";
import { Home } from "lucide-react";

export function NotFoundPage() {
    return (
        <div className="route-container h-full flex items-center justify-center">
            <Helmet>
                <title>404 - Page Not Found | Govex</title>
            </Helmet>
            <div className="w-full max-w-4xl mx-auto">
                <div className="bg-card border border-border-light rounded-xl overflow-hidden shadow-lg">
                    {/* Header Section */}
                    <div className="relative bg-linear-to-br from-card-elevated to-card-more-elevated border-b border-border-light p-8 sm:p-12 overflow-hidden">
                        <div className="absolute inset-0 engineering-grid engineering-grid-fade pointer-events-none" />

                        <div className="relative text-center space-y-4">
                            {/* 404 Number */}
                            <div className="relative inline-block">
                                <h1 className="text-7xl sm:text-8xl md:text-9xl font-bold bg-linear-to-r from-text-primary via-primary to-primary-light bg-clip-text text-transparent opacity-30">
                                    404
                                </h1>
                            </div>

                            {/* Main message */}
                            <div className="space-y-2 pt-4">
                                <h2 className="text-2xl sm:text-3xl font-bold text-text-primary">Page Not Found</h2>
                                <p className="text-text-light text-base sm:text-lg max-w-lg mx-auto">
                                    This page doesn't exist in the market. The URL may be incorrect or the page may have
                                    been removed.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Content Section */}
                    <div className="p-6 sm:p-8 space-y-6">
                        {/* Primary Actions */}
                        <div className="flex flex-col sm:flex-row items-center gap-3">
                            <Link
                                to="/"
                                className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-primary hover:bg-primary-light text-white transition-all w-full sm:flex-1 font-medium shadow-[0_0_12px_rgba(59,130,246,0.3)] hover:shadow-[0_0_16px_rgba(59,130,246,0.5)]"
                            >
                                <Home className="w-4 h-4" />
                                Go Home
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
