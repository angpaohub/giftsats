import { AmountPreference, Preferences } from '../model/types/index';
export declare const deprecatedAmountPreferences: (pref: Array<AmountPreference>) => Preferences;
export declare const isAmountPreference: (obj: any) => obj is AmountPreference;
export declare const isAmountPreferenceArray: (preference?: any) => preference is AmountPreference[];
