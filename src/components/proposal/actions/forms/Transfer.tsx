import { Input } from "@/components/inputs/Input";
import { TokenInput } from "@/components/inputs/TokenInput";
import { resolveCoinIcon } from "@/lib/coin/icons";

interface Props {
    recipientAddress: string;
    amount: string;
    token: string;
    onRecipientChange: (value: string) => void;
    onAmountChange: (value: string) => void;
}

export function TransferForm(props: Props) {
    const { recipientAddress, amount, onRecipientChange, onAmountChange } = props;
    return (
        <div className="space-y-2 sm:space-y-3 w-full">
            <Input
                type="text"
                label="Recipient Address"
                value={recipientAddress}
                onChange={onRecipientChange}
                placeholder="Who receives the tokens?"
                className="bg-card-elevated! focus-within:bg-card-more-elevated!"
            />
            <TokenInput
                value={Number(amount)}
                onChange={onAmountChange}
                placeholder="How much to send?"
                balance={12130}
                className="bg-card-elevated! focus-within:bg-card-more-elevated!"
                tokens={[
                    {
                        name: "GOVEX",
                        symbol: "GOVEX",
                        image: resolveCoinIcon({ symbol: "GOVEX" }),
                        balance: 12130,
                    },
                    {
                        name: "USDC",
                        symbol: "USDC",
                        image: resolveCoinIcon({ symbol: "USDC" }),
                        balance: 12130,
                    },
                ]}
            />
        </div>
    );
}
