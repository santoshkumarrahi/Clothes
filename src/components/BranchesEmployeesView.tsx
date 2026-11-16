import React, { useState } from "react";
import { Building2, Plus, Shield, Users, X } from "lucide-react";
import { AuditLogEntry, Branch, EmployeeRecord } from "../types";
import { formatPKR } from "../utils/formatters";

interface BranchesEmployeesViewProps {
  initialTab: "branches" | "employees" | "settings";
  branches: Branch[];
  activeBranchId: string;
  onSelectBranch: (id: string) => void;
  onAddBranch: (branch: Omit<Branch, "id">) => void;
  employees: EmployeeRecord[];
  onTogglePermission: (empId: string, perm: keyof EmployeeRecord["permissions"]) => void;
  auditLogs: AuditLogEntry[];
  onOpenOnboarding: () => void;
}

export const BranchesEmployeesView: React.FC<BranchesEmployeesViewProps> = ({
  initialTab,
  branches,
  activeBranchId,
  onSelectBranch,
  onAddBranch,
  employees,
  onTogglePermission,
  auditLogs,
  onOpenOnboarding,
}) => {
  const [tab, setTab] = useState<"branches" | "employees" | "audit">(
    initialTab === "employees" ? "employees" : initialTab === "settings" ? "audit" : "branches"
  );
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [newBr, setNewBr] = useState({ name: "", city: "Lahore", address: "", manager: "" });

  const handleCreateBranch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBr.name.trim()) return;
    onAddBranch({
      ...newBr,
      monthlySales: 0,
      stockValue: 0,
      active: true,
    });
    setShowBranchModal(false);
    setNewBr({ name: "", city: "Lahore", address: "", manager: "" });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 w-fit">
          <button
            type="button"
            onClick={() => setTab("branches")}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold cursor-pointer ${
              tab === "branches" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600"
            }`}
          >
            Branches ({branches.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("employees")}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold cursor-pointer ${
              tab === "employees" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600"
            }`}
          >
            Employees & RBAC ({employees.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("audit")}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold cursor-pointer ${
              tab === "audit" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600"
            }`}
          >
            Audit Logs & Settings
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenOnboarding}
            className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            Business Setup Wizard
          </button>
          <button
            type="button"
            onClick={() => setShowBranchModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#0F7C58] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0B6648] cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Branch
          </button>
        </div>
      </div>

      {tab === "branches" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {branches.map((br) => {
            const isCurrent = br.id === activeBranchId;
            return (
              <div
                key={br.id}
                className={`rounded-2xl border p-5 bg-white space-y-3 ${
                  isCurrent ? "border-emerald-600 ring-1 ring-emerald-600/20" : "border-slate-200/80"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-display text-base font-bold text-slate-900">{br.name}</h3>
                      <p className="text-xs text-slate-500">
                        {br.address} · {br.city}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectBranch(br.id)}
                    className={`rounded-lg px-3 py-1 text-xs font-semibold cursor-pointer ${
                      isCurrent ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {isCurrent ? "Active Branch" : "Switch Here"}
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-100 text-xs">
                  <div>
                    <p className="text-slate-500">Manager</p>
                    <p className="font-semibold text-slate-900 mt-0.5">{br.manager}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Monthly Sales</p>
                    <p className="font-bold text-emerald-700 tabular-nums mt-0.5">{formatPKR(br.monthlySales)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Stock Value</p>
                    <p className="font-bold text-slate-900 tabular-nums mt-0.5">{formatPKR(br.stockValue)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "employees" && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4.5 w-4.5 text-emerald-700" />
            <h2 className="font-display text-base font-bold text-slate-900">
              Role-Based Access Control (RBAC) Matrix
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                  <th className="py-2.5 px-3">Employee & Role</th>
                  <th className="py-2.5 px-3 text-center">Create Sales</th>
                  <th className="py-2.5 px-3 text-center">View Profit</th>
                  <th className="py-2.5 px-3 text-center">Manage Stock</th>
                  <th className="py-2.5 px-3 text-center">Approve Refunds</th>
                  <th className="py-2.5 px-3 text-center">Export Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-3">
                      <p className="font-bold text-slate-900 text-[13px]">{emp.name}</p>
                      <p className="text-slate-500">
                        {emp.role} · {emp.branchName}
                      </p>
                    </td>
                    {(
                      ["createSales", "viewProfit", "manageStock", "approveRefunds", "exportReports"] as const
                    ).map((perm) => (
                      <td key={perm} className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={emp.permissions[perm]}
                          disabled={emp.role === "Owner"}
                          onChange={() => onTogglePermission(emp.id, perm)}
                          className="h-4 w-4 accent-emerald-700 cursor-pointer"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "audit" && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="h-4.5 w-4.5 text-emerald-700" />
            <h2 className="font-display text-base font-bold text-slate-900">
              Immutable Security & Financial Audit Trail
            </h2>
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            {auditLogs.map((log) => (
              <div key={log.id} className="py-2.5 flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">
                    {log.action} — <span className="text-slate-600 font-normal">{log.target}</span>
                  </p>
                  <p className="text-slate-500">
                    {log.actor} ({log.role})
                  </p>
                </div>
                <span className="tabular-nums text-slate-400 whitespace-nowrap">{log.timestamp}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showBranchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <form onSubmit={handleCreateBranch} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-display text-base font-bold text-slate-900">Add New Branch</h3>
              <button type="button" onClick={() => setShowBranchModal(false)} className="text-slate-400">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Branch Name</label>
                <input
                  required
                  type="text"
                  value={newBr.name}
                  onChange={(e) => setNewBr({ ...newBr, name: e.target.value })}
                  placeholder="e.g. DHA Phase 5 Express Mart"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    value={newBr.city}
                    onChange={(e) => setNewBr({ ...newBr, city: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Branch Manager</label>
                  <input
                    type="text"
                    value={newBr.manager}
                    onChange={(e) => setNewBr({ ...newBr, manager: e.target.value })}
                    placeholder="Manager Name"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Address</label>
                <input
                  type="text"
                  value={newBr.address}
                  onChange={(e) => setNewBr({ ...newBr, address: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowBranchModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button type="submit" className="rounded-xl bg-[#0F7C58] px-4 py-2 text-xs font-semibold text-white">
                Create Branch
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
