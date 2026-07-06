exports.id = 173;
exports.ids = [173];
exports.modules = {

/***/ 5163:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Ct: () => (/* binding */ Badge),
/* harmony export */   II: () => (/* binding */ Input),
/* harmony export */   NZ: () => (/* binding */ SectionTitle),
/* harmony export */   Ph: () => (/* binding */ Select),
/* harmony export */   Rm: () => (/* binding */ StatCard),
/* harmony export */   cx: () => (/* binding */ cx),
/* harmony export */   qi: () => (/* binding */ CopyButton),
/* harmony export */   s_: () => (/* binding */ Panel),
/* harmony export */   zx: () => (/* binding */ Button)
/* harmony export */ });
/* unused harmony exports Textarea, Label */
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2322);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(6689);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_1__);


function cx(...parts) {
    return parts.filter(Boolean).join(" ");
}
function Panel({ children, className }) {
    return /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("div", {
        className: cx("rounded-2xl border border-line bg-panel shadow-soft", className),
        children: children
    });
}
function SectionTitle({ title, description, action }) {
    return /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", {
        className: "mb-4 flex items-start justify-between gap-4",
        children: [
            /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", {
                children: [
                    /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("h1", {
                        className: "text-xl font-semibold text-ink",
                        children: title
                    }),
                    description ? /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("p", {
                        className: "mt-1 text-sm text-muted",
                        children: description
                    }) : null
                ]
            }),
            action
        ]
    });
}
function Button({ children, variant = "primary", className, ...props }) {
    const styles = {
        primary: "bg-brand text-white hover:bg-blue-700",
        secondary: "bg-panelAlt text-ink hover:bg-slate-100 border border-line",
        ghost: "bg-transparent text-ink hover:bg-slate-100",
        danger: "bg-rose-600 text-white hover:bg-rose-700"
    };
    return /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("button", {
        className: cx("inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60", styles[variant], className),
        ...props,
        children: children
    });
}
function Input(props) {
    return /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("input", {
        ...props,
        className: cx("w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-brand", props.className)
    });
}
function Textarea(props) {
    return /*#__PURE__*/ _jsx("textarea", {
        ...props,
        className: cx("w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-brand", props.className)
    });
}
function Select(props) {
    return /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("select", {
        ...props,
        className: cx("w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-brand", props.className)
    });
}
function Label({ children }) {
    return /*#__PURE__*/ _jsx("label", {
        className: "mb-1 block text-sm font-medium text-ink",
        children: children
    });
}
function StatCard({ label, value, subtext }) {
    return /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)(Panel, {
        className: "p-4",
        children: [
            /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("div", {
                className: "text-sm text-muted",
                children: label
            }),
            /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("div", {
                className: "mt-2 text-2xl font-semibold text-ink",
                children: value
            }),
            subtext ? /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("div", {
                className: "mt-2 text-sm text-muted",
                children: subtext
            }) : null
        ]
    });
}
function Badge({ children, tone = "neutral" }) {
    const tones = {
        neutral: "bg-slate-100 text-slate-700",
        green: "bg-emerald-100 text-emerald-700",
        red: "bg-rose-100 text-rose-700",
        blue: "bg-blue-100 text-blue-700"
    };
    return /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("span", {
        className: cx("inline-flex rounded-full px-2 py-1 text-xs font-medium", tones[tone]),
        children: children
    });
}
function CopyButton({ value, label = "Copy" }) {
    const [copied, setCopied] = react__WEBPACK_IMPORTED_MODULE_1___default().useState(false);
    return /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("button", {
        type: "button",
        className: "rounded-xl border border-line bg-white px-3 py-2 text-sm hover:bg-slate-50",
        onClick: async ()=>{
            await navigator.clipboard.writeText(value);
            setCopied(true);
            window.setTimeout(()=>setCopied(false), 1500);
        },
        children: copied ? "Copied" : label
    });
}


/***/ }),

/***/ 7094:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   KY: () => (/* binding */ setSession),
/* harmony export */   LP: () => (/* binding */ getToken),
/* harmony export */   Ov: () => (/* binding */ clearSession)
/* harmony export */ });
/* unused harmony exports AUTH_TOKEN_KEY, AUTH_USER_KEY, getSession */
const AUTH_TOKEN_KEY = "payharness_access_token";
const AUTH_USER_KEY = "payharness_user";
function getToken() {
    if (true) return "";
    return window.localStorage.getItem(AUTH_TOKEN_KEY) || "";
}
function getSession() {
    if (true) return null;
    const raw = window.localStorage.getItem(AUTH_USER_KEY);
    return raw ? JSON.parse(raw) : null;
}
function setSession(session) {
    window.localStorage.setItem(AUTH_TOKEN_KEY, session.accessToken);
    window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(session));
}
function clearSession() {
    if (true) return;
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
    window.localStorage.removeItem(AUTH_USER_KEY);
}


/***/ }),

/***/ 173:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
// ESM COMPAT FLAG
__webpack_require__.r(__webpack_exports__);

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  "default": () => (/* binding */ App)
});

// EXTERNAL MODULE: ../../node_modules/react/jsx-runtime.js
var jsx_runtime = __webpack_require__(2322);
// EXTERNAL MODULE: ../../node_modules/next/font/google/target.css?{"path":"src/pages/_app.tsx","import":"Plus_Jakarta_Sans","arguments":[{"subsets":["latin"]}],"variableName":"font"}
var _app_tsx_import_Plus_Jakarta_Sans_arguments_subsets_latin_variableName_font_ = __webpack_require__(6685);
var _app_tsx_import_Plus_Jakarta_Sans_arguments_subsets_latin_variableName_font_default = /*#__PURE__*/__webpack_require__.n(_app_tsx_import_Plus_Jakarta_Sans_arguments_subsets_latin_variableName_font_);
// EXTERNAL MODULE: external "next/router"
var router_ = __webpack_require__(1853);
// EXTERNAL MODULE: external "react"
var external_react_ = __webpack_require__(6689);
// EXTERNAL MODULE: ./src/lib/auth.ts
var auth = __webpack_require__(7094);
;// CONCATENATED MODULE: ./src/components/auth.tsx




function AuthGate({ children }) {
    const router = (0,router_.useRouter)();
    const [ready, setReady] = (0,external_react_.useState)(false);
    (0,external_react_.useEffect)(()=>{
        const token = (0,auth/* getToken */.LP)();
        if (!token) {
            router.replace("/login");
            return;
        }
        setReady(true);
    }, [
        router
    ]);
    if (!ready) {
        return /*#__PURE__*/ jsx_runtime.jsx("div", {
            className: "flex min-h-screen items-center justify-center bg-bg text-sm text-muted",
            children: "Loading..."
        });
    }
    return /*#__PURE__*/ jsx_runtime.jsx(jsx_runtime.Fragment, {
        children: children
    });
}
function logout(router) {
    (0,auth/* clearSession */.Ov)();
    router.push("/login");
}

// EXTERNAL MODULE: ../../node_modules/next/link.js
var next_link = __webpack_require__(9097);
var link_default = /*#__PURE__*/__webpack_require__.n(next_link);
// EXTERNAL MODULE: ./src/components/ui.tsx
var ui = __webpack_require__(5163);
;// CONCATENATED MODULE: ./src/components/layout.tsx






const sections = [
    {
        title: "Main",
        items: [
            {
                label: "Dashboard",
                href: "/dashboard",
                exact: true
            },
            {
                label: "Transactions",
                href: "/transactions"
            },
            {
                label: "Checkout Sessions",
                href: "/checkout-sessions"
            }
        ]
    },
    {
        title: "Operations",
        items: [
            {
                label: "Providers",
                href: "/providers"
            },
            {
                label: "Analytics",
                href: "/analytics"
            }
        ]
    },
    {
        title: "Developers",
        items: [
            {
                label: "API Keys",
                href: "/developers/api-keys"
            },
            {
                label: "Webhooks",
                href: "/developers/webhooks"
            },
            {
                label: "Usage",
                href: "/developers/usage"
            }
        ]
    },
    {
        title: "Settings",
        items: [
            {
                label: "Profile",
                href: "/settings/profile"
            },
            {
                label: "Branding",
                href: "/settings/branding"
            },
            {
                label: "General",
                href: "/settings/general"
            }
        ]
    }
];
function DashboardLayout({ children }) {
    const router = (0,router_.useRouter)();
    const [open, setOpen] = (0,external_react_.useState)(false);
    const currentPath = router.asPath.split("?")[0];
    const nav = (0,external_react_.useMemo)(()=>sections, []);
    return /*#__PURE__*/ (0,jsx_runtime.jsxs)("div", {
        className: "min-h-screen bg-bg text-ink",
        children: [
            /*#__PURE__*/ (0,jsx_runtime.jsxs)("div", {
                className: "flex min-h-screen",
                children: [
                    /*#__PURE__*/ (0,jsx_runtime.jsxs)("aside", {
                        className: (0,ui.cx)("fixed inset-y-0 left-0 z-30 w-72 border-r border-line bg-panel px-4 py-5 shadow-soft transition-transform lg:static lg:translate-x-0 lg:shadow-none", open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"),
                        children: [
                            /*#__PURE__*/ (0,jsx_runtime.jsxs)("div", {
                                className: "mb-6 flex items-center justify-between",
                                children: [
                                    /*#__PURE__*/ (0,jsx_runtime.jsxs)("div", {
                                        children: [
                                            /*#__PURE__*/ jsx_runtime.jsx("div", {
                                                className: "text-lg font-semibold",
                                                children: "PayHarness"
                                            }),
                                            /*#__PURE__*/ jsx_runtime.jsx("div", {
                                                className: "text-xs text-muted",
                                                children: "Merchant dashboard"
                                            })
                                        ]
                                    }),
                                    /*#__PURE__*/ jsx_runtime.jsx(ui/* Button */.zx, {
                                        variant: "ghost",
                                        className: "lg:hidden",
                                        onClick: ()=>setOpen(false),
                                        children: "Close"
                                    })
                                ]
                            }),
                            /*#__PURE__*/ jsx_runtime.jsx("nav", {
                                className: "space-y-5",
                                children: nav.map((section)=>/*#__PURE__*/ (0,jsx_runtime.jsxs)("div", {
                                        children: [
                                            /*#__PURE__*/ jsx_runtime.jsx("div", {
                                                className: "mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted",
                                                children: section.title
                                            }),
                                            /*#__PURE__*/ jsx_runtime.jsx("div", {
                                                className: "space-y-1",
                                                children: section.items.map((item)=>{
                                                    const active = item.exact ? currentPath === item.href : currentPath.startsWith(item.href);
                                                    return /*#__PURE__*/ jsx_runtime.jsx((link_default()), {
                                                        href: item.href,
                                                        onClick: ()=>setOpen(false),
                                                        className: (0,ui.cx)("block rounded-xl px-3 py-2 text-sm transition", active ? "bg-brand text-white" : "text-ink hover:bg-slate-100"),
                                                        children: item.label
                                                    }, item.href);
                                                })
                                            })
                                        ]
                                    }, section.title))
                            })
                        ]
                    }),
                    /*#__PURE__*/ (0,jsx_runtime.jsxs)("div", {
                        className: "flex min-w-0 flex-1 flex-col",
                        children: [
                            /*#__PURE__*/ jsx_runtime.jsx("header", {
                                className: "sticky top-0 z-20 border-b border-line bg-[rgba(246,247,251,0.9)] backdrop-blur",
                                children: /*#__PURE__*/ (0,jsx_runtime.jsxs)("div", {
                                    className: "flex items-center justify-between gap-3 px-4 py-3 lg:px-8",
                                    children: [
                                        /*#__PURE__*/ (0,jsx_runtime.jsxs)("div", {
                                            className: "flex items-center gap-3",
                                            children: [
                                                /*#__PURE__*/ jsx_runtime.jsx(ui/* Button */.zx, {
                                                    variant: "secondary",
                                                    className: "lg:hidden",
                                                    onClick: ()=>setOpen(true),
                                                    children: "Menu"
                                                }),
                                                /*#__PURE__*/ (0,jsx_runtime.jsxs)("div", {
                                                    children: [
                                                        /*#__PURE__*/ jsx_runtime.jsx("div", {
                                                            className: "text-sm font-medium text-ink",
                                                            children: "PayHarness"
                                                        }),
                                                        /*#__PURE__*/ jsx_runtime.jsx("div", {
                                                            className: "text-xs text-muted",
                                                            children: "Operational console"
                                                        })
                                                    ]
                                                })
                                            ]
                                        }),
                                        /*#__PURE__*/ jsx_runtime.jsx(ui/* Button */.zx, {
                                            variant: "secondary",
                                            onClick: ()=>logout(router),
                                            children: "Logout"
                                        })
                                    ]
                                })
                            }),
                            /*#__PURE__*/ jsx_runtime.jsx("main", {
                                className: "flex-1 px-4 py-6 lg:px-8",
                                children: children
                            })
                        ]
                    })
                ]
            }),
            open ? /*#__PURE__*/ jsx_runtime.jsx("button", {
                className: "fixed inset-0 z-20 bg-black/30 lg:hidden",
                "aria-label": "Close menu",
                onClick: ()=>setOpen(false)
            }) : null
        ]
    });
}

// EXTERNAL MODULE: ./src/styles/globals.css
var globals = __webpack_require__(7016);
;// CONCATENATED MODULE: ./src/pages/_app.tsx






const publicRoutes = [
    "/login",
    "/register"
];
function App({ Component, pageProps }) {
    const router = (0,router_.useRouter)();
    const isPublic = publicRoutes.includes(router.pathname);
    return /*#__PURE__*/ jsx_runtime.jsx("main", {
        className: (_app_tsx_import_Plus_Jakarta_Sans_arguments_subsets_latin_variableName_font_default()).className,
        children: isPublic ? /*#__PURE__*/ jsx_runtime.jsx(Component, {
            ...pageProps
        }) : /*#__PURE__*/ jsx_runtime.jsx(AuthGate, {
            children: /*#__PURE__*/ jsx_runtime.jsx(DashboardLayout, {
                children: /*#__PURE__*/ jsx_runtime.jsx(Component, {
                    ...pageProps
                })
            })
        })
    });
}


/***/ }),

/***/ 7016:
/***/ (() => {



/***/ })

};
;