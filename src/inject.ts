// Runs in the page's MAIN world (see manifest) so it can observe and modify the
// Dynamics client's actual fetch / XHR calls. It captures request bodies and
// error responses (which webRequest does not reliably expose) and, while
// recording with an impersonation user selected, injects the MSCRMCallerID
// header so operations run in that user's security context.

(function () {
    const TARGET = '/api/data/v';

    let recording = false;
    let impersonateUserId = '';

    window.addEventListener('message', (event: MessageEvent) => {
        if (event.source !== window) { return; }
        const data = event.data;
        if (!data || data.__powerRolesConfig !== true) { return; }
        recording = !!data.recording;
        impersonateUserId = typeof data.impersonateUserId === 'string' ? data.impersonateUserId : '';
    });

    const post = (payload: Record<string, unknown>) => {
        try {
            window.postMessage(Object.assign({ __powerRoles: true }, payload), '*');
        } catch {
            // ignore
        }
    };

    const reportRequest = (method: string, url: string, body: unknown) => {
        if (!recording) { return; }
        post({ kind: 'request', method: String(method || 'GET').toUpperCase(), url: String(url), body: typeof body === 'string' ? body : null });
    };

    const reportResponse = (method: string, url: string, status: number, body: string | null) => {
        if (!recording) { return; }
        post({ kind: 'response', method: String(method || 'GET').toUpperCase(), url: String(url), status, body });
    };

    const isTarget = (url: unknown): boolean => !!url && String(url).indexOf(TARGET) !== -1;

    // App-shell, personalization, and metadata/form reads must NOT be impersonated:
    // running them as an under-privileged user breaks the model-driven client (e.g.
    // "Form descriptor is null") and floods the console with 403s. Business data —
    // including $batch, where the real read/write denials live — is still
    // impersonated, so genuine privilege gaps are still surfaced and recorded.
    const INFRA_EXACT = new Set<string>([
        '$metadata', 'entitydefinitions', 'relationshipdefinitions', 'globaloptionsetdefinitions',
        'systemforms', 'savedqueries', 'userqueries', 'webresourceset',
        'solutions', 'solutioncomponents', 'publishers', 'organizations', 'systemusers',
        'whoami', 'getrecentitems', 'updaterecentitems', 'getorcreatesharedworkspace',
        'retrievecurrentorganization', 'retrieveversion', 'retrieveprovisionedlanguages',
        'retrieveavailablelanguages', 'retrieveinstalledlanguagepacks', 'retrievetotalrecordcount',
        'msdyn_tours', 'settingdefinitions', 'appusersettings', 'aiskillconfigs',
        'userentityuisettings', 'usersettingscollection', 'usersettings', 'navigationsettings',
        'appnotifications',
    ]);
    const INFRA_PREFIX = ['retrieveunpublished', 'retrievemetadata', 'appmodule', 'sdkmessage', 'customcontrol', 'ribbon'];

    // A $batch can bundle metadata/descriptor reads together with data ops, and a
    // single MSCRMCallerID applies to the whole batch. Impersonating a batch that
    // contains metadata makes those reads fail for the under-privileged user, so
    // the client throws "Entity/Form descriptor is not available". Only impersonate
    // batches that carry purely business-data operations.
    const INFRA_BODY = /(EntityDefinitions|RetrieveMetadataChanges|RetrieveUnpublished|RelationshipDefinitions|GlobalOptionSetDefinitions|systemform|savedquer|userquer|appmodule|sdkmessage|customcontrol|ribbon|\$metadata|RetrieveAvailableLanguages|RetrieveProvisionedLanguages)/i;

    const batchHasInfra = (body: unknown): boolean =>
        typeof body !== 'string' ? true : INFRA_BODY.test(body);

    const shouldImpersonate = (url: unknown, body?: unknown): boolean => {
        const m = String(url).match(/\/api\/data\/v[\d.]+\/([^?]*)/i);
        if (!m) { return false; }
        const rawSeg = m[1].split(/[/(?]/)[0];
        const seg = rawSeg.toLowerCase();
        if (!seg) { return false; }
        if (seg === '$batch') { return !batchHasInfra(body); }
        // Dataverse functions are app infrastructure (GetClientMetadata, WhoAmI,
        // RetrieveMetadataChanges, license/feature/tenant RPCs). They are bound or
        // unbound functions — PascalCase, or a Microsoft prefix + PascalCase — never
        // lowercase entity sets. Impersonating them breaks the model-driven client
        // (e.g. GetClientMetadata 502 -> "Entity descriptor is not available").
        if (/^[A-Z]/.test(rawSeg) || /^msdyn_[A-Z]/.test(rawSeg)) { return false; }
        if (INFRA_EXACT.has(seg)) { return false; }
        if (INFRA_PREFIX.some(p => seg.startsWith(p))) { return false; }
        return true;
    };

    const w = window as any;

    const originalFetch = w.fetch;
    if (typeof originalFetch === 'function') {
        w.fetch = function (this: any, input: any, init?: any) {
            const url = typeof input === 'string' ? input : (input && input.url);

            if (!isTarget(url)) {
                return originalFetch.apply(this, arguments as any);
            }

            const method = (init && init.method) || (input && input.method) || 'GET';

            // Capture the request body (from init, or a Request clone).
            const initBody = init && init.body;
            if (typeof initBody === 'string') {
                reportRequest(method, url, initBody);
            } else if (input && typeof input.clone === 'function') {
                try {
                    input.clone().text()
                        .then((text: string) => reportRequest(method, url, text))
                        .catch(() => reportRequest(method, url, null));
                } catch {
                    reportRequest(method, url, null);
                }
            } else {
                reportRequest(method, url, null);
            }

            // Impersonate while recording by overriding the headers (business data only).
            let callInit = init;
            if (recording && impersonateUserId && shouldImpersonate(url, typeof initBody === 'string' ? initBody : null)) {
                try {
                    const headers = (typeof input !== 'string' && input && input.headers)
                        ? new Headers(input.headers as any)
                        : new Headers((init && init.headers) || {});
                    headers.set('MSCRMCallerID', impersonateUserId);
                    callInit = Object.assign({}, init, { headers });
                } catch {
                    callInit = init;
                }
            }

            const promise = originalFetch.call(this, input, callInit);

            try {
                const scanBody = String(url).indexOf('/$batch') !== -1;
                promise.then((response: Response) => {
                    try {
                        // $batch returns 200 even when an inner op fails 403, so its
                        // body must be scanned regardless of the outer status.
                        if (response.status >= 400 || scanBody) {
                            response.clone().text()
                                .then((body: string) => reportResponse(method, url, response.status, body))
                                .catch(() => { });
                        }
                    } catch {
                        // ignore
                    }
                }).catch(() => { });
            } catch {
                // ignore
            }

            return promise;
        };
    }

    const xhrProto = w.XMLHttpRequest && w.XMLHttpRequest.prototype;
    if (xhrProto) {
        const originalOpen = xhrProto.open;
        const originalSend = xhrProto.send;

        xhrProto.open = function (this: any, method: string, url: string) {
            try {
                this.__prMethod = method;
                this.__prUrl = url;
            } catch {
                // ignore
            }
            return originalOpen.apply(this, arguments as any);
        };

        xhrProto.send = function (this: any, body?: any) {
            try {
                if (isTarget(this.__prUrl)) {
                    reportRequest(this.__prMethod, this.__prUrl, body);

                    if (recording && impersonateUserId && shouldImpersonate(this.__prUrl, typeof body === 'string' ? body : null)) {
                        try {
                            this.setRequestHeader('MSCRMCallerID', impersonateUserId);
                        } catch {
                            // ignore
                        }
                    }

                    this.addEventListener('load', () => {
                        try {
                            const scanBody = String(this.__prUrl).indexOf('/$batch') !== -1;
                            if (this.status >= 400 || scanBody) {
                                reportResponse(this.__prMethod, this.__prUrl, this.status, this.responseText);
                            }
                        } catch {
                            // ignore
                        }
                    });
                }
            } catch {
                // ignore
            }
            return originalSend.apply(this, arguments as any);
        };
    }
})();

export { };
