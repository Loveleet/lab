import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Sidebar from "./Sidebar";
import { apiFetch } from "../config";

const EMPTY_FORM = {
  first_name: "",
  last_name: "",
  phone_number: "",
  email: "",
  telegram_id: "",
  binance_api_key: "",
  binance_secret_key: "",
  investment: "",
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load clients");
      setClients(Array.isArray(data.clients) ? data.clients : []);
    } catch (e) {
      setError(e.message || "Failed to load clients");
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
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (client) => {
    setEditingId(client.id);
    setForm({
      first_name: client.first_name || "",
      last_name: client.last_name || "",
      phone_number: client.phone_number || "",
      email: client.email || "",
      telegram_id: client.telegram_id || "",
      binance_api_key: client.binance_api_key || "",
      binance_secret_key: client.binance_secret_key || "",
      investment: client.investment != null ? String(client.investment) : "",
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const url = editingId ? `/api/clients/${editingId}` : "/api/clients";
      const method = editingId ? "PUT" : "POST";
      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to save client");
      closeModal();
      await loadClients();
    } catch (err) {
      setFormError(err.message || "Failed to save client");
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
    return Number.isFinite(n) ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f6fa] dark:bg-black text-gray-900 dark:text-gray-100">
      <Sidebar isOpen={isSidebarOpen} toggleSidebar={() => setIsSidebarOpen((o) => !o)} />
      <div className={`flex-1 transition-all duration-300 ${isSidebarOpen ? "ml-64" : "ml-20"} h-full overflow-hidden`}>
        <div className="p-6 h-full flex flex-col gap-4 overflow-hidden">
          <div className="flex items-center justify-between flex-wrap gap-3 shrink-0">
            <div>
              <h1 className="text-2xl font-bold">Clients</h1>
              <p className="text-sm text-gray-600 dark:text-gray-300">Manage client accounts and Binance credentials</p>
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
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Telegram</th>
                    <th className="px-4 py-3">Binance API Key</th>
                    <th className="px-4 py-3">Secret Key</th>
                    <th className="px-4 py-3 text-right">Investment</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => (
                    <tr
                      key={client.id}
                      className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/60"
                    >
                      <td className="px-4 py-3 font-medium whitespace-nowrap">
                        {client.first_name} {client.last_name}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{client.phone_number || "—"}</td>
                      <td className="px-4 py-3">{client.email || "—"}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{client.telegram_id || "—"}</td>
                      <td className="px-4 py-3 font-mono text-xs">{client.binance_api_key || "—"}</td>
                      <td className="px-4 py-3 font-mono text-xs">{client.binance_secret_key || "—"}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">{formatInvestment(client.investment)}</td>
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
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white dark:bg-gray-900 shadow-xl border border-gray-200 dark:border-gray-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold">{editingId ? "Edit Client" : "Add New Client"}</h2>
              <button type="button" onClick={closeModal} className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 text-xl leading-none">
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
              <label className="block">
                <span className="text-sm font-medium">Binance API Key</span>
                <input
                  type="text"
                  value={form.binance_api_key}
                  onChange={handleChange("binance_api_key")}
                  className="mt-1 w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 font-mono text-sm"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Binance Secret Key</span>
                <input
                  type="password"
                  value={form.binance_secret_key}
                  onChange={handleChange("binance_secret_key")}
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
                  value={form.investment}
                  onChange={handleChange("investment")}
                  className="mt-1 w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                />
              </label>
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
