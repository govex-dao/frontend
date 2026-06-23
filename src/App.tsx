import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, Navigate, Outlet, useLocation, useParams } from "react-router";
import { Toaster } from "react-hot-toast";

import { Navbar } from "./components/navigation/navbar";
import { SiteFooter } from "./components/navigation/Footer";
import { ErrorBoundary } from "./components/ErrorBoundary";

const Home = lazy(() => import("./routes/Home").then(({ Home }) => ({ default: Home })));
const CreateOrg = lazy(() => import("./routes/org/Create").then(({ CreateOrg }) => ({ default: CreateOrg })));
const Org = lazy(() => import("./routes/org/Org").then(({ Org }) => ({ default: Org })));
const Orgs = lazy(() => import("./routes/org/Orgs").then(({ Orgs }) => ({ default: Orgs })));
const Proposal = lazy(() => import("./routes/proposal/Proposal").then(({ Proposal }) => ({ default: Proposal })));
const Proposals = lazy(() => import("./routes/proposal/Proposals").then(({ Proposals }) => ({ default: Proposals })));
const Raise = lazy(() => import("./routes/raise/Raise").then(({ Raise }) => ({ default: Raise })));
const Raises = lazy(() => import("./routes/raise/Raises").then(({ Raises }) => ({ default: Raises })));
const Multisigs = lazy(() => import("./routes/multisig/Multisigs").then(({ Multisigs }) => ({ default: Multisigs })));
const Multisig = lazy(() => import("./routes/multisig/Multisig").then(({ Multisig }) => ({ default: Multisig })));
const Docs = lazy(() => import("./routes/docs/Docs").then(({ Docs }) => ({ default: Docs })));
const NotFoundPage = lazy(() => import("./routes/NotFound").then(({ NotFoundPage }) => ({ default: NotFoundPage })));

function RouteLoading() {
    return (
        <div className="route-container flex min-h-[50vh] items-center justify-center text-text-tertiary">
            Loading...
        </div>
    );
}

function RouteErrorBoundary({ children }: { children: ReactNode }) {
    const location = useLocation();
    return <ErrorBoundary resetKey={location.pathname}>{children}</ErrorBoundary>;
}

function wrap(element: ReactNode) {
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
                        <Suspense fallback={<RouteLoading />}>
                            <Outlet />
                        </Suspense>
                        <SiteFooter />
                    </div>
                ) : isDocs ? (
                    <div className="h-full overflow-y-auto flex-1">
                        <Navbar heroContent={<DocsNavbarHero />} />
                        <Suspense fallback={<RouteLoading />}>
                            <Outlet />
                        </Suspense>
                        <SiteFooter />
                    </div>
                ) : (
                    <div className="h-full overflow-y-auto flex-1">
                        <Navbar />
                        <Suspense fallback={<RouteLoading />}>
                            <Outlet />
                        </Suspense>
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
