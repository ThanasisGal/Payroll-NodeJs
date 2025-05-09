import { createDropdownApi } from './createDropdownApi.js';

export function buildDropdownRoute(model, options = {}) {
  return createDropdownApi(model, options);
}
