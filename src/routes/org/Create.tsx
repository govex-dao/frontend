import { Helmet } from "react-helmet-async";

export function CreateOrg() {
    return (
        <div className="route-container">
            <Helmet>
                <title>Create Organization</title>
            </Helmet>
            <h1>Create Org</h1>
        </div>
    );
}
