import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { useDAOMap } from "@/hooks/api";
import { getRaiseName } from "@/types/Raise";
import { useActiveProposals } from "./ProposalsDropdown";
import { useActiveFundraises } from "./RaiseDropdown";
import { LiveChip } from "../../badges/LiveChip";

export function LiveDropdown() {
    const navigate = useNavigate();
    const location = useLocation();
    const [isOpen, setIsOpen] = useState(false);

    // Close dropdown when location changes (e.g., clicking nav items)
    useEffect(() => {
        setIsOpen(false);
    }, [location.pathname]);

    const { data: activeProposals } = useActiveProposals();
    const { data: activeFundraises } = useActiveFundraises();
    const { data: daoMap } = useDAOMap();

    const totalCount = activeProposals.length + activeFundraises.length;

    if (totalCount === 0) return null;

    const handleNavigate = (path: string) => {
        setIsOpen(false);
        navigate(path);
    };

    return (
        <>
            <button onClick={() => setIsOpen(!isOpen)}>
                <LiveChip nb={totalCount} label="Live" size="small" animated />
            </button>

            {/* Combined Dropdown */}
            {createPortal(
                <AnimatePresence>
                    {isOpen && (
                        <>
                            {/* Backdrop to close on click outside */}
                            <motion.div
                                className="fixed inset-0 z-30"
                                onClick={() => setIsOpen(false)}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                            />
                            <motion.div
                                className="fixed left-0 right-0 top-0 z-40 pt-12 sm:pt-16 bg-card/80 backdrop-blur-2xl border-b border-white/10 shadow-2xl"
                                initial={{ y: "-100%" }}
                                animate={{ y: 0 }}
                                exit={{ y: "-100%" }}
                                transition={{ duration: 0.3, ease: "easeInOut" }}
                            >
                                <div className="route-container py-8">
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mx-auto">
                                        {/* Raises Section - Hidden when empty */}
                                        {activeFundraises.length > 0 && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -5 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ duration: 0.2, delay: 0.05 }}
                                            >
                                                <div className="flex items-center justify-between mb-4">
                                                    <LiveChip
                                                        nb={activeFundraises.length}
                                                        label="Live Raises"
                                                        animated
                                                    />
                                                    <button
                                                        onClick={() => handleNavigate("/raises")}
                                                        className="text-xs text-primary hover:text-primary-light transition-colors font-medium"
                                                    >
                                                        View all →
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    {activeFundraises.map((raise) => (
                                                        <button
                                                            key={raise.id}
                                                            onClick={() => handleNavigate(`/raises/${raise.id}`)}
                                                            className="group w-full text-left p-4 rounded-xl bg-card-elevated hover:bg-card-more-elevated border border-white/5 hover:border-primary/10 transition-all duration-200"
                                                        >
                                                            <h4 className="text-sm font-semibold text-text-primary group-hover:text-primary transition-colors line-clamp-1">
                                                                {getRaiseName(raise)}
                                                            </h4>
                                                            <p className="text-xs text-primary mt-1">Live now</p>
                                                        </button>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        )}

                                        {/* Proposals Section */}
                                        {activeProposals.length > 0 && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -5 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ duration: 0.2, delay: 0.1 }}
                                            >
                                                <div className="flex items-center justify-between mb-4">
                                                    <LiveChip
                                                        nb={activeProposals.length}
                                                        label="Live Markets"
                                                        color="blue"
                                                        animated
                                                    />
                                                    <button
                                                        onClick={() => handleNavigate("/orgs")}
                                                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium"
                                                    >
                                                        View all →
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-2">
                                                    {activeProposals.map((proposal) => {
                                                        const dao = daoMap.get(proposal.daoId);
                                                        return (
                                                            <button
                                                                key={proposal.id}
                                                                onClick={() =>
                                                                    handleNavigate(
                                                                        `/orgs/${proposal.daoId}/proposals/${proposal.id}`
                                                                    )
                                                                }
                                                                className="group w-full text-left p-4 rounded-xl bg-card-elevated hover:bg-card-more-elevated border border-white/5 hover:border-blue-500/10 transition-all duration-200"
                                                            >
                                                                <div className="flex items-center gap-3 mb-3">
                                                                    {dao?.iconUrl ? (
                                                                        <img
                                                                            src={dao.iconUrl}
                                                                            alt={dao.name}
                                                                            className="w-10 h-10 rounded-lg object-cover"
                                                                        />
                                                                    ) : (
                                                                        <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center text-sm font-bold text-blue-400">
                                                                            {proposal.title[0]}
                                                                        </div>
                                                                    )}
                                                                    <div className="flex-1 min-w-0">
                                                                        <h4 className="text-sm font-semibold text-text-primary group-hover:text-blue-400 transition-colors line-clamp-1">
                                                                            {proposal.title}
                                                                        </h4>
                                                                        <p className="text-xs text-text-muted">
                                                                            {proposal.daoName}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <p className="text-xs text-text-muted line-clamp-2">
                                                                    {proposal.description}
                                                                </p>
                                                                <p className="text-xs text-blue-400 mt-2">Live now</p>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </motion.div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </>
    );
}
