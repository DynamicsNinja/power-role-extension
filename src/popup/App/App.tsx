import { useEffect, useState } from 'react';
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
import Footer from '../../components/Footer';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function App() {
  const [sessionActive, setSessionActive] = useState(false);
  const [filteredPrivilages, setFilteredPrivilages] = useState([] as TablePrivileges[]);

  const [businessUnits, setBusinessUnits] = useState([] as BusinessUnit[]);
  const [solutions, setSolutions] = useState([] as any[]);

  const [loading, setLoading] = useState(false);

  const [saveRoleModalOpen, setSaveRoleModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  const [settings, setSettings] = useState({ showNames: ShowNames.DisplayNames } as Settings);

  const { privilages, isLoading } = usePrivileges()

  const canSaveRole = businessUnits.length > 0 && solutions.length > 0;
  const showSaveButton = !sessionActive && (privilages?.length ?? 0) > 0;

  const getActiveDataverseTabId = async (): Promise<number | null> => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];

    if (!tab?.id || !tab.url?.includes('.dynamics.com')) {
      toast.error('Open a Dynamics 365 tab to use Power Roles.');
      return null;
    }

    return tab.id;
  }

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

  const getBusinessUnits = async (tabId: number) => {
    const result = await chrome.tabs.sendMessage(tabId, { action: 'GET_BUSINESS_UNITS' });
    setBusinessUnits(result);
  }

  const getSolutions = async (tabId: number) => {
    const result = await chrome.tabs.sendMessage(tabId, { action: 'GET_SOLUTIONS' });
    setSolutions(result);
  }

  const getSessionActive = async () => {
    const result = await chrome.storage.local.get('sessionActive');
    setSessionActive(result.sessionActive);
  }

  const createRole = async (roleName: string, buId: string, solutionName: string) => {
    closeSaveRoleModal();

    const tabId = await getActiveDataverseTabId();
    if (tabId === null) return;

    let message = {
      action: 'CREATE_ROLE',
      privilages: privilages,
      roleName: roleName,
      buId: buId,
      solutionName: solutionName
    };

    setLoading(true);
    let result = await chrome.tabs.sendMessage(tabId, message);
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Role created successfully');
    }
  }

  const updateRole = async (roleId: string, buId: string) => {
    closeSaveRoleModal();

    const tabId = await getActiveDataverseTabId();
    if (tabId === null) return;

    let message = {
      action: 'UPDATE_ROLE',
      privilages: privilages,
      roleId: roleId,
      buId: buId
    };

    setLoading(true);
    let result = await chrome.tabs.sendMessage(tabId, message);
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Role updated successfully');
    }
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
    const init = async () => {
      getSessionActive();
      getSettings();

      const tabId = await getActiveDataverseTabId();
      if (tabId === null) return;

      let cachedTables = (await chrome.storage.local.get('tables')).tables as Table[] || [];

      if (cachedTables.length === 0) {
        setLoading(true);
        await chrome.tabs.sendMessage(tabId, { action: 'GET_TABLES' });
        setLoading(false);
      } else {
        chrome.tabs.sendMessage(tabId, { action: 'GET_TABLES' });
      }

      getBusinessUnits(tabId);
      getSolutions(tabId);
    }

    init();
  }, []);

  useEffect(() => {
    setFilteredPrivilages(privilages || []);
  }, [privilages]);

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-surface-2 text-fg">
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
          solutions={solutions}
          businessUnits={businessUnits}
          onClose={closeSaveRoleModal}
          onCreate={createRole}
          onUpdate={updateRole}
        ></SaveRoleModal>}
      {(isLoading || loading) && <LodingModal message='Loading...'></LodingModal>}

      <Header onSettingsClick={() => setSettingsModalOpen(true)}></Header>

      <main className='flex flex-1 flex-col gap-3 overflow-hidden p-4'>
        <div className='flex items-center gap-3'>
          {!sessionActive ? (
            <button onClick={startStopSession} className='btn-primary'>
              <span className='h-2.5 w-2.5 rounded-full bg-current' />
              Start recording
            </button>
          ) : (
            <>
              <button onClick={startStopSession} className='btn-danger'>
                <span className='h-2.5 w-2.5 rounded-sm bg-current' />
                Stop
              </button>
              <span className='flex items-center gap-2 text-sm font-semibold text-danger'>
                <span className='h-2.5 w-2.5 rounded-full bg-danger animate-pulsedot' />
                Recording
              </span>
            </>
          )}
        </div>

        <div className='flex items-center justify-between'>
          <h2 className='text-base font-semibold'>
            Privileges <span className='text-fg-muted'>· {privilages?.length ?? 0}</span>
          </h2>
          {showSaveButton &&
            <button
              disabled={!canSaveRole}
              onClick={openSaveRoleModal}
              className='btn-primary'
            >
              Save role
            </button>}
        </div>

        <div className='relative'>
          <svg
            xmlns='http://www.w3.org/2000/svg'
            className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted'
            fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}>
            <path strokeLinecap='round' strokeLinejoin='round' d='M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z' />
          </svg>
          <input
            onChange={handleSearchPrivilages}
            className='input pl-9'
            type='text'
            placeholder='Search tables…' />
        </div>

        <div className='card flex-1 overflow-auto'>
          <EntityPermissionsTable
            names={settings.showNames}
            tablePrivileges={filteredPrivilages} />
        </div>
      </main>

      <Footer></Footer>
      <ToastContainer
        position='bottom-right'
        autoClose={3000}
        onClick={() => toast.dismiss()}
      />
    </div>
  );
}

export default App;
