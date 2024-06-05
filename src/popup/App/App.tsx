import { useEffect, useState } from 'react';
import './App.css';
import { Table } from '../../model/Table';
import { TablePrivileges } from '../../model/TablePrivileges';
import SaveRoleModal from '../../components/SaveRoleModal';
import { BusinessUnit } from '../../model/BusinessUnit';

function App() {
  const [sessionActive, setSessionActive] = useState(false);
  const [privilages, setPrivilages] = useState({} as { [key: string]: string[] });

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
      await chrome.storage.local.set({ privilages: {} });
      setPrivilages({});
    }

    setSessionActive(!sessionActive);
  }

  const getTables = async () => {
    let tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    let tabId = tabs[0].id || 0;

    let cachedTables = await chrome.storage.local.get('tables');
    setTables(cachedTables.tables || {});

    let message = { action: 'GET_TABLES' };

    setLoading(cachedTables.tables ? false : true);
    let result = await chrome.tabs.sendMessage(tabId, message);
    setLoading(false);
    setTables(result);

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
    setPrivilages(result.privilages || {});
  }

  const saveAsRole = async (roleName: string, buId: string) => {
    closeSaveRoleModal();

    let tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    let tabId = tabs[0].id || 0;

    let tablePrivileges = Object.keys(privilages).map((key) => {
      return {
        LogicalName: tables.find(t => t.CollectionLogicalName === key)?.LogicalName || key,
        Privilages: privilages[key]
      } as TablePrivileges;
    });

    let message = {
      action: 'CREATE_ROLE',
      privilages: tablePrivileges,
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

  useEffect(() => {
    getTables();
  }, []);

  return (
    <div className="flex flex-col w-[500px] h-auto p-4">
      {loading && <div className='text-center text-2xl font-bold mb-4'>Loading...</div>}
      {saveRoleModalOpen &&
        <SaveRoleModal
          businessUnits={businessUnits}
          onClose={closeSaveRoleModal}
          onSave={saveAsRole}
        ></SaveRoleModal>}
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
        <div
          className='h-auto max-h-96 overflow-y-auto bg-gray-100 rounded shadow-md min-h-52'
        >
          <table
            className='w-full p-2'
          >
            <thead>
              <tr
                className='sticky top-0 bg-gray-200 z-10'
              >
                <th className='p-2 text-left'>Entity</th>
                <th className='p-2 text-center'>Create</th>
                <th className='p-2 text-center'>Read</th>
                <th className='p-2 text-center'>Update</th>
                <th className='p-2 text-center'>Delete</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(privilages).length !== 0 && Object.keys(privilages).map((key) => (
                <tr
                  className='border-b-2 border-gray-200 hover:bg-gray-300'
                >
                  <td className='p-2 text-left'>{
                    tables.find(t => t.CollectionLogicalName === key)?.DisplayName || key
                  }</td>
                  {
                    ['Create', 'Read', 'Write', 'Delete'].map((permission) => {
                      return (
                        <td className='p-2 text-center'>
                          <div
                            className='flex justify-center'
                          >
                            <div
                              className={
                                `w-4 h-4 rounded-full 
                                ${privilages[key].includes(permission) ? 'bg-green-500' : 'bg-gray-200'}`
                              }
                            ></div>
                          </div>
                        </td>
                      )
                    })
                  }
                </tr>
              ))}
              {
                Object.keys(privilages).length === 0 && <tr>
                  <td colSpan={5}
                    className='text-center p-4 text-gray-400'>No data</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default App;
