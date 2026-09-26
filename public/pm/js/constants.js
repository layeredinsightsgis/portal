// Static lookup tables -- never mutated, so these are plain module-level
// exports rather than part of state.js.
export var WO_STATUS_LABELS = { REP: "Reported", WIP: "In Progress", HLD: "Holding for Parts", CMP: "Completed" };
export var WO_STATUS_CLASS = { REP: "wo-status-rep", WIP: "wo-status-wip", HLD: "wo-status-hld", CMP: "wo-status-cmp" };
export var WO_STATUS_ORDER = ["REP", "WIP", "HLD", "CMP"];
export var WO_ISSUE_LABELS = {
  ELE: "Electrical", PLU: "Plumbing", HVAC: "Heating/Cooling", MINCON: "Minor Construction",
  MAJCON: "Major Construction", ACC: "Access Controls", FIRSYS: "Fire System", DORWIN: "Doors/Windows"
};
export var WO_SEVERITY_LABELS = { CRITICAL: "Critical", HIGH: "High", MEDIUM: "Medium", LOW: "Low" };
export var WO_SEVERITY_CLASS = { CRITICAL: "wo-sev-critical", HIGH: "wo-sev-high", MEDIUM: "wo-sev-medium", LOW: "wo-sev-low" };
export var WO_SEVERITY_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
