import { state } from './state.js';
import { dom } from './dom.js';
import { applyEdits, cloneSelectOptions } from './utils.js';
import { WO_STATUS_LABELS, WO_STATUS_CLASS, WO_STATUS_ORDER, WO_ISSUE_LABELS, WO_SEVERITY_LABELS, WO_SEVERITY_CLASS, WO_SEVERITY_ORDER } from './constants.js';

function resolveWorkOrderContext(log) {
  if (log.UnitID) {
    var u = state.unitsById[log.UnitID];
    return {
      structureId: u && u.StructureID,
      floorId: u && u.FloorID,
      clientId: u && u.ClientID,
      unitId: log.UnitID
    };
  }
  if (log.RoomID) {
    var r = state.roomsById[log.RoomID];
    var floorForRoom = r && state.floorsById[r.FloorID];
    if (r && r.UnitID) {
      var ru = state.unitsById[r.UnitID];
      return {
        structureId: ru && ru.StructureID,
        floorId: r.FloorID,
        clientId: ru && ru.ClientID,
        unitId: r.UnitID
      };
    }
    return {
      structureId: floorForRoom && floorForRoom.StructureID,
      floorId: r && r.FloorID,
      clientId: null,
      unitId: null
    };
  }
  if (log.FloorID) {
    var f = state.floorsById[log.FloorID];
    return {
      structureId: f && f.StructureID,
      floorId: log.FloorID,
      clientId: null,
      unitId: null
    };
  }
  if (log.StructureID) {
    return {
      structureId: log.StructureID,
      floorId: null,
      clientId: null,
      unitId: null
    };
  }
  return {
    structureId: null,
    floorId: null,
    clientId: null,
    unitId: null
  };
}
function workOrderInScope(log) {
  var ctx = resolveWorkOrderContext(log);
  if (state.editingObjectId !== null) {
    var editingUnit = state.unitsById[state.editingUnitId];
    if (log.UnitID) return log.UnitID === state.editingUnitId;
    if (log.RoomID) return ctx.unitId === state.editingUnitId;
    if (log.FloorID) return !!(editingUnit && String(log.FloorID) === String(editingUnit.FloorID));
    if (log.StructureID) return !!(editingUnit && String(log.StructureID) === String(editingUnit.StructureID));
    return false;
  }
  if (state.activeStructureId && String(ctx.structureId || "") !== String(state.activeStructureId)) return false;
  if (state.activeFloorId) {
    var isStructureWide = !!log.StructureID && !log.FloorID && !log.UnitID && !log.RoomID;
    if (!isStructureWide && String(ctx.floorId || "") !== String(state.activeFloorId)) return false;
  }
  if (state.activeClientId && (log.UnitID || log.RoomID) && ctx.clientId !== state.activeClientId) return false;
  return true;
}
function workOrderLocationLabel(log) {
  if (log.UnitID) {
    var u = state.unitsById[log.UnitID];
    return u ? "Unit " + (u.UnitNumber || u.UnitID) : "Unit " + log.UnitID;
  }
  if (log.RoomID) {
    var r = state.roomsById[log.RoomID];
    return r ? "Room " + (r.RoomNumber || r.RoomID) : "Room " + log.RoomID;
  }
  if (log.FloorID) {
    var f = state.floorsById[log.FloorID];
    return f ? "Floor " + f.FloorNumber : "Floor " + log.FloorID;
  }
  if (log.StructureID) {
    var s = state.structuresById[log.StructureID];
    return (s && s.StructureName ? s.StructureName : "Building") + " (entire building)";
  }
  return "—";
}
function workOrderLevel(log) {
  if (log.UnitID) return "unit";
  if (log.RoomID) return "room";
  if (log.FloorID) return "floor";
  if (log.StructureID) return "structure";
  return "";
}
function severityOrder(sev) {
  return WO_SEVERITY_ORDER.hasOwnProperty(sev) ? WO_SEVERITY_ORDER[sev] : 9;
}
function buildWorkOrderEditForm(log) {
  var form = document.createElement("form");
  form.className = "wo-edit-form";
  function addField(labelText, el) {
    var label = document.createElement("label");
    label.textContent = labelText;
    form.appendChild(label);
    form.appendChild(el);
  }
  var issueSelect = cloneSelectOptions(dom.woIssueType);
  issueSelect.value = log.IssueType || "";
  addField("Issue Type", issueSelect);
  var severitySelect = cloneSelectOptions(dom.woSeverity);
  severitySelect.value = log.Severity || "MEDIUM";
  addField("Severity", severitySelect);
  var statusSelect = document.createElement("select");
  WO_STATUS_ORDER.forEach(function (code) {
    var opt = document.createElement("option");
    opt.value = code;
    opt.textContent = WO_STATUS_LABELS[code];
    statusSelect.appendChild(opt);
  });
  statusSelect.value = log.Status || "REP";
  addField("Status", statusSelect);
  var descTextarea = document.createElement("textarea");
  descTextarea.rows = 2;
  descTextarea.value = log.Description || "";
  addField("Description", descTextarea);
  var reportedByInput = document.createElement("input");
  reportedByInput.type = "text";
  reportedByInput.value = log.ReportedBy || "";
  addField("Reported By", reportedByInput);
  var errorDiv = document.createElement("div");
  errorDiv.className = "mini-error";
  form.appendChild(errorDiv);
  var actions = document.createElement("div");
  actions.className = "mini-actions";
  var cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.textContent = "Cancel";
  cancelBtn.addEventListener("click", function () {
    state.editingWorkOrderId = null;
    renderWorkOrders();
  });
  var saveBtn = document.createElement("button");
  saveBtn.type = "submit";
  saveBtn.className = "primary";
  saveBtn.textContent = "Save";
  actions.appendChild(cancelBtn);
  actions.appendChild(saveBtn);
  form.appendChild(actions);
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    errorDiv.textContent = "";
    saveBtn.disabled = true;
    var newStatus = statusSelect.value;
    var updatedAttrs = {
      OBJECTID: log.OBJECTID,
      IssueType: issueSelect.value,
      Severity: severitySelect.value,
      Description: descTextarea.value || null,
      ReportedBy: reportedByInput.value || null,
      Status: newStatus
    };
    if (newStatus === "CMP" && log.Status !== "CMP") {
      updatedAttrs.DateResolved = Date.now();
    } else if (newStatus !== "CMP" && log.Status === "CMP") {
      updatedAttrs.DateResolved = null;
    }
    applyEdits(9, {
      updates: [{
        attributes: updatedAttrs
      }]
    }).then(function (result) {
      if (result.error) {
        errorDiv.textContent = "ArcGIS error " + (result.error.code || "") + ": " + (result.error.message || JSON.stringify(result.error));
        saveBtn.disabled = false;
        return;
      }
      var updateResult = result.updateResults && result.updateResults[0];
      if (!updateResult || !updateResult.success) {
        var msg = updateResult && updateResult.error && (updateResult.error.description || updateResult.error.message) || "Unexpected response: " + JSON.stringify(result);
        errorDiv.textContent = msg;
        saveBtn.disabled = false;
        return;
      }
      log.IssueType = updatedAttrs.IssueType;
      log.Severity = updatedAttrs.Severity;
      log.Description = updatedAttrs.Description;
      log.ReportedBy = updatedAttrs.ReportedBy;
      log.Status = updatedAttrs.Status;
      if (updatedAttrs.hasOwnProperty("DateResolved")) log.DateResolved = updatedAttrs.DateResolved;
      state.editingWorkOrderId = null;
      renderWorkOrders();
    }).catch(function (err) {
      errorDiv.textContent = "Could not reach the server: " + (err && err.message ? err.message : err);
      saveBtn.disabled = false;
    });
  });
  return form;
}
function renderWorkOrders() {
  var isClosed = function (status) {
    return status === "CMP";
  };
  if (state.editingObjectId !== null) {
    var scopedUnit = state.unitsById[state.editingUnitId];
    dom.woScopeLabel.hidden = false;
    dom.woScopeLabel.textContent = "Showing: Unit " + (scopedUnit ? scopedUnit.UnitNumber || state.editingUnitId : state.editingUnitId) + " + any floor/building-wide issues";
  } else {
    dom.woScopeLabel.hidden = true;
  }
  var scoped = state.maintenanceLogs.filter(function (log) {
    if (!workOrderInScope(log)) return false;
    return state.activeWoTab === "closed" ? isClosed(log.Status) : !isClosed(log.Status);
  });
  var openCount = state.maintenanceLogs.filter(function (log) {
    return workOrderInScope(log) && !isClosed(log.Status);
  }).length;
  var closedCount = state.maintenanceLogs.filter(function (log) {
    return workOrderInScope(log) && isClosed(log.Status);
  }).length;
  dom.workOrderTabs.querySelector('[data-tab="open"]').textContent = "Open (" + openCount + ")";
  dom.workOrderTabs.querySelector('[data-tab="closed"]').textContent = "Closed (" + closedCount + ")";
  scoped.sort(function (a, b) {
    var sevDiff = severityOrder(a.Severity) - severityOrder(b.Severity);
    if (sevDiff !== 0) return sevDiff;
    return (b.DateReported || 0) - (a.DateReported || 0);
  });
  dom.workOrderList.innerHTML = "";
  if (!scoped.length) {
    var scopeDesc = state.editingObjectId !== null ? " for this unit." : state.activeFloorId || state.activeClientId ? " for this selection." : ".";
    dom.workOrderList.innerHTML = "<p>No " + state.activeWoTab + " work orders" + scopeDesc + "</p>";
    return;
  }
  scoped.forEach(function (log) {
    var level = workOrderLevel(log);
    var item = document.createElement("div");
    item.className = "wo-item" + (level ? " wo-level-" + level : "");
    if (log.OBJECTID === state.editingWorkOrderId) {
      item.appendChild(buildWorkOrderEditForm(log));
      dom.workOrderList.appendChild(item);
      return;
    }
    var unitLabel = workOrderLocationLabel(log);
    var top = document.createElement("div");
    top.className = "wo-top";
    var issueSpan = document.createElement("span");
    issueSpan.textContent = WO_ISSUE_LABELS[log.IssueType] || log.IssueType || "Issue";
    var badges = document.createElement("span");
    badges.className = "wo-badges";
    if (log.Severity) {
      var sevSpan = document.createElement("span");
      sevSpan.className = "wo-severity " + (WO_SEVERITY_CLASS[log.Severity] || "wo-sev-medium");
      sevSpan.textContent = WO_SEVERITY_LABELS[log.Severity] || log.Severity;
      badges.appendChild(sevSpan);
    }
    var statusSpan = document.createElement("span");
    statusSpan.className = "wo-status " + (WO_STATUS_CLASS[log.Status] || "wo-status-rep");
    statusSpan.textContent = WO_STATUS_LABELS[log.Status] || log.Status || "";
    badges.appendChild(statusSpan);
    top.appendChild(issueSpan);
    top.appendChild(badges);
    var desc = document.createElement("div");
    desc.className = "wo-desc";
    desc.textContent = log.Description || "";
    var meta = document.createElement("div");
    meta.className = "wo-meta";
    var reportedDate = log.DateReported ? new Date(log.DateReported).toLocaleDateString() : "—";
    meta.textContent = unitLabel + " · Reported " + reportedDate + (log.ReportedBy ? " by " + log.ReportedBy : "");
    item.appendChild(top);
    if (log.Description) item.appendChild(desc);
    item.appendChild(meta);
    var actionsRow = document.createElement("div");
    actionsRow.className = "wo-actions-row";
    var editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "wo-edit-btn";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", function () {
      state.editingWorkOrderId = log.OBJECTID;
      renderWorkOrders();
    });
    actionsRow.appendChild(editBtn);
    if (state.activeWoTab !== "closed") {
      var completeBtn = document.createElement("button");
      completeBtn.type = "button";
      completeBtn.className = "wo-complete-btn";
      completeBtn.textContent = "Mark Completed";
      completeBtn.addEventListener("click", function () {
        markWorkOrderCompleted(log, completeBtn);
      });
      actionsRow.appendChild(completeBtn);
    }
    item.appendChild(actionsRow);
    dom.workOrderList.appendChild(item);
  });
}
function markWorkOrderCompleted(log, btn) {
  dom.woActionError.textContent = "";
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Saving…";
  }
  var resolvedAt = Date.now();
  applyEdits(9, {
    updates: [{
      attributes: {
        OBJECTID: log.OBJECTID,
        Status: "CMP",
        DateResolved: resolvedAt
      }
    }]
  }).then(function (result) {
    if (result.error) {
      dom.woActionError.textContent = "ArcGIS error " + result.error.code + ": " + result.error.message;
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Mark Completed";
      }
      return;
    }
    var updateResult = result.updateResults && result.updateResults[0];
    if (!updateResult || !updateResult.success) {
      var msg = updateResult && updateResult.error ? updateResult.error.description || updateResult.error.message : "Unexpected response: " + JSON.stringify(result);
      dom.woActionError.textContent = msg;
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Mark Completed";
      }
      return;
    }
    log.Status = "CMP";
    log.DateResolved = resolvedAt;
    renderWorkOrders();
  }).catch(function (err) {
    dom.woActionError.textContent = "Save failed: " + err.message;
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Mark Completed";
    }
  });
}
function unitMatchesActiveClient(unit) {
  return !state.activeClientId || !!(unit && unit.ClientID === state.activeClientId);
}
function populateWoUnitSelect() {
  dom.woUnitSelect.innerHTML = "";
  var placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "-- Select a unit --";
  dom.woUnitSelect.appendChild(placeholder);
  var allUnits = Object.keys(state.unitsById).map(function (id) {
    return state.unitsById[id];
  });
  var scoped = allUnits.filter(function (u) {
    if (state.activeStructureId && String(u.StructureID) !== String(state.activeStructureId)) return false;
    return unitMatchesActiveClient(u);
  });
  scoped.sort(function (a, b) {
    return String(a.UnitNumber || "").localeCompare(String(b.UnitNumber || ""), undefined, {
      numeric: true
    });
  });
  scoped.forEach(function (u) {
    var option = document.createElement("option");
    option.value = u.UnitID;
    option.textContent = "Unit " + (u.UnitNumber || u.UnitID) + (u.UnitName ? " — " + u.UnitName : "");
    dom.woUnitSelect.appendChild(option);
  });
  if (state.editingUnitId && scoped.some(function (u) {
    return u.UnitID === state.editingUnitId;
  })) {
    dom.woUnitSelect.value = state.editingUnitId;
  }
}
function populateWoFloorSelect() {
  dom.woFloorSelect.innerHTML = "";
  var placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "-- Select a floor --";
  dom.woFloorSelect.appendChild(placeholder);
  var floors = state.activeStructureId ? state.floorsByStructure[state.activeStructureId] || [] : [];
  floors.forEach(function (f) {
    var option = document.createElement("option");
    option.value = f.FloorID;
    option.textContent = "Floor " + f.FloorNumber;
    dom.woFloorSelect.appendChild(option);
  });
  if (state.activeFloorId && floors.some(function (f) {
    return f.FloorID === state.activeFloorId;
  })) {
    dom.woFloorSelect.value = state.activeFloorId;
  }
}
function populateWoRoomSelect() {
  dom.woRoomSelect.innerHTML = "";
  var placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "-- Select a room --";
  dom.woRoomSelect.appendChild(placeholder);
  var allRooms = Object.keys(state.roomsById).map(function (id) {
    return state.roomsById[id];
  });
  var scoped = allRooms.filter(function (r) {
    if (state.activeFloorId) {
      if (String(r.FloorID) !== String(state.activeFloorId)) return false;
    } else if (state.activeStructureId) {
      var floor = state.floorsById[r.FloorID];
      if (!floor || String(floor.StructureID) !== String(state.activeStructureId)) return false;
    }
    if (state.activeClientId) {
      var unit = r.UnitID ? state.unitsById[r.UnitID] : null;
      if (!unitMatchesActiveClient(unit)) return false;
    }
    return true;
  });
  scoped.sort(function (a, b) {
    return String(a.RoomNumber || "").localeCompare(String(b.RoomNumber || ""), undefined, {
      numeric: true
    });
  });
  scoped.forEach(function (r) {
    var option = document.createElement("option");
    option.value = r.RoomID;
    option.textContent = "Room " + (r.RoomNumber || r.RoomID);
    dom.woRoomSelect.appendChild(option);
  });
}
function updateWoLevelVisibility() {
  var level = dom.woLevel.value;
  dom.woStructureWrap.hidden = level !== "STRUCTURE";
  dom.woFloorWrap.hidden = level !== "FLOOR";
  dom.woUnitWrap.hidden = level !== "UNIT";
  dom.woRoomWrap.hidden = level !== "ROOM";
  if (level === "STRUCTURE") {
    var structure = state.activeStructureId && state.structuresById[state.activeStructureId];
    dom.woStructureNote.textContent = structure ? "Applies to the entire " + (structure.StructureName || "building") + "." : "Select a building in the sidebar first.";
  }
}
function resetAddWorkOrderForm() {
  dom.addWorkOrderForm.reset();
  dom.woAddError.textContent = "";
  dom.addWorkOrderForm.hidden = true;
  dom.addWorkOrderBtn.textContent = "+ New";
  dom.woLevel.value = "UNIT";
  dom.woSeverity.value = "MEDIUM";
  updateWoLevelVisibility();
}
function initWorkOrders() {
  dom.workOrderTabs.addEventListener("click", function (e) {
    var btn = e.target.closest(".wo-tab");
    if (!btn) return;
    state.activeWoTab = btn.dataset.tab;
    dom.workOrderTabs.querySelectorAll(".wo-tab").forEach(function (b) {
      b.classList.toggle("active", b === btn);
    });
    renderWorkOrders();
  });
  dom.woLevel.addEventListener("change", updateWoLevelVisibility);
  dom.addWorkOrderBtn.addEventListener("click", function () {
    var showing = !dom.addWorkOrderForm.hidden;
    dom.addWorkOrderForm.hidden = showing;
    dom.addWorkOrderBtn.textContent = showing ? "+ New" : "Cancel";
    if (!showing) {
      dom.woLevel.value = "UNIT";
      dom.woSeverity.value = "MEDIUM";
      populateWoUnitSelect();
      populateWoFloorSelect();
      populateWoRoomSelect();
      updateWoLevelVisibility();
    }
  });
  dom.woAddCancel.addEventListener("click", resetAddWorkOrderForm);
  dom.addWorkOrderForm.addEventListener("submit", function (e) {
    e.preventDefault();
    dom.woAddError.textContent = "";
    var level = dom.woLevel.value;
    var attrs = {
      UnitID: null,
      StructureID: null,
      FloorID: null,
      RoomID: null,
      // TEXT GUID fields, like every other *ID in this schema -- never coerce to Number
      IssueType: dom.woIssueType.value,
      Severity: dom.woSeverity.value || "MEDIUM",
      Description: dom.woDescription.value || null,
      ReportedBy: dom.woReportedBy.value || null,
      Status: "REP",
      DateReported: Date.now()
    };
    if (level === "UNIT") {
      if (!dom.woUnitSelect.value) {
        dom.woAddError.textContent = "Select a unit.";
        return;
      }
      attrs.UnitID = dom.woUnitSelect.value;
    } else if (level === "STRUCTURE") {
      if (!state.activeStructureId) {
        dom.woAddError.textContent = "Select a building in the sidebar first.";
        return;
      }
      attrs.StructureID = state.activeStructureId;
    } else if (level === "FLOOR") {
      if (!dom.woFloorSelect.value) {
        dom.woAddError.textContent = "Select a floor.";
        return;
      }
      attrs.FloorID = dom.woFloorSelect.value;
    } else if (level === "ROOM") {
      if (!dom.woRoomSelect.value) {
        dom.woAddError.textContent = "Select a room.";
        return;
      }
      attrs.RoomID = dom.woRoomSelect.value;
    }
    var saveBtn = document.getElementById("woAddSave");
    saveBtn.disabled = true;
    applyEdits(9, {
      adds: [{
        attributes: attrs
      }]
    }).then(function (result) {
      if (result.error) {
        dom.woAddError.textContent = "ArcGIS error " + (result.error.code || "") + ": " + (result.error.message || JSON.stringify(result.error));
        saveBtn.disabled = false;
        return;
      }
      var addResult = result.addResults && result.addResults[0];
      if (!addResult || !addResult.success) {
        var msg = addResult && addResult.error && (addResult.error.description || addResult.error.message) || "Unexpected response: " + JSON.stringify(result);
        dom.woAddError.textContent = msg;
        saveBtn.disabled = false;
        return;
      }
      attrs.OBJECTID = addResult.objectId;
      state.maintenanceLogs.push(attrs);
      renderWorkOrders();
      saveBtn.disabled = false;
      resetAddWorkOrderForm();
    }).catch(function (err) {
      dom.woAddError.textContent = "Could not reach the server: " + (err && err.message ? err.message : err);
      saveBtn.disabled = false;
    });
  });
}
export { resolveWorkOrderContext, workOrderInScope, workOrderLocationLabel, workOrderLevel, severityOrder, buildWorkOrderEditForm, renderWorkOrders, markWorkOrderCompleted, unitMatchesActiveClient, populateWoUnitSelect, populateWoFloorSelect, populateWoRoomSelect, updateWoLevelVisibility, resetAddWorkOrderForm, initWorkOrders };
