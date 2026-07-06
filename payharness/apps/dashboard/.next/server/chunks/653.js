"use strict";
exports.id = 653;
exports.ids = [653];
exports.modules = {

/***/ 2653:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   hi: () => (/* binding */ api)
/* harmony export */ });
/* unused harmony exports ApiError, apiRequest */
/* harmony import */ var _auth__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(7094);

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
class ApiError extends Error {
    constructor(message, code = "API_ERROR", status = 500, errors = []){
        super(message);
        this.code = code;
        this.status = status;
        this.errors = errors;
    }
}
async function parseResponse(response) {
    const payload = await response.json().catch(()=>null);
    if (!response.ok) {
        const message = payload?.message || response.statusText || "Request failed";
        throw new ApiError(message, payload?.code || "REQUEST_FAILED", response.status, payload?.errors || []);
    }
    if (payload && typeof payload === "object" && "success" in payload) {
        return {
            data: payload.data,
            meta: payload.meta || {}
        };
    }
    return {
        data: payload,
        meta: {}
    };
}
async function apiRequest(path, init = {}) {
    const headers = new Headers(init.headers || {});
    headers.set("Content-Type", headers.get("Content-Type") || "application/json");
    const token = (0,_auth__WEBPACK_IMPORTED_MODULE_0__/* .getToken */ .LP)();
    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }
    const response = await fetch(`${API_URL}${path}`, {
        ...init,
        headers
    });
    try {
        return await parseResponse(response);
    } catch (error) {
        if (error.status === 401) {
            (0,_auth__WEBPACK_IMPORTED_MODULE_0__/* .clearSession */ .Ov)();
        }
        throw error;
    }
}
const api = {
    get: (path)=>apiRequest(path),
    post: (path, body)=>apiRequest(path, {
            method: "POST",
            body: body === undefined ? undefined : JSON.stringify(body)
        }),
    patch: (path, body)=>apiRequest(path, {
            method: "PATCH",
            body: body === undefined ? undefined : JSON.stringify(body)
        }),
    put: (path, body)=>apiRequest(path, {
            method: "PUT",
            body: body === undefined ? undefined : JSON.stringify(body)
        }),
    delete: (path)=>apiRequest(path, {
            method: "DELETE"
        })
};


/***/ })

};
;