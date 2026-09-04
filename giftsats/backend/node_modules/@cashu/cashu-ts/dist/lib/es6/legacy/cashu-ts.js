export var deprecatedAmountPreferences = function (pref) {
    console.warn('[DEPRECATION] Use `Preferences` instead of `Array<AmountPreference>`');
    return { sendPreference: pref };
};
export var isAmountPreference = function (obj) {
    return (typeof obj === 'object' &&
        obj !== null &&
        'amount' in obj &&
        'count' in obj &&
        typeof obj.amount === 'number' &&
        typeof obj.count === 'number');
};
export var isAmountPreferenceArray = function (preference) {
    return Array.isArray(preference) && preference.every(function (item) { return isAmountPreference(item); });
};
//# sourceMappingURL=cashu-ts.js.map