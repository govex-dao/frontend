import { useMemo, useState, type FormEvent } from "react";
import { Helmet } from "react-helmet-async";
import { AtSign, Globe, Rocket, UserRound } from "lucide-react";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { Button } from "@/components/inputs/Button";
import { Input } from "@/components/inputs/Input";
import { Textarea } from "@/components/inputs/Textarea";

interface LaunchProfileDraft {
    name: string;
    website: string;
    twitter: string;
    founderTwitter: string;
    description: string;
}

interface LaunchProfileErrors {
    name?: string;
    website?: string;
    twitter?: string;
    founderTwitter?: string;
}

const DRAFT_STORAGE_KEY = "govex.launchProfileDraft";
const TWITTER_HANDLE_RE = /^[A-Za-z0-9_]{1,15}$/;

function normalizeWebsite(value: string): string | null {
    const raw = value.trim();
    if (!raw) return null;
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
        const url = new URL(withProtocol);
        if (url.protocol !== "https:" && url.protocol !== "http:") return null;
        if (!url.hostname.includes(".") && url.hostname !== "localhost") return null;
        return url.toString();
    } catch {
        return null;
    }
}

function twitterHandle(value: string): string | null {
    const raw = value.trim();
    if (!raw) return null;
    const withoutAt = raw.startsWith("@") ? raw.slice(1) : raw;
    const isTwitterUrl = /^https?:\/\//i.test(raw) || /^(www\.)?(x|twitter)\.com\//i.test(raw);

    if (isTwitterUrl) {
        try {
            const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
            if (!["x.com", "www.x.com", "twitter.com", "www.twitter.com"].includes(url.hostname.toLowerCase())) {
                return null;
            }
            const handle = url.pathname.split("/").filter(Boolean)[0] ?? "";
            return TWITTER_HANDLE_RE.test(handle) ? handle : null;
        } catch {
            return null;
        }
    }

    return TWITTER_HANDLE_RE.test(withoutAt) ? withoutAt : null;
}

function twitterUrl(value: string): string | null {
    const handle = twitterHandle(value);
    return handle ? `https://x.com/${handle}` : null;
}

function validateDraft(draft: LaunchProfileDraft): LaunchProfileErrors {
    const errors: LaunchProfileErrors = {};
    if (!draft.name.trim()) errors.name = "Required";
    if (!normalizeWebsite(draft.website)) errors.website = "Enter a valid website";
    if (!twitterUrl(draft.twitter)) errors.twitter = "Enter a Twitter handle or URL";
    if (!twitterUrl(draft.founderTwitter)) errors.founderTwitter = "Enter a founder Twitter handle";
    return errors;
}

export function buildLaunchMetadataPairs(draft: LaunchProfileDraft): { keys: string[]; values: string[] } {
    const website = normalizeWebsite(draft.website);
    const twitter = twitterUrl(draft.twitter);
    const founderTwitter = twitterUrl(draft.founderTwitter);
    const founderHandle = twitterHandle(draft.founderTwitter);

    const pairs = [
        ["name", draft.name.trim()],
        ["website", website ?? ""],
        ["twitter", twitter ?? ""],
        ["founder_twitter", founderTwitter ?? ""],
        [
            "team",
            JSON.stringify([
                {
                    name: founderHandle ? `@${founderHandle}` : "Founder",
                    role: "Founder",
                    twitter: founderTwitter ?? "",
                },
            ]),
        ],
    ];

    const description = draft.description.trim();
    if (description) pairs.push(["about", description]);

    return {
        keys: pairs.map(([key]) => key),
        values: pairs.map(([, value]) => value),
    };
}

function FieldError({ message }: { message?: string }) {
    if (!message) return null;
    return <p className="text-xs text-error-light">{message}</p>;
}

export function CreateOrg() {
    const [draft, setDraft] = useState<LaunchProfileDraft>({
        name: "",
        website: "",
        twitter: "",
        founderTwitter: "",
        description: "",
    });
    const [submitted, setSubmitted] = useState(false);
    const [saved, setSaved] = useState(false);

    const errors = useMemo(() => validateDraft(draft), [draft]);
    const hasErrors = Object.keys(errors).length > 0;

    function updateDraft<K extends keyof LaunchProfileDraft>(key: K, value: LaunchProfileDraft[K]) {
        setSaved(false);
        setDraft((current) => ({ ...current, [key]: value }));
    }

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSubmitted(true);
        if (hasErrors) return;

        const metadata = buildLaunchMetadataPairs(draft);
        window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ draft, metadata }));
        setSaved(true);
    }

    return (
        <div className="route-container flex min-h-full flex-col gap-4 pb-8">
            <Helmet>
                <title>Create Organization</title>
            </Helmet>
            <Breadcrumbs
                items={[{ label: "Home", href: "/" }, { label: "Orgs", href: "/orgs" }, { label: "Create" }]}
            />

            <div className="flex flex-col gap-1">
                <h1>Create Org</h1>
                <p className="max-w-2xl text-sm text-text-muted">Launch profile metadata for the raise.</p>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
                <section className="glass-flow-panel rounded-xl p-4 sm:p-5">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                            <Input
                                label="Project name"
                                value={draft.name}
                                onChange={(value) => updateDraft("name", value)}
                                placeholder="Govex"
                                required
                                error={submitted && Boolean(errors.name)}
                                leftIcon={<Rocket className="h-4 w-4 text-text-muted" />}
                            />
                            {submitted && <FieldError message={errors.name} />}
                        </div>

                        <div>
                            <Input
                                label="Website"
                                value={draft.website}
                                onChange={(value) => updateDraft("website", value)}
                                placeholder="https://govex.ai"
                                inputMode="url"
                                required
                                error={submitted && Boolean(errors.website)}
                                leftIcon={<Globe className="h-4 w-4 text-text-muted" />}
                            />
                            {submitted && <FieldError message={errors.website} />}
                        </div>

                        <div>
                            <Input
                                label="Project Twitter"
                                value={draft.twitter}
                                onChange={(value) => updateDraft("twitter", value)}
                                placeholder="@govex"
                                inputMode="text"
                                required
                                error={submitted && Boolean(errors.twitter)}
                                leftIcon={<AtSign className="h-4 w-4 text-text-muted" />}
                            />
                            {submitted && <FieldError message={errors.twitter} />}
                        </div>

                        <div className="sm:col-span-2">
                            <Input
                                label="Founder Twitter"
                                value={draft.founderTwitter}
                                onChange={(value) => updateDraft("founderTwitter", value)}
                                placeholder="@founder"
                                inputMode="text"
                                required
                                error={submitted && Boolean(errors.founderTwitter)}
                                leftIcon={<UserRound className="h-4 w-4 text-text-muted" />}
                            />
                            {submitted && <FieldError message={errors.founderTwitter} />}
                        </div>

                        <Textarea
                            label="Description"
                            value={draft.description}
                            onChange={(value) => updateDraft("description", value)}
                            placeholder="Short launch summary"
                            rows={5}
                            containerClassName="sm:col-span-2"
                        />
                    </div>
                </section>

                <aside className="glass-flow-panel flex h-fit flex-col gap-4 rounded-xl p-4">
                    <div className="space-y-1">
                        <h2 className="text-lg font-semibold">Launch metadata</h2>
                        <p className="text-sm text-text-muted">Required fields are saved into the launch draft.</p>
                    </div>
                    <div className="space-y-2 rounded-lg border border-border-light bg-white/[0.025] p-3 text-xs text-text-muted">
                        {buildLaunchMetadataPairs(draft).keys.map((key) => (
                            <div key={key} className="flex items-center justify-between gap-3">
                                <span>{key}</span>
                                <span className="text-text-primary">{key === "team" ? "founder" : "required"}</span>
                            </div>
                        ))}
                    </div>
                    <Button type="submit" disabled={submitted && hasErrors}>
                        Save launch profile
                    </Button>
                    {saved && <p className="text-sm text-success">Launch profile saved.</p>}
                </aside>
            </form>
        </div>
    );
}
