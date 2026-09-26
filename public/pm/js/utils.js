import { state } from './state.js';

export function sqlQuote(value){
  return "'" + String(value).replace(/'/g, "''") + "'";
}

// Matches the {UPPERCASE-GUID} convention the ArcGIS Pro backfill tooling
// uses for StructureID/FloorID/UnitID/RoomID, so a client added here looks
// the same as one added any other way. ClientID is a plain TEXT field (not
// a GlobalID), so nothing auto-generates a value for it on add -- this has
// to happen client-side.
export function newGuid(){
  return "{" + crypto.randomUUID().toUpperCase() + "}";
}

// Copies a static select's <option> list into a fresh <select>, so a
// per-item edit form can offer exactly the same choices as the Add form
// without duplicating those option lists in JS.
export function cloneSelectOptions(sourceSelect){
  var clone = document.createElement("select");
  sourceSelect.querySelectorAll("option").forEach(function(o){
    var opt = document.createElement("option");
    opt.value = o.value;
    opt.textContent = o.textContent;
    clone.appendChild(opt);
  });
  return clone;
}

// The Clients table (a non-spatial table on the same FeatureServer) and the
// Units-to-ClientID mapping aren't map layers, so they're queried directly
// over REST rather than through a FeatureLayer.
export function queryTable(index, params){
  var url = new URL(state.baseUrl + "/" + index + "/query");
  Object.keys(params).forEach(function(k){ url.searchParams.set(k, params[k]); });
  url.searchParams.set("token", state.token);
  url.searchParams.set("f", "json");
  return fetch(url.toString()).then(function(res){ return res.json(); });
}

// Shared applyEdits helper -- geometry is never touched here (that stays in
// ArcGIS Pro); this only ever sends attribute adds/updates. `edits` is
// {adds?, updates?, deletes?}, each the JSON array the REST operation
// expects for that param (each item like {attributes: {...}}) -- every key
// present gets its own stringified form param; a key left out is omitted
// entirely.
export function applyEdits(index, edits){
  var url = state.baseUrl + "/" + index + "/applyEdits";
  var params = { f: "json", token: state.token };
  if (edits.adds) params.adds = JSON.stringify(edits.adds);
  if (edits.updates) params.updates = JSON.stringify(edits.updates);
  if (edits.deletes) params.deletes = JSON.stringify(edits.deletes);
  var body = new URLSearchParams(params);
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  }).then(function(res){ return res.json(); });
}
