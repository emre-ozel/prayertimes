/**
 * Prayer Times - Preferences
 * Compatible with GNOME 45+ (ESM modules)
 */

import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';

import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

// Calculation methods from Aladhan API
const CALCULATION_METHODS = [
    { id: 13, name: 'Diyanet İşleri Başkanlığı (Turkey)' },
    { id: 3, name: 'Muslim World League' },
    { id: 2, name: 'Islamic Society of North America (ISNA)' },
    { id: 4, name: 'Umm Al-Qura University, Makkah' },
    { id: 5, name: 'Egyptian General Authority of Survey' },
    { id: 1, name: 'University of Islamic Sciences, Karachi' },
    { id: 7, name: 'Institute of Geophysics, University of Tehran' },
    { id: 8, name: 'Gulf Region' },
    { id: 9, name: 'Kuwait' },
    { id: 10, name: 'Qatar' },
    { id: 11, name: 'Majlis Ugama Islam Singapura' },
    { id: 12, name: 'Union Organization Islamic de France' },
    { id: 14, name: 'Spiritual Administration of Muslims of Russia' },
    { id: 15, name: 'Moonsighting Committee Worldwide' },
    { id: 0, name: 'Shia Ithna-Ashari' }
];

export default class PrayerTimesTRPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        // Create main page
        const page = new Adw.PreferencesPage({
            title: _('Prayer Times'),
            icon_name: 'preferences-system-time-symbolic'
        });
        window.add(page);

        // ==================== Location Group ====================
        const locationGroup = new Adw.PreferencesGroup({
            title: _('Location Settings'),
            description: _('Configure how your location is determined')
        });
        page.add(locationGroup);

        // Auto location toggle
        const autoLocationRow = new Adw.SwitchRow({
            title: _('Automatic Location'),
            subtitle: _('Detect location automatically using IP geolocation')
        });
        settings.bind(
            'auto-location',
            autoLocationRow,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        locationGroup.add(autoLocationRow);

        // Detected location info
        const detectedCity = settings.get_string('detected-city');
        const detectedLat = settings.get_double('detected-latitude');
        const detectedLon = settings.get_double('detected-longitude');

        if (detectedCity || detectedLat !== 0 || detectedLon !== 0) {
            const detectedRow = new Adw.ActionRow({
                title: _('Detected Location'),
                subtitle: `${detectedCity || 'Unknown'} (${detectedLat.toFixed(4)}, ${detectedLon.toFixed(4)})`
            });
            detectedRow.add_suffix(new Gtk.Image({
                icon_name: 'emblem-ok-symbolic',
                valign: Gtk.Align.CENTER
            }));
            locationGroup.add(detectedRow);
        }

        // Manual latitude
        const latitudeRow = new Adw.SpinRow({
            title: _('Latitude'),
            subtitle: _('Manual latitude coordinate (-90 to 90)'),
            adjustment: new Gtk.Adjustment({
                lower: -90,
                upper: 90,
                step_increment: 0.0001,
                page_increment: 1
            }),
            digits: 4
        });
        settings.bind(
            'latitude',
            latitudeRow,
            'value',
            Gio.SettingsBindFlags.DEFAULT
        );
        locationGroup.add(latitudeRow);

        // Manual longitude
        const longitudeRow = new Adw.SpinRow({
            title: _('Longitude'),
            subtitle: _('Manual longitude coordinate (-180 to 180)'),
            adjustment: new Gtk.Adjustment({
                lower: -180,
                upper: 180,
                step_increment: 0.0001,
                page_increment: 1
            }),
            digits: 4
        });
        settings.bind(
            'longitude',
            longitudeRow,
            'value',
            Gio.SettingsBindFlags.DEFAULT
        );
        locationGroup.add(longitudeRow);

        // Bind sensitivity to auto-location setting
        settings.bind(
            'auto-location',
            latitudeRow,
            'sensitive',
            Gio.SettingsBindFlags.INVERT_BOOLEAN
        );
        settings.bind(
            'auto-location',
            longitudeRow,
            'sensitive',
            Gio.SettingsBindFlags.INVERT_BOOLEAN
        );

        // ==================== Calculation Method Group ====================
        const methodGroup = new Adw.PreferencesGroup({
            title: _('Calculation Method'),
            description: _('Select the prayer time calculation method')
        });
        page.add(methodGroup);

        // Create string list for methods
        const methodStrings = CALCULATION_METHODS.map(m => m.name);
        const stringList = Gtk.StringList.new(methodStrings);

        const methodRow = new Adw.ComboRow({
            title: _('Method'),
            subtitle: _('Different organizations use different calculation methods'),
            model: stringList
        });

        // Set current value
        const currentMethod = settings.get_int('calculation-method');
        const currentIndex = CALCULATION_METHODS.findIndex(m => m.id === currentMethod);
        if (currentIndex >= 0) {
            methodRow.set_selected(currentIndex);
        }

        // Connect change handler
        methodRow.connect('notify::selected', () => {
            const selected = methodRow.get_selected();
            if (selected >= 0 && selected < CALCULATION_METHODS.length) {
                settings.set_int('calculation-method', CALCULATION_METHODS[selected].id);
            }
        });

        methodGroup.add(methodRow);

        // ==================== Language Group ====================
        const languageGroup = new Adw.PreferencesGroup({
            title: _('Language / Dil'),
            description: _('Select display language')
        });
        page.add(languageGroup);

        // Language options
        const LANGUAGES = [
            { id: 'tr', name: 'Türkçe' },
            { id: 'en', name: 'English' },
            { id: 'de', name: 'Deutsch' },
            { id: 'ar', name: 'العربية' }
        ];

        const languageStrings = LANGUAGES.map(l => l.name);
        const languageStringList = Gtk.StringList.new(languageStrings);

        const languageRow = new Adw.ComboRow({
            title: _('Language'),
            subtitle: _('Display language for prayer times'),
            model: languageStringList
        });

        // Set current value
        const currentLanguage = settings.get_string('language');
        const currentLangIndex = LANGUAGES.findIndex(l => l.id === currentLanguage);
        if (currentLangIndex >= 0) {
            languageRow.set_selected(currentLangIndex);
        }

        // Connect change handler
        languageRow.connect('notify::selected', () => {
            const selected = languageRow.get_selected();
            if (selected >= 0 && selected < LANGUAGES.length) {
                settings.set_string('language', LANGUAGES[selected].id);
            }
        });

        languageGroup.add(languageRow);

        // ==================== Notification Group ====================
        const notificationGroup = new Adw.PreferencesGroup({
            title: _('Notifications'),
            description: _('Configure prayer time notifications')
        });
        page.add(notificationGroup);

        // Enable notifications toggle
        const notificationsRow = new Adw.SwitchRow({
            title: _('Enable Notifications'),
            subtitle: _('Show notifications when prayer times start')
        });
        settings.bind(
            'notifications-enabled',
            notificationsRow,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        notificationGroup.add(notificationsRow);

        // Enable reminder toggle
        const reminderEnabledRow = new Adw.SwitchRow({
            title: _('Enable Reminders'),
            subtitle: _('Show reminder notifications before prayer times')
        });
        settings.bind(
            'reminder-enabled',
            reminderEnabledRow,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        notificationGroup.add(reminderEnabledRow);

        // Reminder minutes
        const reminderRow = new Adw.SpinRow({
            title: _('Reminder Time'),
            subtitle: _('Minutes before prayer time to show reminder'),
            adjustment: new Gtk.Adjustment({
                lower: 1,
                upper: 120,
                step_increment: 1,
                page_increment: 5
            })
        });
        settings.bind(
            'reminder-minutes',
            reminderRow,
            'value',
            Gio.SettingsBindFlags.DEFAULT
        );
        notificationGroup.add(reminderRow);

        // Bind reminder row sensitivity to reminder-enabled
        settings.bind(
            'reminder-enabled',
            reminderRow,
            'sensitive',
            Gio.SettingsBindFlags.DEFAULT
        );

        // ==================== About Group ====================
        const aboutGroup = new Adw.PreferencesGroup({
            title: _('About'),
            description: _('Prayer Times Extension')
        });
        page.add(aboutGroup);

        const aboutRow = new Adw.ActionRow({
            title: _('Prayer Times'),
            subtitle: _('Islamic prayer times for GNOME Shell. Data from aladhan.com API.')
        });
        aboutRow.add_suffix(new Gtk.Label({
            label: 'v1.0',
            css_classes: ['dim-label'],
            valign: Gtk.Align.CENTER
        }));
        aboutGroup.add(aboutRow);

        const apiRow = new Adw.ActionRow({
            title: _('Data Source'),
            subtitle: 'https://aladhan.com/prayer-times-api'
        });
        aboutGroup.add(apiRow);
    }
}
