import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import SideNavBar from "./SideNavBar";
import TopNavBar from "./TopNavBar";
import BottomNavBar from "./BottomNavBar";
export default function AppLayout({ children }) {
    return (_jsxs("div", { className: "min-h-screen flex", children: [_jsx(SideNavBar, {}), _jsxs("main", { className: "flex-1 md:ml-64 flex flex-col min-h-screen pb-16 md:pb-0", children: [_jsx(TopNavBar, {}), _jsx("div", { className: "p-6 md:p-8 max-w-7xl mx-auto w-full flex-1", children: children })] }), _jsx(BottomNavBar, {})] }));
}
//# sourceMappingURL=AppLayout.js.map