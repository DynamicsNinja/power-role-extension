import { useEffect, useState } from 'react';
import './App.css';
import { TablePrivileges } from '../../model/TablePrivileges';
import SaveRoleModal from '../../components/SaveRoleModal';
import { BusinessUnit } from '../../model/BusinessUnit';
import EntityPermissionsTable from '../../components/EntityPermissionsTable';
import { Table } from '../../model/Table';

function App() {
  const [sessionActive, setSessionActive] = useState(false);
  const [privilages, setPrivilages] = useState([] as TablePrivileges[]);
  const [filteredPrivilages, setFilteredPrivilages] = useState([] as TablePrivileges[]);
  const [tables, setTables] = useState([] as Table[]);

  const [businessUnits, setBusinessUnits] = useState([] as BusinessUnit[]);

  const [loading, setLoading] = useState(false);
  const [creatingRole, setCreatingRole] = useState(false);

  const [saveRoleModalOpen, setSaveRoleModalOpen] = useState(false);

  const startStopSession = async () => {
    await chrome.storage.local.set({ sessionActive: !sessionActive });
    await chrome.action.setBadgeText({ text: sessionActive ? '' : 'REC' });
    await chrome.action.setBadgeBackgroundColor({ color: sessionActive ? '#000000' : '#FF0000' });
    await chrome.action.setBadgeTextColor({ color: '#FFFFFF' });

    if (!sessionActive) {
      await chrome.storage.local.set({ privilages: [] });
      setPrivilages([]);
    }

    setSessionActive(!sessionActive);
  }

  const getTables = async () => {
    let cahcedTables = (await chrome.storage.local.get('tables')).tables as Table[] || [];
    setTables(cahcedTables);

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
    getPrivilegesFromLog();
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

  const getPrivilegesFromLog = async () => {
    const result = await chrome.storage.local.get('privilages');

    let fetchedPrivilages = result.privilages as TablePrivileges[] || [];

    // sort by entity name
    fetchedPrivilages.sort((a, b) => {
      if (a.CollectionName < b.CollectionName) { return -1; }
      if (a.CollectionName > b.CollectionName) { return 1; }
      return 0;
    });

    setPrivilages(fetchedPrivilages);
    setFilteredPrivilages(fetchedPrivilages);
  }

  const saveAsRole = async (roleName: string, buId: string) => {
    closeSaveRoleModal();

    let tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    let tabId = tabs[0].id || 0;

    let message = {
      action: 'CREATE_ROLE',
      privilages: privilages,
      roleName: roleName,
      buId: buId
    };

    setCreatingRole(true);
    let result = await chrome.tabs.sendMessage(tabId, message);
    setCreatingRole(false);
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
      setFilteredPrivilages(privilages);
      return;
    }

    let filtered = privilages.filter(p =>
      p.CollectionName.toLowerCase().includes(value.toLowerCase()) ||
      p.LogicalName.toLowerCase().includes(value.toLowerCase())
    );

    setFilteredPrivilages(filtered);

  }

  useEffect(() => {
    getTables();
  }, []);

  return (
    <div className="flex flex-col w-[500px] h-auto p-4">
      {saveRoleModalOpen &&
        <SaveRoleModal
          businessUnits={businessUnits}
          onClose={closeSaveRoleModal}
          onSave={saveAsRole}
        ></SaveRoleModal>}
      {loading && <div className='text-center text-2xl font-bold mb-4'>Loading...</div>}
      {!loading &&
        <>
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
                className='text-xl font-bold'>Privileges ({Object.keys(privilages).length})
              </div>
              {
                <button
                  onClick={openSaveRoleModal}
                  className={`${sessionActive && privilages ? "visible" : "invisible"} bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded`}>
                  {creatingRole ? 'Creating...' : 'Save as Role'}
                </button>
              }
            </div>
            <div>
              <input
                onChange={handleSearchPrivilages}
                className='w-full p-2 mb-2 rounded shadow-md border border-gray-200'
                type="text" placeholder='Search...' />
            </div>
            <div
              className='h-auto max-h-96 overflow-y-auto bg-gray-100 rounded shadow-md min-h-52'
            >
              <EntityPermissionsTable tablePrivileges={filteredPrivilages} />
            </div>
          </div>
        </>
      }

    </div>
  );
}

export default App;
