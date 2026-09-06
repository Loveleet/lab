import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Sidebar from "./Sidebar";
import { apiFetch } from "../config";

const EXCHANGE_OPTIONS = [
  { value: "binance", label: "Binance" },
  { value: "delta", label: "Delta" },
];

const emptyAccount = (exchange = "binance") => ({
  id: null,
  exchange,
  api_key: "",
  secret_key: "",
  investment: "",
  is_active: false,
});

const EMPTY_FORM = {
  first_name: "",
  last_name: "",
  phone_number: "",
  email: "",
  telegram_id: "",
  is_active: false,
  accounts: [emptyAccount("binance")],
};

const formatExchangeLabel = (value) => {
  const v = String(value || "").toLowerCase();
  if (v === "delta") return "Delta";
  return "Binance";
};

const ClientsPage = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const loadClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/clients");
      const text = await res.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {};
      }
      if (!res.ok) {
        throw new Error(data.error || data.message || text || `Request failed (${res.status})`);
      }
      setClients(Array.isArray(data.clients) ? data.clients : []);
    } catch (e) {
      const msg = e.message || "Failed to load clients";
      setError(msg === "Failed to fetch" ? "Cannot reach API server. Is the Node server running?" : msg);
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const openAddModal = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, accounts: [emptyAccount("binance")] });
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (client) => {
    const accounts =
      Array.isArray(client.accounts) && client.accounts.length
        ? client.accounts.map((a) => ({
            id: a.id ?? null,
            exchange: a.exchange === "delta" ? "delta" : "binance",
            api_key: a.api_key || "",
            secret_key: a.secret_key || "",
            investment: a.investment != null ? String(a.investment) : "",
            is_active: !!a.is_active,
          }))
        : [emptyAccount("binance")];
    setEditingId(client.id);
    setForm({
      first_name: client.first_name || "",
      last_name: client.last_name || "",
      phone_number: client.phone_number || "",
      email: client.email || "",
      telegram_id: client.telegram_id || "",
      is_active: !!client.is_active,
      accounts,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  };

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleAccountChange = (index, field) => (e) => {
    const value = field === "is_active" ? e.target.value === "active" : e.target.value;
    setForm((prev) => {
      const accounts = prev.accounts.map((acc, i) =>
        i === index ? { ...acc, [field]: value } : acc
      );
      return { ...prev, accounts };
    });
  };

  const addAccount = () => {
    setForm((prev) => {
      const used = new Set(prev.accounts.map((a) => a.exchange));
      const nextExchange = used.has("binance") ? (used.has("delta") ? "binance" : "delta") : "binance";
      if (prev.accounts.length >= EXCHANGE_OPTIONS.length) return prev;
      return { ...prev, accounts: [...prev.accounts, emptyAccount(nextExchange)] };
    });
  };

  const removeAccount = (index) => {
    setForm((prev) => {
      if (prev.accounts.length <= 1) return prev;
      return { ...prev, accounts: prev.accounts.filter((_, i) => i !== index) };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const exchanges = form.accounts.map((a) => a.exchange);
      if (new Set(exchanges).size !== exchanges.length) {
        throw new Error("Each exchange can only be added once (Binance and/or Delta)");
      }
      const payload = {
        first_name: form.first_name,
        last_name: form.last_name,
        phone_number: form.phone_number,
        email: form.email,
        telegram_id: form.telegram_id,
        is_active: form.is_active,
        accounts: form.accounts.map((a) => ({
          id: a.id,
          exchange: a.exchange,
          api_key: a.api_key,
          secret_key: a.secret_key,
          investment: a.investment,
          is_active: a.is_active,
        })),
      };
      const url = editingId ? `/api/clients/${editingId}` : "/api/clients";
      const method = editingId ? "PUT" : "POST";
      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {};
      }
      if (!res.ok) {
        throw new Error(data.error || data.message || text || `Request failed (${res.status})`);
      }
      closeModal();
      await loadClients();
    } catch (err) {
      const msg = err.message || "Failed to save client";
      setFormError(msg === "Failed to fetch" ? "Cannot reach API server. Is the Node server running?" : msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (client) => {
    const name = `${client.first_name || ""} ${client.last_name || ""}`.trim() || "this client";
    if (!window.confirm(`Delete ${name}?`)) return;
    try {
      const res = await apiFetch(`/api/clients/${client.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to delete client");
      await loadClients();
    } catch (err) {
      setError(err.message || "Failed to delete client");
    }
  };

  const formatInvestment = (val) => {
    const n = parseFloat(val);
    return Number.isFinite(n)
      ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : "—";
  };

  const formatStatus = (active) => (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
        active
          ? "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200"
          : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
      }`}
    >
      {active ? "Active" : "Deactive"}
    </span>
  );

  const totalInvestment = (accounts) => {
    if (!Array.isArray(accounts) || !accounts.length) return null;
    return accounts.reduce((sum, a) => {
      const n = parseFloat(a.investment);
      return sum + (Number.isFinite(n) ? n : 0);
    }, 0);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f6fa] dark:bg-black text-gray-900 dark:text-gray-100">
      <Sidebar isOpen={isSidebarOpen} toggleSidebar={() => setIsSidebarOpen((o) => !o)} />
      <div className={`flex-1 transition-all duration-300 ${isSidebarOpen ? "ml-64" : "ml-20"} h-full overflow-hidden`}>
        <div className="p-6 h-full flex flex-col gap-4 overflow-hidden">
          <div className="flex items-center justify-between flex-wrap gap-3 shrink-0">
            <div>
              <h1 className="text-2xl font-bold">Clients</h1>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                One client profile with Binance and/or Delta exchange accounts
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/"
                className="px-3 py-2 rounded bg-gray-200 dark:bg-gray-800 text-black dark:text-white border border-gray-300 dark:border-gray-700 hover:bg-gray-300 dark:hover:bg-gray-700"
              >
                ← Home
              </Link>
              <button
                type="button"
                onClick={openAddModal}
                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 font-medium"
              >
                + Add New Client
              </button>
            </div>
          </div>

          {error && (
            <div className="shrink-0 px-4 py-3 rounded-lg bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200 border border-red-200 dark:border-red-800">
              {error}
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
            {loading ? (
              <div className="p-8 text-center text-gray-500">Loading clients…</div>
            ) : clients.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No clients yet. Click <strong>Add New Client</strong> to create one.
              </div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800 text-xs uppercase text-gray-600 dark:text-gray-300">
                  <tr>
                    <th className="px-4 py-3 w-12">#</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Telegram</th>
                    <th className="px-4 py-3">Exchanges</th>
                    <th className="px-4 py-3 text-right">Investment</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client, index) => {
                    const accounts = Array.isArray(client.accounts) ? client.accounts : [];
                    return (
                      <tr
                        key={client.id}
                        className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/60 align-top"
                      >
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{index + 1}</td>
                        <td className="px-4 py-3 font-medium whitespace-nowrap">
                          {client.first_name} {client.last_name}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">{client.phone_number || "—"}</td>
                        <td className="px-4 py-3">{client.email || "—"}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{client.telegram_id || "—"}</td>
                        <td className="px-4 py-3">
                          {accounts.length ? (
                            <div className="flex flex-col gap-1">
                              {accounts.map((a) => (
                                <div key={a.id || a.exchange} className="text-xs">
                                  <span className="font-semibold">{formatExchangeLabel(a.exchange)}</span>
                                  <span className="text-gray-500 dark:text-gray-400">
                                    {" "}
                                    · {a.is_active ? "Active" : "Deactive"}
                                    {a.api_key ? ` · ${a.api_key}` : ""}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {formatInvestment(totalInvestment(accounts))}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">{formatStatus(client.is_active)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openEditModal(client)}
                            className="text-blue-600 dark:text-blue-400 hover:underline mr-3"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(client)}
                            className="text-red-600 dark:text-red-400 hover:underline"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white dark:bg-gray-900 shadow-xl border border-gray-200 dark:border-gray-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold">{editingId ? "Edit Client" : "Add New Client"}</h2>
              <button
                type="button"
                onClick={closeModal}
                className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {formError && (
                <div className="px-3 py-2 rounded bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200 text-sm">
                  {formError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-sm font-medium">First Name *</span>
                  <input
                    type="text"
                    required
                    value={form.first_name}
                    onChange={handleChange("first_name")}
                    className="mt-1 w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Last Name *</span>
                  <input
                    type="text"
                    required
                    value={form.last_name}
                    onChange={handleChange("last_name")}
                    className="mt-1 w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-sm font-medium">Phone Number</span>
                <input
                  type="tel"
                  value={form.phone_number}
                  onChange={handleChange("phone_number")}
                  className="mt-1 w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Email</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={handleChange("email")}
                  className="mt-1 w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Telegram ID</span>
                <input
                  type="text"
                  value={form.telegram_id}
                  onChange={handleChange("telegram_id")}
                  className="mt-1 w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                />
              </label>

              <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">Exchange accounts</h3>
                  <button
                    type="button"
                    onClick={addAccount}
                    disabled={form.accounts.length >= EXCHANGE_OPTIONS.length}
                    className="text-sm px-3 py-1 rounded bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-300 dark:hover:bg-gray-700 disabled:opacity-50"
                  >
                    + Add exchange
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Add Binance and/or Delta under the same client. New accounts default to Deactive.
                </p>
                {form.accounts.map((acc, index) => (
                  <div
                    key={acc.id || `new-${index}`}
                    className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-3 bg-gray-50 dark:bg-gray-800/40"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">Account {index + 1}</span>
                      {form.accounts.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeAccount(index)}
                          className="text-xs text-red-600 dark:text-red-400 hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block">
                        <span className="text-sm font-medium">Exchange *</span>
                        <select
                          required
                          value={acc.exchange}
                          onChange={handleAccountChange(index, "exchange")}
                          className="mt-1 w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                        >
                          {EXCHANGE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-sm font-medium">Status</span>
                        <select
                          value={acc.is_active ? "active" : "deactive"}
                          onChange={handleAccountChange(index, "is_active")}
                          className="mt-1 w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                        >
                          <option value="deactive">Deactive</option>
                          <option value="active">Active</option>
                        </select>
                      </label>
                    </div>
                    <label className="block">
                      <span className="text-sm font-medium">API Key</span>
                      <input
                        type="text"
                        value={acc.api_key}
                        onChange={handleAccountChange(index, "api_key")}
                        className="mt-1 w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 font-mono text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium">Secret Key</span>
                      <input
                        type="password"
                        value={acc.secret_key}
                        onChange={handleAccountChange(index, "secret_key")}
                        placeholder={editingId ? "Leave unchanged to keep existing" : ""}
                        className="mt-1 w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 font-mono text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium">Investment</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={acc.investment}
                        onChange={handleAccountChange(index, "investment")}
                        className="mt-1 w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                      />
                    </label>
                  </div>
                ))}
              </div>

              {editingId ? (
                <label className="block">
                  <span className="text-sm font-medium">Client status</span>
                  <select
                    value={form.is_active ? "active" : "deactive"}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, is_active: e.target.value === "active" }))
                    }
                    className="mt-1 w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                  >
                    <option value="active">Active</option>
                    <option value="deactive">Deactive</option>
                  </select>
                </label>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  New clients are created as <strong>Deactive</strong>.
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving ? "Saving…" : editingId ? "Update Client" : "Add Client"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientsPage;
