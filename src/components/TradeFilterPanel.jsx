import React from "react";
import moment from "moment";

// Optional short labels; unknown signalfrom values from trades display as-is
const signalLabels = {};

const TradeFilterPanel = ({
  selectedSignals,
  setSelectedSignals,
  selectedMachines,
  setSelectedMachines,
  selectedIntervals,
  setSelectedIntervals,
  selectedActions,
  setSelectedActions,
  fromDate,
  toDate,
  setFromDate,
  setToDate,
  includeMinClose,
  setIncludeMinClose,
  signalRadioMode,
  setSignalRadioMode,
  machineRadioMode,
  setMachineRadioMode,
  intervalRadioMode,
  setIntervalRadioMode,
  actionRadioMode,
  setActionRadioMode,
  liveFilter,
  setLiveFilter,
  liveRadioMode,
  setLiveRadioMode,
  signalToggleAll,
  setSignalToggleAll,
  machineToggleAll,
  setMachineToggleAll,
  machines,
  setDateKey,
  assignedCount,
  dateKey
}) => {
  const toMachineKey = (id) => (id === null || id === undefined ? "" : String(id));
  // --- Helper functions for toggling checkboxes/radios in the copied block ---
  // Only define if not present (for this component scope)
  const toggleSignal = (signal) => {
    setSelectedSignals((prev) => {
      const updated = { ...prev, [signal]: !prev[signal] };
      localStorage.setItem("selectedSignals", JSON.stringify(updated));
      return updated;
    });
  };

  const toggleMachine = (machineId) => {
    const key = toMachineKey(machineId);
    setSelectedMachines((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      localStorage.setItem("selectedMachines", JSON.stringify(updated));
      return updated;
    });
  };

  const toggleInterval = (interval) => {
    setSelectedIntervals((prev) => {
      const updated = { ...prev, [interval]: !prev[interval] };
      localStorage.setItem("selectedIntervals", JSON.stringify(updated));
      return updated;
    });
  };

  const toggleAction = (action) => {
    setSelectedActions((prev) => {
      const updated = { ...prev, [action]: !prev[action] };
      localStorage.setItem("selectedActions", JSON.stringify(updated));
      return updated;
    });
  };

  /** Radio ↔ checkbox toggle + select all / uncheck (header, right-aligned). */
  const FilterModeButtons = ({
    radioMode,
    onToggleMode,
    showToggleAll,
    onToggleAll,
    allSelected,
    tone = "blue",
  }) => {
    const toneBtn = {
      blue: "bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-blue-100 hover:bg-blue-300 dark:hover:bg-blue-700 focus:ring-blue-400",
      green: "bg-green-200 dark:bg-green-800 text-green-900 dark:text-green-100 hover:bg-green-300 dark:hover:bg-green-700 focus:ring-green-400",
      purple: "bg-purple-200 dark:bg-purple-800 text-purple-900 dark:text-purple-100 hover:bg-purple-300 dark:hover:bg-purple-700 focus:ring-purple-400",
      pink: "bg-pink-200 dark:bg-pink-800 text-pink-900 dark:text-pink-100 hover:bg-pink-300 dark:hover:bg-pink-700 focus:ring-pink-400",
      emerald: "bg-emerald-200 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100 hover:bg-emerald-300 dark:hover:bg-emerald-700 focus:ring-emerald-400",
    }[tone];

    return (
      <div className="flex flex-wrap items-center justify-end gap-1 shrink-0">
        <button
          type="button"
          onClick={onToggleMode}
          className={`px-2 py-1 rounded text-xs font-semibold focus:ring-2 transition-all ${toneBtn}`}
          title={radioMode ? "Switch to checkbox mode (multi-select)" : "Switch to radio mode (single-select)"}
        >
          {radioMode ? "◉ Radio" : "☑ Check"}
        </button>
        {showToggleAll && (
          <button
            type="button"
            onClick={onToggleAll}
            className={`text-xs font-semibold px-2 py-1 rounded transition-all focus:ring-2 ${
              allSelected
                ? "bg-red-200 dark:bg-red-800 text-red-900 dark:text-red-100 hover:bg-red-300 dark:hover:bg-red-700 focus:ring-red-400"
                : "bg-green-200 dark:bg-green-800 text-green-900 dark:text-green-100 hover:bg-green-300 dark:hover:bg-green-700 focus:ring-green-400"
            }`}
            title={allSelected ? "Uncheck all" : "Select all"}
          >
            {allSelected ? "Uncheck" : "All"}
          </button>
        )}
      </div>
    );
  };

  const cardHeader = (icon, title, titleClass, underlineClass, buttons) => (
    <div className="flex items-start justify-between gap-2 mb-2 min-h-[2rem]">
      <span className={`text-base sm:text-lg font-extrabold tracking-wide leading-tight shrink-0 ${titleClass}`}>
        <span className="mr-1">{icon}</span>
        {title}
      </span>
      {buttons}
    </div>
  );

  return (
    <div className="w-full min-w-0 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 auto-rows-min">
      {/* Signal Filter Group — row 1, col 1 */}
      <div className="min-w-0 h-full xl:col-start-1 xl:row-start-1 bg-gradient-to-br from-blue-50 via-white to-blue-100 dark:from-blue-900 dark:via-gray-900 dark:to-blue-950 rounded-2xl shadow-lg border border-blue-200 dark:border-blue-800 p-4 gap-2">
        {cardHeader(
          "📡",
          "Signal",
          "text-blue-700 dark:text-blue-200",
          null,
          <FilterModeButtons
            tone="blue"
            radioMode={signalRadioMode}
            onToggleMode={() => {
              const toggled = !signalRadioMode;
              setSignalRadioMode(toggled);
              if (toggled) {
                const selected = Object.keys(selectedSignals).find((key) => selectedSignals[key]);
                if (selected) {
                  const updated = {};
                  Object.keys(selectedSignals).forEach((key) => {
                    updated[key] = key === selected;
                  });
                  setSelectedSignals(updated);
                  localStorage.setItem("selectedSignals", JSON.stringify(updated));
                }
              }
            }}
            showToggleAll={!signalRadioMode}
            allSelected={Object.values(selectedSignals).some(Boolean)}
            onToggleAll={() => {
              const anySelected = Object.values(selectedSignals).some(Boolean);
              const newState = {};
              Object.keys(selectedSignals).forEach((key) => {
                newState[key] = !anySelected;
              });
              setSelectedSignals(newState);
              setSignalToggleAll(!anySelected);
              localStorage.setItem("selectedSignals", JSON.stringify(newState));
            }}
          />
        )}
        <div className="flex flex-wrap gap-2">
          {Object.keys(selectedSignals).map((signal) => (
            <label key={signal} className="flex items-center space-x-2 bg-white dark:bg-gray-800 rounded px-2 py-1 shadow-sm border border-gray-200 dark:border-gray-700">
              {signalRadioMode ? (
                <input
                  type="radio"
                  name="signalFilterRadio"
                  checked={selectedSignals[signal]}
                  onChange={() => {
                    const updated = {};
                    Object.keys(selectedSignals).forEach((key) => {
                      updated[key] = key === signal;
                    });
                    setSelectedSignals(updated);
                    localStorage.setItem("selectedSignals", JSON.stringify(updated));
                  }}
                  className="form-radio h-5 w-5 text-green-600"
                  style={{ accentColor: '#22c55e' }}
                />
              ) : (
                <input
                  type="checkbox"
                  checked={selectedSignals[signal]}
                  onChange={() => toggleSignal(signal)}
                  className="form-checkbox h-5 w-5 text-blue-600"
                />
              )}
              <span className="text-gray-700 dark:text-gray-200 font-semibold">{signalLabels[signal] || signal}</span>
            </label>
          ))}
        </div>
      </div>
      {/* Machine Filter Group — row 1, col 2 */}
      <div className="min-w-0 h-full xl:col-start-2 xl:row-start-1 bg-gradient-to-br from-green-50 via-white to-green-100 dark:from-green-900 dark:via-gray-900 dark:to-green-950 rounded-2xl shadow-lg border border-green-200 dark:border-green-800 p-4 gap-2">
        {cardHeader(
          "🖥️",
          "Machine",
          "text-green-700 dark:text-green-200",
          null,
          <FilterModeButtons
            tone="green"
            radioMode={machineRadioMode}
            onToggleMode={() => {
              const toggled = !machineRadioMode;
              setMachineRadioMode(toggled);
              if (toggled) {
                const selected = machines.find((m) => selectedMachines[toMachineKey(m.machineid)]);
                if (selected) {
                  const updated = {};
                  machines.forEach((m) => {
                    const key = toMachineKey(m.machineid);
                    updated[key] = key === toMachineKey(selected.machineid);
                  });
                  setSelectedMachines(updated);
                  localStorage.setItem("selectedMachines", JSON.stringify(updated));
                }
              }
            }}
            showToggleAll={!machineRadioMode}
            allSelected={Object.values(selectedMachines).some(Boolean)}
            onToggleAll={() => {
              const allChecked = Object.values(selectedMachines).every((v) => v === true);
              const updated = {};
              machines.forEach((machine) => {
                const key = toMachineKey(machine.machineid);
                updated[key] = !allChecked;
              });
              setSelectedMachines(updated);
              setMachineToggleAll(!allChecked);
              localStorage.setItem("selectedMachines", JSON.stringify(updated));
            }}
          />
        )}
        <div className="flex flex-wrap gap-2">
          {machines
            .map((machine) => (
              <label key={machine.machineid} className="flex items-center space-x-2 bg-white dark:bg-gray-800 rounded px-2 py-1 shadow-sm border border-gray-200 dark:border-gray-700">
                {machineRadioMode ? (
                  <input
                    type="radio"
                    name="machineRadio"
                    checked={selectedMachines[toMachineKey(machine.machineid)] === true}
                    onChange={() => {
                      const updated = {};
                      machines.forEach((m) => {
                        const key = toMachineKey(m.machineid);
                        updated[key] = key === toMachineKey(machine.machineid);
                      });
                      setSelectedMachines(updated);
                      localStorage.setItem("selectedMachines", JSON.stringify(updated));
                    }}
                    className="form-radio h-5 w-5 text-green-600"
                    style={{ accentColor: '#22c55e' }}
                  />
                ) : (
                  <input
                    type="checkbox"
                    checked={selectedMachines[toMachineKey(machine.machineid)] || false}
                    onChange={() => toggleMachine(toMachineKey(machine.machineid))}
                    className="form-checkbox h-5 w-5 text-blue-600"
                  />
                )}
                <span className="text-gray-700 dark:text-gray-200 font-semibold">
                  {machine.machineid}
                  {!machine.active && <span className="ml-1 text-xs text-red-500">(inactive)</span>}
                </span>
              </label>
            ))}
        </div>
      </div>
      {/* Interval Filter Group — row 1, col 3 */}
      <div className="min-w-0 h-full xl:col-start-3 xl:row-start-1 bg-gradient-to-br from-purple-50 via-white to-purple-100 dark:from-purple-900 dark:via-gray-900 dark:to-purple-950 rounded-2xl shadow-lg border border-purple-200 dark:border-purple-800 p-4 gap-2">
        {cardHeader(
          "⏱️",
          "Interval",
          "text-purple-700 dark:text-purple-200",
          null,
          <FilterModeButtons
            tone="purple"
            radioMode={intervalRadioMode}
            onToggleMode={() => {
              const toggled = !intervalRadioMode;
              setIntervalRadioMode(toggled);
              if (toggled) {
                const selected = Object.keys(selectedIntervals).find((key) => selectedIntervals[key]);
                if (selected) {
                  const updated = {};
                  Object.keys(selectedIntervals).forEach((key) => {
                    updated[key] = key === selected;
                  });
                  setSelectedIntervals(updated);
                  localStorage.setItem("selectedIntervals", JSON.stringify(updated));
                }
              }
            }}
            showToggleAll={!intervalRadioMode}
            allSelected={Object.values(selectedIntervals).some(Boolean)}
            onToggleAll={() => {
              const allSelected = Object.values(selectedIntervals).every((val) => val);
              const updated = {};
              Object.keys(selectedIntervals).forEach((key) => {
                updated[key] = !allSelected;
              });
              setSelectedIntervals(updated);
              localStorage.setItem("selectedIntervals", JSON.stringify(updated));
            }}
          />
        )}
        <div className="flex flex-wrap gap-2">
          {Object.keys(selectedIntervals).map((interval) => (
            <label key={interval} className="flex items-center space-x-2 bg-white dark:bg-gray-800 rounded px-2 py-1 shadow-sm border border-gray-200 dark:border-gray-700">
              {intervalRadioMode ? (
                <input
                  type="radio"
                  name="intervalFilterRadio"
                  checked={selectedIntervals[interval]}
                  onChange={() => {
                    const updated = {};
                    Object.keys(selectedIntervals).forEach((key) => {
                      updated[key] = key === interval;
                    });
                    setSelectedIntervals(updated);
                    localStorage.setItem("selectedIntervals", JSON.stringify(updated));
                  }}
                  className="form-radio h-5 w-5 text-green-600"
                  style={{ accentColor: '#22c55e' }}
                />
              ) : (
                <input
                  type="checkbox"
                  checked={selectedIntervals[interval]}
                  onChange={() => toggleInterval(interval)}
                  className="form-checkbox h-5 w-5 text-blue-600"
                />
              )}
              <span className="text-gray-700 dark:text-gray-200 font-semibold">{interval}</span>
            </label>
          ))}
        </div>
      </div>
      {/* Action + Live — row 1–2, col 4 */}
      <div className="min-w-0 h-full xl:col-start-4 xl:row-start-1 xl:row-span-2 bg-gradient-to-br from-pink-50 via-white to-pink-100 dark:from-pink-900 dark:via-gray-900 dark:to-pink-950 rounded-2xl shadow-lg border border-pink-200 dark:border-pink-800 p-4 gap-2">
        {cardHeader(
          "🛒",
          "Action",
          "text-pink-700 dark:text-pink-200",
          null,
          <FilterModeButtons
            tone="pink"
            radioMode={actionRadioMode}
            onToggleMode={() => {
              const toggled = !actionRadioMode;
              setActionRadioMode(toggled);
              if (toggled) {
                const selected = Object.keys(selectedActions).find((key) => selectedActions[key]);
                if (selected) {
                  const updated = { BUY: false, SELL: false };
                  updated[selected] = true;
                  setSelectedActions(updated);
                  localStorage.setItem("selectedActions", JSON.stringify(updated));
                }
              }
            }}
            showToggleAll={!actionRadioMode}
            allSelected={Object.values(selectedActions).some(Boolean)}
            onToggleAll={() => {
              const allSelected = Object.values(selectedActions).every((val) => val);
              const updated = { BUY: !allSelected, SELL: !allSelected };
              setSelectedActions(updated);
              localStorage.setItem("selectedActions", JSON.stringify(updated));
            }}
          />
        )}
        <div className="flex flex-wrap gap-2">
          {["BUY", "SELL"].map((action) => (
            <label key={action} className="flex items-center space-x-2 bg-white dark:bg-gray-800 rounded px-2 py-1 shadow-sm border border-gray-200 dark:border-gray-700">
              {actionRadioMode ? (
                <input
                  type="radio"
                  name="actionRadio"
                  checked={selectedActions[action]}
                  onChange={() => {
                    const updated = { BUY: false, SELL: false };
                    updated[action] = true;
                    setSelectedActions(updated);
                    localStorage.setItem("selectedActions", JSON.stringify(updated));
                  }}
                  className="form-radio h-5 w-5 text-green-600"
                  style={{ accentColor: '#22c55e' }}
                />
              ) : (
                <input
                  type="checkbox"
                  checked={selectedActions[action]}
                  onChange={() => toggleAction(action)}
                  className="form-checkbox h-5 w-5 text-blue-600"
                />
              )}
              <span className="text-gray-700 dark:text-gray-200 font-semibold">{action}</span>
            </label>
          ))}
        </div>

        <div className="border-t border-pink-200/80 dark:border-pink-800/80 pt-2 mt-1">
          <div className="flex items-start justify-between gap-2 mb-2">
            <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">📡 Live</span>
            <FilterModeButtons
              tone="emerald"
              radioMode={!!liveRadioMode}
              onToggleMode={() => {
                const nextRadio = !liveRadioMode;
                setLiveRadioMode?.(nextRadio);
                if (nextRadio) {
                  const f = liveFilter ?? { true: true, false: true };
                  const selected = f.true ? "true" : "false";
                  setLiveFilter?.({ true: selected === "true", false: selected === "false" });
                }
              }}
              showToggleAll={!liveRadioMode}
              allSelected={!!(liveFilter?.true || liveFilter?.false)}
              onToggleAll={() => {
                const f = liveFilter ?? { true: true, false: true };
                const allChecked = f.true && f.false;
                setLiveFilter?.({ true: !allChecked, false: !allChecked });
              }}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center space-x-2 bg-white dark:bg-gray-800 rounded px-2 py-1 shadow-sm border border-gray-200 dark:border-gray-700">
              {liveRadioMode ? (
                <input
                  type="radio"
                  name="liveFilterRadio"
                  checked={!!liveFilter?.true}
                  onChange={() => setLiveFilter?.({ true: true, false: false })}
                  className="form-radio h-5 w-5 text-emerald-600"
                  style={{ accentColor: "#10b981" }}
                />
              ) : (
                <input
                  type="checkbox"
                  checked={liveFilter?.true ?? true}
                  onChange={() => setLiveFilter?.((prev) => ({ ...prev, true: !prev.true }))}
                  className="form-checkbox h-5 w-5 text-emerald-600"
                />
              )}
              <span className="text-gray-700 dark:text-gray-200 font-semibold">True</span>
            </label>
            <label className="flex items-center space-x-2 bg-white dark:bg-gray-800 rounded px-2 py-1 shadow-sm border border-gray-200 dark:border-gray-700">
              {liveRadioMode ? (
                <input
                  type="radio"
                  name="liveFilterRadio"
                  checked={!!liveFilter?.false}
                  onChange={() => setLiveFilter?.({ true: false, false: true })}
                  className="form-radio h-5 w-5 text-emerald-600"
                  style={{ accentColor: "#10b981" }}
                />
              ) : (
                <input
                  type="checkbox"
                  checked={liveFilter?.false ?? true}
                  onChange={() => setLiveFilter?.((prev) => ({ ...prev, false: !prev.false }))}
                  className="form-checkbox h-5 w-5 text-emerald-600"
                />
              )}
              <span className="text-gray-700 dark:text-gray-200 font-semibold">False</span>
            </label>
          </div>
        </div>
      </div>
      {/* Date Range — row 1–2, col 5 */}
      <div className="min-w-0 h-full xl:col-start-5 xl:row-start-1 xl:row-span-2 bg-gradient-to-br from-yellow-50 via-white to-yellow-100 dark:from-yellow-900 dark:via-gray-900 dark:to-yellow-950 rounded-2xl shadow-lg border border-yellow-200 dark:border-yellow-800 p-2 gap-1 justify-start items-stretch">
        {cardHeader("📅", "Date & Time", "text-yellow-700 dark:text-yellow-200", null, null)}
        <div className="flex flex-col gap-1">
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-800 dark:text-gray-200 mb-0.5">From</label>
            <input
              type="datetime-local"
              value={fromDate ? moment(fromDate).format('YYYY-MM-DDTHH:mm') : ''}
              onChange={e => {
                const value = e.target.value;
                setFromDate(value ? moment(value) : null);
              }}
              className="border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
              placeholder="From"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-800 dark:text-gray-200 mb-0.5">To</label>
            <input
              type="datetime-local"
              value={toDate ? moment(toDate).format('YYYY-MM-DDTHH:mm') : ''}
              onChange={e => {
                const value = e.target.value;
                setToDate(value ? moment(value) : null);
              }}
              className="border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
              placeholder="To"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setFromDate(null);
              setToDate(null);
              setDateKey(prev => prev + 1);
            }}
            className="bg-yellow-400 dark:bg-yellow-700 text-yellow-900 dark:text-yellow-100 px-2 py-1 rounded mt-1 hover:bg-yellow-500 dark:hover:bg-yellow-800 focus:ring-1 focus:ring-yellow-400 transition-all font-semibold text-xs"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
};

export default TradeFilterPanel;
