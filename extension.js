/**
 * Prayer Times - GNOME Shell Extension
 * Compatible with GNOME 45+ (ESM modules)
 */

import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Soup from 'gi://Soup?version=3.0';
import St from 'gi://St';
import Clutter from 'gi://Clutter';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';

import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';

// Prayer names in multiple languages
const PRAYER_NAMES = {
    Fajr: { tr: 'İmsak', en: 'Fajr', de: 'Fadschr', ar: 'الفجر' },
    Sunrise: { tr: 'Güneş', en: 'Sunrise', de: 'Sonnenaufgang', ar: 'الشروق' },
    Dhuhr: { tr: 'Öğle', en: 'Dhuhr', de: 'Dhuhr', ar: 'الظهر' },
    Asr: { tr: 'İkindi', en: 'Asr', de: 'Asr', ar: 'العصر' },
    Maghrib: { tr: 'Akşam', en: 'Maghrib', de: 'Maghrib', ar: 'المغرب' },
    Isha: { tr: 'Yatsı', en: 'Isha', de: 'Ischa', ar: 'العشاء' }
};

// UI Labels in multiple languages
const UI_LABELS = {
    loading: { tr: 'Yükleniyor...', en: 'Loading...', de: 'Laden...', ar: 'جار التحميل...' },
    noData: { tr: 'Veri yok', en: 'No data', de: 'Keine Daten', ar: 'لا توجد بيانات' },
    error: { tr: 'Hata', en: 'Error', de: 'Fehler', ar: 'خطأ' },
    cached: { tr: 'Önbellek', en: 'Cached', de: 'Zwischengespeichert', ar: 'مخزن مؤقتا' },
    manualLocation: { tr: 'Manuel Konum', en: 'Manual Location', de: 'Manueller Standort', ar: 'الموقع اليدوي' },
    unknown: { tr: 'Bilinmiyor', en: 'Unknown', de: 'Unbekannt', ar: 'غير معروف' },
    cachedLocation: { tr: 'Önbellekli Konum', en: 'Cached Location', de: 'Zwischengespeicherter Standort', ar: 'الموقع المخزن' },
    defaultIstanbul: { tr: 'Varsayılan (İstanbul)', en: 'Default (Istanbul)', de: 'Standard (Istanbul)', ar: 'الافتراضي (اسطنبول)' },
    refresh: { tr: '🔄 Yenile', en: '🔄 Refresh', de: '🔄 Aktualisieren', ar: '🔄 تحديث' },
    settings: { tr: '⚙️ Ayarlar', en: '⚙️ Settings', de: '⚙️ Einstellungen', ar: '⚙️ الإعدادات' },
    prayerTime: { tr: 'Namaz Vakti', en: 'Prayer Time', de: 'Gebetszeit', ar: 'وقت الصلاة' },
    prayerReminder: { tr: 'Namaz Hatırlatma', en: 'Prayer Reminder', de: 'Gebetserinnerung', ar: 'تذكير الصلاة' },
    timeEntered: { tr: 'vakti girdi', en: 'time has entered', de: 'Zeit ist eingetreten', ar: 'قد حان وقت' },
    minutesRemaining: { tr: 'dakika kaldı', en: 'minutes remaining', de: 'Minuten verbleibend', ar: 'دقائق متبقية' },
    toTime: { tr: 'vaktine', en: 'until', de: 'bis', ar: 'حتى' }
};

// Date locale codes
const DATE_LOCALES = {
    tr: 'tr-TR',
    en: 'en-US',
    de: 'de-DE',
    ar: 'ar-SA'
};

// Calculation methods from Aladhan API
const CALCULATION_METHODS = {
    0: 'Shia Ithna-Ashari',
    1: 'University of Islamic Sciences, Karachi',
    2: 'Islamic Society of North America',
    3: 'Muslim World League',
    4: 'Umm Al-Qura University, Makkah',
    5: 'Egyptian General Authority of Survey',
    7: 'Institute of Geophysics, University of Tehran',
    8: 'Gulf Region',
    9: 'Kuwait',
    10: 'Qatar',
    11: 'Majlis Ugama Islam Singapura',
    12: 'Union Organization Islamic de France',
    13: 'Diyanet İşleri Başkanlığı (Turkey)',
    14: 'Spiritual Administration of Muslims of Russia',
    15: 'Moonsighting Committee Worldwide'
};

const PrayerTimesIndicator = GObject.registerClass(
    class PrayerTimesIndicator extends PanelMenu.Button {
        _init(extension) {
            super._init(0.0, 'Prayer Times');

            this._extension = extension;
            this._settings = extension.getSettings();
            this._prayerTimes = null;
            this._nextPrayer = null;
            this._timerId = null;
            this._httpSession = null;
            this._notifiedPrayers = new Set();
            this._notifiedReminders = new Set();
            this._location = null;
            this._language = this._settings.get_string('language') || 'tr';

            this._initUI();
            this._initHttpSession();
            this._connectSettings();
            this._fetchPrayerTimes();
            this._startTimer();
        }

        _initUI() {
            // Panel button layout
            this._box = new St.BoxLayout({
                style_class: 'panel-status-menu-box'
            });

            // Icon
            this._icon = new St.Icon({
                icon_name: 'preferences-system-time-symbolic',
                style_class: 'system-status-icon'
            });
            this._box.add_child(this._icon);

            // Label showing next prayer and countdown
            this._label = new St.Label({
                text: this._getLabel('loading'),
                y_align: Clutter.ActorAlign.CENTER,
                style: 'margin-left: 5px;'
            });
            this._box.add_child(this._label);

            this.add_child(this._box);

            // Popup menu header
            this._headerItem = new PopupMenu.PopupMenuItem('', { reactive: false });
            this._headerItem.label.set_style('font-weight: bold; font-size: 14px;');
            this.menu.addMenuItem(this._headerItem);

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            // Prayer time items
            this._prayerItems = {};
            for (const key of Object.keys(PRAYER_NAMES)) {
                const item = new PopupMenu.PopupMenuItem('', { reactive: false });
                this._prayerItems[key] = item;
                this.menu.addMenuItem(item);
            }

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            // Location info
            this._locationItem = new PopupMenu.PopupMenuItem('', { reactive: false });
            this._locationItem.label.set_style('font-size: 11px; color: #888;');
            this.menu.addMenuItem(this._locationItem);

            // Refresh button
            this._refreshItem = new PopupMenu.PopupMenuItem(this._getLabel('refresh'));
            this._refreshItem.connect('activate', () => this._fetchPrayerTimes());
            this.menu.addMenuItem(this._refreshItem);

            // Settings button
            this._settingsItem = new PopupMenu.PopupMenuItem(this._getLabel('settings'));
            this._settingsItem.connect('activate', () => {
                this._extension.openPreferences();
            });
            this.menu.addMenuItem(this._settingsItem);
        }

        _getLabel(key) {
            return UI_LABELS[key]?.[this._language] || UI_LABELS[key]?.en || key;
        }

        _getPrayerName(prayerKey) {
            return PRAYER_NAMES[prayerKey]?.[this._language] || PRAYER_NAMES[prayerKey]?.en || prayerKey;
        }

        _getDateLocale() {
            return DATE_LOCALES[this._language] || 'en-US';
        }

        _initHttpSession() {
            this._httpSession = new Soup.Session({
                timeout: 30
            });
        }

        _connectSettings() {
            this._settingsChangedId = this._settings.connect('changed', (settings, key) => {
                if (['auto-location', 'latitude', 'longitude', 'calculation-method'].includes(key)) {
                    this._fetchPrayerTimes();
                }
                if (key === 'language') {
                    this._language = this._settings.get_string('language') || 'tr';
                    this._updateUILabels();
                    this._updateUI();
                }
            });
        }

        _updateUILabels() {
            this._refreshItem.label.set_text(this._getLabel('refresh'));
            this._settingsItem.label.set_text(this._getLabel('settings'));
        }

        async _fetchLocation() {
            if (!this._settings.get_boolean('auto-location')) {
                return {
                    latitude: this._settings.get_double('latitude'),
                    longitude: this._settings.get_double('longitude'),
                    city: this._getLabel('manualLocation')
                };
            }

            // Try to get location from GeoIP
            try {
                const message = Soup.Message.new('GET', 'http://ip-api.com/json/');
                const bytes = await this._httpSession.send_and_read_async(
                    message,
                    GLib.PRIORITY_DEFAULT,
                    null
                );

                if (message.get_status() === Soup.Status.OK) {
                    const decoder = new TextDecoder('utf-8');
                    const text = decoder.decode(bytes.get_data());
                    const data = JSON.parse(text);

                    if (data.status === 'success') {
                        // Save detected location
                        this._settings.set_double('detected-latitude', data.lat);
                        this._settings.set_double('detected-longitude', data.lon);
                        this._settings.set_string('detected-city', data.city || '');

                        return {
                            latitude: data.lat,
                            longitude: data.lon,
                            city: data.city || this._getLabel('unknown')
                        };
                    }
                }
            } catch (e) {
                console.error('Prayer Times: GeoIP error:', e);
            }

            // Fallback to cached detected location
            const cachedLat = this._settings.get_double('detected-latitude');
            const cachedLon = this._settings.get_double('detected-longitude');

            if (cachedLat !== 0 || cachedLon !== 0) {
                return {
                    latitude: cachedLat,
                    longitude: cachedLon,
                    city: this._settings.get_string('detected-city') || this._getLabel('cachedLocation')
                };
            }

            // Final fallback to manual settings (Istanbul default)
            return {
                latitude: this._settings.get_double('latitude'),
                longitude: this._settings.get_double('longitude'),
                city: this._getLabel('defaultIstanbul')
            };
        }

        async _fetchPrayerTimes() {
            try {
                const location = await this._fetchLocation();
                const method = this._settings.get_int('calculation-method');
                const today = new Date();
                const dateStr = `${today.getDate()}-${today.getMonth() + 1}-${today.getFullYear()}`;

                const url = `https://api.aladhan.com/v1/timings/${dateStr}?latitude=${location.latitude}&longitude=${location.longitude}&method=${method}`;

                const message = Soup.Message.new('GET', url);
                const bytes = await this._httpSession.send_and_read_async(
                    message,
                    GLib.PRIORITY_DEFAULT,
                    null
                );

                if (message.get_status() === Soup.Status.OK) {
                    const decoder = new TextDecoder('utf-8');
                    const text = decoder.decode(bytes.get_data());
                    const data = JSON.parse(text);

                    if (data.code === 200 && data.data && data.data.timings) {
                        this._prayerTimes = data.data.timings;
                        this._location = location;

                        // Cache the data
                        this._settings.set_string('cached-times', JSON.stringify({
                            timings: this._prayerTimes,
                            location: location,
                            date: dateStr
                        }));
                        this._settings.set_string('last-fetch-date', dateStr);

                        // Reset notification tracking for new day
                        this._notifiedPrayers.clear();
                        this._notifiedReminders.clear();

                        this._updateUI();
                        return;
                    }
                }

                // If fetch failed, try to use cached data
                this._loadCachedData();

            } catch (e) {
                console.error('Prayer Times: Fetch error:', e);
                this._loadCachedData();
            }
        }

        _loadCachedData() {
            try {
                const cached = this._settings.get_string('cached-times');
                if (cached && cached !== '{}') {
                    const data = JSON.parse(cached);
                    this._prayerTimes = data.timings;
                    this._location = data.location;
                    this._updateUI();

                    // Show cached indicator
                    if (this._location) {
                        this._locationItem.label.set_text(
                            `📍 ${this._location.city} (${this._getLabel('cached')})`
                        );
                    }
                } else {
                    this._label.set_text(this._getLabel('noData'));
                }
            } catch (e) {
                console.error('Prayer Times: Cache error:', e);
                this._label.set_text(this._getLabel('error'));
            }
        }

        _updateUI() {
            if (!this._prayerTimes) return;

            const now = new Date();
            this._nextPrayer = this._getNextPrayer(now);

            // Update header
            const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            this._headerItem.label.set_text(now.toLocaleDateString(this._getDateLocale(), dateOptions));

            // Update prayer times in menu
            for (const [key, names] of Object.entries(PRAYER_NAMES)) {
                const time = this._prayerTimes[key];
                if (time && this._prayerItems[key]) {
                    const isNext = this._nextPrayer && this._nextPrayer.name === key;
                    const prefix = isNext ? '➤ ' : '   ';
                    const style = isNext ? 'font-weight: bold; color: #4CAF50;' : '';
                    this._prayerItems[key].label.set_text(`${prefix}${this._getPrayerName(key)}: ${time}`);
                    this._prayerItems[key].label.set_style(style);
                }
            }

            // Update location
            if (this._location) {
                this._locationItem.label.set_text(`📍 ${this._location.city}`);
            }

            // Update panel label
            this._updateCountdown();
        }

        _getNextPrayer(now) {
            const prayerOrder = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
            const nowMinutes = now.getHours() * 60 + now.getMinutes();

            for (const name of prayerOrder) {
                const time = this._prayerTimes[name];
                if (time) {
                    const [hours, minutes] = time.split(':').map(Number);
                    const prayerMinutes = hours * 60 + minutes;

                    if (prayerMinutes > nowMinutes) {
                        return {
                            name,
                            time,
                            hours,
                            minutes,
                            totalMinutes: prayerMinutes
                        };
                    }
                }
            }

            // If all prayers passed today, return Fajr for tomorrow
            const fajrTime = this._prayerTimes['Fajr'];
            if (fajrTime) {
                const [hours, minutes] = fajrTime.split(':').map(Number);
                return {
                    name: 'Fajr',
                    time: fajrTime,
                    hours,
                    minutes,
                    totalMinutes: hours * 60 + minutes,
                    tomorrow: true
                };
            }

            return null;
        }

        _updateCountdown() {
            if (!this._nextPrayer) {
                this._label.set_text('--:--');
                return;
            }

            const now = new Date();
            const nowMinutes = now.getHours() * 60 + now.getMinutes();
            const nowSeconds = now.getSeconds();

            let diffMinutes;
            if (this._nextPrayer.tomorrow) {
                // Minutes until midnight + minutes from midnight to Fajr
                diffMinutes = (24 * 60 - nowMinutes) + this._nextPrayer.totalMinutes;
            } else {
                diffMinutes = this._nextPrayer.totalMinutes - nowMinutes;
            }

            // Adjust for seconds
            let totalSeconds = diffMinutes * 60 - nowSeconds;

            // FIX: Handle negative countdown (when prayer time has passed)
            // This can happen between when getNextPrayer runs and this update
            if (totalSeconds < 0) {
                // Recalculate next prayer
                this._nextPrayer = this._getNextPrayer(now);
                if (!this._nextPrayer) {
                    this._label.set_text('--:--');
                    return;
                }
                // Recalculate with updated next prayer
                if (this._nextPrayer.tomorrow) {
                    diffMinutes = (24 * 60 - nowMinutes) + this._nextPrayer.totalMinutes;
                } else {
                    diffMinutes = this._nextPrayer.totalMinutes - nowMinutes;
                }
                totalSeconds = diffMinutes * 60 - nowSeconds;

                // Update UI for the new next prayer
                this._updateUI();
            }

            // Ensure we never show negative values
            if (totalSeconds < 0) {
                totalSeconds = 0;
            }

            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;

            const prayerName = this._getPrayerName(this._nextPrayer.name);

            let countdown;
            if (hours > 0) {
                countdown = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            } else {
                countdown = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            }

            this._label.set_text(`${prayerName} ${countdown}`);

            // Check for notifications
            this._checkNotifications(diffMinutes, this._nextPrayer.name);
        }

        _checkNotifications(minutesRemaining, prayerName) {
            if (!this._settings.get_boolean('notifications-enabled')) return;

            const reminderMinutes = this._settings.get_int('reminder-minutes');
            const reminderEnabled = this._settings.get_boolean('reminder-enabled');
            const prayerDisplayName = this._getPrayerName(prayerName);

            // On-time notification (when prayer time starts)
            if (minutesRemaining <= 0 && !this._notifiedPrayers.has(prayerName)) {
                this._showNotification(
                    this._getLabel('prayerTime'),
                    `${prayerDisplayName} ${this._getLabel('timeEntered')}`,
                    'appointment-soon-symbolic'
                );
                this._notifiedPrayers.add(prayerName);
            }

            // Reminder notification
            if (reminderEnabled &&
                minutesRemaining <= reminderMinutes &&
                minutesRemaining > 0 &&
                !this._notifiedReminders.has(prayerName)) {
                this._showNotification(
                    this._getLabel('prayerReminder'),
                    `${prayerDisplayName} ${this._getLabel('toTime')} ${Math.ceil(minutesRemaining)} ${this._getLabel('minutesRemaining')}`,
                    'alarm-symbolic'
                );
                this._notifiedReminders.add(prayerName);
            }
        }

        _showNotification(title, body, iconName) {
            try {
                const source = new MessageTray.Source({
                    title: 'Prayer Times',
                    iconName: iconName
                });

                Main.messageTray.add(source);

                const notification = new MessageTray.Notification({
                    source: source,
                    title: title,
                    body: body,
                    urgency: MessageTray.Urgency.HIGH
                });

                source.addNotification(notification);
            } catch (e) {
                console.error('Prayer Times: Notification error:', e);
            }
        }

        _startTimer() {
            // Update every second for accurate countdown
            this._timerId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
                this._updateCountdown();

                // Check if we need to fetch new data (new day)
                const now = new Date();
                const dateStr = `${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()}`;
                const lastDate = this._settings.get_string('last-fetch-date');

                if (dateStr !== lastDate) {
                    this._fetchPrayerTimes();
                }

                return GLib.SOURCE_CONTINUE;
            });
        }

        destroy() {
            if (this._timerId) {
                GLib.source_remove(this._timerId);
                this._timerId = null;
            }

            if (this._settingsChangedId) {
                this._settings.disconnect(this._settingsChangedId);
                this._settingsChangedId = null;
            }

            if (this._httpSession) {
                this._httpSession = null;
            }

            super.destroy();
        }
    });

export default class PrayerTimesTRExtension extends Extension {
    enable() {
        this._indicator = new PrayerTimesIndicator(this);
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    disable() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
    }
}
