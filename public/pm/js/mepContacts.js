import { state } from './state.js';
import { dom } from './dom.js';
import { applyEdits } from './utils.js';
import { structureHasClientUnits } from './filters.js';
import { clientNameFor } from './clients.js';

function mepInScope(c) {
  if (state.editingObjectId !== null) {
    var scopedUnit = state.unitsById[state.editingUnitId];
    if (c.UnitID) return c.UnitID === state.editingUnitId;
    if (c.StructureID) return c.StructureID === state.activeStructureId;
    if (c.ClientID) return !!(scopedUnit && scopedUnit.ClientID === c.ClientID);
    return false;
  }
  var inBuilding;
  if (c.StructureID) {
    inBuilding = c.StructureID === state.activeStructureId;
  } else if (c.UnitID) {
    var unit = state.unitsById[c.UnitID];
    inBuilding = !!(unit && unit.StructureID === state.activeStructureId);
  } else if (c.ClientID) {
    inBuilding = structureHasClientUnits(state.activeStructureId, c.ClientID);
  } else {
    inBuilding = false; // shouldn't happen -- every vendor needs at least one of these
  }
  if (!inBuilding) return false;
  if (!state.activeClientId) return true;
  return !c.ClientID || c.ClientID === state.activeClientId;
}
function renderMepContacts() {
  dom.mepList.innerHTML = "";
  if (!state.activeStructureId) {
    dom.mepScopeLabel.hidden = true;
    dom.mepList.innerHTML = "<p>Select a building below to see its vendor contacts.</p>";
    return;
  }
  if (state.editingObjectId !== null) {
    var scopedUnit = state.unitsById[state.editingUnitId];
    dom.mepScopeLabel.hidden = false;
    dom.mepScopeLabel.textContent = "Showing: Unit " + (scopedUnit ? scopedUnit.UnitNumber || state.editingUnitId : state.editingUnitId) + " + shared";
  } else {
    dom.mepScopeLabel.hidden = true;
  }
  var scoped = state.mepContacts.filter(mepInScope);
  if (!scoped.length) {
    var emptyDesc = state.editingObjectId !== null ? " for this unit." : state.activeClientId ? " for this client in this building." : " for this building.";
    dom.mepList.innerHTML = "<p>No vendor contacts on file" + emptyDesc + "</p>";
    return;
  }
  scoped.forEach(function (c) {
    var unit = c.UnitID && state.unitsById[c.UnitID];
    var scopeLabel = unit ? "Unit " + (unit.UnitNumber || c.UnitID) : c.StructureID ? "Building-wide" : "All properties";
    var ownerLabel = c.ClientID ? clientNameFor(c.ClientID) : "Shared";
    var contactBits = [c.ContactName, c.Phone, c.Email].filter(Boolean).join(" · ");
    var item = document.createElement("div");
    item.className = "mep-item";
    var top = document.createElement("div");
    top.className = "mep-top";
    top.textContent = (c.Trade || "Vendor") + (c.VendorName ? " — " + c.VendorName : "");
    var meta = document.createElement("div");
    meta.className = "mep-meta";
    meta.textContent = scopeLabel + " · " + ownerLabel + (contactBits ? " · " + contactBits : "");
    item.appendChild(top);
    item.appendChild(meta);
    if (c.Notes) {
      var notes = document.createElement("div");
      notes.className = "mep-meta";
      notes.textContent = c.Notes;
      item.appendChild(notes);
    }
    dom.mepList.appendChild(item);
  });
}
function resetAddMepForm() {
  dom.addMepForm.reset();
  dom.mepAddError.textContent = "";
  dom.addMepForm.hidden = true;
  dom.addMepBtn.textContent = "+ New";
}
function initMepContacts() {
  dom.addMepBtn.addEventListener("click", function () {
    var showing = !dom.addMepForm.hidden;
    dom.addMepForm.hidden = showing;
    dom.addMepBtn.textContent = showing ? "+ New" : "Cancel";
  });
  dom.mepAddCancel.addEventListener("click", resetAddMepForm);
  dom.addMepForm.addEventListener("submit", function (e) {
    e.preventDefault();
    dom.mepAddError.textContent = "";
    if (!state.activeStructureId && !dom.mepClient.value) {
      dom.mepAddError.textContent = "Select a building, or assign this vendor to a client.";
      return;
    }
    var attrs = {
      StructureID: state.activeStructureId || null,
      // null when this is a client's portable vendor
      UnitID: null,
      ClientID: dom.mepClient.value || null,
      // blank = shared/building-wide
      Trade: dom.mepTrade.value || null,
      VendorName: dom.mepVendorName.value || null,
      ContactName: dom.mepContactName.value || null,
      Phone: dom.mepPhone.value || null,
      Email: dom.mepEmail.value || null,
      Notes: dom.mepNotes.value || null
    };
    var saveBtn = document.getElementById("mepAddSave");
    saveBtn.disabled = true;
    applyEdits(8, {
      adds: [{
        attributes: attrs
      }]
    }).then(function (result) {
      if (result.error) {
        dom.mepAddError.textContent = "ArcGIS error " + (result.error.code || "") + ": " + (result.error.message || JSON.stringify(result.error));
        saveBtn.disabled = false;
        return;
      }
      var addResult = result.addResults && result.addResults[0];
      if (!addResult || !addResult.success) {
        var msg = addResult && addResult.error && (addResult.error.description || addResult.error.message) || "Unexpected response: " + JSON.stringify(result);
        dom.mepAddError.textContent = msg;
        saveBtn.disabled = false;
        return;
      }
      attrs.OBJECTID = addResult.objectId;
      state.mepContacts.push(attrs);
      renderMepContacts();
      saveBtn.disabled = false;
      resetAddMepForm();
    }).catch(function (err) {
      dom.mepAddError.textContent = "Could not reach the server: " + (err && err.message ? err.message : err);
      saveBtn.disabled = false;
    });
  });
}
export { mepInScope, renderMepContacts, resetAddMepForm, initMepContacts };
