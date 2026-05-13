import { ChevronDown, ChevronUp } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";

interface Props {
    show: boolean;
    setShow: Dispatch<SetStateAction<boolean>>;
    title: string;
}

export function ShowMoreDetails(props: Props) {
    const { show, setShow, title } = props;
    return (
        <button
            onClick={() => setShow((p) => !p)}
            className="text-xs text-text-tertiary hover:text-text-primary flex items-center transition-colors duration-200 px-2 py-0.5 rounded hover:bg-card-elevated"
        >
            {show ? (
                <>
                    <ChevronUp className="h-3 w-3 mr-1" />
                    Hide {title}
                </>
            ) : (
                <>
                    <ChevronDown className="h-3 w-3 mr-1" />
                    Show {title}
                </>
            )}
        </button>
    );
}
