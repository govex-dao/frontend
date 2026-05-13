interface Props {
    value: boolean;
    onChange: (value: boolean) => void;
    size?: "sm" | "md";
}

const sizeConfig = {
    sm: {
        container: "w-8 h-[1.125rem]",
        knob: "w-3 h-3 top-[0.125rem]",
        translateOn: "translate-x-[1.0625rem]",
        translateOff: "translate-x-[0.125rem]",
    },
    md: {
        container: "w-11 h-6",
        knob: "w-4 h-4 top-[0.1875rem]",
        translateOn: "translate-x-[1.4375rem]",
        translateOff: "translate-x-1",
    },
};

export function Switch(props: Props) {
    const { value, onChange, size = "md" } = props;
    const config = sizeConfig[size];

    return (
        <button
            onClick={() => onChange(!value)}
            className={`relative ${config.container} rounded-full transition-colors border ${
                value ? "bg-text-light/20 border-text-light/30" : "bg-card border-border"
            }`}
        >
            <div
                className={`absolute ${config.knob} rounded-full transition-transform shadow-sm ${
                    value ? `${config.translateOn} bg-text-light` : `${config.translateOff} bg-text-muted`
                }`}
            />
        </button>
    );
}
