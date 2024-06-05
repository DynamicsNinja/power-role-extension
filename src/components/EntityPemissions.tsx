interface EntityPermissionsProps {
    entity: string;
    permissions: string[];
}

export default function EntityPermissions(props: EntityPermissionsProps) {
    let allPermissions = ['Create', 'Read', 'Update', 'Delete'];

    return (
        <div
            className="flex justify-between border-b-2 border-gray-200 p-2"
        >
            <div
                className="w-[200px] font-bold overflow-ellipsis flex align-middle items-center"
            >
                {props.entity}
            </div>

            {
                allPermissions.map((permission) => {
                    return (
                        <div
                            className="flex flex-col justify-center align-middle items-center space-y-2"
                        >

                            {/* <div>{permission}</div> */}
                            <div key={permission} className={`w-4 h-4 rounded-full ${props.permissions.indexOf(permission) >= 0 ? 'bg-green-500' : 'bg-gray-200'}`}
                            >
                            </div>
                        </div>
                    )
                })
            }
        </div>
    )
}