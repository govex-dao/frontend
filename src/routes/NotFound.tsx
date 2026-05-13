import { Link } from "react-router";
import { Helmet } from "react-helmet-async";
import { Home, BookOpen, Building2, Shield, ArrowRight } from "lucide-react";

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
                                Go to Home
                            </Link>
                            <Link
                                to="/orgs"
                                className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-card-elevated border border-border-light hover:bg-card-more-elevated hover:border-primary/30 transition-all w-full sm:flex-1 font-medium"
                            >
                                <Building2 className="w-4 h-4" />
                                Browse Orgs
                            </Link>
                        </div>

                        <div className="border-t border-border" />

                        {/* Quick Links Grid */}
                        <div>
                            <p className="text-sm font-medium text-text-muted mb-4">Explore the platform:</p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <Link
                                    to="/multisig"
                                    className="group flex items-center gap-3 p-4 bg-card-elevated hover:bg-card-more-elevated border border-border-light hover:border-primary/30 rounded-lg transition-all"
                                >
                                    <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                                        <Shield className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-semibold text-text-primary">Multisig</div>
                                        <div className="text-xs text-text-muted">Manage approvals</div>
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                                </Link>

                                <Link
                                    to="/orgs"
                                    className="group flex items-center gap-3 p-4 bg-card-elevated hover:bg-card-more-elevated border border-border-light hover:border-primary/30 rounded-lg transition-all"
                                >
                                    <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                                        <Building2 className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-semibold text-text-primary">Orgs</div>
                                        <div className="text-xs text-text-muted">Explore Orgs</div>
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                                </Link>

                                <Link
                                    to="/docs"
                                    className="group flex items-center gap-3 p-4 bg-card-elevated hover:bg-card-more-elevated border border-border-light hover:border-primary/30 rounded-lg transition-all"
                                >
                                    <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                                        <BookOpen className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-semibold text-text-primary">Docs</div>
                                        <div className="text-xs text-text-muted">Read documentation</div>
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
