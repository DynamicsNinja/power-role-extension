import { useEffect, useMemo, useState } from 'react';
import { TablePrivileges } from '../../model/TablePrivileges';
import SaveRoleModal from '../../components/SaveRoleModal';
import { BusinessUnit } from '../../model/BusinessUnit';
import EntityPermissionsTable from '../../components/EntityPermissionsTable';
import UserCombobox from '../../components/UserCombobox';
import { Table } from '../../model/Table';
import { RolePrivilegeDiff } from '../../model/RolePrivilegeDiff';
import LoadingModal from '../../components/LoadingModal';
import SettingsModal from '../../components/SettingsModal';
import { Settings } from '../../model/Settings';
import { ShowNames } from '../../enum/ShowNames';
import usePrivileges from '../../hooks/usePrivilages';
import Footer from '../../components/Footer';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function App() {
  const [sessionActive, setSessionActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [businessUnits, setBusinessUnits] = useState([] as BusinessUnit[]);
  const [solutions, setSolutions] = useState([] as any[]);
  const [users, setUsers] = useState([] as { id: string; name: string }[]);
  const [impersonateUserId, setImpersonateUserId] = useState('');
  const [liveBuild, setLiveBuild] = useState(false);
  const [tempRoleSyncing, setTempRoleSyncing] = useState(false);
  const [showAutoGrantInfo, setShowAutoGrantInfo] = useState(false);

  const [loading, setLoading] = useState(false);

  const [saveRoleModalOpen, setSaveRoleModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  const [settings, setSettings] = useState({ showNames: ShowNames.DisplayNames } as Settings);

  const { privilages, isLoading } = usePrivileges()

  const filteredPrivilages: TablePrivileges[] = useMemo(() => {
    const list = privilages || [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) { return list; }
    return list.filter(p =>
      p.CollectionName.toLowerCase().includes(q) ||
      p.LogicalName.toLowerCase().includes(q) ||
      p.CollectionLogicalName.toLowerCase().includes(q)
    );
  }, [privilages, searchQuery]);

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
    const starting = !sessionActive;

    if (starting) {
      if (liveBuild && impersonateUserId) {
        const tabId = await getActiveDataverseTabId();
        if (tabId === null) return;

        setLoading(true);
        const result = await chrome.tabs.sendMessage(tabId, { action: 'CREATE_TEMP_ROLE', userId: impersonateUserId });
        setLoading(false);

        if (!result || result.error || !result.roleId) {
          toast.error(result?.error || 'Could not create the temp role');
          return;
        }

        await chrome.storage.local.set({ tempRoleId: result.roleId, tempRoleBuId: result.buId });
        toast.success('Temp role created and assigned');
      }

      await chrome.storage.local.set({ privilages: [], tempRoleSyncing: false });

      await chrome.action.setBadgeText({ text: 'REC' });
      await chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
      await chrome.action.setBadgeTextColor({ color: '#FFFFFF' });

      await chrome.storage.local.set({ sessionActive: true });
      setSessionActive(true);
    } else {
      await chrome.storage.local.set({ sessionActive: false });
      setSessionActive(false);
      await chrome.action.setBadgeText({ text: '' });

      const { tempRoleId } = await chrome.storage.local.get('tempRoleId');
      if (tempRoleId && impersonateUserId) {
        const tabId = await getActiveDataverseTabId();
        if (tabId !== null) {
          setLoading(true);
          await chrome.tabs.sendMessage(tabId, { action: 'DELETE_TEMP_ROLE', userId: impersonateUserId, roleId: tempRoleId });
          setLoading(false);
          toast.success('Temp role removed');
        }
      }
      await chrome.storage.local.remove(['tempRoleId', 'tempRoleBuId', 'tempRoleSyncing']);
    }
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

  const getUsers = async (tabId: number) => {
    const result = await chrome.tabs.sendMessage(tabId, { action: 'GET_USERS' });
    setUsers(result);
  }

  const changeImpersonation = async (userId: string) => {
    setImpersonateUserId(userId);
    await chrome.storage.local.set({ impersonateUserId: userId });
  }

  const getSessionActive = async () => {
    const result = await chrome.storage.local.get('sessionActive');
    setSessionActive(result.sessionActive);
  }

  const createRole = async (roleName: string, buId: string, solutionName: string, assignUserId: string) => {
    closeSaveRoleModal();

    const tabId = await getActiveDataverseTabId();
    if (tabId === null) return;

    let message = {
      action: 'CREATE_ROLE',
      privilages: privilages,
      roleName: roleName,
      buId: buId,
      solutionName: solutionName,
      assignUserId: assignUserId
    };

    setLoading(true);
    let result = await chrome.tabs.sendMessage(tabId, message);
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(assignUserId ? 'Role created and assigned' : 'Role created successfully');
    }
  }

  const getRoleDiff = async (roleId: string): Promise<RolePrivilegeDiff[] | null> => {
    const tabId = await getActiveDataverseTabId();
    if (tabId === null) { return null; }

    const result = await chrome.tabs.sendMessage(tabId, { action: 'GET_ROLE_DIFF', roleId, privilages });
    if (result && result.error) {
      toast.error(result.error);
      return null;
    }
    return result as RolePrivilegeDiff[];
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

  useEffect(() => {
    const init = async () => {
      getSessionActive();
      getSettings();

      const imp = await chrome.storage.local.get('impersonateUserId');
      setImpersonateUserId(imp.impersonateUserId || '');

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
      getUsers(tabId);
    }

    init();
  }, []);

  useEffect(() => {
    chrome.storage.local.get('tempRoleSyncing').then(r => setTempRoleSyncing(!!r.tempRoleSyncing));

    const onChanged = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area === 'local' && changes.tempRoleSyncing) {
        setTempRoleSyncing(!!changes.tempRoleSyncing.newValue);
      }
    };

    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, []);

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
          users={users}
          onClose={closeSaveRoleModal}
          onCreate={createRole}
          onUpdate={updateRole}
          onRequestDiff={getRoleDiff}
        ></SaveRoleModal>}
      {(isLoading || loading) && <LoadingModal message='Loading...'></LoadingModal>}

      <main className='flex flex-1 flex-col gap-4 overflow-hidden p-4'>
        <section className='card flex flex-col gap-3 p-3'>
          <div className='flex flex-col gap-1.5'>
            <label htmlFor='record-as' className='field-label'>Record as</label>
            <UserCombobox
              users={users}
              value={impersonateUserId}
              disabled={sessionActive}
              onChange={changeImpersonation}
            />
          </div>

          {impersonateUserId &&
            <div className='flex items-center gap-2.5 rounded-md bg-surface-2 px-2.5 py-2'>
              <label className='flex min-w-0 flex-1 cursor-pointer items-center gap-2.5'>
                <input
                  type='checkbox'
                  className='h-4 w-4 shrink-0 accent-accent'
                  checked={liveBuild}
                  disabled={sessionActive}
                  onChange={(e) => setLiveBuild(e.target.checked)}
                />
                <span className='text-sm font-semibold text-fg'>Auto-grant privileges</span>
              </label>
              <span className='relative shrink-0'>
                <button
                  type='button'
                  className='text-xs font-medium text-accent hover:underline focus:outline-none'
                  onMouseEnter={() => setShowAutoGrantInfo(true)}
                  onMouseLeave={() => setShowAutoGrantInfo(false)}
                  onClick={() => setShowAutoGrantInfo(v => !v)}
                  aria-expanded={showAutoGrantInfo}
                >
                  Learn more
                </button>
                {showAutoGrantInfo &&
                  <span className='absolute right-0 top-full z-20 mt-1.5 w-60 rounded-md border border-border bg-surface p-2.5 text-xs leading-snug text-fg-muted shadow-lg'>
                    Builds a temp role for this user while recording so you can click through with the new access. Removed on Stop. Requires the “Act on Behalf of Another User” privilege — use a dev/test environment.
                  </span>}
              </span>
            </div>}

          {!sessionActive ? (
            <button onClick={startStopSession} className='btn-primary w-full'>
              <span className='h-2.5 w-2.5 rounded-full bg-current' />
              Start recording
            </button>
          ) : (
            <div className='flex flex-col gap-2.5'>
              <button onClick={startStopSession} className='btn-danger w-full'>
                <span className='h-2.5 w-2.5 rounded-sm bg-current' />
                Stop recording
              </button>
              <div className='flex items-center justify-between'>
                <span className='flex items-center gap-2 text-xs font-semibold text-danger'>
                  <span className='h-2 w-2 rounded-full bg-danger animate-pulsedot' />
                  Recording
                </span>
                {tempRoleSyncing &&
                  <span className='flex items-center gap-1.5 text-xs font-medium text-accent'>
                    <span className='h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent' />
                    Granting privileges…
                  </span>}
              </div>
            </div>
          )}
        </section>

        <div className='flex min-h-0 flex-1 flex-col gap-3'>
          <div className='flex items-center justify-between gap-2'>
            <h2 className='flex items-center gap-2 text-sm font-semibold'>
              Privileges
              <span className='badge'>{privilages?.length ?? 0}</span>
            </h2>
            <div className='flex items-center gap-1.5'>
              {(privilages?.length ?? 0) > 0 &&
                <button
                  type='button'
                  className='icon-btn'
                  title='Review in a full tab'
                  aria-label='Review in a full tab'
                  onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('index.html?view=privileges') })}
                >
                  <svg
                    xmlns='http://www.w3.org/2000/svg'
                    className='h-5 w-5'
                    fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={1.8}>
                    <path strokeLinecap='round' strokeLinejoin='round' d='M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25' />
                  </svg>
                </button>}
              {showSaveButton &&
                <button
                  disabled={!canSaveRole}
                  onClick={openSaveRoleModal}
                  className='btn-primary'
                  title={canSaveRole ? undefined : 'Business units and solutions are still loading'}
                >
                  Save role
                </button>}
            </div>
          </div>

          {(privilages?.length ?? 0) > 0 &&
            <div className='relative'>
              <svg
                xmlns='http://www.w3.org/2000/svg'
                className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted'
                fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}>
                <path strokeLinecap='round' strokeLinejoin='round' d='M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z' />
              </svg>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className='input pl-9'
                type='text'
                placeholder='Search tables…' />
            </div>}

          <div className='card min-h-0 flex-1 overflow-auto'>
            <EntityPermissionsTable
              names={settings.showNames}
              tablePrivileges={filteredPrivilages} />
          </div>
        </div>
      </main>

      <Footer onSettingsClick={() => setSettingsModalOpen(true)}></Footer>
      <ToastContainer
        position='bottom-right'
        autoClose={3000}
        onClick={() => toast.dismiss()}
      />
    </div>
  );
}

export default App;
