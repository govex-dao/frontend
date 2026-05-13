import { useState } from "react";
import { formatAddress } from "@mysten/sui/utils";
import { ChevronDown, Wallet, Loader2 } from "lucide-react";
import { useConnectWallet, useCurrentAccount, useDisconnectWallet, useWallets } from "@mysten/dapp-kit";
import toast from "react-hot-toast";
import { Modal } from "@/components/overlays/Modal";
import { Identicon } from "../Identicon";
import { Button } from "../inputs/Button";
import { Popover, PopoverContent, PopoverHeader, PopoverMenuItem } from "../overlays/Popover";
import { SidebarNav, type SidebarNavItem } from "../navigation/SidebarNav";

interface ConnectionStatusProps {
    selectedWallet: string;
    isConnecting: boolean;
    connectionError: string;
    walletIcon?: string;
    onRetry: () => void;
    idleMessage: string;
}

function ConnectionStatus(props: ConnectionStatusProps) {
    const { selectedWallet, isConnecting, connectionError, walletIcon, onRetry, idleMessage } = props;

    const showIdle = !selectedWallet && !connectionError;
    const showError = connectionError && !isConnecting;

    const message = showIdle
        ? idleMessage
        : showError
          ? "Connection failed"
          : isConnecting
            ? "Approve the connection in your wallet"
            : "Connected to " + selectedWallet;

    return (
        <div className="flex flex-col items-center justify-start text-center min-h-[200px] md:min-h-[300px] gap-4 md:gap-6 py-4">
            {/* Icon */}
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-white/5 flex items-center justify-center relative">
                {showIdle ? (
                    <Wallet className="w-8 h-8 md:w-10 md:h-10 opacity-30" />
                ) : walletIcon ? (
                    <>
                        <img src={walletIcon} alt={selectedWallet} className={`w-16 h-16 md:w-20 md:h-20 rounded-lg`} />
                        {isConnecting && (
                            <div className="absolute -bottom-2 -right-2 w-7 h-7 md:w-8 md:h-8 rounded-full bg-blue-500 flex items-center justify-center">
                                <Loader2 className="w-3.5 h-3.5 md:w-4 md:h-4 text-white animate-spin" />
                            </div>
                        )}
                    </>
                ) : null}
            </div>

            {/* Text content */}
            <p
                className={`text-sm px-4 ${showError ? "text-red-400" : showIdle ? "text-text-muted" : "text-text-primary"}`}
            >
                {message}
            </p>

            {/* Retry button */}
            {showError && (
                <Button variant="secondary" onClick={onRetry}>
                    Retry Connection
                </Button>
            )}
        </div>
    );
}

interface WalletConnectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    mode: "connect" | "switch";
    walletItems: SidebarNavItem[];
    selectedWallet: string;
    isConnecting: boolean;
    connectionError: string;
    selectedWalletIcon?: string;
    onConnect: (walletName: string) => void;
}

function WalletConnectionModal(props: WalletConnectionModalProps) {
    const {
        isOpen,
        onClose,
        mode,
        walletItems,
        selectedWallet,
        isConnecting,
        connectionError,
        selectedWalletIcon,
        onConnect,
    } = props;

    const title = mode === "connect" ? "Connect a Wallet" : "Switch Account";
    const idleMessage = mode === "connect" ? "Select a wallet to connect" : "Select a wallet to switch";
    const emptyMessage = mode === "connect" ? "No wallets detected. Please install a Sui wallet extension" : undefined;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} subTitle="">
            <div className="flex flex-col md:grid md:grid-cols-[240px_1fr] gap-6 md:gap-0 min-h-[400px]">
                <div className="md:pr-6">
                    <SidebarNav
                        items={walletItems}
                        activeItem={selectedWallet}
                        onItemClick={onConnect}
                        emptyMessage={emptyMessage}
                    />
                </div>
                <div className="md:border-l border-border/50 md:pl-8 flex flex-col justify-center">
                    <ConnectionStatus
                        selectedWallet={selectedWallet}
                        isConnecting={isConnecting}
                        connectionError={connectionError}
                        walletIcon={selectedWalletIcon}
                        onRetry={() => onConnect(selectedWallet)}
                        idleMessage={idleMessage}
                    />
                </div>
            </div>
        </Modal>
    );
}

interface SuiWalletButtonProps {
    buttonClassName?: string;
}

export function SuiWalletButton(props: SuiWalletButtonProps = {}) {
    const { buttonClassName = "" } = props;
    const [open, setOpen] = useState(false);
    const [connectModal, setConnectModal] = useState(false);
    const [selectedWallet, setSelectedWallet] = useState<string>("");
    const [connectionError, setConnectionError] = useState<string>("");
    const account = useCurrentAccount();
    const wallets = useWallets();
    const { mutate: connect, isPending: isConnecting } = useConnectWallet();
    const { mutate: disconnect } = useDisconnectWallet();

    const walletItems: SidebarNavItem[] = wallets.map((wallet) => ({
        id: wallet.name,
        label: wallet.name,
        icon: <img src={wallet.icon} alt={wallet.name} className="w-6 h-6 rounded-lg" />,
    }));

    const selectedWalletData = wallets.find((w) => w.name === selectedWallet);

    const handleConnect = (walletName: string) => {
        // Clear error first to ensure smooth transition to loading state
        setConnectionError("");
        setSelectedWallet(walletName);

        // Use setTimeout to ensure state updates are processed before connect is called
        setTimeout(() => {
            connect(
                { wallet: wallets.find((w) => w.name === walletName)! },
                {
                    onSuccess: () => {
                        setConnectModal(false);
                        setSelectedWallet("");
                        setConnectionError("");
                    },
                    onError: (error) => {
                        setConnectionError(error.message || "Failed to connect to wallet");
                    },
                }
            );
        }, 0);
    };

    const handleCloseModal = () => {
        setConnectModal(false);
        setSelectedWallet("");
        setConnectionError("");
    };

    const onCopyAddress = () => {
        if (account?.address) {
            navigator.clipboard.writeText(account.address).then(() => {
                toast.success("Address copied to clipboard!", { id: "clipboard-copy" });
            }).catch(() => {
                toast.error("Failed to copy address");
            });
        }
    };

    const onSwitchAccount = () => setConnectModal(true);

    const onDisconnect = () => {
        disconnect();
        setOpen(false);
    };

    const modalMode = account ? "switch" : "connect";

    return (
        <>
            {!account ? (
                <Button
                    variant="secondary"
                    className={buttonClassName}
                    leftIcon={<Wallet className="w-4 h-4" />}
                    onClick={() => setConnectModal(true)}
                    isLoading={isConnecting}
                >
                    {isConnecting ? "Connecting" : "Connect Wallet"}
                </Button>
            ) : (
                <Popover
                    open={open}
                    onOpenChange={setOpen}
                    align="right"
                    closeOnClick={false}
                    trigger={
                        <Button variant="secondary" className={`!gap-2 ${buttonClassName}`}>
                            <Identicon seed={account.address} />
                            <span className="tabular-nums font-mono text-sm">{formatAddress(account.address)}</span>
                            <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
                        </Button>
                    }
                >
                    <PopoverContent className="w-64">
                        <PopoverHeader>
                            <div className="text-xs text-text-muted mb-1">Connected Address</div>
                            <div className="text-xs text-text-primary font-mono break-all">
                                {formatAddress(account.address)}
                            </div>
                        </PopoverHeader>
                        <div className="py-1">
                            <PopoverMenuItem onClick={onCopyAddress}>Copy address</PopoverMenuItem>
                            <PopoverMenuItem onClick={onSwitchAccount}>Switch account</PopoverMenuItem>
                            <PopoverMenuItem onClick={onDisconnect} variant="danger">
                                Disconnect
                            </PopoverMenuItem>
                        </div>
                    </PopoverContent>
                </Popover>
            )}

            <WalletConnectionModal
                isOpen={connectModal}
                onClose={handleCloseModal}
                mode={modalMode}
                walletItems={walletItems}
                selectedWallet={selectedWallet}
                isConnecting={isConnecting}
                connectionError={connectionError}
                selectedWalletIcon={selectedWalletData?.icon}
                onConnect={handleConnect}
            />
        </>
    );
}
