import { useEffect, useState } from "react";
import { Settings } from "../model/Settings";
import Modal from "./Modal";
import { ShowNames } from "../enum/ShowNames";

interface ISettingsModalProps {
    settings: Settings;
    onClose: () => void;
    onSave: (settings: Settings) => void;
}

export default function SettingsModal(props: ISettingsModalProps) {
    const [settings, setSettings] = useState<Settings>(props.settings)

    const handleSave = async () => {
        await chrome.storage.local.set({ settings: settings })
        props.onSave(settings)
    }
    
    useEffect(() => {
        setSettings(props.settings)
    }, [props.settings])

    return (
        <Modal title={"Settings"} onClose={props.onClose}>
            <div
                className="flex flex-col space-y-2"
            >
                <div
                    className="flex flex-col space-y-2"
                >
                    <label
                        className="font-bold"
                        htmlFor="">Entity names</label>
                    <select
                        onChange={(e) => setSettings({ showNames: parseInt(e.target.value) })}
                        value={settings.showNames || ShowNames.DisplayNames}
                        className="border border-gray-300 p-2"
                        name="" id="">
                        <option value="1">Logical Names</option>
                        <option value="2">Display Names</option>
                        <option value="3">Both</option>
                    </select>
                </div>
                <div
                    className="flex flex-row space-x-2 justify-end"
                >
                    <button
                        className="w-14 bg-blue-500 text-white p-2 rounded-md"
                        onClick={handleSave}
                    >
                        Save
                    </button>
                    <button
                        className="w-14 bg-red-500 text-white p-2 rounded-md"
                        onClick={props.onClose}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </Modal>
    )
}