// Runs in the page's MAIN world (see manifest) so it can observe the Dynamics
// client's actual fetch / XHR calls — including request bodies, which the
// webRequest API does not reliably expose. Captured calls are posted to the
// window and picked up by the isolated content script.

(function () {
    const TARGET = '/api/data/v';

    const report = (method: string, url: string, body: unknown) => {
        try {
            window.postMessage({
                __powerRoles: true,
                method: String(method || 'GET').toUpperCase(),
                url: String(url),
                body: typeof body === 'string' ? body : null
            }, '*');
        } catch {
            // ignore
        }
    };

    const w = window as any;

    const originalFetch = w.fetch;
    if (typeof originalFetch === 'function') {
        w.fetch = function (this: any, input: any, init?: any) {
            try {
                const url = typeof input === 'string' ? input : (input && input.url);
                if (url && String(url).indexOf(TARGET) !== -1) {
                    const method = (init && init.method) || (input && input.method) || 'GET';
                    const initBody = init && init.body;

                    if (typeof initBody === 'string') {
                        report(method, url, initBody);
                    } else if (input && typeof input.clone === 'function') {
                        // fetch(new Request(url, { body })) — body is in the stream;
                        // read it from a clone without consuming the original.
                        try {
                            input.clone().text()
                                .then((text: string) => report(method, url, text))
                                .catch(() => report(method, url, null));
                        } catch {
                            report(method, url, null);
                        }
                    } else {
                        report(method, url, null);
                    }
                }
            } catch {
                // ignore
            }
            return originalFetch.apply(this, arguments as any);
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
                if (this.__prUrl && String(this.__prUrl).indexOf(TARGET) !== -1) {
                    report(this.__prMethod, this.__prUrl, body);
                }
            } catch {
                // ignore
            }
            return originalSend.apply(this, arguments as any);
        };
    }
})();

export { };
