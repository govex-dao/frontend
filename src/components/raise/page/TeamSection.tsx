import { ExternalLink } from "lucide-react";

interface Props {
    team?: { name: string; role: string; twitter?: string }[];
}

function safeHttpUrl(url: string | undefined): string | undefined {
    if (!url) return undefined;
    try {
        const parsed = new URL(url);
        if (parsed.protocol === "http:" || parsed.protocol === "https:") return url;
    } catch {
        /* invalid URL */
    }
    return undefined;
}

export function TeamSection(props: Props) {
    const { team } = props;
    if (!team) return null;
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold">Team</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {team.map((member, index) => {
                    const safeTwitter = safeHttpUrl(member.twitter);
                    const Wrapper = safeTwitter ? "a" : "div";
                    const linkProps = safeTwitter
                        ? { href: safeTwitter, target: "_blank" as const, rel: "noopener noreferrer" }
                        : {};
                    return (
                        <Wrapper
                            key={index}
                            {...linkProps}
                            className="flex items-center gap-3 p-3 rounded-lg border border-white/5 hover:border-primary/30 hover:bg-white/5 transition-all group"
                        >
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <span className="text-sm font-semibold text-primary">{member.name[0]}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">{member.name}</p>
                                <p className="text-xs text-white/40 truncate">{member.role}</p>
                            </div>
                            {safeTwitter && (
                                <ExternalLink className="w-4 h-4 text-white/40 group-hover:text-primary transition-colors shrink-0" />
                            )}
                        </Wrapper>
                    );
                })}
            </div>
        </div>
    );
}
