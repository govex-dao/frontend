import { Link } from "react-router";

interface Props {
    name: string;
}

export function NotFound(props: Props) {
    const { name } = props;

    return (
        <div className="flex flex-col items-center justify-center min-h-screen w-full px-8 py-12">
            <div className="text-center space-y-4">
                <h1>{name} Not Found</h1>
                <p className="text-text-light">The {name} you are looking for does not exist.</p>
                <Link
                    to="/"
                    className="inline-block px-6 py-3 rounded-lg bg-card-elevated border border-border-light hover:bg-card-more-elevated transition-colors"
                >
                    Back to Home
                </Link>
            </div>
        </div>
    );
}
