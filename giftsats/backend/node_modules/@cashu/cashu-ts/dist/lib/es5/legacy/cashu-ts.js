"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAmountPreferenceArray = exports.isAmountPreference = exports.deprecatedAmountPreferences = void 0;
var deprecatedAmountPreferences = function (pref) {
    console.warn('[DEPRECATION] Use `Preferences` instead of `Array<AmountPreference>`');
    return { sendPreference: pref };
};
exports.deprecatedAmountPreferences = deprecatedAmountPreferences;
var isAmountPreference = function (obj) {
    return (typeof obj === 'object' &&
        obj !== null &&
        'amount' in obj &&
        'count' in obj &&
        typeof obj.amount === 'number' &&
        typeof obj.count === 'number');
};
exports.isAmountPreference = isAmountPreference;
var isAmountPreferenceArray = function (preference) {
    return Array.isArray(preference) && preference.every(function (item) { return (0, exports.isAmountPreference)(item); });
};
exports.isAmountPreferenceArray = isAmountPreferenceArray;
