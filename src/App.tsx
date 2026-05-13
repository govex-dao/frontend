import { createBrowserRouter, Navigate, Outlet, useLocation, useParams } from "react-router";
import { Toaster } from "react-hot-toast";

import { Navbar } from "./components/navigation/navbar";
import { SiteFooter } from "./components/navigation/Footer";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Home } from "./routes/Home";
import { CreateOrg } from "./routes/org/Create";
import { Org } from "./routes/org/Org";
import { Orgs } from "./routes/org/Orgs";
import { Proposal } from "./routes/proposal/Proposal";
import { Proposals } from "./routes/proposal/Proposals";
import { Raise } from "./routes/raise/Raise";
import { Raises } from "./routes/raise/Raises";
import { Multisigs } from "./routes/multisig/Multisigs";
import { Multisig } from "./routes/multisig/Multisig";
import { Docs } from "./routes/docs/Docs";
import { NotFoundPage } from "./routes/NotFound";

function RouteErrorBoundary({ children }: { children: React.ReactNode }) {
    const location = useLocation();
    return <ErrorBoundary resetKey={location.pathname}>{children}</ErrorBoundary>;
}

function wrap(element: React.ReactNode) {
    return <RouteErrorBoundary>{element}</RouteErrorBoundary>;
}

function DocAliasRedirect() {
    const { slug } = useParams();
    return <Navigate to={slug ? `/docs/${slug}` : "/docs"} replace />;
}

function DocsNavbarHero() {
    return (
        <div className="relative z-10 py-8 sm:py-10 md:py-12">
            <div className="w-full max-w-7xl mx-auto px-3 sm:px-0">
                <h1 className="bg-linear-to-r from-text-primary to-primary bg-clip-text text-transparent">
                    Govex Docs
                </h1>
                <p className="mt-3 text-base font-medium text-text-secondary">V3</p>
            </div>
        </div>
    );
}

function AppLayout() {
    const location = useLocation();
    const isHome = location.pathname === "/";
    const isDocs = location.pathname === "/docs" || location.pathname.startsWith("/docs/");

    return (
        <ErrorBoundary>
            <main className="flex flex-col h-full w-full">
                <Toaster
                    position="bottom-right"
                    toastOptions={{
                        duration: 3000,
                        style: {
                            background: "rgba(255, 255, 255, 0.05)",
                            backdropFilter: "blur(10px)",
                            color: "var(--text-primary)",
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                            borderRadius: "12px",
                        },
                        success: {
                            iconTheme: {
                                primary: "rgb(34, 197, 94)",
                                secondary: "white",
                            },
                        },
                    }}
                />
                {isHome ? (
                    <div className="h-full overflow-y-auto flex-1">
                        <Navbar homeHero />
                        <Outlet />
                        <SiteFooter />
                    </div>
                ) : isDocs ? (
                    <div className="h-full overflow-y-auto flex-1">
                        <Navbar heroContent={<DocsNavbarHero />} />
                        <Outlet />
                        <SiteFooter />
                    </div>
                ) : (
                    <div className="h-full overflow-y-auto flex-1">
                        <Navbar />
                        <Outlet />
                        <SiteFooter />
                    </div>
                )}
            </main>
        </ErrorBoundary>
    );
}

export const router = createBrowserRouter([
    {
        element: <AppLayout />,
        children: [
            { path: "/", element: wrap(<Home />) },
            { path: "/raises/:raiseId", element: wrap(<Raise />) },
            { path: "/raises", element: wrap(<Raises />) },
            { path: "/orgs/create", element: wrap(<CreateOrg />) },
            { path: "/orgs/:orgId", element: wrap(<Org />) },
            { path: "/orgs/:orgId/proposals/:proposalId", element: wrap(<Proposal />) },
            { path: "/orgs", element: wrap(<Orgs />) },
            { path: "/proposal/:id", element: wrap(<Proposal />) },
            { path: "/proposals/:proposalId", element: wrap(<Proposal />) },
            { path: "/proposals", element: wrap(<Proposals />) },
            { path: "/multisig", element: wrap(<Multisigs />) },
            { path: "/multisig/:accountId", element: wrap(<Multisig />) },
            { path: "/docs", element: wrap(<Docs />) },
            { path: "/docs/:slug", element: wrap(<Docs />) },
            { path: "/doc", element: wrap(<DocAliasRedirect />) },
            { path: "/doc/:slug", element: wrap(<DocAliasRedirect />) },
            { path: "*", element: <NotFoundPage /> },
        ],
    },
]);
