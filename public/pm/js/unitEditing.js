import { state } from './state.js';
import { dom } from './dom.js';
import { applyEdits } from './utils.js';
import { renderWorkOrders } from './workOrders.js';
import { renderMepContacts } from './mepContacts.js';
import { applyFilters, refreshBookmarkRelevance } from './filters.js';

function openEditPanel(attrs) {
  state.editingObjectId = attrs[state.unitsLayer.objectIdField];
  state.editingUnitId = attrs.UnitID;
  dom.editUnitError.textContent = "";
  dom.editUnitSaved.textContent = "";
  dom.editUnitNumber.value = attrs.UnitNumber || "";
  dom.editUnitName.value = attrs.UnitName || "";
  dom.editUnitStatus.value = attrs.Status || "ACTIVE";
  dom.editUnitClient.value = attrs.ClientID || "";
  dom.editUnitSqFt.value = attrs.SqFt !== null && attrs.SqFt !== undefined ? attrs.SqFt : "";
  dom.editUnitNotes.value = attrs.Notes || "";
  dom.editPanel.hidden = false;
  renderWorkOrders();
  renderMepContacts();
}
function closeEditPanel() {
  dom.editPanel.hidden = true;
  state.editingObjectId = null;
  renderWorkOrders();
  renderMepContacts();
}
function initUnitEditing() {
  dom.editPanelClose.addEventListener("click", closeEditPanel);
  dom.editUnitCancel.addEventListener("click", closeEditPanel);
  dom.editUnitForm.addEventListener("submit", function (e) {
    e.preventDefault();
    if (state.editingObjectId === null) return;
    dom.editUnitError.textContent = "";
    dom.editUnitSaved.textContent = "";
    var updatedAttrs = {};
    updatedAttrs[state.unitsLayer.objectIdField] = state.editingObjectId;
    updatedAttrs.UnitNumber = dom.editUnitNumber.value || null;
    updatedAttrs.UnitName = dom.editUnitName.value || null;
    updatedAttrs.Status = dom.editUnitStatus.value;
    updatedAttrs.ClientID = dom.editUnitClient.value || null;
    updatedAttrs.SqFt = dom.editUnitSqFt.value === "" ? null : Number(dom.editUnitSqFt.value);
    updatedAttrs.Notes = dom.editUnitNotes.value || null;
    applyEdits(1, {
      updates: [{
        attributes: updatedAttrs
      }]
    }).then(function (result) {
      if (result.error) {
        dom.editUnitError.textContent = "ArcGIS error " + (result.error.code || "") + ": " + (result.error.message || JSON.stringify(result.error));
        return;
      }
      var updateResult = result.updateResults && result.updateResults[0];
      if (!updateResult || !updateResult.success) {
        var msg = updateResult && updateResult.error && (updateResult.error.description || updateResult.error.message) || "Unexpected response: " + JSON.stringify(result);
        dom.editUnitError.textContent = msg;
        return;
      }
      var unit = state.unitsById[state.editingUnitId];
      if (unit) {
        if (unit.ClientID !== updatedAttrs.ClientID) {
          var oldList = state.unitIdsByClient[unit.ClientID];
          if (oldList) {
            var idx = oldList.indexOf(state.editingUnitId);
            if (idx !== -1) oldList.splice(idx, 1);
          }
          if (updatedAttrs.ClientID) {
            var newList = state.unitIdsByClient[updatedAttrs.ClientID] || (state.unitIdsByClient[updatedAttrs.ClientID] = []);
            newList.push(state.editingUnitId);
          }
        }
        unit.UnitNumber = updatedAttrs.UnitNumber;
        unit.UnitName = updatedAttrs.UnitName;
        unit.Status = updatedAttrs.Status;
        unit.ClientID = updatedAttrs.ClientID;
        unit.SqFt = updatedAttrs.SqFt;
        unit.Notes = updatedAttrs.Notes;
      }
      dom.editUnitSaved.textContent = "Saved.";
      state.unitsLayer.refresh();
      applyFilters();
      refreshBookmarkRelevance();
    }).catch(function (err) {
      dom.editUnitError.textContent = "Could not reach the server: " + (err && err.message ? err.message : err);
    });
  });
}
export { openEditPanel, closeEditPanel, initUnitEditing };
