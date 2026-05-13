import { Card, CardContent } from "@/components/Card";

interface TreasuryChartProps {
    treasuryValue: number;
}

export function TreasuryChart({ treasuryValue }: TreasuryChartProps) {
    void treasuryValue;
    return (
        <Card className="flex-1 p-0! h-full">
            <CardContent className="h-full flex flex-col gap-1">
                <div className="flex flex-row justify-between items-center p-4">
                    <h3 className="text-sm font-semibold">Treasury Over Time</h3>
                </div>
                <div className="flex-1 w-full flex items-center justify-center">
                    <p className="text-text-muted text-sm">Historical data not yet available</p>
                </div>
            </CardContent>
        </Card>
    );
}
