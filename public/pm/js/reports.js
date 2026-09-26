import { state } from './state.js';
import { dom } from './dom.js';
import { clientNameFor } from './clients.js';
import { resolveWorkOrderContext } from './workOrders.js';

function computeUnitProblemStats(structureFilter) {
  var stats = {}; // UnitID -> {count, open, completed, lastDate}
  state.maintenanceLogs.forEach(function (log) {
    var ctx = resolveWorkOrderContext(log);
    if (!ctx.unitId) return;
    if (structureFilter && String(ctx.structureId || "") !== String(structureFilter)) return;
    var s = stats[ctx.unitId] || (stats[ctx.unitId] = {
      count: 0,
      open: 0,
      completed: 0,
      lastDate: 0
    });
    s.count++;
    if (log.Status === "CMP") s.completed++;else s.open++;
    if (log.DateReported && log.DateReported > s.lastDate) s.lastDate = log.DateReported;
  });
  return stats;
}
function populateReportsBuildingFilter() {
  var previousValue = dom.reportsBuildingFilter.value;
  dom.reportsBuildingFilter.innerHTML = "";
  var allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = "All Buildings";
  dom.reportsBuildingFilter.appendChild(allOption);
  var sorted = Object.keys(state.structuresById).map(function (id) {
    return state.structuresById[id];
  }).sort(function (a, b) {
    return (a.StructureName || "").localeCompare(b.StructureName || "");
  });
  sorted.forEach(function (s) {
    var opt = document.createElement("option");
    opt.value = s.StructureID;
    opt.textContent = s.StructureName || s.StructureID;
    dom.reportsBuildingFilter.appendChild(opt);
  });
  dom.reportsBuildingFilter.value = previousValue; // no-op if it no longer exists
}
function renderReportsTable() {
  var structureFilter = dom.reportsBuildingFilter.value || null;
  var stats = computeUnitProblemStats(structureFilter);
  var rows = Object.keys(stats).map(function (unitId) {
    var unit = state.unitsById[unitId];
    var structure = unit && state.structuresById[unit.StructureID];
    var s = stats[unitId];
    return {
      unitLabel: unit ? "Unit " + (unit.UnitNumber || unitId) + (unit.UnitName ? " — " + unit.UnitName : "") : "Unit " + unitId,
      buildingLabel: structure ? structure.StructureName || "—" : "—",
      clientLabel: unit && unit.ClientID ? clientNameFor(unit.ClientID) : "Unassigned",
      total: s.count,
      open: s.open,
      completed: s.completed,
      lastDate: s.lastDate
    };
  });
  rows.sort(function (a, b) {
    if (b.total !== a.total) return b.total - a.total;
    if (b.open !== a.open) return b.open - a.open;
    return b.lastDate - a.lastDate;
  });
  dom.reportsTableBody.innerHTML = "";
  if (!rows.length) {
    var tr = document.createElement("tr");
    var td = document.createElement("td");
    td.colSpan = 8;
    td.textContent = "No work orders logged" + (structureFilter ? " for this building." : " yet.");
    tr.appendChild(td);
    dom.reportsTableBody.appendChild(tr);
    return;
  }
  rows.forEach(function (row, i) {
    var tr = document.createElement("tr");
    [i + 1, row.unitLabel, row.buildingLabel, row.clientLabel, row.total, row.open, row.completed, row.lastDate ? new Date(row.lastDate).toLocaleDateString() : "—"].forEach(function (value) {
      var td = document.createElement("td");
      td.textContent = value;
      tr.appendChild(td);
    });
    dom.reportsTableBody.appendChild(tr);
  });
}
function initReports() {
  dom.reportsBtn.addEventListener("click", function () {
    populateReportsBuildingFilter();
    renderReportsTable();
    dom.reportsModal.hidden = false;
  });
  dom.reportsClose.addEventListener("click", function () {
    dom.reportsModal.hidden = true;
  });
  dom.reportsModal.addEventListener("click", function (e) {
    if (e.target === dom.reportsModal) dom.reportsModal.hidden = true; // click on backdrop closes
  });
  dom.reportsBuildingFilter.addEventListener("change", renderReportsTable);
}
export { computeUnitProblemStats, populateReportsBuildingFilter, renderReportsTable, initReports };
