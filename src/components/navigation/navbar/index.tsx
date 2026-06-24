import { useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { SuiWalletButton } from "@/components/sui/WalletButton";
import { Drawer } from "@/components/overlays/Drawer";
import { NavButton } from "./NavButton";

interface Props {
    className?: string;
    homeHero?: boolean;
    heroContent?: ReactNode;
}

const NAV_CHROME_CLASSES =
    "!h-12 !px-6 !py-0 !gap-2 !rounded-t-none !rounded-b-lg !bg-white/5 !border-x !border-b !border-t-0 !border-white/10 !backdrop-blur-sm !text-[15px] !font-medium !text-text-secondary hover:!bg-white/10 hover:!border-white/20 hover:!text-text-primary";

function HomeNavbarHero() {
    return (
        <div className="relative z-10 py-12 sm:py-16 md:py-20 flex flex-col items-center">
            <div className="text-center relative my-6 sm:my-8 px-4 flex flex-col items-center gap-7 sm:gap-9">
                <h1 className="bg-linear-to-r from-text-primary to-primary bg-clip-text text-transparent -mt-4 text-4xl sm:-mt-6 sm:text-5xl md:text-6xl">
                    Secure and manage Sui assets
                </h1>
            </div>
        </div>
    );
}

export function Navbar(props: Props) {
    const { className, homeHero = false, heroContent } = props;
    const navigate = useNavigate();
    const pathname = useLocation().pathname;
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const hasHeroSurface = homeHero || Boolean(heroContent);
    const showHomeHero = homeHero && !mobileMenuOpen;
    const showHeroContent = Boolean(heroContent) && !mobileMenuOpen;

    const handleNavigation = (path: string) => {
        navigate(path);
        setMobileMenuOpen(false);
    };

    return (
        <>
            <header
                className={`${hasHeroSurface ? "relative overflow-hidden" : "relative backdrop-blur-md"} z-50 route-container py-0 ${className}`}
            >
                {hasHeroSurface && (
                    <>
                        <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-primary/8 via-primary/4 to-transparent" />
                        <div className="pointer-events-none absolute inset-0 engineering-grid-horizontal-fade">
                            <div className="absolute inset-0 engineering-grid engineering-grid-curved-bottom-fade" />
                        </div>
                    </>
                )}
                <div className="flex items-center justify-between w-full relative z-10 px-3 sm:px-0">
                    {/* Left: Logo */}
                    <button
                        className="flex h-12 items-center gap-2 sm:gap-4 cursor-pointer"
                        onClick={() => navigate("/")}
                    >
                        <img src="/images/govex-logo.png" alt="Govex" className="w-7 h-7" />
                        <h3 className="text-xl md:text-2xl">Govex</h3>
                    </button>

                    {/* Center: Desktop Navigation - Hidden on mobile */}
                    <div className="hidden lg:flex items-center gap-4 absolute left-1/2 -translate-x-1/2 w">
                        <div
                            className={`flex items-center gap-4 py-3 px-6 h-12 bg-white/5 rounded-b-lg border-b border-x border-white/10 backdrop-blur-sm transition-all duration-300`}
                        >
                            <NavButton
                                label="Multisig"
                                isActive={pathname.startsWith("/multisig")}
                                onClick={() => navigate("/multisig")}
                            />
                            <NavButton
                                label="Docs"
                                isActive={pathname.startsWith("/docs") || pathname.startsWith("/doc")}
                                onClick={() => navigate("/docs")}
                            />
                        </div>
                    </div>

                    {/* Right: Wallet (desktop) + Hamburger (mobile) */}
                    <div className="flex h-12 items-center gap-3">
                        {/* Wallet button - Desktop only */}
                        <div className="hidden lg:block">
                            <SuiWalletButton buttonClassName={NAV_CHROME_CLASSES} />
                        </div>

                        {/* Hamburger Menu Button - Mobile only */}
                        <button
                            className="lg:hidden flex flex-col gap-1.5 w-6 h-6 justify-center"
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            aria-label="Toggle menu"
                        >
                            <span
                                className={`block h-0.5 rounded-full w-full bg-white transition-all duration-300 ${
                                    mobileMenuOpen ? "rotate-45 translate-y-2" : ""
                                }`}
                            />
                            <span
                                className={`block h-0.5 rounded-full w-full bg-white transition-all duration-300 ${
                                    mobileMenuOpen ? "opacity-0" : ""
                                }`}
                            />
                            <span
                                className={`block h-0.5 rounded-full w-full bg-white transition-all duration-300 ${
                                    mobileMenuOpen ? "-rotate-45 -translate-y-2" : ""
                                }`}
                            />
                        </button>
                    </div>
                </div>
                {showHomeHero && <HomeNavbarHero />}
                {showHeroContent && heroContent}
            </header>

            {/* Mobile Menu */}
            <Drawer
                isOpen={mobileMenuOpen}
                onClose={() => setMobileMenuOpen(false)}
                className="lg:hidden"
                underHeader
                zIndexAboveHeader={false}
            >
                <MobileMenuContent handleNavigation={handleNavigation} pathname={pathname} />
            </Drawer>
        </>
    );
}

function MobileMenuContent({
    handleNavigation,
    pathname,
}: {
    handleNavigation: (path: string) => void;
    pathname: string;
}) {
    return (
        <div className="flex flex-col h-full">
            <nav className="flex flex-col p-3 gap-4 flex-1 w-full overflow-y-auto">
                <button
                    className={`px-4 py-3 rounded-lg transition-colors w-full text-left ${
                        pathname.startsWith("/multisig")
                            ? "bg-white/10 text-white"
                            : "text-white/70 hover:text-white hover:bg-white/5"
                    }`}
                    onClick={() => handleNavigation("/multisig")}
                >
                    Multisig
                </button>

                <button
                    className={`px-4 py-3 rounded-lg transition-colors w-full text-left ${
                        pathname.startsWith("/docs") || pathname.startsWith("/doc")
                            ? "bg-white/10 text-white"
                            : "text-white/70 hover:text-white hover:bg-white/5"
                    }`}
                    onClick={() => handleNavigation("/docs")}
                >
                    Docs
                </button>
            </nav>

            {/* Wallet button - sticky at bottom */}
            <div className="px-4 py-2 flex justify-center w-full">
                <SuiWalletButton />
            </div>
        </div>
    );
}
