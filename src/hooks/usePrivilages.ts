import useSWR from "swr"
import { TablePrivileges } from "../model/TablePrivileges";

const fetcher = async (key: string) => {
    let response = await chrome.storage.local.get('privilages');
    return response.privilages as TablePrivileges[] || [];
}

export default function usePrivilages() {
    const { data, error, isLoading } = useSWR(`privilages`, fetcher, { refreshInterval: 1000 })

    if (data) {
        data.sort((a, b) => {
            if (a.CollectionName < b.CollectionName) {
                return -1;
            }
            if (a.CollectionName > b.CollectionName) {
                return 1;
            }
            return 0;
        });
    }

    return {
        privilages: data,
        isLoading,
        error
    }
}