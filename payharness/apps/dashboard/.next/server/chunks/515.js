"use strict";
exports.id = 515;
exports.ids = [515];
exports.modules = {

/***/ 6515:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Ds: () => (/* binding */ Paginator),
/* harmony export */   Ev: () => (/* binding */ FieldRow),
/* harmony export */   T5: () => (/* binding */ FormGrid),
/* harmony export */   xS: () => (/* binding */ SimpleTable)
/* harmony export */ });
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2322);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(6689);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _ui__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(5163);



function FieldRow({ label, children, hint }) {
    return /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", {
        className: "space-y-1",
        children: [
            /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("div", {
                className: "text-sm font-medium text-ink",
                children: label
            }),
            children,
            hint ? /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("div", {
                className: "text-xs text-muted",
                children: hint
            }) : null
        ]
    });
}
function FormGrid({ children }) {
    return /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("div", {
        className: "grid gap-4 md:grid-cols-2",
        children: children
    });
}
function SimpleTable({ headers, rows, emptyText = "No records yet." }) {
    if (!rows.length) {
        return /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx(_ui__WEBPACK_IMPORTED_MODULE_2__/* .Panel */ .s_, {
            className: "p-6 text-sm text-muted",
            children: emptyText
        });
    }
    return /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx(_ui__WEBPACK_IMPORTED_MODULE_2__/* .Panel */ .s_, {
        className: "overflow-hidden",
        children: /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("div", {
            className: "overflow-x-auto",
            children: /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("table", {
                className: "min-w-full text-left text-sm",
                children: [
                    /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("thead", {
                        className: "bg-panelAlt text-muted",
                        children: /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("tr", {
                            children: headers.map((header)=>/*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("th", {
                                    className: "px-4 py-3 font-medium",
                                    children: header
                                }, header))
                        })
                    }),
                    /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("tbody", {
                        children: rows.map((row, rowIndex)=>/*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("tr", {
                                className: "border-t border-line",
                                children: row.map((cell, cellIndex)=>/*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("td", {
                                        className: "px-4 py-3 align-top text-ink",
                                        children: cell
                                    }, cellIndex))
                            }, rowIndex))
                    })
                ]
            })
        })
    });
}
function Paginator({ page, totalPages, onPrev, onNext }) {
    return /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", {
        className: "mt-4 flex items-center justify-between",
        children: [
            /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", {
                className: "text-sm text-muted",
                children: [
                    "Page ",
                    page,
                    " of ",
                    totalPages || 1
                ]
            }),
            /*#__PURE__*/ (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("div", {
                className: "flex gap-2",
                children: [
                    /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("button", {
                        className: "rounded-xl border border-line bg-white px-3 py-2 text-sm disabled:opacity-50",
                        onClick: onPrev,
                        disabled: page <= 1,
                        children: "Previous"
                    }),
                    /*#__PURE__*/ react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx("button", {
                        className: "rounded-xl border border-line bg-white px-3 py-2 text-sm disabled:opacity-50",
                        onClick: onNext,
                        disabled: page >= totalPages,
                        children: "Next"
                    })
                ]
            })
        ]
    });
}


/***/ })

};
;