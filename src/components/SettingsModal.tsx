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
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                    <label className="field-label" htmlFor="entity-names">Entity names</label>
                    <select
                        id="entity-names"
                        onChange={(e) => setSettings({ showNames: parseInt(e.target.value) })}
                        value={settings.showNames || ShowNames.DisplayNames}
                        className="select">
                        <option value="1">Logical Names</option>
                        <option value="2">Display Names</option>
                        <option value="3">Both</option>
                    </select>
                </div>
                <div className="flex justify-end gap-2">
                    <button className="btn-ghost" onClick={props.onClose}>
                        Cancel
                    </button>
                    <button className="btn-primary" onClick={handleSave}>
                        Save
                    </button>
                </div>
            </div>
        </Modal>
    )
}
