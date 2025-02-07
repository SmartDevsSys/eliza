import { UserProfileButton } from "./user-profile-button";
import ConnectionStatus from "./connection-status";

export default function UserConnectionStatus() {
    return (
        <div className="flex flex-col gap-2">
            <UserProfileButton />
            <ConnectionStatus />
        </div>
    );
}
