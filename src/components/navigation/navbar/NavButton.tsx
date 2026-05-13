import { Fragment, useState, type ReactNode } from "react";

interface NavButtonProps {
    label: string;
    isActive: boolean;
    onClick: () => void;
    badge?: ReactNode;
    dropdownContent?: (closeDropdown: () => void, onMouseLeave: () => void) => ReactNode;
}

export function NavButton({ label, isActive, onClick, badge, dropdownContent }: NavButtonProps) {
    const [showDropdown, setShowDropdown] = useState(false);

    return (
        <Fragment>
            <button
                onClick={() => {
                    setShowDropdown(false);
                    onClick();
                }}
                className={`flex items-center gap-2 transition-all duration-300 text-sm relative ${
                    isActive
                        ? "text-text-primary hover:text-text-secondary"
                        : "text-text-secondary hover:text-text-primary"
                }`}
            >
                <p>{label}</p>
                {badge && <div onMouseEnter={() => setShowDropdown(true)}>{badge}</div>}
                <div
                    className={`absolute -bottom-3 left-0 right-0 h-0.5 bg-primary rounded-full transition-all duration-300 origin-center ${
                        isActive ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0"
                    }`}
                />
            </button>

            {showDropdown &&
                dropdownContent &&
                dropdownContent(
                    () => setShowDropdown(false),
                    () => setShowDropdown(false)
                )}
        </Fragment>
    );
}
