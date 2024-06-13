import { useEffect, useState } from 'react';
import './App.css';
import { TablePrivileges } from '../../model/TablePrivileges';
import SaveRoleModal from '../../components/SaveRoleModal';
import { BusinessUnit } from '../../model/BusinessUnit';
import EntityPermissionsTable from '../../components/EntityPermissionsTable';
import { Table } from '../../model/Table';
import LodingModal from '../../components/LodingModal';
import SettingsModal from '../../components/SettingsModal';
import { Settings } from '../../model/Settings';
import { ShowNames } from '../../enum/ShowNames';
import Header from '../../components/Header';
import usePrivileges from '../../hooks/usePrivilages';

function App() {
  const [sessionActive, setSessionActive] = useState(false);
  const [filteredPrivilages, setFilteredPrivilages] = useState([] as TablePrivileges[]);

  const [businessUnits, setBusinessUnits] = useState([] as BusinessUnit[]);

  const [loading, setLoading] = useState(false);

  const [saveRoleModalOpen, setSaveRoleModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  const [settings, setSettings] = useState({ showNames: ShowNames.DisplayNames } as Settings);

  const { privilages, isLoading } = usePrivileges()

  const startStopSession = async () => {
    await chrome.storage.local.set({ sessionActive: !sessionActive });
    await chrome.action.setBadgeText({ text: sessionActive ? '' : 'REC' });
    await chrome.action.setBadgeBackgroundColor({ color: sessionActive ? '#000000' : '#FF0000' });
    await chrome.action.setBadgeTextColor({ color: '#FFFFFF' });

    if (!sessionActive) {
      await chrome.storage.local.set({ privilages: [] });
      setFilteredPrivilages([]);
    }

    setSessionActive(!sessionActive);
  }

  const getSettings = async () => {
    const result = await chrome.storage.local.get('settings');
    setSettings(result.settings || { showNames: ShowNames.DisplayNames });
  }

  const getBusinessUnits = async () => {
    let tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    let tabId = tabs[0].id || 0;

    let message = { action: 'GET_BUSINESS_UNITS' };

    let result = await chrome.tabs.sendMessage(tabId, message);

    console.log(result);

    setBusinessUnits(result);
  }

  const getSessionActive = async () => {
    const result = await chrome.storage.local.get('sessionActive');
    setSessionActive(result.sessionActive);
  }

  const createRole = async (roleName: string, buId: string) => {
    closeSaveRoleModal();

    let tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    let tabId = tabs[0].id || 0;

    let message = {
      action: 'CREATE_ROLE',
      privilages: privilages,
      roleName: roleName,
      buId: buId
    };

    setLoading(true);
    await chrome.tabs.sendMessage(tabId, message);
    setLoading(false);
  }

  const updateRole = async (roleId: string, buId: string) => {
    closeSaveRoleModal();

    let tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    let tabId = tabs[0].id || 0;

    let message = {
      action: 'UPDATE_ROLE',
      privilages: privilages,
      roleId: roleId,
      buId: buId
    };

    setLoading(true);
    await chrome.tabs.sendMessage(tabId, message);
    setLoading(false);
  }

  const openSaveRoleModal = () => {
    setSaveRoleModalOpen(true);
  }

  const closeSaveRoleModal = () => {
    setSaveRoleModalOpen(false);
  }

  const handleSearchPrivilages = (e: any) => {
    let value = e.target.value;
    if (value === '') {
      setFilteredPrivilages(privilages || []);
      return;
    }

    let filtered = privilages?.filter(p =>
      p.CollectionName.toLowerCase().includes(value.toLowerCase()) ||
      p.LogicalName.toLowerCase().includes(value.toLowerCase()) ||
      p.CollectionLogicalName.toLowerCase().includes(value.toLowerCase())
    ) || [];

    setFilteredPrivilages(filtered);

  }

  useEffect(() => {
    const getTables = async () => {
      let cahcedTables = (await chrome.storage.local.get('tables')).tables as Table[] || [];
  
      let tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      let tabId = tabs[0].id || 0;
  
      let message = { action: 'GET_TABLES' };
  
      if (cahcedTables.length === 0) {
        setLoading(true);
        await chrome.tabs.sendMessage(tabId, message);
        setLoading(false);
      } else {
        chrome.tabs.sendMessage(tabId, message);
      }
  
      getBusinessUnits();
      getSessionActive();
      getSettings();
    }
    
    getTables();
  }, []);

  useEffect(() => {
    setFilteredPrivilages(privilages || []);
  }, [privilages]);

  return (
    <div className="flex flex-col w-[500px] h-auto">
      {settingsModalOpen &&
        <SettingsModal
          settings={settings}
          onSave={(settings: Settings) => {
            setSettingsModalOpen(false)
            setSettings(settings)
          }}
          onClose={() => setSettingsModalOpen(false)}
        />}
      {saveRoleModalOpen &&
        <SaveRoleModal
          businessUnits={businessUnits}
          onClose={closeSaveRoleModal}
          onCreate={createRole}
          onUpdate={updateRole}
        ></SaveRoleModal>}
      {(isLoading || loading) && <LodingModal message='Loading...'></LodingModal>}

      <Header onSettingsClick={() => setSettingsModalOpen(true)}></Header>

      <div className='p-4'>
        <div
          className='flex items-center space-x-4 mb-2'
        >
          <button
            onClick={startStopSession}
            className='bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded w-16'
          >
            {sessionActive ? 'Stop' : 'Start'}
          </button>
          {sessionActive && <div className={`text-xl font-bold animate-blink`}>Recording</div>}
        </div>

        <div>
          <div
            className='flex justify-between mb-2'
          >
            <div
              className='text-xl font-bold'>Privileges ({privilages?.length})
            </div>
            {
              <button
                disabled={businessUnits.length === 0}
                onClick={openSaveRoleModal}
                className={
                  `${!sessionActive && privilages?.length !== 0 ? "visible" : "invisible"}
                   bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50`
                }>
                Save as Role
              </button>
            }
          </div>
          <div>
            <input
              onChange={handleSearchPrivilages}
              className='w-full p-2 mb-2 rounded shadow-md border border-gray-200'
              type="text" placeholder='search...' />
          </div>
          <div
            className='h-auto max-h-96 overflow-y-auto bg-gray-100 rounded shadow-md min-h-52'
          >
            <EntityPermissionsTable
              names={settings.showNames}
              tablePrivileges={filteredPrivilages} />
          </div>
        </div>
      </div>

    </div>
  );
}

export default App;
