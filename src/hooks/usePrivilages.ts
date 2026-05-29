import { useEffect, useState } from "react";
import { TablePrivileges } from "../model/TablePrivileges";

const sortByCollectionName = (privilages: TablePrivileges[]) =>
    [...privilages].sort((a, b) => a.CollectionName.localeCompare(b.CollectionName));

export default function usePrivilages() {
    const [privilages, setPrivilages] = useState<TablePrivileges[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let active = true;

        const load = async () => {
            const response = await chrome.storage.local.get('privilages');
            if (!active) { return; }
            setPrivilages(sortByCollectionName(response.privilages || []));
            setIsLoading(false);
        };

        load();

        const onChanged = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
            if (area === 'local' && changes.privilages) {
                setPrivilages(sortByCollectionName(changes.privilages.newValue || []));
            }
        };

        chrome.storage.onChanged.addListener(onChanged);

        return () => {
            active = false;
            chrome.storage.onChanged.removeListener(onChanged);
        };
    }, []);

    return {
        privilages,
        isLoading,
        error: null
    };
}
