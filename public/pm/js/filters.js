import { state } from './state.js';
import { dom } from './dom.js';
import { sqlQuote } from './utils.js';
import { showMapStatus } from './main.js';
import { renderWorkOrders } from './workOrders.js';
import { renderMepContacts } from './mepContacts.js';

function applyFilters() {
  var floorClause = state.activeFloorId ? "FloorID = " + sqlQuote(state.activeFloorId) : "1=1";
  if (!state.activeClientId) {
    state.floorsLayer.definitionExpression = floorClause;
    state.unitsLayer.definitionExpression = floorClause;
    state.roomsLayer.definitionExpression = floorClause;
    state.evacLayer.definitionExpression = floorClause;
  } else {
    var unitIds = state.unitIdsByClient[state.activeClientId] || [];
    var unitIdClause = unitIds.length ? "UnitID IN (" + unitIds.map(sqlQuote).join(",") + ")" : "1=0";
    state.floorsLayer.definitionExpression = floorClause; // building footprints aren't client-specific
    state.unitsLayer.definitionExpression = floorClause + " AND ClientID = " + sqlQuote(state.activeClientId);
    state.roomsLayer.definitionExpression = floorClause + " AND " + unitIdClause;
    state.evacLayer.definitionExpression = floorClause + " AND " + unitIdClause;
  }
  var btns = dom.floorButtons.querySelectorAll(".floor-btn");
  btns.forEach(function (btn) {
    btn.classList.toggle("active", btn.dataset.floorId === (state.activeFloorId || ""));
  });
  renderWorkOrders();
  renderMepContacts();
}
function setFloorFilter(floorId) {
  state.activeFloorId = floorId;
  applyFilters();
}
function showFloorPicker(structureId) {
  state.activeStructureId = structureId;
  var floors = state.floorsByStructure[structureId] || [];
  dom.floorButtons.innerHTML = "";
  renderMepContacts();
  if (!floors.length) {
    dom.floorButtons.innerHTML = "<p>No floors on record for this building.</p>";
    setFloorFilter(null);
    return;
  }
  var allBtn = document.createElement("button");
  allBtn.type = "button";
  allBtn.className = "floor-btn";
  allBtn.textContent = "All floors";
  allBtn.dataset.floorId = "";
  allBtn.addEventListener("click", function () {
    setFloorFilter(null);
  });
  dom.floorButtons.appendChild(allBtn);
  floors.forEach(function (f) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "floor-btn";
    btn.textContent = "Floor " + f.FloorNumber;
    btn.dataset.floorId = f.FloorID;
    btn.addEventListener("click", function () {
      setFloorFilter(f.FloorID);
    });
    dom.floorButtons.appendChild(btn);
  });
  setFloorFilter(floors[0].FloorID);
}
function structureHasClientUnits(structureId, clientId) {
  var unitIds = state.unitIdsByClient[clientId] || [];
  return unitIds.some(function (uid) {
    var u = state.unitsById[uid];
    return u && String(u.StructureID) === String(structureId);
  });
}
function refreshBookmarkRelevance() {
  var btns = dom.bookmarkList.querySelectorAll(".bookmark-btn");
  btns.forEach(function (btn) {
    var relevant = !state.activeClientId || structureHasClientUnits(btn.dataset.structureId, state.activeClientId);
    btn.classList.toggle("muted", !relevant);
    var flag = btn.querySelector(".b-flag");
    if (!relevant) {
      if (!flag) {
        flag = document.createElement("span");
        flag.className = "b-flag";
        flag.textContent = "No units for this client";
        btn.appendChild(flag);
      }
    } else if (flag) {
      flag.remove();
    }
  });
}
function zoomToClientExtent() {
  var extentQuery;
  if (state.activeClientId) {
    extentQuery = state.unitsLayer.queryExtent({
      where: "ClientID = " + sqlQuote(state.activeClientId)
    });
  } else {
    extentQuery = state.structuresLayer.queryExtent();
  }
  console.log("zoomToClientExtent: querying", state.activeClientId ? "unitsLayer for ClientID=" + state.activeClientId : "structuresLayer (all)");
  extentQuery.then(function (extentResult) {
    console.log("zoomToClientExtent result:", extentResult, "count:", extentResult && extentResult.count, "extent:", extentResult && extentResult.extent);
    if (extentResult && extentResult.extent) {
      state.view.goTo(extentResult.extent.expand(1.3)).then(function () {
        console.log("zoomToClientExtent: goTo resolved");
      }).catch(function (goErr) {
        console.log("zoomToClientExtent: goTo rejected", goErr);
      });
    } else {
      console.log("zoomToClientExtent: no extent to zoom to (0 features or null extent)");
    }
  }).catch(function (err) {
    console.log("zoomToClientExtent: queryExtent error", err);
    showMapStatus("Could not zoom to client: " + (err && err.message ? err.message : err));
  });
}
function initFilters() {
  dom.clientSelect.addEventListener("change", function () {
    state.activeClientId = dom.clientSelect.value || null;
    dom.viewingLine.textContent = "Viewing: " + dom.clientSelect.options[dom.clientSelect.selectedIndex].textContent;
    applyFilters();
    refreshBookmarkRelevance();
    zoomToClientExtent();
  });
}
export { applyFilters, setFloorFilter, showFloorPicker, structureHasClientUnits, refreshBookmarkRelevance, zoomToClientExtent, initFilters };
